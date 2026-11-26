/**
 * MESSAY PRO — Dashboard Chef de Gare (correction du 05/11/2026).
 *
 * Les opérations affichées proviennent exclusivement des API existantes.
 * Les indicateurs issus de listes paginées ne sont PAS des totaux officiels.
 * Les chiffres consolidés nécessitent des endpoints backend dédiés.
 * Les permissions doivent également être vérifiées côté serveur.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Info,
  RefreshCw,
  ShieldCheck,
  Ticket,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import {
  garesHierarchyApi,
  garesManagementApi,
  type Gare,
  type GareAccessContext,
  type GareRapportHierarchique,
  type GareTransaction,
} from '../../services/garesManagementApi';

type GareSnapshot = {
  gareId: string;
  day: string;
  transactions: GareTransaction[];
  reports: GareRapportHierarchique[];
  transactionsHaveMore: boolean;
  transactionsError: string;
  reportsError: string;
  updatedAt: Date;
};

function dateInAbidjan(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Abidjan',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function readableDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Abidjan',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function readableTime(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Abidjan',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Une erreur est survenue.';
}

function money(amount: number): string {
  return Number.isFinite(amount)
    ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount)} FCFA`
    : 'Montant indisponible';
}

const actions = [
  {
    to: '/chef-gare/agents',
    title: 'Agents de ma gare',
    detail: 'Gestion des accès et affectation du personnel',
    icon: Users,
  },
  {
    to: '/chef-gare/billetterie',
    title: 'Billetterie',
    detail: 'Ventes, réservations et opérations de la gare',
    icon: Ticket,
  },
  {
    to: '/chef-gare/caisse',
    title: 'Caisse et transactions',
    detail: 'Contrôle des mouvements financiers',
    icon: Wallet,
  },
  {
    to: '/chef-gare/rapports',
    title: 'Rapports et validations',
    detail: 'Contrôler puis transmettre à la direction',
    icon: ClipboardCheck,
  },
] as const;

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  featured = false,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  featured?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${
      featured ? 'border-orange-200 bg-orange-50/70' : 'border-slate-200 bg-white'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold leading-snug text-slate-600">{label}</p>
        <span className={`rounded-xl p-2.5 ${
          featured ? 'bg-white text-orange-600' : 'bg-orange-50 text-orange-600'
        }`}>
          <Icon size={19} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-black tracking-tight text-slate-900" aria-live="polite">
        {value}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{detail}</p>
    </div>
  );
}

export default function ChefGareDashboard() {
  const access = useOutletContext<GareAccessContext>();
  // Dépendance primitive stable : évite de relancer les requêtes lorsque le
  // layout fournit un nouveau tableau gare_ids contenant les mêmes identifiants.
  const authorizedIdsKey = access.gare_ids.join('|');
  const authorizedIds = useMemo(
    () => authorizedIdsKey.split('|').filter(Boolean),
    [authorizedIdsKey],
  );

  const [gareId, setGareId] = useState(() => access.gare_ids[0] ?? '');
  const [gares, setGares] = useState<Gare[]>([]);
  const [garesError, setGaresError] = useState('');
  const [snapshot, setSnapshot] = useState<GareSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(() => new Date());

  const today = dateInAbidjan(now);
  const weekStart = dateInAbidjan(new Date(now.getTime() - 6 * 86_400_000));
  const isAuthorized = access.role === 'CHEF_GARE' && authorizedIds.includes(gareId);

  // Un changement d'attribution ne doit jamais conserver une gare non autorisée.
  useEffect(() => {
    if (!authorizedIds.includes(gareId)) {
      setGareId(authorizedIds[0] ?? '');
    }
  }, [authorizedIds, gareId]);

  // Actualisation modérée pendant que l'onglet est visible.
  // Il ne s'agit pas d'un flux Socket.IO temps réel.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      setNow(new Date());
      setRevision((value) => value + 1);
    };
    const timer = window.setInterval(refresh, 120_000);
    // Après une période en arrière-plan, récupérer les données dès le retour.
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthorized) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setGaresError('');

    void Promise.allSettled([
      garesManagementApi.list(),
      garesHierarchyApi.transactions(gareId, today, today),
      garesHierarchyApi.reports(gareId, weekStart, today),
    ]).then(([stations, financial, hierarchy]) => {
      if (cancelled) return;

      if (stations.status === 'fulfilled') {
        setGares(stations.value);
      } else {
        setGares([]);
        setGaresError(errorText(stations.reason));
      }

      setSnapshot({
        gareId,
        day: today,
        transactions: financial.status === 'fulfilled' ? financial.value.transactions : [],
        reports: hierarchy.status === 'fulfilled' ? hierarchy.value.rapports : [],
        transactionsHaveMore: financial.status === 'fulfilled' && Boolean(financial.value.next_cursor),
        transactionsError: financial.status === 'rejected' ? errorText(financial.reason) : '',
        reportsError: hierarchy.status === 'rejected' ? errorText(hierarchy.reason) : '',
        updatedAt: new Date(),
      });
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [isAuthorized, gareId, today, weekStart, revision]);

  const allowedGares = useMemo(
    () => gares.filter((gare) => authorizedIds.includes(gare.id)),
    [gares, authorizedIds],
  );
  const selectedGare = allowedGares.find((gare) => gare.id === gareId);

  // Ne pas afficher les opérations de la gare précédemment sélectionnée.
  const current = isAuthorized && snapshot?.gareId === gareId && snapshot.day === today
    ? snapshot
    : null;
  const transactions = current?.transactions ?? [];
  const reports = current?.reports ?? [];
  const pendingReports = reports.filter(
    (report) => report.type === 'AGENT' && report.statut === 'SOUMIS_CHEF',
  );
  const txLoaded = Boolean(current && !current.transactionsError);
  const reportsLoaded = Boolean(current && !current.reportsError);
  const isBusy = loading || !current;

  if (access.role !== 'CHEF_GARE' || authorizedIds.length === 0) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
        Accès Chef de Gare non autorisé. Contactez la direction de votre compagnie.
      </div>
    );
  }

  return (
    <main className="space-y-6 pb-8">
      <header className="relative overflow-hidden rounded-[26px] bg-[#111e32] p-5 text-white shadow-lg sm:p-7 lg:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-20 h-72 w-72 rounded-full border-[48px] border-orange-500/10" />
        <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-24 h-32 w-32 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/25 bg-orange-500/10 px-3 py-1 text-xs font-extrabold uppercase tracking-widest text-orange-300">
              <ShieldCheck size={14} aria-hidden="true" /> MESSAY PRO · Chef de gare
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
                Bonjour, {access.display_name || 'Chef de gare'}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
                Pilotez les opérations de vos gares et contrôlez les rapports de vos agents.
              </p>
            </div>
            <p className="flex items-center gap-2 text-xs text-slate-300">
              <CalendarDays size={15} aria-hidden="true" />
              <span className="capitalize">{readableDate(now)}</span> · Heure d'Abidjan
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setNow(new Date()); setRevision((value) => value + 1); }}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-orange-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            Actualiser
          </button>
        </div>
        <div className="relative mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4 text-xs text-slate-300">
          <span className="inline-flex items-center gap-2"><Activity size={15} className="text-orange-400" /> Actualisation toutes les 2 minutes (onglet actif)</span>
          {current?.updatedAt && (
            <span className="inline-flex items-center gap-2"><Clock3 size={15} aria-hidden="true" /> Dernière synchronisation : {readableTime(current.updatedAt)}</span>
          )}
        </div>
      </header>

      <section aria-label="Gare supervisée" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="rounded-2xl bg-orange-50 p-3 text-orange-600"><Building2 size={24} aria-hidden="true" /></span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Gare supervisée</p>
              <p className="truncate text-lg font-black text-slate-900">
                {selectedGare?.nom ?? (loading ? 'Chargement…' : garesError ? 'Nom de gare indisponible' : 'Gare attribuée')}
              </p>
              <p className="text-sm text-slate-500">
                {selectedGare?.ville || `${authorizedIds.length} gare${authorizedIds.length > 1 ? 's' : ''} autorisée${authorizedIds.length > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          {authorizedIds.length > 1 && (
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">
              Choisir la gare
              <select
                value={gareId}
                onChange={(event) => setGareId(event.target.value)}
                className="max-w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 focus:border-orange-400 focus:outline-none"
              >
                {authorizedIds.map((id) => (
                  <option key={id} value={id}>
                    {allowedGares.find((gare) => gare.id === id)?.nom ?? `Gare ${id.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </section>

      {(garesError || current?.transactionsError || current?.reportsError) && (
        <div role="alert" className="space-y-1 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-bold">Certaines données n'ont pas pu être chargées.</p>
          {garesError && <p>Gares : {garesError}</p>}
          {current?.transactionsError && <p>Transactions : {current.transactionsError}</p>}
          {current?.reportsError && <p>Rapports : {current.reportsError}</p>}
          <button type="button" onClick={() => setRevision((value) => value + 1)} className="mt-2 font-bold text-orange-700 underline">
            Réessayer
          </button>
        </div>
      )}

      <section aria-label="Indicateurs de la gare" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Mouvements chargés aujourd'hui"
          value={isBusy || !txLoaded ? '—' : `${transactions.length}${current?.transactionsHaveMore ? '+' : ''}`}
          detail="Première page d'opérations, pas un total comptable consolidé."
          icon={Wallet}
        />
        <StatCard
          label="Rapports chargés · 7 jours"
          value={isBusy || !reportsLoaded ? '—' : reports.length}
          detail="Nombre de rapports reçus dans la liste, potentiellement limitée."
          icon={ClipboardCheck}
        />
        <StatCard
          label="Rapports agents à contrôler"
          value={isBusy || !reportsLoaded ? '—' : pendingReports.length}
          detail="Rapports SOUMIS_CHEF dans les résultats chargés, pas un total exhaustif."
          icon={Users}
          featured
        />
        <StatCard
          label="Gares autorisées"
          value={authorizedIds.length}
          detail="Attributions liées à votre compte Chef de Gare."
          icon={Building2}
        />
        <StatCard
          label="Billets vendus aujourd'hui"
          value="—"
          detail="Total officiel à connecter à une API de statistiques de gare."
          icon={Ticket}
        />
        <StatCard
          label="Départs prévus aujourd'hui"
          value="—"
          detail="Total officiel à connecter au planning de gare."
          icon={CalendarDays}
        />
      </section>

      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-relaxed text-slate-600">
        <Info size={16} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
        <p>
          Les compteurs « chargés » proviennent de réponses paginées (actuellement jusqu'à 50 transactions et 200 rapports).
          Les recettes, ventes et départs consolidés devront être calculés par des endpoints backend dédiés, filtrés par compagnie, gare et période.
        </p>
      </div>

      {reportsLoaded && !loading && pendingReports.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-white p-2 text-orange-600"><ClipboardCheck size={20} aria-hidden="true" /></span>
            <div>
              <p className="text-sm font-black text-slate-900">Rapports en attente de votre contrôle</p>
              <p className="text-xs text-slate-600">{pendingReports.length} rapport(s) repéré(s) dans la liste chargée.</p>
            </div>
          </div>
          <Link to="/chef-gare/rapports" className="inline-flex items-center gap-1 text-sm font-extrabold text-orange-700 hover:underline">
            Vérifier les rapports <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      )}

      <section aria-label="Accès rapides" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-black tracking-tight text-slate-900 sm:text-xl">Gestion de votre gare</h2>
          <p className="text-xs text-slate-500">Actions réservées aux gares qui vous sont attribuées</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {actions.map(({ to, title, detail, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
            >
              <span className="rounded-xl bg-orange-50 p-3 text-orange-600"><Icon size={22} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-extrabold text-slate-900">{title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500">{detail}</span>
              </span>
              <ArrowRight size={18} className="shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-orange-600" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <section aria-label="Activité financière récente" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Transactions récentes de la gare</h2>
            <p className="mt-1 text-xs text-slate-500">Journée du {today} · opérations provenant du backend</p>
          </div>
          <Link to="/chef-gare/caisse" className="inline-flex items-center gap-1 text-sm font-bold text-orange-600 hover:underline">
            Ouvrir la caisse <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {isBusy ? (
            <p className="p-5 text-sm text-slate-500">Chargement des mouvements…</p>
          ) : !txLoaded ? (
            <p role="status" className="p-5 text-sm text-amber-800">Impossible de charger les transactions. Utilisez « Réessayer » ci-dessus.</p>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <CheckCircle2 size={28} className="text-slate-300" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-700">Aucun mouvement enregistré dans les résultats du jour.</p>
              <p className="text-xs text-slate-500">Les nouvelles opérations apparaîtront après actualisation.</p>
            </div>
          ) : transactions.slice(0, 8).map((tx) => (
            <div key={tx.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50">
              <div className="flex min-w-0 items-center gap-3">
                <span className="rounded-lg bg-slate-100 p-2 text-slate-600"><Wallet size={17} aria-hidden="true" /></span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{tx.reference_billet || 'Mouvement sans référence de billet'}</p>
                  <p className="mt-1 text-xs text-slate-500">{tx.agent_nom || 'Agent non renseigné'} · {tx.mode_paiement}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-slate-900">{money(tx.montant_fcfa)}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{tx.statut}</p>
              </div>
            </div>
          ))}
        </div>
        {current?.transactionsHaveMore && txLoaded && (
          <p className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-600">
            D'autres transactions existent. Ce tableau présente seulement les premières opérations chargées.
          </p>
        )}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-orange-600" /> Vue limitée aux gares attribuées par le backend.</span>
        <span>MESSAY PRO · Exploitation de gare</span>
      </footer>
    </main>
  );
}
