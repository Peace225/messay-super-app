/**
 * MESSAY — Worker de rapprochement financier interurbain.
 *
 * - Aucun endpoint Express.
 * - Aucun déclenchement automatique.
 * - Aucune initiation de paiement GeniusPay.
 * - Client Supabase privilégié et vérifié requis.
 * - Désactivé par défaut.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  rapprocherEtEmettreBillet,
} from './messayInterurbainFinalizePayment.service';

const UUID =
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

type Outcome = 'DONE' | 'RETRY' | 'REVIEW';

type Job = {
  intent_id: string;
  lease_token: string;
  attempts: number;
};

export type ReconciliationSummary = {
  inspected: number;
  emitted: number;
  alreadyIssued: number;
  pending: number;
  review: number;
  errors: number;
  ackFailures: number;
};

function workerEnabled(): boolean {
  return (
    process.env.NODE_ENV === 'production' &&
    process.env.MESSAY_GENIUSPAY_RECONCILIATION_ENABLED === 'true' &&
    process.env.MESSAY_LIVE_PAYMENT_BACKEND_READY === 'true'
  );
}

function validateJobs(data: unknown): Job[] {
  if (!Array.isArray(data)) {
    throw new Error('MESSAY_RECONCILIATION_LOT_INVALIDE');
  }

  return data.map((value: unknown) => {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {
      throw new Error('MESSAY_RECONCILIATION_JOB_INVALIDE');
    }

    const job = value as Record<string, unknown>;

    if (
      typeof job.intent_id !== 'string' ||
      !UUID.test(job.intent_id) ||
      typeof job.lease_token !== 'string' ||
      !UUID.test(job.lease_token) ||
      typeof job.attempts !== 'number' ||
      !Number.isSafeInteger(job.attempts) ||
      job.attempts < 1
    ) {
      throw new Error('MESSAY_RECONCILIATION_JOB_INVALIDE');
    }

    return job as Job;
  });
}

/**
 * Exécute un seul lot.
 *
 * Le client db doit être créé côté backend par une factory
 * de production vérifiant la cible Supabase et les privilèges.
 *
 * La fonction SQL claim garantit l'exclusivité du lot.
 * La fonction SQL ack vérifie le jeton de réclamation.
 */
export async function executerRapprochementGeniusPay(
  db: SupabaseClient,
  limit = 10,
): Promise<ReconciliationSummary> {
  if (!workerEnabled()) {
    throw new Error('MESSAY_RECONCILIATION_DESACTIVEE');
  }

  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 25
  ) {
    throw new Error('MESSAY_RECONCILIATION_LIMITE_INVALIDE');
  }

  const summary: ReconciliationSummary = {
    inspected: 0,
    emitted: 0,
    alreadyIssued: 0,
    pending: 0,
    review: 0,
    errors: 0,
    ackFailures: 0,
  };

  const { data, error } = await db.rpc(
    'messay_interurbain_claim_reconciliation_jobs',
    { p_limit: limit },
  );

  if (error) {
    throw new Error('MESSAY_RECONCILIATION_CLAIM_REFUSE');
  }

  const jobs = validateJobs(data);

  for (const job of jobs) {
    summary.inspected++;

    let outcome: Outcome = 'RETRY';

    try {
      const result = await rapprocherEtEmettreBillet(
        db,
        job.intent_id,
      );

      switch (result.resultat) {
        case 'BILLET_EMIS':
          summary.emitted++;
          outcome = 'DONE';
          break;

        case 'DEJA_EMIS':
          summary.alreadyIssued++;
          outcome = 'DONE';
          break;

        case 'EN_ATTENTE':
          summary.pending++;
          outcome = 'RETRY';
          break;

        case 'PAIEMENT_A_RAPPROCHER':
          summary.review++;
          outcome = 'REVIEW';
          break;

        default:
          throw new Error(
            'MESSAY_RECONCILIATION_RESULTAT_INCONNU',
          );
      }
    } catch {
      // Incident réseau, fournisseur ou SQL :
      // ne jamais créer une seconde transaction de paiement.
      // La tâche sera réessayée après temporisation.
      summary.errors++;
      outcome = 'RETRY';
    }

    try {
      const acknowledgment = await db.rpc(
        'messay_interurbain_ack_reconciliation_job',
        {
          p_intent_id: job.intent_id,
          p_lease_token: job.lease_token,
          p_outcome: outcome,
        },
      );

      if (
        acknowledgment.error ||
        acknowledgment.data !== true
      ) {
        summary.ackFailures++;
      }
    } catch {
      // Si l'acquittement échoue, le verrou expirera.
      // Le prochain passage pourra reprendre la tâche.
      summary.ackFailures++;
    }
  }

  return summary;
}
