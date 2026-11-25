/**
 * MESSAY — primitives GeniusPay côté serveur uniquement.
 * Ne jamais appeler directement depuis Express : utiliser le gateway
 * SANDBOX ou LIVE, chacun muni de ses verrous d'environnement.
 * Aucune fonction de ce fichier ne confirme un paiement ni n'émet un billet.
 */

const BASE_URL = 'https://geniuspay.ci/api/v1/merchant';
const REFERENCE = /^[A-Za-z0-9_-]{4,128}$/;
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_CHARS = 65_536;

type JsonObject = Record<string, unknown>;
export type GeniusPayEnvironment = 'sandbox' | 'live';

export type GeniusPayCheckoutInput = Readonly<{
  intentId: string;
  companyId: string;
  amountXof: number;
}>;

export type GeniusPayCheckoutSession<E extends GeniusPayEnvironment> = Readonly<{
  provider: 'GENIUSPAY';
  reference: string;
  checkoutUrl: string;
  amountXof: number;
  currency: 'XOF';
  environment: E;
}>;

export type GeniusPayCredentials = Readonly<{
  publicKey: string;
  secretKey: string;
}>;

function asObject(value: unknown): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('GENIUSPAY_REPONSE_INVALIDE');
  }
  return value as JsonObject;
}

function validInput(input: GeniusPayCheckoutInput): boolean {
  return (
    UUID.test(input.intentId) &&
    UUID.test(input.companyId) &&
    Number.isSafeInteger(input.amountXof) &&
    input.amountXof >= 200 &&
    input.amountXof <= 2_500_000
  );
}

function amountIs(value: unknown, expected: number): boolean {
  // Pas de conversion silencieuse, pas de centimes dans un montant XOF.
  return Number.isSafeInteger(value) && value === expected;
}

function validateCheckoutUrl(value: unknown, reference: string): string {
  if (typeof value !== 'string') {
    throw new Error('GENIUSPAY_URL_INVALIDE');
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('GENIUSPAY_URL_INVALIDE');
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'geniuspay.ci' ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    url.pathname !== `/checkout/${reference}` ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error('GENIUSPAY_URL_NON_AUTORISEE');
  }
  return url.toString();
}

async function apiRequest(
  method: 'GET' | 'POST',
  endpoint: string,
  credentials: GeniusPayCredentials,
  payload?: JsonObject,
): Promise<JsonObject> {
  // endpoint n'est jamais construit à partir d'une URL utilisateur libre.
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: {
        'X-API-Key': credentials.publicKey,
        'X-API-Secret': credentials.secretKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: 'error',
    });
  } catch {
    // Le fournisseur a pu créer la session malgré le timeout réseau.
    // Ne JAMAIS répéter un POST automatiquement.
    throw new Error(method === 'POST'
      ? 'GENIUSPAY_INITIATION_A_RAPPROCHER'
      : 'GENIUSPAY_LECTURE_INDISPONIBLE');
  }

  if (!response.ok) {
    // Ne pas divulguer le corps fournisseur au client ni aux journaux.
    throw new Error(method === 'POST'
      ? 'GENIUSPAY_INITIATION_A_RAPPROCHER'
      : 'GENIUSPAY_LECTURE_INDISPONIBLE');
  }

  const contentType = response.headers.get('content-type') ?? '';
  const lengthHeader = response.headers.get('content-length');
  if (
    !contentType.toLowerCase().includes('application/json') ||
    (lengthHeader !== null && Number(lengthHeader) > MAX_RESPONSE_CHARS)
  ) {
    throw new Error('GENIUSPAY_REPONSE_INVALIDE_A_RAPPROCHER');
  }

  let parsed: unknown;
  try {
    const raw = await response.text();
    if (raw.length > MAX_RESPONSE_CHARS) {
      throw new Error('response-too-long');
    }
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('GENIUSPAY_REPONSE_INVALIDE_A_RAPPROCHER');
  }

  const envelope = asObject(parsed);
  if (envelope.success !== true) {
    throw new Error('GENIUSPAY_OPERATION_A_RAPPROCHER');
  }
  return asObject(envelope.data);
}

export async function initiateGeniusPayPayment<E extends GeniusPayEnvironment>(
  environment: E,
  credentials: GeniusPayCredentials,
  input: GeniusPayCheckoutInput,
): Promise<GeniusPayCheckoutSession<E>> {
  if (!validInput(input)) {
    throw new Error('GENIUSPAY_INTENTION_INVALIDE');
  }
  // Précondition métier : l'appelant détient une réclamation SQL exclusive,
  // a relu le montant XOF en base et contrôle encore les expirations.
  const payment = await apiRequest('POST', '/payments', credentials, {
    amount: input.amountXof,
    currency: 'XOF',
    description: 'Réservation interurbaine MESSAY',
    metadata: {
      order_id: input.intentId,
      company_id: input.companyId,
    },
  });

  const reference = payment.reference;
  if (typeof reference !== 'string' || !REFERENCE.test(reference)) {
    throw new Error('GENIUSPAY_INITIATION_A_RAPPROCHER');
  }
  const metadata = asObject(payment.metadata);
  if (
    !amountIs(payment.amount, input.amountXof) ||
    payment.currency !== 'XOF' ||
    payment.environment !== environment ||
    payment.status !== 'pending' ||
    metadata.order_id !== input.intentId ||
    metadata.company_id !== input.companyId
  ) {
    throw new Error('GENIUSPAY_INITIATION_A_RAPPROCHER');
  }

  const checkoutUrl = validateCheckoutUrl(
    payment.checkout_url ?? payment.payment_url,
    reference,
  );
  return {
    provider: 'GENIUSPAY',
    reference,
    checkoutUrl,
    amountXof: input.amountXof,
    currency: 'XOF',
    environment,
  };
}

export async function getGeniusPayPayment(
  environment: GeniusPayEnvironment,
  credentials: GeniusPayCredentials,
  reference: string,
  expected?: GeniusPayCheckoutInput,
): Promise<JsonObject> {
  if (!REFERENCE.test(reference)) {
    throw new Error('GENIUSPAY_REFERENCE_INVALIDE');
  }
  if (expected !== undefined && !validInput(expected)) {
    throw new Error('GENIUSPAY_INTENTION_INVALIDE');
  }
  const payment = await apiRequest(
    'GET',
    `/payments/${encodeURIComponent(reference)}`,
    credentials,
  );
  if (
    payment.reference !== reference ||
    payment.environment !== environment ||
    payment.currency !== 'XOF' ||
    !Number.isSafeInteger(payment.amount)
  ) {
    throw new Error('GENIUSPAY_STATUT_A_RAPPROCHER');
  }

  if (expected !== undefined) {
    const metadata = asObject(payment.metadata);
    if (
      !amountIs(payment.amount, expected.amountXof) ||
      metadata.order_id !== expected.intentId ||
      metadata.company_id !== expected.companyId
    ) {
      throw new Error('GENIUSPAY_STATUT_A_RAPPROCHER');
    }
  }
  // Même en statut 'completed', le serveur doit rapprocher puis valider une
  // transaction PostgreSQL atomique AVANT d'émettre le billet.
  return payment;
}
