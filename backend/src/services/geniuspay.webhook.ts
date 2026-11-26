import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * MESSAY — validation des webhooks GeniusPay, côté serveur uniquement.
 *
 * Vérifie l'authenticité du message. Ne marque JAMAIS un paiement comme payé
 * et ne crée JAMAIS un billet. Le traitement métier et l'idempotence
 * appartiennent au backend et à PostgreSQL.
 *
 * IMPORTANT : rawBody doit provenir d'express.raw() AVANT express.json().
 */
export type GeniusPayWebhookEnvironment = 'sandbox' | 'live';

export type GeniusPayWebhookHeaders = Readonly<{
  signature?: string;
  timestamp?: string;
  event?: string;
  environment?: string;
}>;

export type VerifiedGeniusPayWebhook = Record<string, unknown> & {
  id: string;
  event: string;
  timestamp: number; // Normalisé en secondes Unix
  environment: GeniusPayWebhookEnvironment;
};

export type VerifyGeniusPayWebhookOptions = Readonly<{
  /**
   * À activer UNIQUEMENT si GeniusPay garantit que le timestamp du payload
   * est régénéré à chaque livraison. Sinon, les retransmissions tardives
   * risquent d'être rejetées.
   */
  strictEventTimestampWindow?: boolean;
}>;

const MAX_BODY_BYTES = 32_768;
const MAX_CLOCK_SKEW_SECONDS = 300;
const SIGNATURE_REGEX = /^[a-fA-F0-9]{64}$/;
const HEADER_TIMESTAMP_REGEX = /^\d{10,11}$/;

/** Accepte un timestamp Unix numérique en secondes ou en millisecondes. */
function normalizeSeconds(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return null;
  }
  const seconds = value >= 1_000_000_000_000 ? Math.floor(value / 1000) : value;
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null;
}

export function verifyGeniusPayWebhook(
  rawBody: Buffer,
  headers: GeniusPayWebhookHeaders,
  secret: string,
  expectedEnvironment: GeniusPayWebhookEnvironment,
  options: VerifyGeniusPayWebhookOptions = {},
): VerifiedGeniusPayWebhook {
  const cleanSecret = typeof secret === 'string' ? secret.trim() : '';
  if (
    !Buffer.isBuffer(rawBody) ||
    rawBody.length === 0 ||
    rawBody.length > MAX_BODY_BYTES ||
    !cleanSecret.startsWith('whsec_') ||
    cleanSecret.length <= 'whsec_'.length
  ) {
    throw new Error('WEBHOOK_INVALID');
  }

  if (expectedEnvironment !== 'sandbox' && expectedEnvironment !== 'live') {
    throw new Error('WEBHOOK_ENVIRONMENT_INVALID');
  }

  const signature = headers.signature?.trim();
  // Conserver la valeur EXACTE de l'en-tête timestamp pour le HMAC.
  const timestamp = headers.timestamp;
  const headerEvent = headers.event?.trim();
  const headerEnvironment = headers.environment?.trim();

  if (
    !signature || !SIGNATURE_REGEX.test(signature) ||
    typeof timestamp !== 'string' || !HEADER_TIMESTAMP_REGEX.test(timestamp) ||
    !headerEvent || headerEvent.length > 128 ||
    (
      headers.environment !== undefined &&
      headerEnvironment !== expectedEnvironment
    )
  ) {
    throw new Error('WEBHOOK_HEADERS_INVALID');
  }

  const headerSeconds = Number(timestamp);
  if (
    !Number.isSafeInteger(headerSeconds) ||
    Math.abs(Date.now() / 1000 - headerSeconds) > MAX_CLOCK_SKEW_SECONDS
  ) {
    throw new Error('WEBHOOK_EXPIRED');
  }

  const expectedSignature = createHmac('sha256', cleanSecret)
    .update(`${timestamp}.`, 'utf8')
    .update(rawBody)
    .digest();
  const receivedSignature = Buffer.from(signature, 'hex');

  if (
    receivedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(receivedSignature, expectedSignature)
  ) {
    throw new Error('WEBHOOK_SIGNATURE_INVALID');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString('utf8')) as unknown;
  } catch {
    throw new Error('WEBHOOK_JSON_INVALID');
  }

  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('WEBHOOK_PAYLOAD_INVALID');
  }

  const data = payload as Record<string, unknown>;
  const id = typeof data.id === 'string' ? data.id.trim() : '';
  const event = typeof data.event === 'string' ? data.event.trim() : '';
  const eventSeconds = normalizeSeconds(data.timestamp);

  if (
    data.environment !== expectedEnvironment ||
    event !== headerEvent ||
    !id || id.length > 128 ||
    !event || event.length > 128 ||
    eventSeconds === null
  ) {
    throw new Error('WEBHOOK_EVENT_INVALID');
  }

  // Un événement ne peut normalement pas être daté du futur après son envoi.
  // Autoriser un délai de retransmission : l'horodatage du payload peut
  // représenter la création initiale, pas cette livraison.
  if (eventSeconds > headerSeconds + MAX_CLOCK_SKEW_SECONDS) {
    throw new Error('WEBHOOK_EVENT_TIMESTAMP_INVALID');
  }
  if (
    options.strictEventTimestampWindow === true &&
    Math.abs(eventSeconds - headerSeconds) > MAX_CLOCK_SKEW_SECONDS
  ) {
    throw new Error('WEBHOOK_EVENT_TIMESTAMP_INVALID');
  }

  return {
    ...data,
    id,
    event,
    environment: expectedEnvironment,
    timestamp: eventSeconds,
  };
}
