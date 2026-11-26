/**
 * MESSAY / Phase D.8 — Identification HORS LIGNE de references candidates.
 *
 * Ce module est PUR : il ne contacte ni GeniusPay ni Supabase, ne modifie
 * aucun statut financier, et n'emet aucun billet.
 *
 * PRECONDITION DE SECURITE : `events` doit provenir exclusivement de l'inbox
 * serveur qui a deja VERIFIE la signature HMAC du webhook. Ne jamais utiliser
 * un payload HTTP brut, un retour mobile, ni une table modifiable par le public.
 *
 * Une REFERENCE_CANDIDATE ne doit JAMAIS etre directement enregistree en base.
 * Avant tout rattachement, le backend doit executer un GET marchant GeniusPay
 * par cette reference et re-verifier environnement, montant, devise,
 * metadata.order_id, metadata.company_id, et les invariants SQL sous verrou.
 */

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const REFERENCE = /^[A-Za-z0-9_-]{4,128}$/;
const SHA256 = /^[a-f0-9]{64}$/i;

type JsonRecord = Record<string, unknown>;

export type RecoveryIntent = Readonly<{
  id: string;
  company_id: string;
  amount_xof: number;
  checkout_state: string;
  financial_status: string;
  issuance_status: string;
  provider_reference: string | null;
}>;

/** Format minimal des lignes lues dans l'inbox deja authentifiee. */
export type SignedInboxEvent = Readonly<{
  provider_event_id: string;
  intent_id: string | null;
  event_type: string;
  environment: string;
  raw_sha256: string;
  payload: unknown;
}>;

export type RecoveryCandidateResult =
  | Readonly<{ statut: 'AUCUN_INDICE'; motif: string; reference: null; event_ids: string[] }>
  | Readonly<{ statut: 'REVUE_MANUELLE'; motif: string; reference: null; event_ids: string[] }>
  | Readonly<{ statut: 'REFERENCE_CANDIDATE'; motif: string; reference: string; event_ids: string[] }>;

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord) : null;
}

function at(object: unknown, ...path: string[]): unknown {
  let current: unknown = object;
  for (const name of path) {
    const obj = record(current);
    if (!obj) return undefined;
    current = obj[name];
  }
  return current;
}

const none = (motif: string): RecoveryCandidateResult =>
  ({ statut: 'AUCUN_INDICE', motif, reference: null, event_ids: [] });
const review = (motif: string, ids: string[]): RecoveryCandidateResult =>
  ({ statut: 'REVUE_MANUELLE', motif, reference: null, event_ids: ids });

/**
 * Retourne uniquement un indice exploitable par une verification fournisseur GET.
 * Refuse les references multiples et toutes les contradictions detectees.
 */
export function rechercherReferenceCandidateWebhook(
  intent: RecoveryIntent,
  events: readonly SignedInboxEvent[],
): RecoveryCandidateResult {
  if (!UUID.test(intent.id) || !UUID.test(intent.company_id) ||
      !Number.isSafeInteger(intent.amount_xof) ||
      intent.amount_xof < 200 || intent.amount_xof > 2_500_000) {
    return review('INTENTION_INVALIDE', []);
  }
  if (intent.checkout_state !== 'RECONCILE' ||
      intent.financial_status !== 'PENDING' ||
      intent.issuance_status !== 'NOT_ISSUED' ||
      intent.provider_reference !== null) {
    return review('INTENTION_NON_ELIGIBLE', []);
  }
  if (!Array.isArray(events) || events.length > 500) {
    return review('LOT_WEBHOOKS_INVALIDE', []);
  }

  const refs = new Set<string>();
  const matchedIds: string[] = [];

  for (const evt of events) {
    // Ne pas ignorer silencieusement une ligne d'inbox mal formee.
    // Les donnees doivent provenir exclusivement du stockage serveur HMAC.
    if (!evt || typeof evt !== 'object' || Array.isArray(evt)) {
      return review('WEBHOOK_CONTRADICTOIRE', matchedIds);
    }

    // On identifie d'abord l'intention : un evenement portant le meme order_id
    // mais un type/environnement incoherent doit bloquer AVANT tout GET.
    // La fonction SQL D8.1 applique les memes contraintes sous verrou.
    const orderId = at(evt.payload, 'data', 'metadata', 'order_id');
    if (orderId !== intent.id) continue;

    if (typeof evt.provider_event_id !== 'string' ||
        evt.provider_event_id.length === 0 ||
        evt.provider_event_id.length > 128) {
      return review('WEBHOOK_CONTRADICTOIRE', matchedIds);
    }
    matchedIds.push(evt.provider_event_id);

    if (evt.environment !== 'live' ||
        typeof evt.event_type !== 'string' ||
        !evt.event_type.startsWith('payment.') ||
        !SHA256.test(evt.raw_sha256) ||
        (evt.intent_id !== null && evt.intent_id !== intent.id) ||
        at(evt.payload, 'id') !== evt.provider_event_id ||
        at(evt.payload, 'environment') !== 'live' ||
        at(evt.payload, 'event') !== evt.event_type ||
        at(evt.payload, 'data', 'metadata', 'company_id') !== intent.company_id ||
        at(evt.payload, 'data', 'currency') !== 'XOF' ||
        at(evt.payload, 'data', 'amount') !== intent.amount_xof) {
      return review('WEBHOOK_CONTRADICTOIRE', matchedIds);
    }

    const ref = at(evt.payload, 'data', 'reference');
    if (typeof ref !== 'string' || !REFERENCE.test(ref)) {
      return review('REFERENCE_WEBHOOK_INVALIDE', matchedIds);
    }
    // Les chemins supplementaires, si presents, ne peuvent pas se contredire.
    const references = [
      at(evt.payload, 'reference'),
      at(evt.payload, 'payment', 'reference'),
      at(evt.payload, 'data', 'payment', 'reference'),
    ];
    if (references.some(value => value !== undefined && value !== null && value !== ref)) {
      return review('REFERENCES_PAYLOAD_CONTRADICTOIRES', matchedIds);
    }
    refs.add(ref);
    if (refs.size > 1) return review('REFERENCES_MULTIPLES', matchedIds);
  }

  if (refs.size === 0) return none('AUCUN_WEBHOOK_EXPLOITABLE');
  return {
    statut: 'REFERENCE_CANDIDATE',
    motif: 'GET_GENIUSPAY_ET_VALIDATION_SQL_OBLIGATOIRES',
    reference: [...refs][0],
    event_ids: [...new Set(matchedIds)],
  };
}
