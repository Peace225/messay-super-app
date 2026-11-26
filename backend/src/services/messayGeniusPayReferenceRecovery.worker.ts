/**
 * MESSAY D.9.3 — Worker INTERNE de recuperation de reference GeniusPay.
 *
 * Cible: la file D9.1 et les RPC D9.2. Aucune route Express, aucun cron,
 * aucune execution a l'import. Le runner existant reste INCHANGE.
 *
 * Recuperer une reference n'est PAS confirmer un paiement. D8.1 ne modifie
 * jamais financial_status/issuance_status et ne cree jamais de billet.
 * L'unique lecture fournisseur autorisee est le GET securise D8.2.
 * NE PAS ACTIVER les flags LIVE avant certification du flux bout en bout.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { recupererReferenceWebhookLive } from './messayInterurbainWebhookRecovery.service';

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

type Job = Readonly<{
  intent_id: string;
  lease_token: string;
  attempts: number;
  leased_until: string;
}>;
type AckOutcome = 'RECOVERED' | 'RETRY' | 'REVIEW';

type AckReason =
  | 'REFERENCE_RECUPEREE'
  | 'AUCUN_INDICE'
  | 'WEBHOOK_A_VERIFIER'
  | 'ERREUR_RECUPERATION'
  | 'RESULTAT_INATTENDU';

export type ReferenceRecoveryWorkerSummary = {
  inspected: number;
  recovered: number;
  alreadyRecovered: number;
  pending: number;
  review: number;
  errors: number;
  expired: number;
  ackFailures: number;
};

function enabled(): boolean {
  return process.env.NODE_ENV === 'production' &&
    process.env.MESSAY_LIVE_PAYMENT_BACKEND_READY === 'true' &&
    process.env.MESSAY_GENIUSPAY_RECONCILIATION_ENABLED === 'true' &&
    process.env.MESSAY_GENIUSPAY_INBOX_ENABLED === 'true' &&
    // D9.3 ajoute un interrupteur distinct: desactive par defaut.
    process.env.MESSAY_GENIUSPAY_REFERENCE_RECOVERY_WORKER_ENABLED === 'true';
}

function validateClaim(data: unknown): Job[] {
  // Un job par passage: un GET ne doit pas pousser un autre bail a expirer.
  if (!Array.isArray(data) || data.length > 1) {
    throw new Error('MESSAY_D93_LOT_INVALIDE');
  }
  return data.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('MESSAY_D93_JOB_INVALIDE');
    }
    const j = entry as Record<string, unknown>;
    if (typeof j.intent_id !== 'string' || !UUID.test(j.intent_id) ||
      typeof j.lease_token !== 'string' || !UUID.test(j.lease_token) ||
      !Number.isSafeInteger(j.attempts) || (j.attempts as number) < 1 ||
      (j.attempts as number) > 8 ||
      typeof j.leased_until !== 'string' ||
      !Number.isFinite(Date.parse(j.leased_until))) {
      throw new Error('MESSAY_D93_JOB_INVALIDE');
    }
    return j as Job;
  });
}

/**
 * Un seul passage; aucune boucle, timer, route, ni autre action au chargement.
 * Le SupabaseClient doit etre privilegie et fourni exclusivement par la
 * factory backend de confiance; jamais par un client web/mobile.
 *
 * Le traitement LIVE est strictement bloque par 5 flags. Le service D8.2
 * applique aussi ses propres verrous avant tout GET.
 *
 * SQL claim => bail exclusif; SQL ACK => token + verification d'expiration.
 * Si le trigger D9.1 a marque DONE pendant le GET, ACK RECOVERED reste
 * idempotent (contrat D9.2).
 */
export async function executerRecuperationReferencesGeniusPay(
  db: SupabaseClient,
  limit = 1,
  leaseSeconds = 120,
): Promise<ReferenceRecoveryWorkerSummary> {
  if (!enabled()) {
    throw new Error('MESSAY_D93_WORKER_DESACTIVE');
  }
  if (limit !== 1 || !Number.isSafeInteger(leaseSeconds) ||
      leaseSeconds < 30 || leaseSeconds > 600) {
    throw new Error('MESSAY_D93_PARAMETRES_INVALIDES');
  }

  const summary: ReferenceRecoveryWorkerSummary = {
    inspected: 0, recovered: 0, alreadyRecovered: 0, pending: 0,
    review: 0, errors: 0, expired: 0, ackFailures: 0,
  };

  const claim = await db.rpc('messay_interurbain_claim_reference_recovery_jobs', {
    p_limit: limit,
    p_lease_seconds: leaseSeconds,
  });
  if (claim.error) {
    throw new Error('MESSAY_D93_CLAIM_REFUSE');
  }
  const jobs = validateClaim(claim.data);

  for (const job of jobs) {
    summary.inspected++;
    // Une reprise tardive ne doit pas entamer un GET sur un bail deja expire.
    if (Date.parse(job.leased_until) <= Date.now()) {
      summary.expired++;
      continue; // Aucune tentative d'ACK avec un token deja expire.
    }

    let outcome: AckOutcome = 'RETRY';
    let reason: AckReason = 'ERREUR_RECUPERATION';
    try {
      const result = await recupererReferenceWebhookLive(db, job.intent_id);
      switch (result.statut) {
        case 'REFERENCE_RECUPEREE':
          summary.recovered++;
          outcome = 'RECOVERED'; reason = 'REFERENCE_RECUPEREE';
          break;
        case 'DEJA_RECUPEREE':
          summary.alreadyRecovered++;
          outcome = 'RECOVERED'; reason = 'REFERENCE_RECUPEREE';
          break;
        case 'AUCUN_INDICE':
          summary.pending++;
          outcome = 'RETRY'; reason = 'AUCUN_INDICE';
          break;
        case 'REVUE_MANUELLE':
          summary.review++;
          outcome = 'REVIEW'; reason = 'WEBHOOK_A_VERIFIER';
          break;
        default:
          // Resultat non documente: aucune supposition sur le paiement.
          summary.errors++;
          outcome = 'REVIEW'; reason = 'RESULTAT_INATTENDU';
      }
    } catch {
      // Timeout GET, erreur SQL/inbox ou indisponibilite: ne JAMAIS POST.
      summary.errors++;
      outcome = 'RETRY'; reason = 'ERREUR_RECUPERATION';
    }

    try {
      const ack = await db.rpc('messay_interurbain_ack_reference_recovery_job', {
        p_intent_id: job.intent_id,
        p_lease_token: job.lease_token,
        p_outcome: outcome,
        p_reason: reason,
      });
      if (ack.error || ack.data !== true) {
        summary.ackFailures++;
      }
    } catch {
      // Bail laisse expirer; sa reprise sera arbitree en SQL.
      summary.ackFailures++;
    }
  }
  return summary;
}
