/**
 * MESSAY — processus autonome de rapprochement GeniusPay.
 *
 * Aucune route Express.
 * Aucun nouveau paiement initié.
 * Désactivé par défaut.
 * Client Supabase production vérifié obligatoire.
 */

import {
  executerRapprochementGeniusPay,
} from '../services/messayGeniusPayReconciliation.worker';

import {
  getGeniusPayInboxProductionClient,
} from '../services/messayGeniusPayInboxProduction.client';

import {
  executerCycleGeniusPayOrchestre,
} from '../services/messayGeniusPayWorkersOrchestrator.service';

function autorise(): boolean {
  return (
    process.env.NODE_ENV === 'production' &&
    process.env.MESSAY_GENIUSPAY_WORKER_ENABLED === 'true' &&
    process.env.MESSAY_GENIUSPAY_RECONCILIATION_ENABLED === 'true' &&
    process.env.MESSAY_LIVE_PAYMENT_BACKEND_READY === 'true' &&
    process.env.MESSAY_GENIUSPAY_INBOX_ENABLED === 'true'
  );
}

function pause(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  if (!autorise()) {
    console.log('MESSAY_WORKER_DESACTIVE');
    console.log('AUCUN APPEL GENIUSPAY');
    return;
  }

  const db = getGeniusPayInboxProductionClient();

  if (!db) {
    throw new Error('MESSAY_CLIENT_PRODUCTION_NON_AUTORISE');
  }

  let arret = false;

  process.once('SIGTERM', () => {
    arret = true;
  });

  process.once('SIGINT', () => {
    arret = true;
  });

  console.log('MESSAY_RECONCILIATION_DEMARREE');

  while (!arret) {
    try {
      // Un seul job par passage :
      // la durée du traitement reste maîtrisée
      // par rapport au bail SQL de deux minutes.
      // Mode D9.6 uniquement sur activation EXPLICITE de l'orchestrateur.
      // Aucun POST GeniusPay n'est effectue par ce runner.
      // Le chemin historique reste preserve tant que ce flag est absent.
      const orchestrationEnabled =
        process.env.MESSAY_GENIUSPAY_ORCHESTRATION_ENABLED === 'true';

      // Evite qu'une configuration partielle ignore silencieusement la
      // recuperation des references pourtant annoncee comme active.
      if (orchestrationEnabled &&
          process.env.MESSAY_GENIUSPAY_REFERENCE_RECOVERY_WORKER_ENABLED !== 'true') {
        throw new Error('MESSAY_ORCHESTRATION_RECOVERY_NON_AUTORISEE');
      }

      const cycle = orchestrationEnabled
        ? await executerCycleGeniusPayOrchestre(db)
        : null;

      const result = cycle
        ? cycle.financialReconciliation
        : orchestrationEnabled
          ? null
          : await executerRapprochementGeniusPay(db, 1);

      if (cycle) {
        const recovery = cycle.referenceRecovery;
        if (recovery.inspected > 0 || recovery.errors > 0 ||
            recovery.ackFailures > 0 || cycle.skippedReason) {
          console.log(JSON.stringify({
            event: 'MESSAY_REFERENCE_RECOVERY_BATCH',
            inspected: recovery.inspected,
            recovered: recovery.recovered,
            alreadyRecovered: recovery.alreadyRecovered,
            pending: recovery.pending,
            review: recovery.review,
            errors: recovery.errors,
            expired: recovery.expired,
            ackFailures: recovery.ackFailures,
            skippedReason: cycle.skippedReason,
          }));
        }
      }

      // Audit indépendant de l'émission des billets.
      // Fonctionne également lorsque la file financière est vide.
      // Ne confirme aucun paiement et n'émet aucun billet.
      try {
        const { data: linked, error: auditError } = await db.rpc(
          'messay_interurbain_rattraper_webhooks_tardifs',
          { p_limit: 25 },
        );

        if (auditError) {
          console.error('MESSAY_WEBHOOK_AUDIT_ERROR', {
            code: auditError.code ?? 'SQL_ERROR',
          });
        } else if (
          typeof linked === 'number' &&
          Number.isSafeInteger(linked) &&
          linked >= 0
        ) {
          if (linked > 0) {
            console.log(JSON.stringify({
              event: 'MESSAY_WEBHOOK_LATE_RECOVERY',
              linked,
            }));
          }
        } else {
          console.error(
            'MESSAY_WEBHOOK_AUDIT_INVALID_RESPONSE',
          );
        }
      } catch (error: unknown) {
        console.error('MESSAY_WEBHOOK_AUDIT_UNAVAILABLE', {
          code: error instanceof Error
            ? error.message
            : 'UNKNOWN',
        });
      }

      if (result && (
        result.inspected > 0 ||
        result.errors > 0 ||
        result.ackFailures > 0
      )) {
        console.log(JSON.stringify({
          event: 'MESSAY_RECONCILIATION_BATCH',
          inspected: result.inspected,
          emitted: result.emitted,
          alreadyIssued: result.alreadyIssued,
          pending: result.pending,
          review: result.review,
          errors: result.errors,
          ackFailures: result.ackFailures,
        }));
      }

      await pause((result?.inspected ?? 0) > 0 ||
        (cycle?.referenceRecovery.inspected ?? 0) > 0 ? 1000 : 15000);

    } catch (error: unknown) {
      const code = error instanceof Error
        ? error.message
        : 'UNKNOWN';

      console.error('MESSAY_RECONCILIATION_ERROR', {
        code,
      });

      // Incident temporaire : ne jamais initier
      // une nouvelle transaction de paiement.
      await pause(30000);
    }
  }

  console.log('MESSAY_RECONCILIATION_ARRETEE');
}

main().catch((error: unknown) => {
  console.error('MESSAY_WORKER_STARTUP_ERROR', {
    code: error instanceof Error
      ? error.message
      : 'UNKNOWN',
  });

  process.exitCode = 1;
});
