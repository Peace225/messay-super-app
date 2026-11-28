/**
 * MESSAY — Admin Dashboard (Prisma ADMIN + JWT backend)
 * À copier dans admin-dashboard/src/App.tsx.
 *
 * - Réutilise le Sidebar existant via SuperAdminLayout (pas de double menu).
 * - Attend l'hydratation du store Zustand avant toute redirection.
 * - Ne donne accès au shell admin que si la session locale annonce ADMIN
 *   et fournit un jeton ; le backend reste la source d'autorité.
 * - Conserve les routes Flotte, Interurbain, RH et Finances.
 * - Ne mélange jamais l'auth Supabase du company-dashboard.
 */

import type { ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

import SuperAdminLayout from './layouts/SuperAdminLayout';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import CompaniesPage from './pages/CompaniesPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import { useAuthStore } from './store/authStore';

// Flotte tricycles : conserver intégralement le module existant.
import FlotteOverviewPage from './pages/flotte/FlotteOverviewPage';
import FlotteTricyclesPage from './pages/flotte/FlotteTricyclesPage';
import FlotteCoursesPage from './pages/flotte/FlotteCoursesPage';
import FlotteLivePage from './pages/flotte/FlotteLivePage';
import FlotteMapPage from './pages/flotte/FlotteMapPage';
import FlotteMaintenancePage from './pages/flotte/FlotteMaintenancePage';
import FlotteConducteursPage from './pages/flotte/FlotteConducteursPage';

// Transport interurbain.
import FlotteBilletsPage from './pages/flotte/FlotteBilletsPage';

// Ressources humaines.
import {
  ChauffeursModule,
  UtilisateursModule,
} from './components/modules/RHModules';

// Finances.
import { FinanceModule } from './components/modules/FinanceModule';
import RapportsPage from './pages/finance/RapportsPage';

/**
 * Compatible avec les deux versions de l'authStore partagées :
 * - store corrigé avec getAccessToken()
 * - store initial conservant les JWT dans localStorage.
 * La lecture locale ne remplace PAS la vérification JWT du backend.
 */
function getAdminAccessToken(): string | null {
  const auth = useAuthStore.getState();

  if (!auth.isAuthenticated || auth.user?.role !== 'ADMIN') {
    return null;
  }

  if (
    'getAccessToken' in auth &&
    typeof auth.getAccessToken === 'function'
  ) {
    const token = auth.getAccessToken();
    return typeof token === 'string' && token.trim() ? token : null;
  }

  try {
    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('accessToken')
        : null;

    return token?.trim() || null;
  } catch {
    return null;
  }
}

async function logoutAdmin(): Promise<void> {
  // Action connue et présente dans ton authStore.ts.
  // Efface les JWT et l'identité locale. Révocation serveur à raccorder
  // si un endpoint de révocation / logout existe côté backend.
  useAuthStore.getState().logout();
}

function SessionLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F7FB] p-6">
      <div role="status" className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
        <p className="text-sm font-semibold text-slate-600">
          Vérification de la session MESSAY…
        </p>
      </div>
    </main>
  );
}

function PrivateRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const role = useAuthStore((state) => state.user?.role);

  if (!hasHydrated) {
    return <SessionLoading />;
  }

  if (!isAuthenticated || role !== 'ADMIN' || !getAdminAccessToken()) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return <>{children}</>;
}

function AdminShell() {
  const admin = useAuthStore((state) => state.user);

  const fullName = [admin?.prenom, admin?.nom]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ');

  return (
    <SuperAdminLayout
      adminName={fullName || 'Administrateur MESSAY'}
      adminEmail={admin?.email || undefined}
      onLogout={logoutAdmin}
    />
  );
}

function ModuleEnPreparation({ title }: { title: string }) {
  return (
    <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <ShieldAlert className="mb-4 text-orange-600" size={32} aria-hidden="true" />
      <h2 className="text-2xl font-black text-slate-900">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Ce module de supervision générale n'est pas encore raccordé à son API
        administrateur. Aucune statistique fictive n'est affichée.
      </p>
      <Link
        to="/"
        className="mt-5 inline-block rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white hover:bg-orange-700"
      >
        Retour au tableau de bord
      </Link>
    </section>
  );
}

function PageIntrouvable() {
  return (
    <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-xs font-black uppercase tracking-widest text-orange-600">Erreur 404</p>
      <h2 className="mt-3 text-2xl font-black text-slate-900">Page introuvable</h2>
      <p className="mt-3 text-sm text-slate-600">Cette page n'existe pas dans l'administration MESSAY.</p>
      <Link to="/" className="mt-5 inline-block rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white hover:bg-orange-700">
        Retour au tableau de bord
      </Link>
    </section>
  );
}

export default function App() {
  // BrowserRouter est déjà installé au niveau de main.tsx dans ce projet.
  // Ne pas l'imbriquer une deuxième fois ici.
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <PrivateRoute>
            <AdminShell />
          </PrivateRoute>
        }
      >
        {/* Super Admin : tableau de bord global. */}
        <Route
          index
          element={
            <SuperAdminDashboard getAccessToken={getAdminAccessToken} />
          }
        />

        {/* Ancien dashboard conservé sans modification. */}
        <Route path="dashboard-classique" element={<DashboardPage />} />

        {/* Flotte tricycles : routes historiques inchangées. */}
        <Route path="flotte" element={<FlotteOverviewPage />} />
        <Route path="flotte/tricycles" element={<FlotteTricyclesPage />} />
        <Route path="flotte/courses" element={<FlotteCoursesPage />} />
        <Route path="flotte/direct" element={<FlotteLivePage />} />
        <Route path="flotte/carte" element={<FlotteMapPage />} />
        <Route path="flotte/maintenance" element={<FlotteMaintenancePage />} />
        <Route path="flotte/conducteurs" element={<FlotteConducteursPage />} />

        {/* Transport interurbain. */}
        <Route path="logistique/tickets-bus" element={<FlotteBilletsPage />} />
        <Route
          path="logistique/tricycles"
          element={<Navigate to="/flotte/tricycles" replace />}
        />

        {/* Ressources humaines. */}
        <Route path="rh/utilisateurs" element={<UtilisateursModule />} />
        <Route path="rh/chauffeurs" element={<ChauffeursModule />} />

        {/* Finances. */}
        <Route path="finance/tresorerie" element={<FinanceModule />} />
        <Route path="finance/rapports" element={<RapportsPage />} />

        {/* Sections globales encore à raccorder à leurs endpoints ADMIN. */}
        <Route path="compagnies" element={<CompaniesPage />} />
        <Route path="approbations" element={<ModuleEnPreparation title="Approbations" />} />
        <Route path="gares" element={<ModuleEnPreparation title="Réseau des gares" />} />
        <Route path="transport" element={<ModuleEnPreparation title="Transport interurbain" />} />
        <Route path="billetterie" element={<Navigate to="/logistique/tickets-bus" replace />} />
        <Route path="transactions" element={<ModuleEnPreparation title="Transactions" />} />
        <Route path="commissions" element={<ModuleEnPreparation title="Commissions MESSAY" />} />
        <Route path="utilisateurs" element={<Navigate to="/rh/utilisateurs" replace />} />
        <Route path="parametres" element={<ModuleEnPreparation title="Paramètres" />} />

        <Route path="*" element={<PageIntrouvable />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
