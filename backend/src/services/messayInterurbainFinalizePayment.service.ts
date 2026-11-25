/**
 * MESSAY — rapprochement bancaire et émission atomique (branche serveur).
 * Aucune route Express n'est montée ici. Ce service ne peut être appelé
 * que par un worker backend autorisé après validation de l'origine de l'événement.
 * Ne pas exposer son argument intentId à une route passager non autorisée.
 * Le RPC PostgreSQL est l'unique responsable de la mutation financière.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { readGeniusPayLivePayment } from './geniuspay.live.gateway';

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

type IntentRow = {
  id: string;
  company_id: string;
  amount_xof: number;
  hold_id: string;
  affectation_id: string;
  provider_reference: string | null;
  financial_status: string;
  issuance_status: string;
  ticket_id: string | null;
};

export type FinalisationResultat = Readonly<{
  resultat: 'EN_ATTENTE' | 'BILLET_EMIS' | 'DEJA_EMIS' | 'PAIEMENT_A_RAPPROCHER';
  billet_id: string | null;
  motif: string | null;
}>;

function exactlyOne(value: unknown): Record<string, unknown> {
  const row = Array.isArray(value) ? (value.length === 1 ? value[0] : null) : value;
  if (row === null || typeof row !== 'object' || Array.isArray(row)) {
    throw new Error('MESSAY_RESULTAT_SQL_INVALIDE');
  }
  return row as Record<string, unknown>;
}

/**
 * db : client Supabase service_role créé côté serveur uniquement.
 * Ne pas appeler cette fonction si l'origine de l'événement n'a pas été
 * authentifiée ou si le worker de rapprochement n'a pas été autorisé.
 */
/**
 * Rattachement pour audit uniquement.
 * Ne confirme aucun paiement et ne crée aucun billet.
 * Une erreur de journalisation ne modifie jamais le résultat financier.
 */
async function rattacherWebhooksPourAudit(
  db: SupabaseClient,
  intent: Pick<IntentRow, 'id' | 'provider_reference'>,
): Promise<void> {
  if (!intent.provider_reference) {
    console.error('[MESSAY/GENIUSPAY] WEBHOOK_LINK_REFERENCE_ABSENTE');
    return;
  }

  try {
    const { error } = await db.rpc(
      'messay_interurbain_lier_evenements_webhook',
      {
        p_intent_id: intent.id,
        p_provider_reference: intent.provider_reference,
      },
    );

    if (error) {
      console.error('[MESSAY/GENIUSPAY] WEBHOOK_LINK_FAILED', {
        code: error.code ?? 'SQL_ERROR',
      });
    }
  } catch {
    console.error('[MESSAY/GENIUSPAY] WEBHOOK_LINK_UNAVAILABLE');
  }
}

export async function rapprocherEtEmettreBillet(
  db: SupabaseClient,
  intentId: string,
): Promise<FinalisationResultat> {
  if (!UUID.test(intentId)) throw new Error('MESSAY_INTENT_ID_INVALIDE');

  const { data, error } = await db
    .from('messay_interurbain_payment_intents')
    .select('id,company_id,hold_id,affectation_id,amount_xof,provider_reference,financial_status,issuance_status,ticket_id')
    .eq('id', intentId)
    .maybeSingle();
  if (error || !data) throw new Error('MESSAY_INTENTION_INTROUVABLE');
  const intent = data as IntentRow;

  if (intent.id !== intentId || !UUID.test(intent.company_id) ||
      !UUID.test(intent.hold_id) || !UUID.test(intent.affectation_id) ||
      !Number.isSafeInteger(intent.amount_xof) ||
      intent.amount_xof < 200 || intent.amount_xof > 2_500_000) {
    throw new Error('MESSAY_INTENTION_INCOHERENTE');
  }
  if (intent.financial_status === 'SUCCEEDED' && intent.issuance_status === 'ISSUED') {
    if (!intent.ticket_id || !UUID.test(intent.ticket_id)) {
      throw new Error('MESSAY_BILLET_ID_MANQUANT');
    }
    // Comme le chemin SQL DEJA_EMIS, confirmer l'existence et les liens du billet.
    const { data: ticket, error: ticketError } = await db
      .from('tickets')
      .select('id,company_id,affectation_id,intent_id,hold_id,status')
      .eq('id', intent.ticket_id)
      .maybeSingle();
    if (ticketError || !ticket ||
        ticket.id !== intent.ticket_id ||
        ticket.company_id !== intent.company_id ||
        ticket.affectation_id !== intent.affectation_id ||
        ticket.intent_id !== intent.id ||
        ticket.hold_id !== intent.hold_id ||
        ticket.status !== 'PAYE') {
      throw new Error('MESSAY_BILLET_DEJA_EMIS_INCOHERENT');
    }
    await rattacherWebhooksPourAudit(db, intent);
    return { resultat: 'DEJA_EMIS', billet_id: intent.ticket_id, motif: null };
  }
  if (!intent.provider_reference) throw new Error('MESSAY_REFERENCE_GENIUSPAY_MANQUANTE');

  // Le GET marchand est effectué UNIQUEMENT côté backend avec les clés LIVE.
  // L'appel vérifie déjà la référence, l'environnement, la devise, le montant
  // et metadata.order_id/company_id.
  const payment = await readGeniusPayLivePayment(intent.provider_reference, {
    intentId: intent.id,
    companyId: intent.company_id,
    amountXof: intent.amount_xof,
  });
  if (payment.status === 'pending' || payment.status === 'processing') {
    return { resultat: 'EN_ATTENTE', billet_id: null, motif: 'GENIUSPAY_EN_COURS' };
  }
  // Statut non finalise/negatif : revue manuelle, jamais emission de billet.
  // Retourner un resultat (plutot que lever une exception) permet au worker
  // d'acquitter ce job en REVIEW au lieu de le reessayer indefiniment.
  if (payment.status !== 'completed') {
    return { resultat: 'PAIEMENT_A_RAPPROCHER', billet_id: null,
      motif: 'GENIUSPAY_STATUT_NON_CONFIRME' };
  }
  if (!Number.isSafeInteger(payment.id) || Number(payment.id) <= 0) {
    return { resultat: 'PAIEMENT_A_RAPPROCHER', billet_id: null,
      motif: 'GENIUSPAY_TRANSACTION_INVALIDE' };
  }

  // Jamais p_provider depuis un body HTTP. SQL revalide et verrouille tout.
  const { data: output, error: rpcError } = await db.rpc(
    'messay_interurbain_finaliser_paiement',
    { p_intent_id: intent.id, p_provider: payment },
  );
  if (rpcError) {
    // Une erreur réseau après COMMIT est possible : vérifier le résultat en
    // base lors du prochain passage, ne jamais initier un second paiement.
    throw new Error('MESSAY_FINALISATION_SQL_A_VERIFIER');
  }
  const row = exactlyOne(output);
  if (!['BILLET_EMIS', 'DEJA_EMIS', 'PAIEMENT_A_RAPPROCHER'].includes(String(row.resultat)) ||
      (row.billet_id !== null && (typeof row.billet_id !== 'string' || !UUID.test(row.billet_id)))) {
    throw new Error('MESSAY_REPONSE_FINALISATION_INCOHERENTE');
  }
  await rattacherWebhooksPourAudit(db, intent);

  return {
    resultat: row.resultat as FinalisationResultat['resultat'],
    billet_id: row.billet_id as string | null,
    motif: typeof row.motif === 'string' ? row.motif : null,
  };
}
