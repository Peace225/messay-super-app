import { Router, type Request, type Response, type RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { createGeniusPayCheckout } from '../services/geniuspay.gateway';
import prisma from '../config/database';
import { authenticate } from '../middleware/auth';

export const interurbainLocalStagingRouter = Router();

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

const LOCAL_DB =
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres?schema=public';

function stagingAutorise(): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    process.env.MESSAY_LOCAL_CHECKOUT_ENABLED === 'true' &&
    process.env.DATABASE_URL === LOCAL_DB &&
    process.env.DIRECT_URL === LOCAL_DB
  );
}

const protectionStaging: RequestHandler = (_req, res, next) => {
  if (!stagingAutorise()) {
    res.status(503).json({
      code: 'CHECKOUT_STAGING_DESACTIVE',
      message: 'Checkout local non autorisé.',
    });
    return;
  }

  next();
};

type CheckoutRow = {
  checkout_id: string;
  reservation_id: string;
  montant_xof: number;
  expire_le: Date;
  statut: string;
};

interurbainLocalStagingRouter.post(
  '/mobile/checkout-staging',
  protectionStaging,
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.vary('Authorization');

    const acteur = req.user?.id;

    if (typeof acteur !== 'string' || !UUID.test(acteur)) {
      res.status(401).json({
        code: 'UTILISATEUR_INVALIDE',
        message: 'Identité du passager non vérifiée.',
      });
      return;
    }

    const body: unknown = req.body;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({
        code: 'REQUETE_INVALIDE',
      });
      return;
    }

    const input = body as Record<string, unknown>;
    const affectationId = input.affectation_id;
    const requestId = input.request_id;

    if (
      typeof affectationId !== 'string' ||
      !UUID.test(affectationId) ||
      typeof requestId !== 'string' ||
      !UUID.test(requestId)
    ) {
      res.status(400).json({
        code: 'UUID_INVALIDE',
        message: 'affectation_id et request_id sont obligatoires.',
      });
      return;
    }

    try {
      const lignes = await prisma.$queryRaw<CheckoutRow[]>`
        SELECT
          c.checkout_id,
          c.reservation_id,
          c.montant_xof,
          c.expire_le,
          c.statut
        FROM public.messay_mobile_preparer_checkout(
          ${affectationId}::uuid,
          ${acteur}::uuid,
          ${requestId}::uuid
        ) AS c
      `;

      const checkout = lignes[0];

      if (
        !checkout ||
        !UUID.test(checkout.checkout_id) ||
        !UUID.test(checkout.reservation_id) ||
        !Number.isSafeInteger(checkout.montant_xof) ||
        checkout.montant_xof <= 0 ||
        !(checkout.expire_le instanceof Date) ||
        Number.isNaN(checkout.expire_le.getTime()) ||
        checkout.statut !== 'EN_ATTENTE_PAIEMENT'
      ) {
        res.status(503).json({
          code: 'CHECKOUT_INVALIDE',
          message: 'Commande non confirmée par PostgreSQL.',
        });
        return;
      }

      res.status(201).json({
        checkout_id: checkout.checkout_id,
        reservation_id: checkout.reservation_id,
        montant_xof: checkout.montant_xof,
        devise: 'XOF',
        expire_le: checkout.expire_le.toISOString(),
        statut: checkout.statut,
        siege: null,
        paiement_actif: false,
        billet_emis: false,
        environnement: 'STAGING_LOCAL',
      });
    } catch (error: unknown) {
      let code = 'UNKNOWN';

      if (
        error instanceof Prisma.PrismaClientKnownRequestError
      ) {
        const pgCode = error.meta?.code;
        code = typeof pgCode === 'string' ? pgCode : error.code;
      }

      console.error('[MESSAY/LOCAL/CHECKOUT]', { code });

      const status =
        code === 'P0002' ? 404 :
        code === 'P0001' || code === '23505' ? 409 :
        code === '22023' ? 400 :
        code === '42501' ? 403 : 503;

      res.status(status).json({
        code: 'CHECKOUT_NON_DISPONIBLE',
        message: 'Départ indisponible ou réservation impossible.',
      });
    }
  },
);

// ------------------------------------------------------------
// MESSAY — Préparation du paiement, STAGING LOCAL UNIQUEMENT.
// Aucun appel fournisseur, aucun encaissement, aucun billet.
// ------------------------------------------------------------

type PaiementIntentRow = {
  intent_id: string;
  merchant_transaction_id: string;
  montant_xof: number;
  devise: string;
  statut: string;
};

interurbainLocalStagingRouter.post(
  '/mobile/paiement-intent-staging',
  protectionStaging,
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.vary('Authorization');

    const acteur = req.user?.id;

    if (typeof acteur !== 'string' || !UUID.test(acteur)) {
      res.status(401).json({
        code: 'AUTHENTIFICATION_REQUISE',
      });
      return;
    }

    const input: unknown = req.body;

    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input)
    ) {
      res.status(400).json({
        code: 'REQUETE_INVALIDE',
      });
      return;
    }

    const body = input as Record<string, unknown>;
    const checkoutId = body.checkout_id;

    if (
      Object.keys(body).some(key => key !== 'checkout_id') ||
      typeof checkoutId !== 'string' ||
      !UUID.test(checkoutId)
    ) {
      res.status(400).json({
        code: 'CHECKOUT_ID_INVALIDE',
      });
      return;
    }

    try {
      const lignes = await prisma.$queryRaw<PaiementIntentRow[]>`
        SELECT
          i.intent_id,
          i.merchant_transaction_id,
          i.montant_xof,
          i.devise,
          i.statut
        FROM public.messay_mobile_preparer_paiement(
          ${checkoutId}::uuid,
          ${acteur}::uuid
        ) AS i
      `;

      const intent = lignes[0];

      if (
        !intent ||
        !UUID.test(intent.intent_id) ||
        !/^[A-Za-z0-9-]{1,30}$/.test(
          intent.merchant_transaction_id
        ) ||
        !Number.isSafeInteger(intent.montant_xof) ||
        intent.montant_xof < 100 ||
        intent.montant_xof > 2500000 ||
        intent.devise !== 'XOF' ||
        intent.statut !== 'PREPARE'
      ) {
        res.status(503).json({
          code: 'INTENTION_NON_DISPONIBLE',
        });
        return;
      }

      res.status(201).json({
        intent_id: intent.intent_id,
        merchant_transaction_id:
          intent.merchant_transaction_id,
        montant_xof: intent.montant_xof,
        devise: 'XOF',
        statut: 'PREPARE',
        paiement_actif: false,
        billet_emis: false,
        environnement: 'STAGING_LOCAL',
      });

    } catch (error: unknown) {
      let code = 'UNKNOWN';

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        const pgCode = error.meta?.code;
        code = typeof pgCode === 'string'
          ? pgCode
          : error.code;
      }

      console.error('[MESSAY/STAGING/PAIEMENT]', { code });

      const status =
        code === 'P0002' ? 404 :
        code === 'P0001' || code === '23505' ? 409 :
        code === '22023' ? 400 :
        code === '42501' ? 403 : 503;

      res.status(status).json({
        code: 'PREPARATION_PAIEMENT_REFUSEE',
        message: 'Checkout indisponible ou expiré.',
      });
    }
  }
);


// MESSAY — Initialisation GeniusPay, SANDBOX LOCAL UNIQUEMENT.
type GeniusPayClaimRow = {
  intent_id: string;
  company_id: string;
  montant_xof: number;
};

type GeniusPayExistingRow = {
  statut: string;
  provider_transaction_id: string | null;
  checkout_url: string | null;
  checkout_expire_le: Date;
  reservation_expire_le: Date;
};

const GENIUSPAY_LOCAL_DB =
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres?schema=public';

const GENIUSPAY_UUID =
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

interurbainLocalStagingRouter.post(
  '/mobile/geniuspay-checkout-staging',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const remote = req.socket.remoteAddress ?? '';

    const localAllowed =
      process.env.NODE_ENV === 'development' &&
      process.env.MESSAY_LOCAL_CHECKOUT_ENABLED === 'true' &&
      process.env.GENIUSPAY_SANDBOX_ENABLED === 'true' &&
      process.env.DATABASE_URL === GENIUSPAY_LOCAL_DB &&
      process.env.DIRECT_URL === GENIUSPAY_LOCAL_DB &&
      process.env.GENIUSPAY_API_KEY?.startsWith('pk_sandbox_') === true &&
      process.env.GENIUSPAY_API_SECRET?.startsWith('sk_sandbox_') === true &&
      ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote);

    if (!localAllowed) {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }

    const actor = req.user?.id;
    const intentId: unknown = req.body?.intent_id;

    if (
      typeof actor !== 'string' ||
      !GENIUSPAY_UUID.test(actor)
    ) {
      res.status(401).json({ code: 'UNAUTHORIZED' });
      return;
    }

    if (
      typeof intentId !== 'string' ||
      !GENIUSPAY_UUID.test(intentId)
    ) {
      res.status(400).json({ code: 'INVALID_INTENT_ID' });
      return;
    }

    let claimed = false;

    try {
      // Le verrou est acquis et commité AVANT l'appel externe.
      const claims = await prisma.$queryRaw<GeniusPayClaimRow[]>`
        SELECT *
        FROM public.messay_mobile_reclamer_geniuspay(
          ${intentId}::uuid,
          ${actor}::uuid
        )
      `;

      if (claims.length === 0) {
        // Reprise idempotente : ne crée jamais une deuxième session.
        const existing = await prisma.$queryRaw<GeniusPayExistingRow[]>`
          SELECT
            i.statut,
            i.provider_transaction_id,
            i.checkout_url,
            c.expire_le AS checkout_expire_le,
            r.expire_le AS reservation_expire_le
          FROM public.messay_bus_paiement_intents i
          JOIN public.messay_bus_checkouts c
            ON c.id = i.checkout_id
           AND c.company_id = i.company_id
           AND c.actor_user_id = i.actor_user_id
          JOIN public.messay_bus_sieges_reservations r
            ON r.id = c.reservation_id
           AND r.company_id = i.company_id
           AND r.actor_user_id = i.actor_user_id
          WHERE i.id = ${intentId}::uuid
            AND i.actor_user_id = ${actor}::uuid
        `;

        const current = existing[0];

        if (
          current?.statut === 'EN_ATTENTE' &&
          current.checkout_url &&
          current.provider_transaction_id &&
          new Date(current.checkout_expire_le).getTime() > Date.now() &&
          new Date(current.reservation_expire_le).getTime() > Date.now()
        ) {
          const url = new URL(current.checkout_url);

          if (
            url.origin !== 'https://geniuspay.ci' ||
            !/^\/checkout\/[A-Za-z0-9_-]+$/.test(url.pathname)
          ) {
            res.status(409).json({
              code: 'SESSION_INVALIDE_A_RAPPROCHER',
            });
            return;
          }

          res.status(200).json({
            provider: 'GENIUSPAY',
            environment: 'sandbox',
            intent_id: intentId,
            reference: current.provider_transaction_id,
            checkout_url: current.checkout_url,
          });
          return;
        }

        res.status(202).json({
          code: 'PAIEMENT_A_RAPPROCHER',
          message: 'Aucune nouvelle initialisation autorisée.',
        });
        return;
      }

      if (claims.length !== 1) {
        res.status(409).json({ code: 'CLAIM_INCOHERENT' });
        return;
      }

      claimed = true;
      const claim = claims[0];

      // Le montant vient exclusivement du checkout PostgreSQL.
      const session = await createGeniusPayCheckout({
        intentId: claim.intent_id,
        companyId: claim.company_id,
        amountXof: claim.montant_xof,
      });

      const saved = await prisma.$queryRaw<Array<{ statut: string }>>`
        SELECT public.messay_mobile_enregistrer_geniuspay(
          ${claim.intent_id}::uuid,
          ${actor}::uuid,
          ${session.reference},
          ${session.checkoutUrl},
          ${session.amountXof}
        ) AS statut
      `;

      // L'expiration est revérifiée par PostgreSQL au moment
      // d'enregistrer la session GeniusPay.
      if (saved[0]?.statut !== 'EN_ATTENTE') {
        res.status(202).json({
          code: 'PAIEMENT_A_RAPPROCHER',
          message: 'Réservation expirée ou état incertain.',
        });
        return;
      }

      res.status(201).json({
        provider: 'GENIUSPAY',
        environment: 'sandbox',
        intent_id: claim.intent_id,
        reference: session.reference,
        checkout_url: session.checkoutUrl,
        amount_xof: session.amountXof,
        currency: 'XOF',
        paiement_confirme: false,
        billet_emis: false,
      });
    } catch {
      // Ne jamais retenter automatiquement le POST fournisseur
      // si le verrou initial a déjà été acquis.
      if (claimed) {
        console.error(
          '[GENIUSPAY-STAGING] Initialisation incertaine : rapprochement requis.'
        );
        res.status(202).json({
          code: 'PAIEMENT_A_RAPPROCHER',
          message: 'Vérification nécessaire avant toute nouvelle tentative.',
        });
        return;
      }

      console.error('[GENIUSPAY-STAGING] Refus de préparation.');
      res.status(409).json({
        code: 'GENIUSPAY_INITIALISATION_REFUSEE',
      });
    }
  }
);

// ------------------------------------------------------------
// MESSAY — Intention financière canonique, STAGING LOCAL.
// Réutilise une réservation mobile existante.
// Aucun appel GeniusPay, aucun billet, aucun siège définitif.
// ------------------------------------------------------------

type CanonicalCheckoutRow = {
  reservation_id: string;
  company_id: string;
  affectation_id: string;
  montant_xof: number;
  expire_le: Date;
};

type CanonicalIntentRow = {
  intent_id: string;
  company_id: string;
  affectation_id: string;
  amount_xof: number | bigint;
  hold_expires_at: Date;
  checkout_state: string;
};

interurbainLocalStagingRouter.post(
  '/mobile/intention-financiere-staging',
  protectionStaging,
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.vary('Authorization');

    const actorId = req.user?.id;

    if (typeof actorId !== 'string' || !UUID.test(actorId)) {
      res.status(401).json({
        code: 'AUTHENTIFICATION_REQUISE',
      });
      return;
    }

    const input: unknown = req.body;

    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input)
    ) {
      res.status(400).json({ code: 'REQUETE_INVALIDE' });
      return;
    }

    const body = input as Record<string, unknown>;

    const allowed = [
      'checkout_id',
      'passenger_name',
      'passenger_phone',
    ];

    if (Object.keys(body).some(key => !allowed.includes(key))) {
      res.status(400).json({
        code: 'CHAMPS_NON_AUTORISES',
      });
      return;
    }

    const checkoutId = body.checkout_id;

    const passengerName =
      typeof body.passenger_name === 'string'
        ? body.passenger_name.trim()
        : '';

    const passengerPhone =
      typeof body.passenger_phone === 'string'
        ? body.passenger_phone.trim()
        : '';

    if (
      typeof checkoutId !== 'string' ||
      !UUID.test(checkoutId) ||
      passengerName.length < 2 ||
      passengerName.length > 160 ||
      !/^\+?[0-9]{8,15}$/.test(passengerPhone)
    ) {
      res.status(400).json({
        code: 'INFORMATIONS_PASSAGER_INVALIDES',
      });
      return;
    }

    try {
      const result = await prisma.$transaction(
        async tx => {
          // Le passager doit être propriétaire du checkout.
          // Les verrous empêchent de modifier la réservation
          // entre sa validation et la création de l'intention.
          const checkouts =
            await tx.$queryRaw<CanonicalCheckoutRow[]>`
              SELECT
                c.reservation_id,
                c.company_id,
                c.affectation_id,
                c.montant_xof,
                c.expire_le
              FROM public.messay_bus_checkouts c
              JOIN public.messay_bus_sieges_reservations r
                ON r.id = c.reservation_id
               AND r.company_id = c.company_id
               AND r.actor_user_id = c.actor_user_id
               AND r.affectation_id = c.affectation_id
              WHERE c.id = ${checkoutId}::uuid
                AND c.actor_user_id = ${actorId}::uuid
                AND c.statut = 'EN_ATTENTE_PAIEMENT'
                AND r.statut = 'EN_ATTENTE'
                AND c.expire_le > clock_timestamp()
                AND r.expire_le > clock_timestamp()
              FOR UPDATE OF c, r
            `;

          const checkout = checkouts[0];

          if (!checkout) {
            throw new Error('CHECKOUT_NON_ELIGIBLE');
          }

          // RPC officielle : tarif, compagnie et réservation
          // sont relus et vérifiés côté PostgreSQL.
          const intentions =
            await tx.$queryRaw<CanonicalIntentRow[]>`
              SELECT
                i.intent_id,
                i.company_id,
                i.affectation_id,
                i.amount_xof,
                i.hold_expires_at,
                i.checkout_state
              FROM public.messay_interurbain_creer_intention_tarif(
                ${checkout.reservation_id}::uuid,
                ${actorId}::uuid,
                ${passengerName}::text,
                ${passengerPhone}::text
              ) AS i
            `;

          const intent = intentions[0];

          // PostgreSQL BIGINT est renvoyé comme bigint par Prisma.
          // Conversion explicite avant JSON.
          const amount =
            typeof intent?.amount_xof === 'bigint'
              ? Number(intent.amount_xof)
              : intent?.amount_xof;

          if (
            !intent ||
            !UUID.test(intent.intent_id) ||
            intent.company_id !== checkout.company_id ||
            intent.affectation_id !== checkout.affectation_id ||
            !Number.isSafeInteger(amount) ||
            amount !== checkout.montant_xof ||
            amount < 200 ||
            amount > 2500000 ||
            !(intent.hold_expires_at instanceof Date) ||
            Number.isNaN(intent.hold_expires_at.getTime()) ||
            intent.hold_expires_at.getTime() <= Date.now() ||
            intent.checkout_state !== 'NEW'
          ) {
            // Une erreur ici annule aussi l'insertion financière.
            throw new Error('INTENTION_CANONIQUE_INCOHERENTE');
          }

          return {
            intentId: intent.intent_id,
            holdId: checkout.reservation_id,
            amountXof: amount,
            expiresAt: intent.hold_expires_at,
          };
        },
        {
          maxWait: 5000,
          timeout: 15000,
        },
      );

      res.status(201).json({
        intent_id: result.intentId,
        checkout_id: checkoutId,
        reservation_id: result.holdId,
        montant_xof: result.amountXof,
        devise: 'XOF',
        expire_le: result.expiresAt.toISOString(),
        statut: 'NEW',
        paiement_actif: false,
        billet_emis: false,
        siege: null,
        environnement: 'STAGING_LOCAL',
      });

    } catch (error: unknown) {
      let pgCode = 'UNKNOWN';

      if (
        error instanceof Prisma.PrismaClientKnownRequestError
      ) {
        const code = error.meta?.code;
        pgCode = typeof code === 'string' ? code : error.code;
      }

      const checkoutError =
        error instanceof Error &&
        error.message === 'CHECKOUT_NON_ELIGIBLE';

      console.error('[MESSAY/STAGING/INTENTION_CANONIQUE]', {
        code: checkoutError ? 'CHECKOUT_NON_ELIGIBLE' : pgCode,
      });

      const status =
        checkoutError ? 409 :
        pgCode === 'P0002' ? 404 :
        pgCode === 'P0001' || pgCode === '23505' ? 409 :
        pgCode === '22023' ? 400 :
        pgCode === '42501' ? 403 : 503;

      res.status(status).json({
        code: 'INTENTION_FINANCIERE_NON_DISPONIBLE',
        paiement_confirme: false,
        billet_emis: false,
      });
    }
  },
);
