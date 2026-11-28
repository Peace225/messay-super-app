/**
 * MESSAY — fonctions internes de réclamation exclusive du checkout.
 * ETAPE DE PRÉPARATION : ce module ne fait aucun appel HTTP à GeniusPay,
 * ne crée aucune intention et n'émet aucun billet. Ne pas monter en API LIVE.
 * Le calcul du tarif officiel et l'émission atomique restent à développer.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GeniusPayCheckoutSession } from './geniuspay.http';

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const PROVIDER_REFERENCE = /^[A-Za-z0-9_-]{4,128}$/;

type ClaimedRow = {
  intent_id: string;
  company_id: string;
  amount_xof: number;
  hold_expires_at: string;
  checkout_state: 'CLAIMED';
};

type SavedRow = {
  intent_id: string;
  checkout_state: 'READY' | 'RECONCILE';
  provider_reference: string;
};

function asRow(data: unknown): Record<string, unknown> {
  const value: unknown = Array.isArray(data)
    ? (data.length === 1 ? data[0] : null)
    : data;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('MESSAY_RPC_REPONSE_INVALIDE');
  }
  return value as Record<string, unknown>;
}

function checkUuid(value: string): void {
  if (!UUID.test(value)) throw new Error('MESSAY_ID_INVALIDE');
}

/**
 * À appeler uniquement depuis un backend qui contrôle le JWT et
 * l'identité de l'acteur. Le montant est RÉCUPÉRÉ depuis PostgreSQL,
 * jamais accepté depuis l'application mobile.
 */
export async function reclamerCheckoutExclusif(
  db: SupabaseClient,
  intentId: string,
  actorId: string,
): Promise<ClaimedRow> {
  checkUuid(intentId);
  checkUuid(actorId);
  const { data, error } = await db.rpc('messay_interurbain_reclamer_checkout', {
    p_intent_id: intentId,
    p_actor: actorId,
  });
  if (error) throw new Error('MESSAY_CHECKOUT_CLAIM_REFUSE');
  const row = asRow(data);
  const expiry = typeof row.hold_expires_at === 'string'
    ? Date.parse(row.hold_expires_at)
    : NaN;
  if (
    row.intent_id !== intentId ||
    typeof row.company_id !== 'string' || !UUID.test(row.company_id) ||
    typeof row.amount_xof !== 'number' ||
    !Number.isSafeInteger(row.amount_xof) ||
    row.amount_xof < 200 || row.amount_xof > 2_500_000 ||
    row.checkout_state !== 'CLAIMED' ||
    !Number.isFinite(expiry) || expiry <= Date.now()
  ) throw new Error('MESSAY_CHECKOUT_CLAIM_INCOHERENT');
  return row as ClaimedRow;
}

/**
 * Enregistre la référence vérifiée par geniuspay.http.ts.
 * Si READY n'est pas retourné, NE PAS renvoyer l'URL au voyageur.
 */
export async function enregistrerCheckoutVerifie(
  db: SupabaseClient,
  claim: ClaimedRow,
  actorId: string,
  session: GeniusPayCheckoutSession<'live'>,
): Promise<SavedRow> {
  checkUuid(actorId);
  if (
    session.provider !== 'GENIUSPAY' ||
    session.environment !== 'live' ||
    session.currency !== 'XOF' ||
    session.amountXof !== claim.amount_xof ||
    !PROVIDER_REFERENCE.test(session.reference) ||
    session.checkoutUrl !== `https://geniuspay.ci/checkout/${session.reference}`
  ) throw new Error('MESSAY_SESSION_GENIUSPAY_INCOHERENTE');

  const { data, error } = await db.rpc('messay_interurbain_enregistrer_checkout', {
    p_intent_id: claim.intent_id,
    p_actor: actorId,
    p_reference: session.reference,
    p_checkout_url: session.checkoutUrl,
  });
  if (error) throw new Error('MESSAY_CHECKOUT_ENREGISTREMENT_INCERTAIN');
  const row = asRow(data);
  if (
    row.intent_id !== claim.intent_id ||
    row.provider_reference !== session.reference ||
    !['READY', 'RECONCILE'].includes(String(row.checkout_state))
  ) throw new Error('MESSAY_CHECKOUT_ENREGISTREMENT_INCOHERENT');
  return row as SavedRow;
}

/** Un timeout fournisseur ne justifie JAMAIS une nouvelle initiation POST. */
export async function signalerCheckoutIncertain(
  db: SupabaseClient,
  intentId: string,
  actorId: string,
): Promise<void> {
  checkUuid(intentId);
  checkUuid(actorId);
  const { data, error } = await db.rpc('messay_interurbain_checkout_a_rapprocher', {
    p_intent_id: intentId,
    p_actor: actorId,
  });
  if (error || typeof data !== 'string' || data !== 'RECONCILE') {
    throw new Error('MESSAY_RAPPROCHEMENT_A_VERIFIER_MANUELLEMENT');
  }
}
