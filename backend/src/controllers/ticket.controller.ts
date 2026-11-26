import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

import prisma from '../config/database';
import {
  lireNouveauxBilletsEmis,
  lireNouveauBilletEmisParId,
} from '../services/messayNouveauxBilletsLecture.service';

const UUID_PATTERN = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;

// Compatibilité production : les colonnes affectationId et siegeNumero peuvent
// être absentes tant que la migration Ticket n'a pas été appliquée.
// Ne pas les SELECT implicitement : l'ancien endpoint doit rester lisible.
// Cette table historique n'est PAS public.tickets (nouvelle émission).
const legacyTicketSelect = {
  id: true,
  userId: true,
  compagnie: true,
  passagerNom: true,
  passagerPrenom: true,
  telephone: true,
  email: true,
  depart: true,
  destination: true,
  gareDepart: true,
  gareArrivee: true,
  dateDepart: true,
  heureDepart: true,
  numeroBus: true,
  siege: true,
  classe: true,
  prix: true,
  methodePaiement: true,
  referencePaiement: true,
  qrCode: true,
  statut: true,
  codeValidation: true,
  dateValidation: true,
  canalVente: true,
  vendeurId: true,
  paiementId: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.TicketSelect;

/**
 * Etat d'attribution pour un billet issu de public."Ticket".
 * Un siège historique sous forme de texte n'est pas une attribution
 * rapprochée du nouvel inventaire par affectation.
 */
function withSeatAssignment<T extends {
  siege: string | null;
  siegeNumero?: number | null;
  statut: string;
}>(ticket: T): T & {
  statutAttributionSiege: 'ATTRIBUE' | 'HISTORIQUE_NON_RAPPROCHE' | 'EN_ATTENTE' | 'SANS_OBJET';
  siegeAffichage: string | null;
} {
  // La colonne siegeNumero n'est pas lue avant déploiement de la migration.
  const numero = ticket.siegeNumero;
  if (typeof numero === 'number' && Number.isInteger(numero) && numero > 0) {
    return { ...ticket, statutAttributionSiege: 'ATTRIBUE', siegeAffichage: String(numero) };
  }
  const historique = typeof ticket.siege === 'string' ? ticket.siege.trim() : '';
  if (historique) {
    return {
      ...ticket,
      statutAttributionSiege: 'HISTORIQUE_NON_RAPPROCHE',
      siegeAffichage: historique,
    };
  }
  return {
    ...ticket,
    statutAttributionSiege: ticket.statut === 'PAYE' ? 'EN_ATTENTE' : 'SANS_OBJET',
    siegeAffichage: null,
  };
}

function authenticatedUserId(req: Request): string | null {
  // req.user est posé par le middleware authenticate (JWT MESSAY vérifié).
  const id = req.user?.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function handleUnexpectedError(error: unknown, res: Response, operation: string): void {
  console.error(`[TICKETS/${operation}]`, error);

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Un billet avec les mêmes informations uniques existe déjà.' });
      return;
    }
    if (error.code === 'P2003') {
      res.status(400).json({ error: 'Une référence de ce billet est invalide.' });
      return;
    }
    if (error.code === 'P2022') {
      res.status(503).json({ error: 'Le schéma Ticket déployé ne correspond pas au client Prisma.' });
      return;
    }
  }

  res.status(500).json({ error: 'Une erreur interne est survenue lors du traitement du billet.' });
}

export class TicketController {
  async createTicket(req: Request, res: Response): Promise<void> {
    res.setHeader('Cache-Control', 'private, no-store');
    const userId = authenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Connexion requise.' });
      return;
    }

    // FAIL CLOSED : création de billets temporairement suspendue.
    // L'ancien endpoint faisait confiance au prix/siège envoyés par le mobile
    // et ne réservait pas le siège dans messay_bus_sieges_reservations.
    // Laisser ce code actif autoriserait un doublon avec MESSAY PRO.
    // Ne réactiver qu'après création d'une transaction atomique commune :
    //   1. vérifier départ, heure, compagnie et tarif côté serveur ;
    //   2. réserver le siège dans la même transaction que Ticket ;
    //   3. gérer paiement, annulation et expiration dans cette transaction.
    res.status(503).json({
      code: 'BILLETTERIE_INTERURBAINE_SUSPENDUE',
      error: 'Les nouvelles réservations interurbaines sont temporairement indisponibles.',
      paiementActif: false,
      billetEmis: false,
    });
  }

  async getUserTickets(req: Request, res: Response): Promise<void> {
    res.setHeader('Cache-Control', 'private, no-store');
    const userId = authenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Connexion requise.' });
      return;
    }

    // Limiter la taille des réponses ; paginer ultérieurement si nécessaire.
    const limitRaw = req.query.limit;
    const queryLimit = limitRaw === undefined
      ? 50
      : typeof limitRaw === 'string' && /^[1-9]\d{0,2}$/.test(limitRaw)
        ? Number(limitRaw)
        : NaN;
    if (!Number.isSafeInteger(queryLimit) || queryLimit < 1 || queryLimit > 100) {
      res.status(400).json({ error: 'limit doit être un entier de 1 à 100.' });
      return;
    }

    try {
      const tickets = await prisma.ticket.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: queryLimit,
        select: legacyTicketSelect,
      });
      // Aucun changement du parcours historique lorsque le nouveau moteur
      // n'a pas été validé. La lecture du nouveau registre est explicitement
      // activable, indépendamment des paiements et des écritures financières.
      if (process.env.MESSAY_NEW_TICKETS_READ_ENABLED !== 'true') {
        res.status(200).json({ tickets: tickets.map(withSeatAssignment) });
        return;
      }

      // L'identité vient exclusivement du JWT MESSAY authentifié. Le service
      // relie payment_intents.actor_user_id aux nouveaux billets réellement
      // émis ; jamais une comparaison supposée avec auth.users.id.
      if (!UUID_PATTERN.test(userId)) {
        res.status(403).json({ error: 'Identité MESSAY invalide.' });
        return;
      }

      const nouveaux = await lireNouveauxBilletsEmis(prisma, userId, queryLimit);
      const combined = [...tickets.map(withSeatAssignment), ...nouveaux]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, queryLimit);
      res.status(200).json({ tickets: combined });
    } catch (error: unknown) {
      // Une migration des nouveaux billets absente ou défectueuse ne doit
      // jamais être interprétée comme une liste vide ou des billets payés.
      if (process.env.MESSAY_NEW_TICKETS_READ_ENABLED === 'true') {
        console.error('[TICKETS/NEW-READ] Échec de lecture sécurisée', error);
        res.status(503).json({
          code: 'NOUVEAUX_BILLETS_LECTURE_INDISPONIBLE',
          error: 'Consultation des billets momentanément indisponible.',
        });
        return;
      }
      handleUnexpectedError(error, res, 'LIST');
    }
  }

  async getTicketById(req: Request, res: Response): Promise<void> {
    res.setHeader('Cache-Control', 'private, no-store');
    const userId = authenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Connexion requise.' });
      return;
    }

    const id = String(req.params.id ?? '');
    if (!UUID_PATTERN.test(id)) {
      res.status(400).json({ error: 'Identifiant de billet invalide.' });
      return;
    }

    try {
      const ticket = await prisma.ticket.findFirst({
        where: { id, userId },
        select: {
          ...legacyTicketSelect,
          user: {
            select: { nom: true, prenom: true, email: true, telephone: true },
          },
        },
      });
      if (!ticket) {
        // Nouveau registre interurbain : lecture autorisée
        // uniquement derrière le flag existant.
        if (process.env.MESSAY_NEW_TICKETS_READ_ENABLED === 'true') {
          if (!UUID_PATTERN.test(userId)) {
            res.status(403).json({ error: 'Identité MESSAY invalide.' });
            return;
          }

          const nouveau = await lireNouveauBilletEmisParId(
            prisma,
            userId,
            id,
          );

          if (nouveau) {
            res.status(200).json({ ticket: nouveau });
            return;
          }
        }

        res.status(404).json({ error: 'Billet introuvable.' });
        return;
      }

      res.status(200).json({ ticket: withSeatAssignment(ticket) });
    } catch (error: unknown) {
      handleUnexpectedError(error, res, 'DETAIL');
    }
  }

  /**
   * Annulation désactivée tant que Ticket et messay_bus_sieges_reservations
   * ne sont pas mis à jour atomiquement dans le même inventaire.
   * Ne jamais libérer un billet uniquement en modifiant ticket.statut.
   */
  async annulerTicket(req: Request, res: Response): Promise<void> {
    res.setHeader('Cache-Control', 'private, no-store');
    const userId = authenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Connexion requise.' });
      return;
    }

    const id = req.params.id;
    if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
      res.status(400).json({ error: 'Identifiant de billet invalide.' });
      return;
    }

    try {
      const ticket = await prisma.ticket.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!ticket) {
        res.status(404).json({ error: 'Billet introuvable.' });
        return;
      }

      // Aucun changement de statut, de siège ou de paiement.
      res.status(503).json({
        code: 'ANNULATION_BILLET_NON_RACCORDEE',
        error: 'Annulation en ligne temporairement indisponible. Contactez le support MESSAY.',
      });
    } catch (error: unknown) {
      handleUnexpectedError(error, res, 'CANCEL');
    }
  }
}
