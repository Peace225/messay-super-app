import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Activity,
  Bus,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  FileText,
  Gauge,
  Home,
  MapPinned,
  Menu,
  Settings2,
  Sparkles,
  Ticket,
  UserRoundCog,
  Users,
  Wallet,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import TricycleIcon from './flotte/TricycleIcon';


type SidebarIcon = LucideIcon | typeof TricycleIcon;

type MenuLink = {
  label: string;
  path: string;
  icon: SidebarIcon;
};

type MenuGroup = {
  id: string;
  label: string;
  icon: SidebarIcon;
  links: MenuLink[];
};

// Ces chemins correspondent aux routes de src/App.tsx.
const menuGroups: MenuGroup[] = [
  {
    id: 'flotte',
    label: 'Flotte tricycles',
    icon: TricycleIcon,
    links: [
      { label: 'Vue générale', path: '/flotte', icon: Gauge },
      { label: 'Tous les tricycles', path: '/flotte/tricycles', icon: TricycleIcon },
      { label: 'Courses', path: '/flotte/courses', icon: ClipboardList },
      { label: 'Suivi en direct', path: '/flotte/direct', icon: Activity },
      { label: 'Carte GPS', path: '/flotte/carte', icon: MapPinned },
      { label: 'Maintenance', path: '/flotte/maintenance', icon: Wrench },
      { label: 'Conducteurs', path: '/flotte/conducteurs', icon: UserRoundCog },
    ],
  },
  {
    id: 'interurbain',
    label: 'Transport interurbain',
    icon: Bus,
    links: [
      { label: 'Billets par compagnie', path: '/logistique/tickets-bus', icon: Ticket },
    ],
  },
  {
    id: 'rh',
    label: 'Ressources humaines',
    icon: Users,
    links: [
      { label: 'Utilisateurs', path: '/rh/utilisateurs', icon: Users },
      { label: 'Chauffeurs', path: '/rh/chauffeurs', icon: UserRoundCog },
    ],
  },
  {
    id: 'finance',
    label: 'Finances',
    icon: Wallet,
    links: [
      { label: 'Trésorerie', path: '/finance/tresorerie', icon: CircleDollarSign },
      { label: 'Rapports', path: '/finance/rapports', icon: FileText },
    ],
  },
];

function pathIsActive(currentPath: string, targetPath: string): boolean {
  // Évite que '/' soit considéré comme actif sur toutes les pages.
  return currentPath === targetPath ||
    (targetPath !== '/' && currentPath.startsWith(`${targetPath}/`));
}

function groupForPath(pathname: string): string | null {
  return menuGroups.find((group) =>
    group.links.some((link) => pathIsActive(pathname, link.path)),
  )?.id ?? null;
}

const baseLink =
  'group relative flex items-center gap-3 rounded-xl px-3.5 py-3 transition-colors duration-200';

export default function Sidebar() {
  const { pathname } = useLocation();
  const [openGroup, setOpenGroup] = useState<string | null>(
    () => groupForPath(pathname) ?? 'flotte',
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  // Le groupe de la page courante s'ouvre automatiquement lors d'une navigation.
  useEffect(() => {
    const activeGroup = groupForPath(pathname);
    if (activeGroup) setOpenGroup(activeGroup);
    setMobileOpen(false);
  }, [pathname]);

  // Fermeture du menu mobile avec la touche Échap.
  useEffect(() => {
    if (!mobileOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  const closeMobileMenu = () => setMobileOpen(false);

  return (
    <>
      {/* Menu mobile autonome ; n'affecte pas la Sidebar sur desktop. */}
      <button
        type="button"
        aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        aria-controls="messay-admin-sidebar"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((current) => !current)}
        className={`fixed top-3 z-[70] flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-[#101014] text-white shadow-lg transition-[left] duration-300 lg:hidden ${
          mobileOpen ? 'left-[232px]' : 'left-3'
        }`}
      >
        {mobileOpen ? <X size={21} /> : <Menu size={21} />}
      </button>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Fermer le menu latéral"
          className="fixed inset-0 z-[49] bg-black/70 lg:hidden"
          onClick={closeMobileMenu}
        />
      )}

      <aside
        id="messay-admin-sidebar"
        aria-label="Navigation administrateur MESSAY"
        className={`fixed inset-y-0 left-0 z-[50] flex h-screen w-72 flex-col overflow-hidden border-r border-white/[0.07] bg-[#07070b] text-white shadow-2xl transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-orange-500/[0.06] via-transparent to-transparent" />

        {/* Identité MESSAY */}
        <div className="relative flex h-[88px] shrink-0 items-center border-b border-white/[0.07] px-6">
          <Link
            to="/"
            onClick={closeMobileMenu}
            className="flex items-center gap-3"
            aria-label="MESSAY — Tableau de bord"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/20">
              <span className="text-2xl font-black">M</span>
            </div>
            <div>
              <span className="text-[25px] font-black tracking-tight">
                MESSAY<span className="text-orange-500">.</span>
              </span>
              <p className="-mt-1 text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">
                Admin Dashboard
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation principale */}
        <nav
          className="relative flex-1 space-y-2 overflow-y-auto px-3 py-5"
          aria-label="Menu principal"
        >
          <NavLink
            to="/"
            end
            onClick={closeMobileMenu}
            className={({ isActive }) =>
              `${baseLink} ${
                isActive
                  ? 'bg-orange-500/15 font-semibold text-orange-300'
                  : 'text-white/60 hover:bg-white/[0.06] hover:text-white'
              }`
            }
          >
            <Home size={18} />
            <span className="text-[13.5px]">Tableau de bord</span>
          </NavLink>

          {menuGroups.map((group) => {
            const GroupIcon = group.icon;
            const expanded = openGroup === group.id;
            // Sélectionner uniquement le lien le plus précis :
            // /flotte ne doit pas rester actif sur /flotte/courses.
            const activeLink = group.links
              .filter((link) => pathIsActive(pathname, link.path))
              .sort((a, b) => b.path.length - a.path.length)[0];
            const groupActive = Boolean(activeLink);

            return (
              <div key={group.id}>
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroup((current) =>
                      current === group.id ? null : group.id,
                    )
                  }
                  aria-expanded={expanded}
                  aria-controls={`sidebar-group-${group.id}`}
                  className={`${baseLink} w-full text-left ${
                    expanded || groupActive
                      ? 'bg-white/[0.07] text-white'
                      : 'text-white/55 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  {(expanded || groupActive) && (
                    <span className="absolute inset-y-3 left-0 w-[3px] rounded-r bg-orange-500" />
                  )}
                  <span
                    className={`rounded-lg p-2 ${
                      expanded || groupActive
                        ? 'bg-orange-500/15 text-orange-400'
                        : 'bg-white/[0.04]'
                    }`}
                  >
                    <GroupIcon size={18} />
                  </span>
                  <span className="flex-1 text-[13px] font-semibold">
                    {group.label}
                  </span>
                  <ChevronDown
                    size={15}
                    className={`shrink-0 transition-transform ${
                      expanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <div
                  id={`sidebar-group-${group.id}`}
                  hidden={!expanded}
                  className="ml-5 mt-1 space-y-1 border-l border-white/10 pl-3"
                >
                  {group.links.map((link) => {
                    const ItemIcon = link.icon;
                    const active = activeLink?.path === link.path;

                    return (
                      <NavLink
                        key={link.path}
                        to={link.path}
                        end
                        onClick={closeMobileMenu}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[12.5px] font-medium transition-colors ${
                          active
                            ? 'bg-orange-500/15 text-orange-300'
                            : 'text-white/45 hover:bg-white/[0.05] hover:text-white/90'
                        }`}
                      >
                        <ItemIcon size={15} className="shrink-0" />
                        <span className="flex-1">{link.label}</span>
                        {active && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-400" />
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Pied de menu : pas de statut LIVE fictif. */}
        <footer className="relative shrink-0 border-t border-white/[0.07] p-4">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-orange-300">
              <Sparkles size={16} />
              <span className="text-[11px] font-bold tracking-wide">MESSAY PRO</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-white/40">
              <Settings2 size={12} /> Administration des transports
            </div>
          </div>
        </footer>
      </aside>
    </>
  );
}
