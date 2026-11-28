/**
 * MESSAY — intentions, initiation et lecture sécurisée du statut GeniusPay.
 * Désactivé par défaut. N'activer que suite à certification intégrale en production.
 * Aucune finalisation ni attribution de siège depuis l'API passager.
 */
import { Router, type Request, type Response, type RequestHandler } from 'express';
import { authenticate } from '../middleware/auth';
import { getGeniusPayInboxProductionClient } from '../services/messayGeniusPayInboxProduction.client';
import { creerIntentionTarifInterurbain } from '../services/messayInterurbainTarifIntent.service';
import { reclamerCheckoutExclusif, enregistrerCheckoutVerifie, signalerCheckoutIncertain } from '../services/interurbainCheckoutClaim.service';
import { createGeniusPayLiveCheckout } from '../services/geniuspay.live.gateway';

export const interurbainPaiementProductionRouter = Router();
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const allowedBody = (body: unknown, keys: readonly string[]): body is Record<string, unknown> =>
  body !== null && typeof body === 'object' && !Array.isArray(body) &&
  Object.keys(body).every(k => keys.includes(k));
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

const paymentNotReady: RequestHandler = (_req, res) => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.vary('Authorization');
  res.status(503).json({
    code: 'PAIEMENTS_INTERURBAINS_NON_ACTIFS',
    message: 'Le paiement des billets interurbains est temporairement indisponible.',
    paiement_confirme: false, billet_emis: false, siege_attribue: false,
  });
};

/** Verrou additionnel indépendant des flags serveur et du fournisseur. */
const requireCertifiedHttp: RequestHandler = (req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.vary('Authorization');
  if (process.env.NODE_ENV !== 'production' ||
      process.env.MESSAY_GENIUSPAY_HTTP_ROUTES_ENABLED !== 'true' ||
      process.env.MESSAY_LIVE_PAYMENT_BACKEND_READY !== 'true' ||
      process.env.MESSAY_PROD_RESERVATIONS_ENABLED !== 'true' ||
      process.env.MESSAY_LIVE_CHECKOUT_ENABLED !== 'true' ||
      process.env.MESSAY_GENIUSPAY_INBOX_ENABLED !== 'true' ||
      process.env.MESSAY_GENIUSPAY_RECONCILIATION_ENABLED !== 'true' ||
      process.env.MESSAY_GENIUSPAY_WORKER_ENABLED !== 'true' ||
      process.env.MESSAY_GENIUSPAY_ORCHESTRATION_ENABLED !== 'true' ||
      process.env.MESSAY_GENIUSPAY_REFERENCE_RECOVERY_WORKER_ENABLED !== 'true') {
    paymentNotReady(req, res, next);
    return;
  }
  next();
};

const requireActorAndJson = (req: Request, res: Response): string | null => {
  const actor: unknown = req.userId;
  if (!isUuid(actor)) {
    res.status(401).json({ code: 'IDENTITE_NON_VERIFIEE' }); return null;
  }
  if (!req.is('application/json')) {
    res.status(415).json({ code: 'CONTENT_TYPE_INVALIDE' }); return null;
  }
  return actor;
};

interurbainPaiementProductionRouter.post(
  '/mobile/paiement-intent', authenticate, requireCertifiedHttp,
  async (req: Request, res: Response): Promise<void> => {
    const actorId = requireActorAndJson(req, res);
    if (!actorId) return;
    if (!allowedBody(req.body, ['reservation_id', 'passenger_name', 'passenger_phone']) ||
        !isUuid(req.body.reservation_id) ||
        typeof req.body.passenger_name !== 'string' ||
        typeof req.body.passenger_phone !== 'string') {
      res.status(400).json({ code: 'PARAMETRES_INVALIDES' }); return;
    }
    const db = getGeniusPayInboxProductionClient();
    if (!db) { paymentNotReady(req, res, () => undefined); return; }
    try {
      const intent = await creerIntentionTarifInterurbain(db, {
        holdId: req.body.reservation_id,
        actorId,
        passengerName: req.body.passenger_name,
        passengerPhone: req.body.passenger_phone,
      });
      res.status(200).json({
        intent_id: intent.intent_id,
        amount_xof: intent.amount_xof,
        currency: 'XOF',
        hold_expires_at: intent.hold_expires_at,
        checkout_state: intent.checkout_state,
        paiement_confirme: false,
        billet_emis: false,
        siege_attribue: false,
      });
    } catch (error: unknown) {
      const code = error instanceof Error ? error.message : '';
      const invalid = code === 'MESSAY_TARIF_IDS_INVALIDES' || code === 'MESSAY_PASSAGER_INVALIDE';
      const conflict = code.startsWith('MESSAY_TARIF_RPC_REFUSEE:') &&
        /:(P0001|P0002|23505|23503)$/.test(code);
      // Ne pas exposer les messages SQL au mobile.
      res.status(invalid ? 400 : conflict ? 409 : 503).json({
        code: invalid ? 'PARAMETRES_INVALIDES' : conflict ? 'INTENTION_REFUSEE' : 'INTENTION_INDISPONIBLE',
        paiement_confirme: false, billet_emis: false,
      });
    }
  },
);

interurbainPaiementProductionRouter.post(
  '/mobile/geniuspay-checkout', authenticate, requireCertifiedHttp,
  async (req: Request, res: Response): Promise<void> => {
    const actorId = requireActorAndJson(req, res);
    if (!actorId) return;
    if (!allowedBody(req.body, ['intent_id']) || !isUuid(req.body.intent_id)) {
      res.status(400).json({ code: 'PARAMETRES_INVALIDES' }); return;
    }
    const db = getGeniusPayInboxProductionClient();
    if (!db) { paymentNotReady(req, res, () => undefined); return; }
    let claimed: Awaited<ReturnType<typeof reclamerCheckoutExclusif>>;
    try {
      claimed = await reclamerCheckoutExclusif(db, req.body.intent_id, actorId);
    } catch {
      // L'intention peut déjà être CLAIMED/READY/RECONCILE : ne pas refaire de POST.
      res.status(409).json({ code: 'CHECKOUT_NON_RECLAMABLE', paiement_confirme: false });
      return;
    }
    try {
      // Uniquement après claim SQL exclusif; le montant et company_id viennent du serveur.
      const session = await createGeniusPayLiveCheckout({
        intentId: claimed.intent_id,
        companyId: claimed.company_id,
        amountXof: claimed.amount_xof,
      });
      const saved = await enregistrerCheckoutVerifie(db, claimed, actorId, session);
      if (saved.checkout_state !== 'READY') {
        res.status(202).json({ code: 'CHECKOUT_A_RAPPROCHER', paiement_confirme: false });
        return;
      }
      res.status(200).json({
        intent_id: claimed.intent_id,
        checkout_url: session.checkoutUrl,
        provider_reference: session.reference,
        amount_xof: claimed.amount_xof,
        currency: 'XOF',
        paiement_confirme: false, billet_emis: false, siege_attribue: false,
      });
    } catch {
      // Timeout, rejet ou écriture incertaine => ne jamais réinitier automatiquement.
      try {
        await signalerCheckoutIncertain(db, claimed.intent_id, actorId);
      } catch {
        // La réconciliation devra être traitée manuellement si la RPC échoue.
      }
      res.status(202).json({ code: 'CHECKOUT_A_RAPPROCHER', paiement_confirme: false, billet_emis: false });
    }
  },
);

// Pas de contournement par l'ancien endpoint. Le mobile ne finalise aucun paiement.
interurbainPaiementProductionRouter.post('/mobile/checkout', authenticate, paymentNotReady);
/**
 * Consultation uniquement : le client ne peut ni confirmer un paiement
 * ni déclencher le GET marchand ni appeler le RPC de finalisation.
 * La lecture utilise l'identité JWT, jamais un actor_id fourni par le client.
 * En dev, requireCertifiedHttp refuse 503 sans accès à la base LIVE.
 */
interurbainPaiementProductionRouter.post(
  '/mobile/geniuspay-status', authenticate, requireCertifiedHttp,
  async (req: Request, res: Response): Promise<void> => {
    const actorId = requireActorAndJson(req, res);
    if (!actorId) return;
    if (!allowedBody(req.body, ['intent_id']) || !isUuid(req.body.intent_id)) {
      res.status(400).json({ code: 'PARAMETRES_INVALIDES' });
      return;
    }

    const db = getGeniusPayInboxProductionClient();
    if (!db) {
      paymentNotReady(req, res, () => undefined);
      return;
    }

    try {
      const { data: intent, error } = await db
        .from('messay_interurbain_payment_intents')
        .select('id,actor_user_id,company_id,hold_id,affectation_id,amount_xof,checkout_state,financial_status,issuance_status,ticket_id')
        .eq('id', req.body.intent_id)
        .eq('actor_user_id', actorId)
        .maybeSingle();

      if (error) throw new Error('MESSAY_STATUT_INTENT_DB');
      // Ne jamais révéler l'existence d'une intention appartenant à autrui.
      if (!intent) {
        res.status(404).json({ code: 'INTENTION_INTROUVABLE' });
        return;
      }
      if (intent.id !== req.body.intent_id || intent.actor_user_id !== actorId ||
          !isUuid(intent.company_id) || !isUuid(intent.hold_id) ||
          !isUuid(intent.affectation_id) ||
          !Number.isSafeInteger(intent.amount_xof) ||
          intent.amount_xof < 200 || intent.amount_xof > 2_500_000 ||
          !['NEW', 'CLAIMED', 'READY', 'RECONCILE', 'FAILED'].includes(intent.checkout_state) ||
          !['PENDING', 'SUCCEEDED', 'FAILED', 'REVIEW', 'REFUNDED'].includes(intent.financial_status) ||
          !['NOT_ISSUED', 'ISSUED', 'RECONCILE'].includes(intent.issuance_status)) {
        throw new Error('MESSAY_STATUT_INTENT_INCOHERENT');
      }

      const paymentConfirmed = intent.financial_status === 'SUCCEEDED';
      const ticketIssued = intent.issuance_status === 'ISSUED';
      let ticketId: string | null = null;

      if (ticketIssued) {
        if (!paymentConfirmed || !isUuid(intent.ticket_id)) {
          throw new Error('MESSAY_STATUT_BILLET_INCOHERENT');
        }
        // Le ticket doit être réel, payé et lié à la même compagnie,
        // intention, affectation, réservation et montant.
        const { data: ticket, error: ticketError } = await db
          .from('tickets')
          .select('id,intent_id,company_id,affectation_id,hold_id,price_paid,status')
          .eq('id', intent.ticket_id)
          .eq('intent_id', intent.id)
          .eq('company_id', intent.company_id)
          .eq('affectation_id', intent.affectation_id)
          .eq('hold_id', intent.hold_id)
          .maybeSingle();

        if (ticketError || !ticket || ticket.id !== intent.ticket_id ||
            ticket.status !== 'PAYE' || ticket.price_paid !== intent.amount_xof) {
          throw new Error('MESSAY_STATUT_BILLET_INCOHERENT');
        }
        ticketId = ticket.id;
      } else if (intent.ticket_id !== null) {
        // Un lien vers un billet sans état ISSUED impose une revue serveur.
        throw new Error('MESSAY_STATUT_TICKET_INATTENDU');
      }

      res.status(200).json({
        intent_id: intent.id,
        amount_xof: intent.amount_xof,
        currency: 'XOF',
        checkout_state: intent.checkout_state,
        financial_status: intent.financial_status,
        issuance_status: intent.issuance_status,
        paiement_confirme: paymentConfirmed,
        billet_emis: ticketIssued,
        billet_id: ticketId,
        siege_attribue: false,
        statut_attribution_siege: ticketIssued ? 'EN_ATTENTE' : null,
        message: ticketIssued
          ? 'Billet confirmé. Siège en attente d’attribution.'
          : paymentConfirmed
            ? 'Paiement reçu. Émission du billet en cours de vérification.'
            : intent.financial_status === 'REVIEW' || intent.issuance_status === 'RECONCILE'
              ? 'Paiement en cours de rapprochement. Contactez le support si nécessaire.'
              : 'Paiement non confirmé.',
      });
    } catch {
      // Aucun statut issu d'une erreur SQL ou d'une réponse incohérente
      // ne doit être présenté comme une confirmation de paiement.
      res.status(503).json({
        code: 'STATUT_PAIEMENT_INDISPONIBLE',
        paiement_confirme: false,
        billet_emis: false,
        siege_attribue: false,
      });
    }
  },
);
