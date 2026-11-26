/**
 * MESSAY — passerelle API GeniusPay LIVE.
 * NE PAS MONTER DE ROUTE LIVE AVANT :
 * 1. fonctions SQL de checkout/intention/claim/enregistrement/rapprochement ;
 * 2. webhook Live signé + inbox idempotente + confirmation atomique ;
 * 3. validation des montants, expirations et émission unique des billets.
 * Aucune route Express n'est déclarée ici.
 */
import {
  initiateGeniusPayPayment,
  getGeniusPayPayment,
  type GeniusPayCheckoutInput,
  type GeniusPayCheckoutSession,
  type GeniusPayCredentials,
} from './geniuspay.http';

type LiveOperation = 'initiation' | 'verification';

function liveCredentials(
  operation: LiveOperation,
): GeniusPayCredentials {
  const backendReady =
    process.env.NODE_ENV === 'production' &&
    process.env.MESSAY_LIVE_PAYMENT_BACKEND_READY === 'true';

  const operationAllowed =
    operation === 'initiation'
      ? (
          process.env.MESSAY_PROD_RESERVATIONS_ENABLED === 'true' &&
          process.env.MESSAY_LIVE_CHECKOUT_ENABLED === 'true'
        )
      : process.env.MESSAY_GENIUSPAY_RECONCILIATION_ENABLED === 'true';

  if (!backendReady || !operationAllowed) {
    throw new Error(
      operation === 'initiation'
        ? 'GENIUSPAY_LIVE_DESACTIVE'
        : 'GENIUSPAY_VERIFICATION_LIVE_DESACTIVEE',
    );
  }

  const publicKey = process.env.GENIUSPAY_LIVE_API_KEY?.trim() ?? '';
  const secretKey = process.env.GENIUSPAY_LIVE_API_SECRET?.trim() ?? '';
  if (
    !/^pk_live_.{8,}$/.test(publicKey) ||
    !/^sk_live_.{8,}$/.test(secretKey)
  ) {
    throw new Error('GENIUSPAY_CLES_LIVE_INVALIDES');
  }
  return { publicKey, secretKey };
}

/**
 * Appeler UNIQUEMENT après la réclamation exclusive de l'intention SQL,
 * et avec montant, intentId et companyId relus côté backend.
 * Jamais depuis un payload mobile brut.
 */
export async function createGeniusPayLiveCheckout(
  input: GeniusPayCheckoutInput,
): Promise<GeniusPayCheckoutSession<'live'>> {
  return initiateGeniusPayPayment('live', liveCredentials('initiation'), input);
}

/** Le statut GET n'est jamais à lui seul une autorisation d'émettre un billet. */
export async function readGeniusPayLivePayment(
  reference: string,
  expectedFromDatabase: GeniusPayCheckoutInput,
): Promise<Record<string, unknown>> {
  return getGeniusPayPayment(
    'live',
    liveCredentials('verification'),
    reference,
    expectedFromDatabase,
  );
}
