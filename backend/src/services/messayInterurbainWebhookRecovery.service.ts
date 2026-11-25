/**
 * MESSAY D.8.2 — Raccordement interne d'une reference manquante.
 * NE MONTER AUCUNE ROUTE et NE LANCER AUCUN WORKER LIVE avec ce seul fichier.
 * Seul le wrapper Live peut consulter le fournisseur; la fonction de test
 * accepte une lecture injectee exclusivement pour des tests hors ligne.
 *
 * Le GET fournisseur n'est PAS une autorisation d'emission: le RPC D8.1
 * attache seulement une reference et un job, et garde RECONCILE/PENDING.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { readGeniusPayLivePayment } from './geniuspay.live.gateway';
import {
  rechercherReferenceCandidateWebhook,
  type RecoveryIntent,
  type SignedInboxEvent,
} from './messayInterurbainWebhookCandidates.service';

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const REFERENCE = /^[A-Za-z0-9_-]{4,128}$/;
const MAX_EVENTS = 500;

type Json = Record<string, unknown>;
type Intent = RecoveryIntent & Readonly<{
  provider: string;
  environment: string;
  currency: string;
}>;

type InboxRow = SignedInboxEvent & Readonly<{
  processing_error_code: string | null;
}>;

export type RecoveryResult = Readonly<{
  statut: 'AUCUN_INDICE' | 'REVUE_MANUELLE' | 'REFERENCE_RECUPEREE' | 'DEJA_RECUPEREE';
  motif: string;
  evenements: number;
}>;

type ProviderGet = (
  reference: string,
  expected: Readonly<{ intentId: string; companyId: string; amountXof: number }>,
) => Promise<Record<string, unknown>>;

function object(value: unknown): value is Json {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function review(motif: string, evenements = 0): RecoveryResult {
  return { statut: 'REVUE_MANUELLE', motif, evenements };
}

/**
 * Coeur testable, sans POST et sans emission. N'exporter aucun endpoint qui
 * accepterait ProviderGet ou p_provider depuis le client mobile.
 */
export async function executerRecuperationReferenceAvecGet(
  db: SupabaseClient,
  intentId: string,
  getMerchantPayment: ProviderGet,
): Promise<RecoveryResult> {
  if (!UUID.test(intentId)) throw new Error('MESSAY_D82_INTENT_ID_INVALIDE');

  // Lire exclusivement la source serveur. La RPC revalidera l'intention
  // sous verrou juste avant la mutation, pour eliminer les races de lecture.
  const { data: intentData, error: intentError } = await db
    .from('messay_interurbain_payment_intents')
    .select('id,company_id,amount_xof,checkout_state,financial_status,issuance_status,provider_reference,provider,environment,currency')
    .eq('id', intentId)
    .maybeSingle();
  if (intentError || !intentData) throw new Error('MESSAY_D82_LECTURE_INTENTION_IMPOSSIBLE');
  const intent = intentData as Intent;

  if (intent.id !== intentId || !UUID.test(intent.company_id) ||
      !Number.isSafeInteger(intent.amount_xof) || intent.amount_xof < 200 ||
      intent.amount_xof > 2_500_000 || intent.provider !== 'GENIUSPAY' ||
      intent.environment !== 'live' || intent.currency !== 'XOF' ||
      intent.checkout_state !== 'RECONCILE' ||
      intent.financial_status !== 'PENDING' ||
      intent.issuance_status !== 'NOT_ISSUED' ||
      intent.provider_reference !== null) {
    return review('INTENTION_NON_ELIGIBLE');
  }

  // Filtre JSON PostgreSQL/PostgREST: data.metadata.order_id dans la
  // colonne payload. 501 resultats permettent de refuser tout depassement
  // du maximum SQL de 500 sans ignorer des contradictions hors pagination.
  const { data: inboxData, error: inboxError } = await db
    .from('messay_interurbain_geniuspay_webhook_events')
    .select('provider_event_id,intent_id,event_type,environment,raw_sha256,payload,processing_error_code')
    .eq('payload->data->metadata->>order_id', intentId)
    .limit(MAX_EVENTS + 1);
  if (inboxError || !Array.isArray(inboxData)) {
    throw new Error('MESSAY_D82_LECTURE_INBOX_IMPOSSIBLE');
  }
  if (inboxData.length > MAX_EVENTS) return review('TROP_WEBHOOKS');
  const inbox = inboxData as InboxRow[];
  if (inbox.some(e => e.processing_error_code !== null)) {
    return review('WEBHOOK_AVEC_ERREUR', inbox.length);
  }

  const candidate = rechercherReferenceCandidateWebhook(intent, inbox);
  if (candidate.statut === 'AUCUN_INDICE') {
    return { statut: 'AUCUN_INDICE', motif: candidate.motif, evenements: 0 };
  }
  if (candidate.statut !== 'REFERENCE_CANDIDATE') {
    return review(candidate.motif, candidate.event_ids.length);
  }
  if (!REFERENCE.test(candidate.reference)) return review('REFERENCE_INVALIDE');

  // Un GET authentifie uniquement. Pas de POST, pas de corps mobile.
  // Le gateway Live effectue aussi ses verifications de metadata et montant.
  const p = await getMerchantPayment(candidate.reference, {
    intentId: intent.id, companyId: intent.company_id, amountXof: intent.amount_xof,
  });
  const metadata = object(p?.metadata) ? p.metadata : null;
  if (!object(p) || p.reference !== candidate.reference ||
      p.environment !== 'live' || p.currency !== 'XOF' ||
      p.amount !== intent.amount_xof ||
      !metadata || metadata.order_id !== intent.id ||
      metadata.company_id !== intent.company_id ||
      typeof p.status !== 'string' || p.status.trim().length === 0 ||
      p.status.length > 40) {
    return review('GET_FOURNISSEUR_CONTRADICTOIRE', candidate.event_ids.length);
  }

  // UNIQUE mutation: attachement reference + job. La fonction SQL impose
  // une nouvelle verification sous verrou et ne declare PAS SUCCEEDED.
  const { data: result, error: rpcError } = await db.rpc(
    'messay_interurbain_recuperer_reference_webhook',
    { p_intent_id: intentId, p_provider: p },
  );
  if (rpcError) throw new Error('MESSAY_D82_RPC_A_RECONCILIER');
  if (result !== 'REFERENCE_RECUPEREE' && result !== 'DEJA_RECUPEREE') {
    throw new Error('MESSAY_D82_REPONSE_RPC_INCOHERENTE');
  }
  return {
    statut: result,
    motif: 'JOB_RECONCILE_CREE_OU_DEJA_PRESENT',
    evenements: candidate.event_ids.length,
  };
}

/** Point d'entree Live *non planifie* et inactif tant que les flags sont OFF. */
export async function recupererReferenceWebhookLive(
  db: SupabaseClient,
  intentId: string,
): Promise<RecoveryResult> {
  if (process.env.NODE_ENV !== 'production' ||
      process.env.MESSAY_LIVE_PAYMENT_BACKEND_READY !== 'true' ||
      process.env.MESSAY_GENIUSPAY_RECONCILIATION_ENABLED !== 'true' ||
      process.env.MESSAY_GENIUSPAY_INBOX_ENABLED !== 'true') {
    throw new Error('MESSAY_D82_RECUPERATION_LIVE_DESACTIVEE');
  }
  return executerRecuperationReferenceAvecGet(db, intentId, readGeniusPayLivePayment);
}
