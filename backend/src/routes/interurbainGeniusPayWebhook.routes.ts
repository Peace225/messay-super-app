/**
 * MESSAY — réception sécurisée des webhooks GeniusPay LIVE (INBOX SEULEMENT).
 * IMPORTANT : cette route ne confirme PAS de paiement et n'émet PAS de billet.
 * Doit être montée AVANT express.json() pour préserver le corps brut HMAC.
 * Activée uniquement par MESSAY_GENIUSPAY_INBOX_ENABLED=true + projet vérifié.
 */
import { Router, raw, type Request, type Response } from 'express';
import { enregistrerWebhookGeniusPay } from
  '../services/messayGeniusPayInbox.service';
import { creerInboxSupabaseStore } from
  '../services/messayGeniusPayInboxSupabase.store';
import { getGeniusPayInboxProductionClient } from
  '../services/messayGeniusPayInboxProduction.client';

export const interurbainGeniusPayWebhookRouter = Router();

function header(req: Request, name: string): string | undefined {
  const value = req.get(name);
  return typeof value === 'string' ? value : undefined;
}

// Le préfixe monté dans server.ts est /api/interurbain/webhooks/geniuspay.
interurbainGeniusPayWebhookRouter.post(
  '/',
  raw({ type: 'application/json', limit: '32kb' }),
  async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    const db = getGeniusPayInboxProductionClient();
    const secret = process.env.GENIUSPAY_LIVE_WEBHOOK_SECRET?.trim() ?? '';
    if (!db || !secret.startsWith('whsec_') || secret.length <= 12) {
      res.status(503).json({ code: 'GENIUSPAY_WEBHOOK_NON_ACTIF' });
      return;
    }
    if (!req.is('application/json') || !Buffer.isBuffer(req.body)) {
      res.status(415).json({ code: 'GENIUSPAY_TYPE_INVALIDE' });
      return;
    }

    try {
      const result = await enregistrerWebhookGeniusPay(
        creerInboxSupabaseStore(db),
        req.body as Buffer,
        {
          signature: header(req, 'X-Webhook-Signature'),
          timestamp: header(req, 'X-Webhook-Timestamp'),
          event: header(req, 'X-Webhook-Event'),
          environment: header(req, 'X-Webhook-Environment'),
        },
        secret,
      );
      // HTTP 200 uniquement lorsque l'événement a été authentifié et,
      // pour les événements de paiement, persisté ou identifié comme doublon.
      res.status(200).json({ status: result.status });
    } catch (error: unknown) {
      const code = error instanceof Error ? error.message : 'UNKNOWN';
      if (code.startsWith('WEBHOOK_')) {
        // Diagnostic interne uniquement, sans secret ni données sensibles.
        const codesAutorises = new Set([
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

        console.warn('[MESSAY/GENIUSPAY/INBOX] WEBHOOK_REJETE', {
          raison: codesAutorises.has(code) ? code : 'WEBHOOK_AUTRE',
        });

        if (code === 'WEBHOOK_HEADERS_INVALID') {
          const signature =
            header(req, 'X-Webhook-Signature')?.trim() ?? '';

          const timestamp =
            header(req, 'X-Webhook-Timestamp') ?? '';

          const event =
            header(req, 'X-Webhook-Event')?.trim() ?? '';

          const environment =
            header(req, 'X-Webhook-Environment')?.trim() ?? '';

          console.warn(
            '[MESSAY/GENIUSPAY/INBOX] HEADER_DIAGNOSTIC',
            {
              signatureFormatOK: /^[a-fA-F0-9]{64}$/.test(signature),
              timestampFormatOK: /^\d{10,11}$/.test(timestamp),
              eventFormatOK: event.length > 0 && event.length <= 128,
              environmentPresent: environment.length > 0,
              environmentLive: environment === 'live',
            },
          );
        }

        // Ne jamais révéler la cause exacte au client HTTP.
        res.status(401).json({ code: 'GENIUSPAY_SIGNATURE_INVALIDE' });
        return;
      }
      if (code === 'GENIUSPAY_EVENT_ID_COLLISION') {
        console.error('[MESSAY/GENIUSPAY/INBOX] event_id_collision');
        res.status(409).json({ code: 'GENIUSPAY_EVENT_CONFLIT' });
        return;
      }
      console.error('[MESSAY/GENIUSPAY/INBOX]', {
        code: code.startsWith('GENIUSPAY_') ? code : 'ERREUR_INCONNUE',
      });
      res.status(503).json({ code: 'GENIUSPAY_INBOX_INDISPONIBLE' });
    }
  },
);
