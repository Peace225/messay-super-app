/**
 * MESSAY PRO — Tableau de bord agent.
 * Données uniquement issues de l'API et limitées au compte/gare par le serveur.
 * IMPORTANT : les montants sont ceux des opérations chargées (50 max),
 * jamais un solde comptable ni un total global certifié.
 */
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  ArrowRight, Bus, ClipboardList, RefreshCw, ScanLine,
  Ticket, Wallet, AlertCircle, type LucideIcon,
} from 'lucide-react';
import {
  garesHierarchyApi,
  garesManagementApi,
  type Gare,
  type GareAccessContext,
  type GareRapportHierarchique,
  type GareTransaction,
  type GareAccessRole,
} from '../../services/garesManagementApi';

type AgentRole = Exclude<GareAccessRole, 'DIRECTION' | 'CHEF_GARE'>;
type Action = { to: string; title: string; subtitle: string; icon: LucideIcon };

const ROLE_CONFIG: Record<AgentRole, {
  name: string; description: string; actions: Action[];
}> = {
  AGENT_BILLETTERIE: {
    name: 'Agent de billetterie',
    description: 'Billetterie, ventes enregistrées et rapports au Chef de gare.',
    actions: [
      { to: '/agent/vente', title: 'Billetterie et mes ventes', subtitle: 'Consulter mes ventes confirmées', icon: Ticket },
      { to: '/agent/rapports', title: 'Mes rapports', subtitle: 'Déclarer et suivre mes rapports', icon: ClipboardList },
    ],
  },
  AGENT_CAISSE: {
    name: 'Agent de caisse',
    description: 'Opérations de caisse et déclarations de trésorerie.',
    actions: [
      { to: '/agent/caisse', title: 'Ma caisse', subtitle: 'Consulter les mouvements autorisés', icon: Wallet },
      { to: '/agent/rapports', title: 'Mes rapports', subtitle: 'Déclarer et suivre mes rapports', icon: ClipboardList },
    ],
  },
  AGENT_EMBARQUEMENT: {
    name: 'Agent d’embarquement',
    description: 'Contrôle des passagers et suivi des départs.',
    actions: [
      { to: '/agent/embarquement', title: 'Contrôle embarquement', subtitle: 'Accéder à mon espace de contrôle', icon: ScanLine },
      { to: '/agent/rapports', title: 'Mes rapports', subtitle: 'Déclarer et suivre mes rapports', icon: ClipboardList },
    ],
  },
  AGENT_EXPLOITATION: {
    name: 'Agent d’exploitation',
    description: 'Suivi de l’exploitation et des départs de la gare.',
    actions: [
      { to: '/agent/exploitation', title: 'Exploitation', subtitle: 'Suivre les opérations autorisées', icon: Bus },
      { to: '/agent/rapports', title: 'Mes rapports', subtitle: 'Déclarer et suivre mes rapports', icon: ClipboardList },
    ],
  },
};

export function abidjanDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Abidjan', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isAgentRole(role: GareAccessRole): role is AgentRole {
  return Object.prototype.hasOwnProperty.call(ROLE_CONFIG, role);
}

function errorText(value: unknown): string {
  return value instanceof Error ? value.message : 'MESSAY PRO : impossible de charger vos opérations.';
}

const money = (amount: number) => `${new Intl.NumberFormat('fr-FR').format(amount)} F CFA`;

function Tile({ title, number, detail }: { title: string; number: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <p className="mt-3 text-2xl font-black text-slate-900 sm:text-3xl">{number}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

export default function AgentDashboard() {
  const access = useOutletContext<GareAccessContext>();
  const allowedIds = access.gare_ids.join('|');
  const authorized = isAgentRole(access.role) && access.gare_ids.length > 0;
  const config = authorized ? ROLE_CONFIG[access.role as AgentRole] : null;
  const [gareId, setGareId] = useState(access.gare_ids[0] || '');
  const [gares, setGares] = useState<Gare[]>([]);
  const [transactions, setTransactions] = useState<GareTransaction[]>([]);
  const [reports, setReports] = useState<GareRapportHierarchique[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  // Recalcule la date lors de l'actualisation, pas à chaque rendu.
  const period = useMemo(() => {
    const now = new Date();
    return {
      today: abidjanDate(now),
      weekStart: abidjanDate(new Date(now.getTime() - 6 * 86_400_000)),
    };
  }, [revision]);

  useEffect(() => {
    if (access.gare_ids.includes(gareId)) return;
    setGareId(access.gare_ids[0] || '');
  }, [allowedIds, gareId, access.gare_ids]);

  useEffect(() => {
    let active = true;
    setGares([]);
    setTransactions([]);
    setReports([]);
    setHasMore(false);
    setError('');

    if (!authorized || !access.gare_ids.includes(gareId)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void Promise.all([
      garesManagementApi.list(),
      garesHierarchyApi.transactions(gareId, period.today, period.today),
      garesHierarchyApi.reports(gareId, period.weekStart, period.today),
    ]).then(([stations, operations, hierarchy]) => {
      if (!active) return;
      setGares(stations.filter(station => access.gare_ids.includes(station.id)));
      setTransactions(operations.transactions);
      setReports(hierarchy.rapports);
      setHasMore(Boolean(operations.next_cursor));
    }).catch((reason: unknown) => {
      if (active) setError(errorText(reason));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  // allowedIds is a stable representation of authorized stations.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, allowedIds, gareId, period.today, period.weekStart, revision]);

  const gare = gares.find(s => s.id === gareId);
  const received = transactions
    .filter(t => t.statut === 'PAYE' && t.montant_fcfa > 0)
    .reduce((total, t) => total + t.montant_fcfa, 0);
  const reimbursements = transactions.filter(t => t.statut === 'REMBOURSE');
  const returned = reports.filter(r => r.statut === 'RETOURNE_AGENT');

  if (!config) return (
    <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
      MESSAY PRO : ce compte ne possède aucun accès Agent actif.
    </p>
  );

  return <div className="space-y-6 pb-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-orange-600">MESSAY PRO · {config.name}</p>
        <h2 className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">Bonjour, {access.display_name || 'Agent'}</h2>
        <p className="mt-2 text-sm text-slate-500">{config.description}</p>
      </div>
      <button type="button" disabled={loading} onClick={() => setRevision(n => n + 1)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-orange-300 disabled:opacity-50">
        <RefreshCw size={17} className={loading ? 'animate-spin' : ''}/> Actualiser
      </button>
    </header>

    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Ma gare autorisée</p>
      <h3 className="mt-2 text-lg font-black text-slate-900">{gare?.nom || (loading ? 'Chargement…' : 'Gare de rattachement')}</h3>
      <p className="mt-1 text-sm text-slate-500">{gare?.ville || 'Accès contrôlé par le serveur MESSAY PRO'}</p>
      {access.gare_ids.length > 1 && <label className="mt-4 block max-w-md text-sm font-semibold text-slate-700">
        Choisir ma gare
        <select className="mt-2 w-full rounded-xl border border-slate-200 p-3" value={gareId} onChange={(e: ChangeEvent<HTMLSelectElement>) => setGareId(e.target.value)}>
          {access.gare_ids.map(id => <option key={id} value={id}>{gares.find(s => s.id === id)?.nom || id}</option>)}
        </select>
      </label>}
    </section>

    {error && <div role="alert" className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <AlertCircle size={18} className="shrink-0"/>{error}
    </div>}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Activité chargée">
      <Tile title="Mes opérations aujourd'hui" number={loading || error ? '—' : String(transactions.length)} detail={hasMore ? '50 premières opérations : d’autres lignes existent' : 'Opérations renvoyées par le serveur'} />
      <Tile title="Encaissements chargés" number={loading || error ? '—' : money(received)} detail="Uniquement les ventes payées parmi les lignes chargées" />
      <Tile title="Remboursements chargés" number={loading || error ? '—' : String(reimbursements.length)} detail="Nombre de mouvements de remboursement chargés" />
      <Tile title="Mes rapports · 7 jours" number={loading || error ? '—' : String(reports.length)} detail={`${returned.length} rapport(s) retourné(s) par le Chef de gare`} />
    </section>
    <p className="text-xs text-slate-500">Ces chiffres concernent les données chargées à l’écran, pas un bilan financier certifié ni la totalité des ventes.</p>

    <section className="grid gap-4 sm:grid-cols-2" aria-label="Actions autorisées">
      {config.actions.map(({ to, title, subtitle, icon: Icon }) => <Link key={to} to={to}
        className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-orange-300 hover:shadow-md">
        <span className="rounded-xl bg-orange-50 p-3 text-orange-600"><Icon size={22}/></span>
        <span className="min-w-0 flex-1"><span className="block font-bold text-slate-900">{title}</span><span className="mt-1 block text-xs text-slate-500">{subtitle}</span></span>
        <ArrowRight size={18} className="text-slate-400 group-hover:text-orange-600"/>
      </Link>)}
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5">
        <h3 className="font-black text-slate-900">Mes rapports récents</h3>
        <p className="mt-1 text-xs text-slate-500">Du {period.weekStart} au {period.today}</p>
      </div>
      {loading ? <p className="p-5 text-sm text-slate-500">Chargement des rapports…</p>
      : error ? <p className="p-5 text-sm text-slate-500">Impossible d’afficher les rapports pour le moment.</p>
      : reports.length === 0 ? <p className="p-5 text-sm text-slate-500">Aucun rapport soumis pour cette période. Vous pouvez créer votre première déclaration.</p>
      : <div className="divide-y divide-slate-100">
        {reports.slice(0, 5).map(report => <div key={report.id} className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-5">
          <div><p className="text-sm font-bold text-slate-900">Rapport du {report.date_rapport}</p><p className="text-xs text-slate-500">{report.billets_declares} vente(s) déclarée(s)</p></div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${report.statut === 'RETOURNE_AGENT' ? 'bg-red-50 text-red-700' : report.statut === 'VALIDE_CHEF' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            {report.statut.replaceAll('_', ' ')}
          </span>
        </div>)}
      </div>}
      <div className="border-t border-slate-100 p-4"><Link to="/agent/rapports" className="text-sm font-bold text-orange-700 hover:underline">Voir tous mes rapports</Link></div>
    </section>
  </div>;
}
