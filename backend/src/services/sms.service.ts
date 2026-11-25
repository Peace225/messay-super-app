/**
 * MESSAY - Orange SMS Côte d'Ivoire v2.0 (backend uniquement).
 * Envoie les SMS ; ne génère ni ne vérifie les OTP.
 * Node.js 18+ requis.
 */

const TOKEN_URL = 'https://api.orange.com/oauth/v3/token';
const SMS_BASE = 'https://api.orange.com/smsmessaging/v1/outbound';
const SENDER_ADDRESS = 'tel:+2250000';
const PHONE_REGEX = /^\+2250[157]\d{8}$/;

interface OrangeTokenResponse {
  access_token?: unknown;
  expires_in?: unknown;
}

type CachedToken = { value: string; expiresAt: number };
let cachedToken: CachedToken | null = null;
let tokenRequest: Promise<string> | null = null;

export class SmsDeliveryError extends Error {
  constructor(message: string, public readonly statusCode = 502) {
    super(message);
    this.name = 'SmsDeliveryError';
  }
}

function getConfig() {
  const clientId = process.env.ORANGE_SMS_CLIENT_ID?.trim();
  const clientSecret = process.env.ORANGE_SMS_CLIENT_SECRET?.trim();
  const senderName = process.env.ORANGE_SMS_SENDER_NAME?.trim();

  if (!clientId || !clientSecret) {
    throw new SmsDeliveryError('Service SMS non configuré', 503);
  }
  if (senderName && !/^[A-Za-z0-9 ]{1,11}$/.test(senderName)) {
    throw new SmsDeliveryError("Nom d'expéditeur SMS invalide", 503);
  }
  return { clientId, clientSecret, senderName };
}

async function requestToken(): Promise<string> {
  const { clientId, clientSecret } = getConfig();
  let response: Response;

  try {
    response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new SmsDeliveryError('Impossible de joindre Orange pour obtenir un token', 503);
  }

  if (!response.ok) {
    throw new SmsDeliveryError('Authentification Orange SMS impossible', 502);
  }

  let data: OrangeTokenResponse;
  try {
    data = (await response.json()) as OrangeTokenResponse;
  } catch {
    throw new SmsDeliveryError('Réponse OAuth Orange invalide', 502);
  }
  if (typeof data.access_token !== 'string' || !data.access_token) {
    throw new SmsDeliveryError('Token OAuth Orange manquant', 502);
  }

  const rawTtl = Number(data.expires_in);
  const ttl = Number.isFinite(rawTtl) && rawTtl > 0 ? rawTtl : 3600;
  // Renouveler en avance sans jamais prolonger artificiellement sa validité.
  const earlySeconds = Math.min(60, Math.floor(ttl / 10));
  const usableSeconds = Math.max(0, ttl - earlySeconds);
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + usableSeconds * 1000,
  };
  return data.access_token;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }
  if (!tokenRequest) {
    tokenRequest = requestToken().finally(() => {
      tokenRequest = null;
    });
  }
  return tokenRequest;
}

/**
 * Retourne lorsque Orange accepte la requête HTTP.
 * Cela ne garantit pas la livraison du SMS au téléphone.
 */
export async function sendMessaySms(phone: string, message: string): Promise<void> {
  if (!PHONE_REGEX.test(phone)) {
    throw new SmsDeliveryError('Numéro mobile ivoirien invalide', 400);
  }
  if (!message.trim() || message.length > 160) {
    throw new SmsDeliveryError('Contenu SMS invalide', 400);
  }

  const { senderName } = getConfig();
  const endpoint = `${SMS_BASE}/${encodeURIComponent(SENDER_ADDRESS)}/requests`;
  const body = JSON.stringify({
    outboundSMSMessageRequest: {
      address: `tel:${phone}`,
      senderAddress: SENDER_ADDRESS,
      ...(senderName ? { senderName } : {}),
      outboundSMSTextMessage: { message },
    },
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getAccessToken();
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      // Ne pas relancer automatiquement un envoi incertain :
      // Orange peut avoir accepté le SMS avant la coupure réseau.
      throw new SmsDeliveryError('Connexion à Orange interrompue ; état de livraison inconnu', 502);
    }

    if (response.ok) return;

    if (response.status === 401 && attempt === 0) {
      // Invalider uniquement le token réellement rejeté.
      if (cachedToken?.value === token) cachedToken = null;
      continue;
    }
    if (response.status === 429) {
      throw new SmsDeliveryError('Quota ou limite de fréquence Orange atteint', 503);
    }
    if (response.status === 400) {
      throw new SmsDeliveryError('Requête SMS refusée : vérifiez le nom d’expéditeur autorisé et les paramètres Orange', 502);
    }
    if (response.status === 401 || response.status === 403) {
      throw new SmsDeliveryError('Accès API Orange SMS refusé', 502);
    }
    throw new SmsDeliveryError(`Orange SMS a refusé la requête (HTTP ${response.status})`, 502);
  }
  throw new SmsDeliveryError('Envoi SMS non confirmé', 502);
}

export async function sendMessayOtp(phone: string, otp: string): Promise<void> {
  if (!/^\d{6}$/.test(otp)) {
    throw new SmsDeliveryError('Code OTP invalide', 400);
  }
  await sendMessaySms(
    phone,
    `MESSAY : votre code de verification est ${otp}. Il expire dans 5 minutes. Ne le partagez jamais.`
  );
}
