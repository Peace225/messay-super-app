/**
 * MESSAY PRO — Caisse du Chef de gare.
 *
 * Montants calculés uniquement sur les transactions récupérées et déjà
 * chargées par useChefTransactions(). Ces indicateurs ne constituent pas
 * un solde de caisse certifié ni une clôture comptable.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CircleDollarSign,
  ClipboardCheck,
  Info,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { Card, ChefPage, money } from './ChefShared';
import {
  LoadMore,
  TransactionFilters,
  TransactionList,
  useChefTransactions,
} from './ChefTransactionsShared';

/** Convertit un montant reçu de l'API sans jamais propager NaN/Infinity. */
function montantValide(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function libelleMode(mode: unknown): string {
  if (typeof mode !== 'string' || !mode.trim()) return 'Non renseigné';
  return mode.replaceAll('_', ' ');
}

export default function ChefCaissePage() {
  const state = useChefTransactions();

  const stats = useMemo(() => {
    let encaissements = 0;
    let remboursements = 0;
    let nombreEncaissements = 0;
    let nombreRemboursements = 0;
    let anomaliesMontants = 0;
    let autresStatuts = 0;

    const repartition = new Map<string, { nombre: number; montant: number }>();

    for (const tx of state.rows) {
      const montant = montantValide(tx.montant_fcfa);

      if (tx.statut === 'PAYE') {
        // Un encaissement négatif ou non numérique n'est pas additionné.
        if (montant === null || montant < 0) {
          anomaliesMontants += 1;
          continue;
        }

        nombreEncaissements += 1;
        encaissements += montant;
        const mode = libelleMode(tx.mode_paiement);
        const actuel = repartition.get(mode) ?? { nombre: 0, montant: 0 };
        repartition.set(mode, {
          nombre: actuel.nombre + 1,
          montant: actuel.montant + montant,
        });
      } else if (tx.statut === 'REMBOURSE') {
        if (montant === null) {
          anomaliesMontants += 1;
          continue;
        }
        nombreRemboursements += 1;
        // Certains systèmes enregistrent les remboursements en négatif,
        // d'autres en positif : leur impact sur la caisse reste négatif.
        remboursements += Math.abs(montant);
      } else {
        // EN_ATTENTE, ANNULE, ECHEC, etc. ne modifient pas le net.
        autresStatuts += 1;
      }
    }

    return {
      encaissements,
      remboursements,
      netIndicatif: encaissements - remboursements,
      nombreEncaissements,
      nombreRemboursements,
      anomaliesMontants,
      autresStatuts,
      repartition: [...repartition.entries()]
        .map(([mode, values]) => ({ mode, ...values }))
        .sort((a, b) => b.montant - a.montant),
    };
  }, [state.rows]);

  const aPlusieursPages = Boolean(state.cursor);

  return (
    <ChefPage
      title="Caisse et transactions"
      description="Contrôlez les encaissements, remboursements et modes de paiement réellement enregistrés pour les gares auxquelles vous avez accès."
    >
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-[#111827] px-5 py-6 text-white shadow-sm sm:px-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-orange-500/15 blur-3xl"
          />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-300">
                MESSAY PRO · Suivi de trésorerie
              </p>
              <h2 className="mt-2 text-xl font-black tracking-tight sm:text-2xl">
                Mouvements de la caisse
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Montants issus des transactions chargées pour la période et la gare sélectionnées.
                Aucun montant n'est généré artificiellement.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <Wallet size={28} className="text-orange-300" aria-hidden="true" />
            </div>
          </div>
        </div>

        <TransactionFilters state={state} />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Card className="transition duration-200 motion-safe:hover:-translate-y-1 hover:shadow-md">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Wallet size={19} className="text-emerald-600" aria-hidden="true" />
              Encaissements confirmés chargés
            </div>
            <p className="break-words text-2xl font-black text-emerald-700 sm:text-3xl" aria-live="polite">
              {money(stats.encaissements)}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {stats.nombreEncaissements} opération(s) au statut PAYE
            </p>
          </Card>

          <Card className="transition duration-200 motion-safe:hover:-translate-y-1 hover:shadow-md">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-500">
              <RotateCcw size={19} className="text-rose-600" aria-hidden="true" />
              Remboursements chargés
            </div>
            <p className="break-words text-2xl font-black text-rose-700 sm:text-3xl" aria-live="polite">
              {money(stats.remboursements)}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {stats.nombreRemboursements} opération(s) au statut REMBOURSE
            </p>
          </Card>

          <Card className="transition duration-200 motion-safe:hover:-translate-y-1 hover:shadow-md sm:col-span-2 xl:col-span-1">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-500">
              <CircleDollarSign size={19} className="text-orange-600" aria-hidden="true" />
              Net indicatif des mouvements chargés
            </div>
            <p
              className={`break-words text-2xl font-black sm:text-3xl ${
                stats.netIndicatif < 0 ? 'text-rose-700' : 'text-slate-900'
              }`}
              aria-live="polite"
            >
              {money(stats.netIndicatif)}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Encaissements PAYE − remboursements REMBOURSE
            </p>
          </Card>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Info size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            <strong>Indicateurs partiels.</strong> Calculés sur {state.rows.length} mouvement(s)
            déjà chargé(s). {aPlusieursPages
              ? 'D’autres transactions sont disponibles : chargez-les pour compléter cette vue.'
              : 'Ils ne constituent ni un rapprochement bancaire ni un solde certifié.'}
            {' '}Même sans autre page, une validation comptable reste nécessaire.
          </p>
        </div>

        {(stats.anomaliesMontants > 0 || stats.autresStatuts > 0) && (
          <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <AlertTriangle size={19} className="mt-0.5 shrink-0 text-orange-600" aria-hidden="true" />
            <div className="space-y-1">
              {stats.anomaliesMontants > 0 && (
                <p>
                  <strong>{stats.anomaliesMontants} montant(s) incohérent(s)</strong> exclus des calculs.
                  Vérifiez ces opérations avant toute clôture.
                </p>
              )}
              {stats.autresStatuts > 0 && (
                <p>
                  {stats.autresStatuts} mouvement(s) avec un statut différent de PAYE ou REMBOURSE
                  ne sont pas inclus dans le net indicatif.
                </p>
              )}
            </div>
          </div>
        )}

        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                <ReceiptText size={19} className="text-orange-600" aria-hidden="true" />
                Encaissements par mode de paiement
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Répartition des opérations PAYE déjà chargées
              </p>
            </div>
          </div>

          {stats.repartition.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              Aucun encaissement confirmé pour les filtres sélectionnés.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.repartition.map(({ mode, montant, nombre }) => (
                <div key={mode} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="text-sm font-semibold capitalize text-slate-800">{mode.toLowerCase()}</p>
                    <p className="mt-1 text-xs text-slate-500">{nombre} opération(s)</p>
                  </div>
                  <p className="text-sm font-extrabold text-slate-900">{money(montant)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <section aria-label="Historique des transactions" className="space-y-3">
          <h3 className="text-lg font-black text-slate-900">Historique des transactions</h3>
          <TransactionList rows={state.rows} loading={state.loading} />
          <LoadMore
            cursor={state.cursor}
            loading={state.loading}
            onClick={() => void state.load(state.cursor)}
          />
        </section>

        <Card className="border-orange-200 bg-orange-50">
          <div className="flex items-start gap-3">
            <ShieldCheck size={22} className="mt-0.5 shrink-0 text-orange-600" aria-hidden="true" />
            <div>
              <p className="font-extrabold text-slate-900">Clôture et rapprochement comptable</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Cette page présente les transactions de la gare mais ne valide aucune clôture.
                Une clôture certifiée doit être calculée et contrôlée côté backend, après
                rapprochement des paiements, remboursements et justificatifs des agents.
                Aucune clôture fictive n'est créée ici.
              </p>
              <Link
                to="/chef-gare/rapports"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
              >
                <ClipboardCheck size={17} aria-hidden="true" />
                Rapports et validations
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </ChefPage>
  );
}
