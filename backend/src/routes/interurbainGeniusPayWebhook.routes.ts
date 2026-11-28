
/**
 * MESSAY — Réception sécurisée des webhooks GeniusPay LIVE.
 *
 * INBOX SEULEMENT :
 * - Vérifie la signature et les informations du webhook.
 * - Enregistre les événements authentifiés dans Supabase.
 * - Ne confirme PAS directement un paiement.
 * - N'émet PAS de billet.
 *
 * IMPORTANT :
 * Cette route doit être montée AVANT express.json()
 * afin de préserver le corps brut utilisé pour le HMAC.
 *
 * Activation :
 * MESSAY_GENIUSPAY_INBOX_ENABLED=true
 * + vérification du projet Supabase Production.
 */

import {
  Router,
  raw,
  type Request,
  type Response,
} from 'express';

import { enregistrerWebhookGeniusPay } from
  '../services/messayGeniusPayInbox.service';

import { creerInboxSupabaseStore } from
  '../services/messayGeniusPayInboxSupabase.store';

import { getGeniusPayInboxProductionClient } from
  '../services/messayGeniusPayInboxProduction.client';

export const interurbainGeniusPayWebhookRouter = Router();

/**
 * Codes de rejet connus.
 *
 * Ne jamais enregistrer dans les logs :
 * - Le secret webhook
 * - La signature reçue
 * - Le corps JSON brut
 * - Les données personnelles ou financières
 */
const WEBHOOK_REJECTION_CODES = new Set([
  'WEBHOOK_INVALID',
  'WEBHOOK_ENVIRONMENT_INVALID',
  'WEBHOOK_HEADERS_INVALID',
  'WEBHOOK_EXPIRED',
  'WEBHOOK_SIGNATURE_INVALID',
  'WEBHOOK_JSON_INVALID',
  'WEBHOOK_PAYLOAD_INVALID',
  'WEBHOOK_EVENT_INVALID',
  'WEBHOOK_EVENT_TIMESTAMP_INVALID',
]);

/**
 * Lecture sécurisée d'un en-tête HTTP.
 */
function header(
  req: Request,
  name: string,
): string | undefined {
  const value = req.get(name);

  return typeof value === 'string'
    ? value
    : undefined;
}

/**
 * Retourne une catégorie de rejet sans exposer
 * de messages d'erreur non maîtrisés dans les logs.
 */
function getSafeRejectionCode(code: string): string {
  return WEBHOOK_REJECTION_CODES.has(code)
    ? code
    : 'WEBHOOK_REJETE';
}

/**
 * Route finale :
 * POST /api/interurbain/webhooks/geniuspay
 *
 * Le préfixe est déclaré dans server.ts.
 */
interurbainGeniusPayWebhookRouter.post(
  '/',
  raw({
    type: 'application/json',
    limit: '32kb',
  }),

  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');

    /**
     * 1. Vérifier la configuration Production.
     */
    const db = getGeniusPayInboxProductionClient();

    const secret =
      process.env.GENIUSPAY_LIVE_WEBHOOK_SECRET?.trim() ?? '';

    if (
      !db ||
      !secret.startsWith('whsec_') ||
      secret.length <= 12
    ) {
      console.warn(
        '[MESSAY/GENIUSPAY/INBOX] CONFIGURATION_INACTIVE',
      );

      res.status(503).json({
        code: 'GENIUSPAY_WEBHOOK_NON_ACTIF',
      });

      return;
    }

    /**
     * 2. Vérifier le Content-Type et le corps brut.
     */
    if (
      !req.is('application/json') ||
      !Buffer.isBuffer(req.body)
    ) {
      res.status(415).json({
        code: 'GENIUSPAY_TYPE_INVALIDE',
      });

      return;
    }

    /**
     * 3. Vérifier et enregistrer le webhook.
     */
    try {
      const result = await enregistrerWebhookGeniusPay(
        creerInboxSupabaseStore(db),
        req.body as Buffer,
        {
          signature: header(
            req,
            'X-Webhook-Signature',
          ),

          timestamp: header(
            req,
            'X-Webhook-Timestamp',
          ),

          event: header(
            req,
            'X-Webhook-Event',
          ),

          environment: header(
            req,
            'X-Webhook-Environment',
          ),
        },
        secret,
      );

      /**
       * HTTP 200 uniquement après authentification
       * et traitement sûr par le service INBOX.
       *
       * Aucun paiement n'est finalisé ici.
       */
      res.status(200).json({
        status: result.status,
      });

      return;

    } catch (error: unknown) {
      const code =
        error instanceof Error
          ? error.message
          : 'UNKNOWN';

      /**
       * 4. Rejet des notifications non authentifiées.
       *
       * Diagnostic visible uniquement dans les logs
       * du serveur Render.
       */
      if (code.startsWith('WEBHOOK_')) {
        console.warn(
          '[MESSAY/GENIUSPAY/INBOX] WEBHOOK_REJETE',
          {
            raison: getSafeRejectionCode(code),
          },
        );

        // Ne pas révéler la cause exacte à l'appelant.
        res.status(401).json({
          code: 'GENIUSPAY_SIGNATURE_INVALIDE',
        });

        return;
      }

      /**
       * 5. Collision d'identifiant d'événement.
       */
      if (code === 'GENIUSPAY_EVENT_ID_COLLISION') {
        console.error(
          '[MESSAY/GENIUSPAY/INBOX] EVENT_ID_COLLISION',
        );

        res.status(409).json({
          code: 'GENIUSPAY_EVENT_CONFLIT',
        });

        return;
      }

      /**
       * 6. Autres erreurs de persistance ou serveur.
       *
       * Aucun accusé de réception positif en cas
       * d'échec de l'enregistrement.
       */
      console.error(
        '[MESSAY/GENIUSPAY/INBOX] ERREUR_SERVEUR',
        {
          code: code.startsWith('GENIUSPAY_')
            ? code
            : 'ERREUR_INCONNUE',
        },
      );

      res.status(503).json({
        code: 'GENIUSPAY_INBOX_INDISPONIBLE',
      });

      return;
    }
  },
);
