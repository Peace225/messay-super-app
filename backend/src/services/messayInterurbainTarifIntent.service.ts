/**
 * MESSAY — création d'une intention depuis un tarif stocké dans PostgreSQL.
 * Aucune route n'est montée ici. Aucun appel à GeniusPay, aucun billet émis.
 * La RPC doit être exécutée par le backend privilégié, jamais depuis Expo.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

type IntentRow = Readonly<{
  intent_id: string;
  company_id: string;
  affectation_id: string;
  amount_xof: number;
  hold_expires_at: string;
  checkout_state: string;
}>;

function singleRow(data: unknown): Record<string, unknown> {
  const value: unknown = Array.isArray(data)
    ? (data.length === 1 ? data[0] : null)
    : data;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('MESSAY_TARIF_RPC_REPONSE_INVALIDE');
  }
  return value as Record<string, unknown>;
}

export async function creerIntentionTarifInterurbain(
  db: SupabaseClient,
  args: Readonly<{
    holdId: string;
    actorId: string; // Doit provenir du JWT vérifié côté Express
    passengerName: string;
    passengerPhone: string;
  }>,
): Promise<IntentRow> {
  if (!UUID.test(args.holdId) || !UUID.test(args.actorId)) {
    throw new Error('MESSAY_TARIF_IDS_INVALIDES');
  }
  const passengerName = args.passengerName.trim();
  const passengerPhone = args.passengerPhone.trim();
  if (passengerName.length < 2 || passengerName.length > 160 ||
      !/^\+?[0-9]{8,15}$/.test(passengerPhone)) {
    throw new Error('MESSAY_PASSAGER_INVALIDE');
  }

  // Interdit : montant, company_id ou tarif venant de l'application mobile.
  const { data, error } = await db.rpc('messay_interurbain_creer_intention_tarif', {
    p_hold_id: args.holdId,
    p_actor: args.actorId,
    p_passenger_name: passengerName,
    p_passenger_phone: passengerPhone,
  });
  if (error) {
    throw new Error(`MESSAY_TARIF_RPC_REFUSEE:${error.code ?? 'unknown'}`);
  }
  const row = singleRow(data);
  const expiry = typeof row.hold_expires_at === 'string'
    ? Date.parse(row.hold_expires_at)
    : NaN;
  if (!UUID.test(String(row.intent_id ?? '')) ||
      !UUID.test(String(row.company_id ?? '')) ||
      !UUID.test(String(row.affectation_id ?? '')) ||
      !Number.isSafeInteger(row.amount_xof) ||
      (row.amount_xof as number) < 200 ||
      (row.amount_xof as number) > 2_500_000 ||
      !Number.isFinite(expiry) || expiry <= Date.now() ||
      !['NEW', 'CLAIMED', 'READY', 'RECONCILE'].includes(String(row.checkout_state))) {
    throw new Error('MESSAY_TARIF_INTENTION_INCOHERENTE');
  }
  return row as IntentRow;
}
