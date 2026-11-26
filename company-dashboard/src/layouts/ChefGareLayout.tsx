/**
 * MESSAY PRO — Layout CHEF_GARE.
 * Navigation propre au chef de gare, indépendante de la Direction et du Super Admin.
 * Les données sont filtrées et autorisées exclusivement par le backend.
 */
import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarClock,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  Ticket,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { GareAccessContext } from '../services/garesManagementApi';

export interface ChefGareLayoutProps {
  access: GareAccessContext;
  onLogout: () => void | Promise<void>;
}

interface MenuItem {
  to: string;
  title: string;
  icon: LucideIcon;
  end?: boolean;
}

const MENU: MenuItem[] = [
  { to: '/chef-gare', title: 'Vue d’ensemble', icon: LayoutDashboard, end: true },
  { to: '/chef-gare/agents', title: 'Agents de ma gare', icon: Users },
  { to: '/chef-gare/departs', title: 'Gestion des départs', icon: CalendarClock },
  { to: '/chef-gare/billetterie', title: 'Billetterie', icon: Ticket },
  ...(import.meta.env.VITE_MESSAY_EMBARQUEMENT_ENABLED === 'true'
    ? [{ to: '/chef-gare/embarquement', title: 'Contrôle QR', icon: ClipboardCheck }]
    : []),
  { to: '/chef-gare/caisse', title: 'Caisse et transactions', icon: Wallet },
  { to: '/chef-gare/rapports', title: 'Rapports et validations', icon: ClipboardCheck },
];

function titleForChefPath(pathname: string): string {
  const match = MENU.find((item) => item.to === pathname);
  return match?.title ?? 'Espace Chef de gare';
}

export default function ChefGareLayout({
  access,
  onLogout,
}: ChefGareLayoutProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [menuOpen]);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setError('');
    try {
      await onLogout();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Déconnexion impossible.');
    } finally {
      setLoggingOut(false);
    }
  }

  if (access.role !== 'CHEF_GARE') {
    return <Navigate to={access.role === 'DIRECTION' ? '/' : '/agent'} replace />;
  }
  if (!Array.isArray(access.gare_ids) || access.gare_ids.length === 0) {
    return (
      <section role="alert" className="mx-auto mt-16 max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        Aucune gare autorisée pour ce compte. Contactez la direction de votre compagnie.
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-slate-900">
      <a href="#contenu-chef" className="sr-only focus:not-sr-only focus:absolute focus:z-[90] focus:bg-white focus:p-3">
        Aller au contenu
      </a>

      {menuOpen && (
        <button
          type="button"
          aria-label="Fermer le menu de navigation"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside
        id="sidebar-chef"
        aria-label="Navigation Chef de gare"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#101827] text-white shadow-xl transition-transform duration-200 lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex min-h-[82px] items-center justify-between border-b border-white/10 px-5">
          <Link to="/chef-gare" className="flex items-center gap-3" onClick={() => setMenuOpen(false)}>
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-500 text-2xl font-black">M</span>
            <span className="font-black tracking-tight">
              MESSAY <span className="text-orange-400">PRO</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">Chef de gare</span>
            </span>
          </Link>
          <button type="button" aria-label="Fermer" onClick={() => setMenuOpen(false)} className="rounded-lg p-2 lg:hidden">
            <X size={20} />
          </button>
        </div>

        <div className="border-b border-white/10 px-5 py-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-orange-300">Compte Chef de gare</p>
          <p className="mt-2 truncate font-semibold">{access.display_name || 'Chef de gare'}</p>
          <p className="mt-1 text-xs text-white/55">
            {access.gare_ids.length} gare{access.gare_ids.length > 1 ? 's' : ''} autorisée{access.gare_ids.length > 1 ? 's' : ''}
          </p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5" aria-label="Modules Chef de gare">
          {MENU.map(({ to, title, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-orange-500/20 text-orange-300'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {title}
            </NavLink>
          ))}
        </nav>

        <footer className="border-t border-white/10 p-4">
          <button
            type="button"
            disabled={loggingOut}
            onClick={() => void logout()}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white/75 hover:bg-white/10 disabled:cursor-wait disabled:opacity-50"
          >
            <LogOut size={18} />
            {loggingOut ? 'Déconnexion…' : 'Se déconnecter'}
          </button>
        </footer>
      </aside>

      <div className="min-w-0 lg:ml-72">
        <header className="sticky top-0 z-30 flex min-h-[76px] items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-7">
          <button
            type="button"
            aria-label="Ouvrir le menu"
            aria-controls="sidebar-chef"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="rounded-xl border border-slate-200 p-2 lg:hidden"
          >
            <Menu size={21} />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Exploitation de gare</p>
            <h1 className="truncate text-lg font-black sm:text-xl">{titleForChefPath(pathname)}</h1>
          </div>
        </header>

        {error && (
          <div role="alert" className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:mx-7">
            {error}
          </div>
        )}

        <main id="contenu-chef" className="mx-auto w-full max-w-[1500px] p-4 sm:p-7">
          <Outlet context={access} />
        </main>
      </div>
    </div>
  );
}
