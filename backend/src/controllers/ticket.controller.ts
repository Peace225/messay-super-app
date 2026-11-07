import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

import prisma from '../config/database';

const UUID_PATTERN = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;

// IMPORTANT : tant que la migration Ticket n'est pas appliquée,
// ne jamais effectuer de SELECT implicite de toutes les colonnes.
// Prisma Client a déjà été généré avec affectationId/siegeNumero,
// mais PostgreSQL Production ne possède pas encore ces colonnes.
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
    const userId = authenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Connexion requise.' });
      return;
    }

    // Limiter la taille des réponses ; paginer ultérieurement si nécessaire.
    const queryLimit = typeof req.query.limit === 'string'
      ? Number(req.query.limit)
      : 50;
    if (!Number.isInteger(queryLimit) || queryLimit < 1 || queryLimit > 100) {
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
      res.status(200).json({ tickets });
    } catch (error: unknown) {
      handleUnexpectedError(error, res, 'LIST');
    }
  }

  async getTicketById(req: Request, res: Response): Promise<void> {
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
        res.status(404).json({ error: 'Billet introuvable.' });
        return;
      }
      res.status(200).json({ ticket });
    } catch (error: unknown) {
      handleUnexpectedError(error, res, 'DETAIL');
    }
  }

  async annulerTicket(req: Request, res: Response): Promise<void> {
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
          id: true, statut: true,
          paiementId: true, referencePaiement: true,
        },
      });
      if (!ticket) {
        res.status(404).json({ error: 'Billet introuvable.' });
        return;
      }

      // Les billets payés, utilisés ou déjà annulés nécessitent une autre
      // procédure métier (remboursement/validation), pas un simple changement d'état.
      if (ticket.statut !== 'RESERVE' || ticket.paiementId || ticket.referencePaiement) {
        res.status(409).json({
          error: 'Annulation directe impossible pour ce billet. Contactez le support si un paiement a été effectué.',
        });
        return;
      }

      // Mise à jour conditionnelle : ne pas annuler une réservation dont
      // le statut ou le paiement auraient changé pendant la requête.
      const updated = await prisma.ticket.updateMany({
        where: {
          id,
          userId,
          statut: 'RESERVE',
          paiementId: null,
          referencePaiement: null,
        },
        data: { statut: 'ANNULE' },
      });

      if (updated.count !== 1) {
        res.status(409).json({ error: 'Le billet a changé de statut. Veuillez actualiser.' });
        return;
      }

      const ticketUpdated = await prisma.ticket.findUnique({
        where: { id },
        select: legacyTicketSelect,
      });
      res.status(200).json({ ticket: ticketUpdated });
    } catch (error: unknown) {
      handleUnexpectedError(error, res, 'CANCEL');
    }
  }
}
