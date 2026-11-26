import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import Sidebar, { SidebarMenuButton, titleForPath } from './components/Sidebar';
import ModulesAConnecter, {
  MODULES_A_CONNECTER,
  type MissingModulePath,
} from './pages/ModulesAConnecter';
import { messayAuth } from './lib/messaySupabaseAuth';
import {
  garesHierarchyApi,
  type GareAccessContext,
  type GareAccessRole,
} from './services/garesManagementApi';
// Pages de la direction : conservées telles quelles.
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Gares from './pages/Gares';
import Billets from './pages/Billets';
import Retraits from './pages/Retraits';
import Chauffeurs from './pages/Chauffeurs';
import TrajetsReel from './pages/TrajetsReel';
import Reservations from './pages/Reservations';
import ProfilCompagnie from './pages/ProfilCompagnies';
import CapaciteSieges, { AttributionCompagnie } from './pages/CapaciteSieges';
import InvitationPage from './pages/InvitationPage';
import ResetPasswordPage from './pages/ResetPasswordPage';


// Nouveaux espaces distincts (pas de Sidebar Direction pour ces rôles).
import ChefGareLayout from './layouts/ChefGareLayout';
import AgentLayout from './layouts/AgentLayout';
import ChefGareDashboard from './pages/chef/ChefGareDashboard';
import PlanningGarePage from './pages/chef/PlanningGarePage';
import AgentRoleDashboard from './pages/agent/AgentRoleDashboard';
import MessayEmbarquementPage from './pages/agent/MessayEmbarquementPage';
import AgentRapportsPage from './pages/agent/AgentRapportsPage';
import AgentVentePage from './pages/agent/AgentVentePage';
import AgentOperationsPage from './pages/agent/AgentOperationsPage';
import ChefAgentsPage from './pages/chef/ChefAgentsPage';
import ChefBilletteriePage from './pages/chef/ChefBilletteriePage';
import ChefCaissePage from './pages/chef/ChefCaissePage';
import ChefRapportsPage from './pages/chef/ChefRapportsPage';

// Pages métier de l'exploitation (fichiers requis dans src/pages).
import Vehicules from './pages/BusEtCapacitesPage';
import HorairesDeparts from './pages/HorairesEtDepartsPage';
import LignesPage from './pages/LignesPage';
import DirectionPlanningDemandesPage from './pages/DirectionPlanningDemandesPages';

// Ne pas afficher de page « Module à connecter » pour les routes déjà gérées.
// Les autres modules non raccordés conservent leur affichage provisoire.
const ROUTES_ACTIVES = new Set<string>([
  '/',
  '/gares',
  '/lignes',
  '/reservations',
  '/billets',
  '/chauffeurs',
  '/trajets',
  '/retraits',
  '/compagnie',
  '/sieges',
  '/vehicules',
  '/horaires',
  '/demandes-planification',
]);
const extraModulePaths = (Object.keys(MODULES_A_CONNECTER) as MissingModulePath[])
  .filter((path) => !ROUTES_ACTIVES.has(`/${path.replace(/^\/+/, '')}`));
const AGENT_ROLES: ReadonlyArray<GareAccessRole> = [
  'AGENT_BILLETTERIE',
  'AGENT_CAISSE',
  'AGENT_EMBARQUEMENT',
  'AGENT_EXPLOITATION',
];
const ALL_ROLES: ReadonlyArray<GareAccessRole> = [
  'DIRECTION',
  'CHEF_GARE',
  ...AGENT_ROLES,
];

// Le contexte React traverse tous les layouts, même si leur <Outlet />
// ne retransmet pas explicitement le contexte React Router.
const CompanyAccessContext = createContext<GareAccessContext | null>(null);
function useCompanyAccess(): GareAccessContext {
  const access = useContext(CompanyAccessContext);
  if (!access) {
    throw new Error('Contexte des autorisations MESSAY PRO indisponible.');
  }
  return access;
}
type AccessStatus = 'checking' | 'authorized' | 'anonymous' | 'error';
function homeForRole(role: GareAccessRole): string {
  if (role === 'DIRECTION') return '/';
  if (role === 'CHEF_GARE') return '/chef-gare';
  return '/agent';
}
function isValidAccess(value: GareAccessContext | null): value is GareAccessContext {
  return Boolean(
    value &&
    ALL_ROLES.includes(value.role) &&
    typeof value.company_id === 'string' &&
    value.company_id.trim().length > 0 &&
    Array.isArray(value.gare_ids) &&
    value.gare_ids.every((id) => typeof id === 'string' && id.trim().length > 0) &&
    (value.role === 'DIRECTION' || value.gare_ids.length > 0),
  );
}

// Vérifie la session Supabase ET les permissions réelles côté backend.
// Le rôle ne vient jamais de localStorage ou d'une propriété d'URL.
function RequireCompanyAccess() {
  const location = useLocation();
  const [status, setStatus] = useState<AccessStatus>('checking');
  const [access, setAccess] = useState<GareAccessContext | null>(null);
  const [message, setMessage] = useState<string>('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let signedOut = false;
    const check = async () => {
      setStatus('checking');
      setAccess(null);
      setMessage('');
      try {
        const { data, error } = await messayAuth.auth.getSession();
        if (!active || signedOut) return;
        if (error) {
          throw new Error(`Impossible de vérifier la session Supabase : ${error.message}`);
        }
        if (!data.session?.access_token) {
          setStatus('anonymous');
          return;
        }
        const resolved = await garesHierarchyApi.access();
        if (!active || signedOut) return;
        if (!isValidAccess(resolved)) {
          throw new Error('Aucun rôle ou aucune gare autorisée pour ce compte.');
        }
        setAccess(resolved);
        setStatus('authorized');
      } catch (error) {
        if (!active || signedOut) return;
        const statusCode = (error as { status?: number })?.status;
        if (statusCode === 401) {
          setStatus('anonymous');
          return;
        }
        setMessage(error instanceof Error ? error.message : 'Impossible de vérifier vos accès.');
        setStatus('error');
      }
    };
    void check();
    const { data: { subscription } } = messayAuth.auth.onAuthStateChange((event) => {
      if (!active) return;
      if (event === 'SIGNED_OUT') {
        signedOut = true;
        setAccess(null);
        setStatus('anonymous');
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        setRetry((value) => value + 1);
      }
    });
    // Réévaluation à chaque retour dans l'onglet : limite les accès périmés.
    const checkOnFocus = () => setRetry((value) => value + 1);
    window.addEventListener('focus', checkOnFocus);
    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener('focus', checkOnFocus);
    };
  }, [retry]);
  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center" role="status">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          <p className="text-sm font-semibold text-slate-600">Vérification des accès MESSAY PRO…</p>
        </div>
      </div>
    );
  }
  if (status === 'anonymous') {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }
  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
        <section className="w-full max-w-md rounded-2xl bg-white p-7 shadow-sm">
          <ShieldCheck className="mb-4 text-orange-500" size={32} />
          <h1 className="text-xl font-black text-slate-900">Accès non confirmé</h1>
          <p role="alert" className="mt-3 text-sm text-red-600">{message}</p>
          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
            className="mt-5 w-full rounded-xl bg-orange-500 px-4 py-3 font-bold text-white hover:bg-orange-600"
          >
            Réessayer
          </button>
          <button
            type="button"
            onClick={() => {
              void signOutCompany()
                .then(() => setStatus('anonymous'))
                .catch((error: unknown) => {
                  setMessage(error instanceof Error ? error.message : 'Déconnexion impossible.');
                });
            }}
            className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            Se déconnecter
          </button>
        </section>
      </div>
    );
  }
  if (!access) return null;
  return (
    <CompanyAccessContext.Provider value={access}>
      <Outlet context={access} />
    </CompanyAccessContext.Provider>
  );
}
async function signOutCompany(): Promise<void> {
  const { error } = await messayAuth.auth.signOut();
  if (error) throw error;
}
function DirectionOnlyLayout() {
  const access = useCompanyAccess();
  if (access.role !== 'DIRECTION') {
    return <Navigate to={homeForRole(access.role)} replace />;
  }
  return <CompanyLayout />;
}
function ChefOnlyLayout() {
  const access = useCompanyAccess();
  if (access.role !== 'CHEF_GARE') {
    return <Navigate to={homeForRole(access.role)} replace />;
  }
  return <ChefGareLayout access={access} onLogout={signOutCompany} />;
}
function AgentOnlyLayout() {
  const access = useCompanyAccess();
  if (!AGENT_ROLES.includes(access.role)) {
    return <Navigate to={homeForRole(access.role)} replace />;
  }
  return <AgentLayout access={access} onLogout={signOutCompany} />;
}
// E3.4 : le rôle AGENT_EMBARQUEMENT est exigé indépendamment du layout agent.
function OnlyAgentEmbarquementPage() {
  const access = useCompanyAccess();
  if (access.role !== 'AGENT_EMBARQUEMENT') return <Navigate to="/agent" replace />;
  return <MessayEmbarquementPage />;
}

function OnlyBilletteriePage() {
  const access = useCompanyAccess();
  if (access.role !== 'AGENT_BILLETTERIE') return <Navigate to="/agent" replace />;
  return <AgentVentePage />;
}
function OnlyAgentReportsPage() {
  const access = useCompanyAccess();
  if (!access.role.startsWith('AGENT_')) return <Navigate to="/agent" replace />;
  return <AgentRapportsPage />;
}
// Les autres modules de l'agent ne sont accessibles qu'au rôle autorisé.
// Les endpoints backend doivent appliquer la même vérification côté serveur.
type AgentOperationMode = 'caisse' | 'embarquement' | 'exploitation';
function OnlyAgentOperationsPage({
  role,
  mode,
}: {
  role: GareAccessRole;
  mode: AgentOperationMode;
}) {
  const access = useCompanyAccess();
  if (access.role !== role) return <Navigate to="/agent" replace />;
  return <AgentOperationsPage mode={mode} />;
}
function PageIntrouvable() {
  const access = useCompanyAccess();
  return (
    <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <p className="text-xs font-extrabold tracking-widest text-orange-600">ERREUR 404</p>
      <h2 className="mt-3 text-2xl font-black text-slate-900">Page introuvable</h2>
      <p className="mt-2 text-sm text-slate-500">Cette rubrique n’existe pas dans votre espace.</p>
      <Link to={homeForRole(access.role)} className="mt-6 inline-block rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600">
        Retour au tableau de bord
      </Link>
    </section>
  );
}

// Layout existant : réservé uniquement à la DIRECTION.
function CompanyLayout() {
  const access = useCompanyAccess();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const closeSidebar = useCallback(() => setMobileOpen(false), []);
  const logout = useCallback(() => {
    setLogoutError(null);
    void signOutCompany()
      .then(() => navigate('/login', { replace: true }))
      .catch((error: unknown) => {
        setLogoutError(error instanceof Error ? error.message : 'Déconnexion impossible.');
      });
  }, [navigate]);
  return (
    <div className="min-h-screen bg-[#F5F7FB] lg:flex">
      <a href="#contenu-principal" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:bg-white focus:p-3">
        Aller au contenu
      </a>
      <Sidebar mobileOpen={mobileOpen} onClose={closeSidebar} onLogout={logout} />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex min-h-[76px] items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-lg sm:px-6 lg:px-9">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarMenuButton onClick={() => setMobileOpen(true)} expanded={mobileOpen} />
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-orange-500">Direction · Transport interurbain</p>
              <h1 className="truncate text-lg font-black text-slate-900 sm:text-xl">{titleForPath(location.pathname)}</h1>
            </div>
          </div>
          {/* Accès direct à l'espace de validation, sans boucle entre Lignes et Horaires. */}
          <div className="flex shrink-0 items-center gap-2">
            <NavLink
              to="/demandes-planification"
              className={({ isActive }) =>
                `hidden items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition sm:inline-flex ${
                  isActive
                    ? 'border-orange-300 bg-orange-50 text-orange-700'
                    : 'border-orange-200 bg-white text-orange-600 hover:bg-orange-50'
                }`
              }
            >
              <ShieldCheck size={16} /> Demandes à valider
            </NavLink>
            <NavLink
              to="/validation"
            className="hidden items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 transition hover:border-orange-200 hover:text-orange-600 sm:inline-flex"
          >
              <ShieldCheck size={16} /> Mon dossier <ArrowUpRight size={14} />
            </NavLink>
          </div>
        </header>
        {logoutError && (
          <div role="alert" className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:mx-6">
            {logoutError}
          </div>
        )}
        <main id="contenu-principal" className="mx-auto w-full max-w-[1650px] p-4 sm:p-6 lg:p-9">
          <Outlet context={access} />
        </main>
      </div>
    </div>
  );
}

// E3.4 : aucun flag modifié par l'installateur, interface désactivée par défaut.
const QR_BOARDING_UI_ENABLED = import.meta.env.VITE_MESSAY_EMBARQUEMENT_ENABLED === 'true';

// La page Billets Direction existante reste inchangée; raccourci visible seulement en local activé.
function DirectionBilletsPage() {
  return (
    <>
      {QR_BOARDING_UI_ENABLED && (
        <div className="px-4 pt-4">
          <Link to="/controle-embarquement"
            className="inline-flex items-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">
            Contrôle QR des embarquements
          </Link>
        </div>
      )}
      <Billets />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Publics. Invitation hors de toute restriction de rôle métier. */}
        <Route path="/login" element={<Login />} />
        <Route path="/invitation" element={<InvitationPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<RequireCompanyAccess />}>
          {/* Direction : la navigation et les pages existantes sont préservées. */}
          <Route path="/" element={<DirectionOnlyLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="gares" element={<Gares />} />
            <Route path="reservations" element={<Reservations />} />
            <Route path="billets" element={<DirectionBilletsPage />} />
            {QR_BOARDING_UI_ENABLED && <Route path="controle-embarquement" element={<MessayEmbarquementPage />} />}
            <Route path="chauffeurs" element={<Chauffeurs />} />
            <Route path="trajets" element={<TrajetsReel />} />
            <Route path="retraits" element={<Retraits />} />
            <Route path="compagnie" element={<ProfilCompagnie />} />
            <Route path="sieges" element={<CapaciteSieges />} />
            <Route path="vehicules" element={<Vehicules />} />
            <Route path="horaires" element={<HorairesDeparts />} />
            <Route path="lignes" element={<LignesPage />} />
            {/* Approbation des lignes, tarifs et horaires par la Direction seulement. */}
            <Route path="demandes-planification" element={<DirectionPlanningDemandesPage />} />
            {extraModulePaths.map((path) => (
              <Route
                key={path}
                path={path.replace(/^\/+/, '')}
                element={<ModulesAConnecter path={path} />}
              />
            ))}
            <Route path="*" element={<PageIntrouvable />} />
          </Route>
          {/* Chef de gare : jamais la Sidebar ni le Dashboard Direction. */}
          <Route path="/chef-gare" element={<ChefOnlyLayout />}>
            <Route index element={<ChefGareDashboard />} />
            <Route path="agents" element={<ChefAgentsPage />} />
            <Route path="departs" element={<PlanningGarePage />} />
            <Route path="sieges" element={<AttributionCompagnie />} />
            <Route path="billetterie" element={<ChefBilletteriePage />} />
            {QR_BOARDING_UI_ENABLED && <Route path="embarquement" element={<MessayEmbarquementPage />} />}
            <Route path="caisse" element={<ChefCaissePage />} />
            <Route path="rapports" element={<ChefRapportsPage />} />
            <Route path="*" element={<PageIntrouvable />} />
          </Route>
          {/* Agents : modules propres à leur rôle, sans gestion de la direction. */}
          <Route path="/agent" element={<AgentOnlyLayout />}>
            <Route index element={<AgentRoleDashboard />} />
            <Route path="vente" element={<OnlyBilletteriePage />} />
            <Route path="caisse" element={<OnlyAgentOperationsPage role="AGENT_CAISSE" mode="caisse" />} />
            <Route path="embarquement" element={
              QR_BOARDING_UI_ENABLED
                ? <OnlyAgentEmbarquementPage />
                : <OnlyAgentOperationsPage role="AGENT_EMBARQUEMENT" mode="embarquement" />
            } />
            <Route path="exploitation" element={<OnlyAgentOperationsPage role="AGENT_EXPLOITATION" mode="exploitation" />} />
            <Route path="rapports" element={<OnlyAgentReportsPage />} />
            <Route path="*" element={<PageIntrouvable />} />
          </Route>
          {/* Un chemin inconnu renvoie à l'accueil du rôle, jamais à l'espace Direction. */}
          <Route path="*" element={<RoleHomeRedirect />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
function RoleHomeRedirect() {
  const access = useCompanyAccess();
  return <Navigate to={homeForRole(access.role)} replace />;
}
