/**
 * MESSAY — capture d'événements GeniusPay signés (journal seulement).
 * Pas de changement de financial_status, ni de création de Ticket.
 * Compatible avec public.messay_interurbain_geniuspay_webhook_events.
 */
import { createHash } from 'node:crypto';
import {
  verifyGeniusPayWebhook,
  type GeniusPayWebhookHeaders,
} from './geniuspay.webhook';

export type InboxEventRow = Readonly<{
  provider_event_id: string;
  intent_id: null;
  event_type: string;
  environment: 'live';
  raw_sha256: string;
  payload: Record<string, unknown>;
}>;
export type InboxError = { code?: string };
export interface GeniusPayInboxStore {
  insert(row: InboxEventRow): Promise<{ error: InboxError | null }>;
  findSha256(eventId: string): Promise<{
    sha256: string | null;
    error: InboxError | null;
  }>;
}
export type InboxResult = Readonly<{
  status: 'RECORDED' | 'DUPLICATE' | 'IGNORED';
  eventId: string;
}>;

/**
 * Un événement est conservé sans intent_id tant que la référence et le montant
 * n'ont pas été rapprochés depuis l'API marchande GeniusPay.
 * Le service est conçu pour être exécuté par le backend privilégié seulement.
 */
export async function enregistrerWebhookGeniusPay(
  store: GeniusPayInboxStore,
  rawBody: Buffer,
  headers: GeniusPayWebhookHeaders,
  webhookSecret: string,
): Promise<InboxResult> {
  const event = verifyGeniusPayWebhook(rawBody, headers, webhookSecret, 'live');
  if (!event.event.startsWith('payment.')) {
    return { status: 'IGNORED', eventId: event.id };
  }
  const sha = createHash('sha256').update(rawBody).digest('hex');
  const row: InboxEventRow = {
    provider_event_id: event.id,
    intent_id: null,
    event_type: event.event,
    environment: 'live',
    raw_sha256: sha,
    payload: event,
  };
  const outcome = await store.insert(row);
  if (!outcome.error) return { status: 'RECORDED', eventId: event.id };
  if (outcome.error.code !== '23505') {
    // Ne pas accuser réception si l'insertion n'est pas certaine.
    throw new Error('GENIUSPAY_INBOX_UNAVAILABLE');
  }
  const previous = await store.findSha256(event.id);
  if (previous.error || previous.sha256 === null) {
    throw new Error('GENIUSPAY_INBOX_RECONCILIATION_REQUIRED');
  }
  if (previous.sha256 !== sha) {
    // Même ID mais corps différent : ne pas écraser, audit manuel.
    throw new Error('GENIUSPAY_EVENT_ID_COLLISION');
  }
  return { status: 'DUPLICATE', eventId: event.id };
}
