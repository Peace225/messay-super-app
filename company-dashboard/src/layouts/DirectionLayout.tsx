/**
 * MESSAY PRO — Layout réservé à la DIRECTION d'une compagnie.
 * Il réutilise la Sidebar et les pages existantes du company-dashboard.
 *
 * Le composant parent doit récupérer `access` depuis
 * GET /api/company-dashboard/me/access et protéger ses routes.
 */
import { useCallback, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';

import Sidebar, {
  SidebarMenuButton,
  titleForPath,
} from '../components/Sidebar';
import type { GareAccessContext } from '../services/garesManagementApi';

export interface DirectionLayoutProps {
  access: GareAccessContext;
  onLogout: () => void | Promise<void>;
}

export default function DirectionLayout({
  access,
  onLogout,
}: DirectionLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const closeSidebar = useCallback(() => setMobileOpen(false), []);

  const logout = useCallback(() => {
    if (loggingOut) return;
    setLogoutError(null);
    setLoggingOut(true);
    void Promise.resolve()
      .then(onLogout)
      .then(() => navigate('/login', { replace: true }))
      .catch((error: unknown) => {
        setLogoutError(
          error instanceof Error ? error.message : 'Déconnexion impossible.',
        );
      })
      .finally(() => setLoggingOut(false));
  }, [loggingOut, navigate, onLogout]);

  // Défense côté interface. L'API doit appliquer ses propres contrôles.
  if (access.role !== 'DIRECTION') {
    return (
      <Navigate
        to={access.role === 'CHEF_GARE' ? '/chef-gare' : '/agent'}
        replace
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-slate-900 lg:flex">
      <a
        href="#contenu-principal-direction"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:rounded-lg focus:bg-white focus:p-3"
      >
        Aller au contenu
      </a>

      {/* La Sidebar existante est conservée : pas de second menu Direction. */}
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={closeSidebar}
        onLogout={logout}
      />

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex min-h-[76px] items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-lg sm:px-6 lg:px-9">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarMenuButton
              onClick={() => setMobileOpen(true)}
              expanded={mobileOpen}
            />
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-orange-500">
                Direction · Transport interurbain
              </p>
              <h1 className="truncate text-lg font-black text-slate-900 sm:text-xl">
                {titleForPath(location.pathname)}
              </h1>
              <p className="max-w-[260px] truncate text-xs text-slate-500 sm:max-w-[420px]">
                {access.display_name || 'Direction de compagnie'}
              </p>
            </div>
          </div>

          <NavLink
            to="/validation"
            className="hidden items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 transition hover:border-orange-200 hover:text-orange-600 sm:inline-flex"
          >
            <ShieldCheck size={16} />
            Mon dossier
            <ArrowUpRight size={14} />
          </NavLink>
        </header>

        {logoutError && (
          <div
            role="alert"
            className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:mx-6"
          >
            {logoutError}
          </div>
        )}

        <main
          id="contenu-principal-direction"
          className="mx-auto w-full max-w-[1650px] p-4 sm:p-6 lg:p-9"
        >
          <Outlet context={access} />
        </main>
      </div>
    </div>
  );
}
