/**
 * MESSAY — Contrôleur de paiements (lecture sécurisée, encaissement désactivé).
 *
 * Cette version conserve les méthodes publiques utilisées par paiement.routes.ts.
 * Le statut enregistré en base NE constitue PAS une preuve de paiement fournisseur.
 * Aucun billet, reçu ni paiement n'est créé par ce contrôleur.
 *
 * IMPORTANT : ces routes sont partagées. Ne pas activer la création avant d'avoir
 * validé les flux tricycle et billetterie avec leurs réservations et tarifs serveur.
 */
import type { Request, Response } from 'express';
import prisma from '../config/database';

const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const LIMIT_PATTERN = /^(?:[1-9]|[1-9][0-9]|100)$/;

/** Ne jamais prendre l'identité dans le body, les query params ou une URL. */
function requireUser(req: Request, res: Response): string | null {
  const userId = req.user?.id;
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    res.status(401).json({
      code: 'AUTHENTIFICATION_REQUISE',
      error: 'Connexion requise.',
    });
    return null;
  }
  return userId;
}

function requirePaymentId(req: Request, res: Response): string | null {
  const id = req.params.id;
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
    res.status(400).json({
      code: 'PAIEMENT_ID_INVALIDE',
      error: 'Identifiant de paiement invalide.',
    });
    return null;
  }
  return id;
}

/** Refuser aussi les tableaux/objets et les valeurs telles que 1.5 ou 0. */
function readLimit(req: Request, res: Response): number | null {
  const raw = req.query.limit;
  if (raw === undefined) return 50;
  if (typeof raw !== 'string' || !LIMIT_PATTERN.test(raw.trim())) {
    res.status(400).json({
      code: 'LIMITE_INVALIDE',
      error: 'limit doit être un entier entre 1 et 100.',
    });
    return null;
  }
  return Number(raw.trim());
}

function setPrivateHeaders(res: Response): void {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.vary('Authorization');
}

function serverError(error: unknown, operation: string, res: Response): void {
  // Ne pas divulguer les détails Prisma, les jetons ou les données sensibles.
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code ?? 'UNKNOWN')
    : 'UNKNOWN';
  console.error(`[MESSAY/PAIEMENTS/${operation}]`, { code });
  if (!res.headersSent) {
    res.status(500).json({
      code: 'PAIEMENT_ERREUR_SERVEUR',
      error: 'Erreur interne pendant le traitement de la demande.',
    });
  }
}

export class PaiementController {
  /** POST /api/paiements — bloqué jusqu'au raccordement financier complet. */
  async createPaiement(req: Request, res: Response): Promise<void> {
    setPrivateHeaders(res);
    if (!requireUser(req, res)) return;

    // Ne pas créer de ligne EN_ATTENTE ici : l'origine du montant, le départ,
    // le stock disponible et la session fournisseur ne sont pas encore reliés.
    res.status(503).json({
      code: 'PAIEMENT_NON_RACCORDE',
      error: 'Paiement temporairement indisponible : la réservation et la vérification du prestataire ne sont pas encore raccordées.',
    });
  }

  /** GET /api/paiements — historique privé, lecture seule. */
  async getHistorique(req: Request, res: Response): Promise<void> {
    setPrivateHeaders(res);
    const userId = requireUser(req, res);
    if (!userId) return;
    const limit = readLimit(req, res);
    if (limit === null) return;

    try {
      const paiements = await prisma.paiement.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        // Préserver le contrat de réponse utilisé par le mobile existant.
        // Le détail utilisateur n'est accessible qu'au propriétaire du paiement.
        include: {
          user: {
            select: { nom: true, prenom: true, email: true, telephone: true },
          },
        },
      });

      res.status(200).json({
        paiements,
        source: 'BASE_DE_DONNEES',
        verification_fournisseur: false,
      });
    } catch (error: unknown) {
      serverError(error, 'HISTORIQUE', res);
    }
  }

  /** GET /api/paiements/:id — détail privé, pas de confirmation financière. */
  async getPaiementById(req: Request, res: Response): Promise<void> {
    setPrivateHeaders(res);
    const userId = requireUser(req, res);
    if (!userId) return;
    const id = requirePaymentId(req, res);
    if (!id) return;

    try {
      const paiement = await prisma.paiement.findFirst({
        where: { id, userId },
        include: {
          user: {
            select: { nom: true, prenom: true, email: true, telephone: true },
          },
        },
      });

      if (!paiement) {
        res.status(404).json({ code: 'PAIEMENT_INTROUVABLE', error: 'Paiement introuvable.' });
        return;
      }

      res.status(200).json({
        paiement,
        source: 'BASE_DE_DONNEES',
        verification_fournisseur: false,
      });
    } catch (error: unknown) {
      serverError(error, 'DETAIL', res);
    }
  }

  /** GET /api/paiements/:id/recu — reçu désactivé sans preuve certifiée. */
  async downloadRecu(req: Request, res: Response): Promise<void> {
    setPrivateHeaders(res);
    const userId = requireUser(req, res);
    if (!userId) return;
    const id = requirePaymentId(req, res);
    if (!id) return;

    try {
      const paiement = await prisma.paiement.findFirst({
        where: { id, userId, statut: 'REUSSI' },
        select: { id: true },
      });

      if (!paiement) {
        res.status(404).json({
          code: 'RECU_INTROUVABLE',
          error: 'Aucun paiement réussi disponible pour ce reçu.',
        });
        return;
      }

      // REUSSI peut provenir d'un historique antérieur : ne pas en déduire
      // un encaissement effectif sans réconciliation avec le prestataire.
      res.status(503).json({
        code: 'RECU_NON_RACCORDE',
        error: 'Reçu indisponible : la preuve de paiement du prestataire doit être vérifiée.',
      });
    } catch (error: unknown) {
      serverError(error, 'RECU', res);
    }
  }

  /**
   * POST /api/paiements/:id/verify — simple lecture du statut interne.
   * N'appelle PAS le prestataire et ne change JAMAIS le statut du paiement.
   */
  async verifyPaiement(req: Request, res: Response): Promise<void> {
    setPrivateHeaders(res);
    const userId = requireUser(req, res);
    if (!userId) return;
    const id = requirePaymentId(req, res);
    if (!id) return;

    try {
      const paiement = await prisma.paiement.findFirst({
        where: { id, userId },
        select: { statut: true, transactionId: true },
      });

      if (!paiement) {
        res.status(404).json({ code: 'PAIEMENT_INTROUVABLE', error: 'Paiement introuvable.' });
        return;
      }

      res.status(200).json({
        statut: paiement.statut,
        transactionId: paiement.transactionId,
        source: 'BASE_DE_DONNEES',
        verification_fournisseur: false,
        message: 'Statut interne uniquement ; ne constitue pas une preuve de paiement.',
      });
    } catch (error: unknown) {
      serverError(error, 'VERIFICATION', res);
    }
  }
}
