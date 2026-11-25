/**
 * MESSAY — passerelle GeniusPay SANDBOX LOCAL UNIQUEMENT.
 * API publique conservée pour interurbainLocalStaging.routes.ts.
 * Ce fichier ne confirme pas de paiement et n'émet pas de billet.
 */
import {
  initiateGeniusPayPayment,
  getGeniusPayPayment,
  type GeniusPayCheckoutInput,
  type GeniusPayCheckoutSession as Session,
  type GeniusPayCredentials,
} from './geniuspay.http';

export type { GeniusPayCheckoutInput } from './geniuspay.http';
export type GeniusPayCheckoutSession = Session<'sandbox'>;

const LOCAL_DB =
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres?schema=public';

function sandboxCredentials(): GeniusPayCredentials {
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.MESSAY_LOCAL_CHECKOUT_ENABLED !== 'true' ||
    process.env.GENIUSPAY_SANDBOX_ENABLED !== 'true' ||
    process.env.DATABASE_URL !== LOCAL_DB ||
    process.env.DIRECT_URL !== LOCAL_DB
  ) {
    throw new Error('GENIUSPAY_SANDBOX_LOCAL_DESACTIVE');
  }
  const publicKey = process.env.GENIUSPAY_API_KEY?.trim() ?? '';
  const secretKey = process.env.GENIUSPAY_API_SECRET?.trim() ?? '';
  if (
    !/^pk_sandbox_.{8,}$/.test(publicKey) ||
    !/^sk_sandbox_.{8,}$/.test(secretKey)
  ) {
    throw new Error('GENIUSPAY_CLES_SANDBOX_INVALIDES');
  }
  return { publicKey, secretKey };
}

export async function createGeniusPayCheckout(
  input: GeniusPayCheckoutInput,
): Promise<GeniusPayCheckoutSession> {
  return initiateGeniusPayPayment('sandbox', sandboxCredentials(), input);
}

export async function readGeniusPayPayment(
  reference: string,
): Promise<Record<string, unknown>> {
  return getGeniusPayPayment('sandbox', sandboxCredentials(), reference);
}
