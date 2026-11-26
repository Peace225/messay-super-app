/**
 * MESSAY — points d'entrée du paiement interurbain.
 *
 * Les endpoints restent fermés tant que le cycle complet n'est pas validé :
 * intention et montant calculés en base, réservation de capacité,
 * initialisation GeniusPay LIVE idempotente, webhook signé, rapprochement,
 * émission atomique d'un billet unique et traitement des paiements tardifs.
 *
 * Ne pas activer un checkout en appelant directement GeniusPay depuis ce routeur.
 */
import { Router, type RequestHandler } from 'express';
import { authenticate } from '../middleware/auth';

export const interurbainPaiementProductionRouter = Router();

/**
 * Réponse explicite pour l'application mobile : jamais de fausse confirmation.
 * L'authentification précède ce middleware (un visiteur anonyme reçoit 401).
 */
const paymentNotReady: RequestHandler = (_req, res) => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.vary('Authorization');

  res.status(503).json({
    code: 'PAIEMENTS_INTERURBAINS_NON_ACTIFS',
    message: 'Le paiement des billets interurbains est temporairement indisponible.',
    paiement_confirme: false,
    billet_emis: false,
    siege_attribue: false,
  });
};

// Un seul contrat de sécurité pour tous les points d'entrée historiques et
// GeniusPay. Aucun montant, statut ou numéro de siège fourni par le mobile
// n'est utilisé pour créer une transaction ou émettre un billet.
const paymentPaths = [
  '/mobile/checkout',
  '/mobile/paiement-intent',
  '/mobile/geniuspay-checkout',
  '/mobile/geniuspay-status',
] as const;

for (const path of paymentPaths) {
  interurbainPaiementProductionRouter.post(
    path,
    authenticate,
    paymentNotReady,
  );
}

// Le webhook sera une route distincte, sans JWT passager : signature vérifiée
// sur le corps brut (express.raw AVANT express.json), anti-rejeu et traitement
// transactionnel idempotent. Jamais de validation financière depuis le mobile.
