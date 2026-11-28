/**
 * MESSAY PRO — Tableau de bord administrateur général.
 * Emplacement : admin-dashboard/src/pages/SuperAdminDashboard.tsx
 *
 * À utiliser à l'intérieur de SuperAdminLayout (qui rend <Outlet />).
 *
 * Sécurité :
 * - ce composant n'accorde AUCUN rôle ; la route doit être protégée par un
 *   garde JWT et le backend doit revérifier le rôle Prisma ADMIN ;
 * - ne jamais mettre la clé Supabase service_role dans le navigateur ;
 * - les seuls chiffres affichés ici viennent de l'API réelle /admin/transport/stats ;
 * - aucune valeur manquante n'est remplacée par un faux zéro.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowRight,
  Building2,
  BusFront,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  CreditCard,
  LayoutDashboard,
  MapPinned,
  RefreshCw,
  ShieldCheck,
  Ticket,
  Users,
  WalletCards,
} from 'lucide-react';

type TokenProvider = () => string | null | Promise<string | null>;

export interface SuperAdminDashboardProps {
  /** Obtenir le JWT MESSAY depuis le service d'authentification existant. */
  getAccessToken?: TokenProvider;
  /** Ex. http://localhost:5000, ou vide si Vite proxy /api est configuré. */
  apiBaseUrl?: string;
}

interface TransportStats {
  generatedAt?: string;
  users?: { total?: number };
  drivers?: { total?: number; pendingValidation?: number };
  vehicles?: { total?: number; disponible?: number; enCourse?: number };
  courses?: { total?: number };
}

type LoadState = 'unconfigured' | 'loading' | 'ready' | 'error';

interface QuickLink {
  label: string;
  description: string;
  to: string;
  icon: LucideIcon;
}

const MODULES: readonly QuickLink[] = [
  {
    label: 'Compagnies de transport',
    description: 'Consulter les sociétés et leurs espaces de gestion.',
    to: '/compagnies',
    icon: Building2,
  },
  {
    label: 'Approbations',
    description: 'Vérifier les dossiers avant leur mise en service.',
    to: '/approbations',
    icon: ClipboardCheck,
  },
  {
    label: 'Réseau de gares',
    description: 'Superviser les gares, sans se substituer à leur direction.',
    to: '/gares',
    icon: MapPinned,
  },
  {
    label: 'Transport interurbain',
    description: 'Suivre les opérations des compagnies et leurs trajets.',
    to: '/transport',
    icon: BusFront,
  },
  {
    label: 'Billetterie',
    description: 'Consulter les billets et réservations autorisés.',
    to: '/billetterie',
    icon: Ticket,
  },
  {
    label: 'Transactions',
    description: 'Contrôler les flux financiers et les rapprochements.',
    to: '/transactions',
    icon: CreditCard,
  },
  {
    label: 'Commissions MESSAY',
    description: 'Analyser les parts calculées depuis les ventes confirmées.',
    to: '/commissions',
    icon: WalletCards,
  },
  {
    label: 'Utilisateurs',
    description: 'Administrer les comptes et les autorisations globales.',
    to: '/utilisateurs',
    icon: Users,
  },
];

function integerValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function displayCount(value: unknown): string {
  const number = integerValue(value);
  return number === null ? '—' : new Intl.NumberFormat('fr-FR').format(number);
}

function formatTimestamp(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}



function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
}: {
  label: string;
  value: unknown;
  subtitle: string;
  icon: LucideIcon;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-500">{label}</p>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
          <Icon size={20} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 text-3xl font-black tracking-tight text-[#111A30]" aria-label={`${label} : ${displayCount(value)}`}>
        {displayCount(value)}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{subtitle}</p>
    </article>
  );
}

function QuickAccess({ item }: { item: QuickLink }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className="group flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-orange-200 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 group-hover:bg-orange-50 group-hover:text-orange-600">
        <Icon size={21} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-slate-900">{item.label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
      </span>
      <ArrowRight size={17} className="mt-1 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-orange-600" aria-hidden="true" />
    </Link>
  );
}

export default function SuperAdminDashboard({
  getAccessToken,
  apiBaseUrl,
}: SuperAdminDashboardProps) {
  const [stats, setStats] = useState<TransportStats | null>(null);
  const [status, setStatus] = useState<LoadState>(
    getAccessToken ? 'loading' : 'unconfigured',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((current) => current + 1), []);

  useEffect(() => {
    if (!getAccessToken) {
      setStatus('unconfigured');
      setStats(null);
      return;
    }

    const controller = new AbortController();
    let mounted = true;

    async function loadStats() {
      setStatus('loading');
      setErrorMessage(null);

      try {
        const token = await getAccessToken!();
        if (!token) {
          throw new Error('Session administrateur absente. Connectez-vous avec le JWT MESSAY.');
        }

        const response = await fetch(
          `${(import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api').replace(/\/+$/, '')}/admin/transport/stats`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
            signal: controller.signal,
          },
        );

        if (response.status === 401) {
          throw new Error('Session expirée ou invalide. Reconnectez-vous à l’administration MESSAY.');
        }
        if (response.status === 403) {
          throw new Error('Accès refusé : le backend exige le rôle Prisma ADMIN.');
        }
        if (!response.ok) {
          throw new Error(`Impossible de charger les indicateurs transport (HTTP ${response.status}).`);
        }
        const result: unknown = await response.json();
        if (!result || typeof result !== 'object' || Array.isArray(result)) {
          throw new Error('La réponse du backend ne contient pas de statistiques valides.');
        }

        if (mounted) {
          setStats(result as TransportStats);
          setStatus('ready');
        }
      } catch (error) {
        if (!mounted || controller.signal.aborted) return;
        setStats(null);
        setStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : 'Une erreur est survenue pendant le chargement.',
        );
      }
    }

    void loadStats();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [getAccessToken, apiBaseUrl, refreshKey]);

  const lastUpdated = formatTimestamp(stats?.generatedAt);
  const pending = integerValue(stats?.drivers?.pendingValidation);

  return (
    <div className="space-y-7 pb-10">
      <section className="relative overflow-hidden rounded-3xl bg-[#111A30] p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-300">
              <ShieldCheck size={16} aria-hidden="true" /> Administration générale
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
              Tableau de bord MESSAY
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Supervision de la plateforme et accès aux espaces administratifs.
              Les données des compagnies restent distinctes de celles du transport par tricycle.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-bold text-white">
              <CheckCircle2 size={16} className="text-orange-300" aria-hidden="true" /> Rôle requis : ADMIN
            </span>
            <Link
              to="/compagnies"
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-orange-600"
            >
              Gérer les compagnies <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="transport-title" className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 id="transport-title" className="flex items-center gap-2 text-lg font-black text-slate-900">
              <Activity size={20} className="text-orange-500" aria-hidden="true" /> Indicateurs du transport par tricycle
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Source : API MESSAY <code className="text-xs">/api/admin/transport/stats</code>.
              {lastUpdated ? ` Actualisée le ${lastUpdated}.` : ''}
            </p>
          </div>
          <button
            type="button"
            disabled={status === 'loading' || !getAccessToken}
            onClick={refresh}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-orange-200 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={16} className={status === 'loading' ? 'animate-spin' : ''} aria-hidden="true" />
            Actualiser
          </button>
        </div>

        {status === 'unconfigured' && (
          <div role="status" className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <CircleAlert className="mt-0.5 shrink-0 text-orange-500" size={19} aria-hidden="true" />
            <p>Connexion JWT non raccordée : fournissez la prop <code>getAccessToken</code> depuis le service de connexion administrateur. Aucun chiffre fictif n'est affiché.</p>
          </div>
        )}
        {status === 'error' && (
          <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-start gap-2"><CircleAlert className="mt-0.5 shrink-0" size={18} aria-hidden="true" />{errorMessage}</span>
            <button type="button" onClick={refresh} className="shrink-0 self-start rounded-lg border border-red-200 bg-white px-3 py-2 font-bold hover:bg-red-100">Réessayer</button>
          </div>
        )}
        {status === 'loading' && (
          <p role="status" className="text-sm text-slate-500">Chargement des statistiques réelles…</p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Passagers enregistrés" value={stats?.users?.total} subtitle="Comptes USER de la base Prisma" icon={Users} />
          <StatCard label="Conducteurs tricycle" value={stats?.drivers?.total} subtitle="Profils de conducteurs enregistrés" icon={ShieldCheck} />
          <StatCard label="Tricycles" value={stats?.vehicles?.total} subtitle="Véhicules enregistrés dans le module tricycle" icon={BusFront} />
          <StatCard label="Courses tricycle" value={stats?.courses?.total} subtitle="Courses conservées dans PostgreSQL" icon={LayoutDashboard} />
        </div>

        {pending !== null && status === 'ready' && (
          <p className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
            <strong>{displayCount(pending)} conducteur(s)</strong> en attente de vérification dans le module tricycle.
          </p>
        )}
      </section>

      <section aria-labelledby="company-title" className="space-y-4">
        <div>
          <h3 id="company-title" className="text-lg font-black text-slate-900">Administration des compagnies</h3>
          <p className="mt-1 text-sm text-slate-500">
            Accès aux modules globaux. Leurs compteurs et leurs détails seront affichés après raccordement aux endpoints administrateur correspondants.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {MODULES.map((item) => <QuickAccess key={item.to} item={item} />)}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="security-title">
        <h3 id="security-title" className="flex items-center gap-2 text-base font-extrabold text-slate-900">
          <ShieldCheck size={20} className="text-orange-500" aria-hidden="true" /> Séparation des accès
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Le Super Admin utilise un compte Prisma avec rôle <code>ADMIN</code> et un JWT MESSAY.
          Les directions, chefs de gare et agents utilisent leurs propres autorisations côté Dashboard Compagnie.
          Chaque endpoint doit contrôler la session, le rôle et le périmètre demandé ; les liens de cette page ne constituent pas une autorisation.
        </p>
      </section>
    </div>
  );
}
