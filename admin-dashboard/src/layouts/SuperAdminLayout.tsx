/**
 * MESSAY PRO — Layout Super Admin compatible avec le Sidebar existant.
 * Destination : admin-dashboard/src/layouts/SuperAdminLayout.tsx
 *
 * Le composant Sidebar gère déjà sa propre navigation responsive et
 * son menu mobile. Ne pas créer de second <aside> ici.
 *
 * IMPORTANT : le layout ne gère pas l'authentification ; protéger les
 * routes via un contrôle backend du JWT et du rôle Prisma ADMIN.
 */
import { useCallback, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, LogOut, ShieldCheck } from 'lucide-react';
import Sidebar from '../components/Sidebar';

export interface SuperAdminLayoutProps {
  /** Valeurs issues d'une session administrateur vérifiée, pas du navigateur. */
  adminName?: string;
  adminEmail?: string;
  /** Révoque / invalide la session JWT côté application. */
  onLogout: () => void | Promise<void>;
}

const PAGE_NAMES: ReadonlyArray<{ prefix: string; title: string }> = [
  { prefix: '/flotte/tricycles', title: 'Tous les tricycles' },
  { prefix: '/flotte/conducteurs', title: 'Conducteurs' },
  { prefix: '/flotte/courses', title: 'Courses' },
  { prefix: '/flotte/direct', title: 'Suivi en direct' },
  { prefix: '/flotte/carte', title: 'Carte GPS' },
  { prefix: '/flotte/maintenance', title: 'Maintenance' },
  { prefix: '/flotte', title: 'Flotte tricycles' },
  { prefix: '/logistique/tickets-bus', title: 'Billets par compagnie' },
  { prefix: '/rh/utilisateurs', title: 'Utilisateurs' },
  { prefix: '/rh/chauffeurs', title: 'Chauffeurs' },
  { prefix: '/finance/tresorerie', title: 'Trésorerie' },
  { prefix: '/finance/rapports', title: 'Rapports financiers' },
  { prefix: '/compagnies', title: 'Compagnies' },
  { prefix: '/approbations', title: 'Approbations' },
  { prefix: '/gares', title: 'Réseau de gares' },
  { prefix: '/transport', title: 'Transport interurbain' },
  { prefix: '/billetterie', title: 'Billetterie' },
  { prefix: '/transactions', title: 'Transactions' },
  { prefix: '/commissions', title: 'Commissions' },
  { prefix: '/utilisateurs', title: 'Utilisateurs' },
  { prefix: '/parametres', title: 'Paramètres' },
];

function pageTitle(pathname: string): string {
  if (pathname === '/') return 'Tableau de bord';
  return PAGE_NAMES.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )?.title ?? 'Administration générale';
}

export default function SuperAdminLayout({
  adminName = 'Administrateur MESSAY',
  adminEmail,
  onLogout,
}: SuperAdminLayoutProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const title = useMemo(() => pageTitle(pathname), [pathname]);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const logout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await onLogout();
      navigate('/login', { replace: true });
    } catch (error) {
      setLogoutError(
        error instanceof Error ? error.message : 'La déconnexion a échoué.',
      );
    } finally {
      setLoggingOut(false);
    }
  }, [loggingOut, navigate, onLogout]);

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-slate-900">
      <a
        href="#contenu-admin"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:p-3"
      >
        Aller au contenu principal
      </a>

      {/* Sidebar possède déjà un <aside> fixe et son menu mobile. */}
      <Sidebar />

      {/* La largeur lg:pl-72 correspond au w-72 de Sidebar.tsx. */}
      <div className="min-h-screen lg:pl-72">
        <header className="sticky top-0 z-30 flex min-h-[76px] items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          {/* Padding mobile pour ne pas recouvrir le bouton Menu fixe de Sidebar. */}
          <div className="min-w-0 pl-12 lg:pl-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-orange-600">
              MESSAY — Administration générale
            </p>
            <h1 className="truncate text-lg font-black sm:text-xl">{title}</h1>
          </div>

          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="max-w-48 truncate text-xs font-bold text-slate-800">
                {adminName}
              </p>
              {adminEmail ? (
                <p className="max-w-48 truncate text-[11px] text-slate-500">
                  {adminEmail}
                </p>
              ) : null}
            </div>
            <span
              title="Rôle requis côté backend : ADMIN"
              className="hidden items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 md:inline-flex"
            >
              <ShieldCheck size={15} className="text-orange-500" />
              ADMIN
            </span>
            <button
              type="button"
              onClick={() => void logout()}
              disabled={loggingOut}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:border-red-200 hover:text-red-600 disabled:cursor-wait disabled:opacity-50"
            >
              <LogOut size={16} aria-hidden="true" />
              <span className="hidden sm:inline">
                {loggingOut ? 'Déconnexion…' : 'Se déconnecter'}
              </span>
              <span className="sr-only sm:hidden">Se déconnecter</span>
            </button>
          </div>
        </header>

        <main
          id="contenu-admin"
          className="mx-auto w-full max-w-[1700px] p-4 sm:p-6 lg:p-8"
        >
          {logoutError && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{logoutError}</span>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
