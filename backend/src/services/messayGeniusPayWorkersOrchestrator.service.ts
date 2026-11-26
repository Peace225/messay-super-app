/**
 * MESSAY D9.6 — ORCHESTRATEUR INTERNE, UN SEUL PASSAGE.
 * N'installe aucun runner, cron, route Express ou effet a l'import.
 * N'appelle JAMAIS POST GeniusPay. Le GET fournisseur appartient aux workers.
 * STRICTEMENT INACTIF par defaut. Ne pas activer LIVE avant certification.
 *
 * Les deux files SQL sont distinctes. Une reference recuperee n'est JAMAIS
 * une preuve de paiement et ne garantit pas qu'un billet sera emis.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  executerRecuperationReferencesGeniusPay,
  type ReferenceRecoveryWorkerSummary,
} from './messayGeniusPayReferenceRecovery.worker';
import {
  executerRapprochementGeniusPay,
  type ReconciliationSummary,
} from './messayGeniusPayReconciliation.worker';

const FLAGS = [
  'MESSAY_LIVE_PAYMENT_BACKEND_READY',
  'MESSAY_GENIUSPAY_RECONCILIATION_ENABLED',
  'MESSAY_GENIUSPAY_INBOX_ENABLED',
  'MESSAY_GENIUSPAY_WORKER_ENABLED',
  'MESSAY_GENIUSPAY_REFERENCE_RECOVERY_WORKER_ENABLED',
  'MESSAY_GENIUSPAY_ORCHESTRATION_ENABLED',
] as const;

export type OrchestrationGeniusPaySummary = Readonly<{
  referenceRecovery: ReferenceRecoveryWorkerSummary;
  financialReconciliation: ReconciliationSummary | null;
  skippedReason: 'RECOVERY_INCIDENT_OU_REVUE' | null;
}>;

function authorized(): boolean {
  return process.env.NODE_ENV === 'production' &&
    FLAGS.every(flag => process.env[flag] === 'true');
}

/** Refuser toute reponse hors contrat plutot que d'en deduire un paiement. */
function validateCounters(
  result: unknown,
  keys: readonly string[],
  name: string,
): asserts result is Record<string, number> {
  if (result === null || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error(`MESSAY_D96_${name}_INVALIDE`);
  }
  const record = result as Record<string, unknown>;
  for (const key of keys) {
    if (!Number.isSafeInteger(record[key]) || (record[key] as number) < 0) {
      throw new Error(`MESSAY_D96_${name}_INVALIDE`);
    }
  }
  if ((record.inspected as number) > 1 ||
      (record.ackFailures as number) > (record.inspected as number)) {
    throw new Error(`MESSAY_D96_${name}_INVALIDE`);
  }
}

/**
 * Point d'entree NON PLANIFIE. Appel uniquement depuis une future factory
 * backend privilegiee (jamais depuis un utilisateur ni une route passager).
 *
 * - Recuperation: 1 job, bail 120s; pas de seconde initiation.
 * - Si incident/ACK douteux/REVIEW: ne PAS lancer la finance dans ce passage.
 * - Sinon, la file financiere est traitee independamment, 1 job maximum.
 * - Les workers/SQL valident eux-memes le GET et l'emission atomique.
 * - AUCUNE boucle, aucun timer, aucune execution a l'import.
 */
export async function executerCycleGeniusPayOrchestre(
  db: SupabaseClient,
): Promise<OrchestrationGeniusPaySummary> {
  if (!authorized()) throw new Error('MESSAY_D96_ORCHESTRATION_DESACTIVEE');
  if (!db || typeof db.rpc !== 'function') {
    throw new Error('MESSAY_D96_CLIENT_INVALIDE');
  }

  // Une exception de claim/lecture interrompt tout le cycle. Jamais de
  // fallback vers la file financiere si le resultat est indetermine.
  const recovery = await executerRecuperationReferencesGeniusPay(db, 1, 120);
  validateCounters(recovery, [
    'inspected', 'recovered', 'alreadyRecovered', 'pending', 'review',
    'errors', 'expired', 'ackFailures',
  ], 'RECUPERATION');
  if (recovery.recovered + recovery.alreadyRecovered + recovery.pending +
      recovery.review + recovery.errors + recovery.expired > recovery.inspected) {
    throw new Error('MESSAY_D96_RECUPERATION_INVALIDE');
  }

  // Une recuperation en REVIEW, un bail expire ou un ACK incertain
  // ne doivent pas etre suivis par une action financiere dans ce cycle.
  if (recovery.review > 0 || recovery.errors > 0 ||
      recovery.expired > 0 || recovery.ackFailures > 0) {
    return {
      referenceRecovery: recovery,
      financialReconciliation: null,
      skippedReason: 'RECOVERY_INCIDENT_OU_REVUE',
    };
  }

  // Ce job financier peut appartenir a UNE AUTRE intention; pas de couplage
  // artificiel des ID. Le worker financier fait son propre GET avant SQL.
  const financial = await executerRapprochementGeniusPay(db, 1);
  validateCounters(financial, [
    'inspected', 'emitted', 'alreadyIssued', 'pending', 'review', 'errors',
    'ackFailures',
  ], 'FINANCE');
  if (financial.emitted + financial.alreadyIssued + financial.pending +
      financial.review + financial.errors > financial.inspected) {
    throw new Error('MESSAY_D96_FINANCE_INVALIDE');
  }

  return {
    referenceRecovery: recovery,
    financialReconciliation: financial,
    skippedReason: null,
  };
}
