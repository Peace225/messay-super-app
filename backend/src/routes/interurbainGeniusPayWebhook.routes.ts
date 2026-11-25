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
        // Signature/horodatage/environnement incorrect : jamais d'accusé succès.
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
