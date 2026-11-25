/**
 * MESSAY PRO — Billetterie de la gare.
 * Affiche exclusivement les transactions chargées par useChefTransactions.
 * Aucun paiement ni billet n'est créé depuis cette page.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  ReceiptText,
  TicketCheck,
  Wallet,
} from 'lucide-react';
import { Card, ChefPage, money } from './ChefShared';
import {
  LoadMore,
  TransactionFilters,
  TransactionList,
  useChefTransactions,
} from './ChefTransactionsShared';

export default function ChefBilletteriePage() {
  const state = useChefTransactions();

  const statistiques = useMemo(() => {
    // PAYE est le statut métier qui confirme l'encaissement enregistré.
    // Une transaction payée n'est pas forcément une vente de billet.
    const operationsPayees = state.rows.filter(
      (transaction) => transaction.statut === 'PAYE',
    );

    const operationsBillets = operationsPayees.filter(
      (transaction) =>
        typeof transaction.reference_billet === 'string' &&
        transaction.reference_billet.trim().length > 0,
    );

    const montantBilletsCharges = operationsBillets.reduce((total, transaction) => {
      const montant = Number(transaction.montant_fcfa);
      return Number.isFinite(montant) ? total + montant : total;
    }, 0);

    return {
      operationsPayees,
      operationsBillets,
      montantBilletsCharges,
      sansReference: operationsPayees.length - operationsBillets.length,
    };
  }, [state.rows]);

  return (
    <ChefPage
      title="Billetterie de ma gare"
      description="Consultez les transactions payées ayant une référence de billet, pour la gare et la période sélectionnées. Les totaux ci-dessous concernent uniquement les lignes chargées."
    >
      <TransactionFilters state={state} />

      <section aria-label="Indicateurs de billetterie" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="motion-safe:transition-all motion-safe:duration-300 hover:border-orange-200 hover:shadow-md">
          <div className="mb-3 flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-slate-500">Opérations PAYE chargées</p>
            <span className="rounded-xl bg-orange-50 p-2.5 text-orange-600">
              <Wallet size={20} aria-hidden="true" />
            </span>
          </div>
          <p className="text-3xl font-black text-slate-900" aria-live="polite">
            {state.loading && state.rows.length === 0 ? '—' : statistiques.operationsPayees.length}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Toutes les opérations payées affichées, avec ou sans référence de billet.
          </p>
        </Card>

        <Card className="motion-safe:transition-all motion-safe:duration-300 hover:border-orange-200 hover:shadow-md">
          <div className="mb-3 flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-slate-500">Ventes référencées chargées</p>
            <span className="rounded-xl bg-orange-50 p-2.5 text-orange-600">
              <TicketCheck size={20} aria-hidden="true" />
            </span>
          </div>
          <p className="text-3xl font-black text-slate-900" aria-live="polite">
            {state.loading && state.rows.length === 0 ? '—' : statistiques.operationsBillets.length}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Transactions PAYE ayant une référence de billet, sans dédupliquer les références.
          </p>
        </Card>

        <Card className="motion-safe:transition-all motion-safe:duration-300 hover:border-orange-200 hover:shadow-md sm:col-span-2 xl:col-span-1">
          <div className="mb-3 flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-slate-500">Montant référencé chargé</p>
            <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
              <BadgeCheck size={20} aria-hidden="true" />
            </span>
          </div>
          <p className="text-2xl font-black tracking-tight text-slate-900" aria-live="polite">
            {state.loading && state.rows.length === 0
              ? '—'
              : money(statistiques.montantBilletsCharges)}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Somme des transactions PAYE référencées chargées, non consolidée par le backend.
          </p>
        </Card>
      </section>

      {statistiques.sansReference > 0 && (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 shrink-0" size={19} aria-hidden="true" />
          <div>
            <p className="font-bold">{statistiques.sansReference} opération(s) PAYE sans référence de billet</p>
            <p className="mt-1 leading-6">
              Elles ne sont pas comptées comme ventes de billets dans les indicateurs référencés.
              Consultez la caisse pour examiner ces opérations.
            </p>
            <Link to="/chef-gare/caisse" className="mt-2 inline-flex items-center gap-1 font-semibold underline underline-offset-2">
              Accéder à la caisse <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}

      <section className="space-y-3" aria-label="Transactions de billetterie confirmées">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
              <ReceiptText size={20} className="text-orange-600" aria-hidden="true" />
              Ventes confirmées avec référence
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Seules les transactions avec statut PAYE et référence de billet sont affichées.
            </p>
          </div>
        </div>

        <TransactionList
          rows={statistiques.operationsBillets}
          loading={state.loading}
          emptyText="Aucune transaction payée avec référence de billet pour la période sélectionnée."
        />
        <LoadMore
          cursor={state.cursor}
          loading={state.loading}
          onClick={() => void state.load(state.cursor)}
        />
      </section>

      <Card className="border-orange-200 bg-orange-50">
        <div className="flex items-start gap-3">
          <TicketCheck className="mt-0.5 shrink-0 text-orange-600" size={20} aria-hidden="true" />
          <div>
            <p className="font-bold text-slate-900">Vente de billets au guichet</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              L'émission d'un billet exige un départ réel, une place réservée sans conflit et une
              confirmation de paiement vérifiée côté backend. Cette page assure uniquement le suivi
              des transactions confirmées et ne crée ni réservation ni billet fictif.
            </p>
          </div>
        </div>
      </Card>
    </ChefPage>
  );
}
