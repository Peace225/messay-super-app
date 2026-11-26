/**
 * MESSAY PRO — Navigation réservée à la DIRECTION de compagnie.
 * Ce composant n'attribue aucun droit : l'API vérifie rôle, compagnie et gare.
 * Compatible avec src/layouts/DirectionLayout.tsx.
 */
import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Armchair,
  BarChart3,
  Bell,
  Building2,
  BusFront,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  FileCheck2,
  Landmark,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Phone,
  Route as RouteIcon,
  Settings2,
  ShieldCheck,
  Ticket,
  TicketCheck,
  UserRoundCog,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

/** Navigation de la Direction uniquement : pas de routes Chef, Agent ou Super Admin. */
export const COMPANY_NAV: NavSection[] = [
  {
    id: 'pilotage',
    label: 'PILOTAGE',
    items: [
      { to: '/', label: 'Tableau de bord', icon: LayoutDashboard },
      { to: '/compagnie', label: 'Profil et téléphone', icon: Phone },
      { to: '/validation', label: 'Approbation de mon dossier', icon: FileCheck2 },
    ],
  },
  {
    id: 'exploitation',
    label: 'EXPLOITATION',
    items: [
      { to: '/gares', label: 'Gares et agences', icon: MapPin },
      { to: '/lignes', label: 'Lignes de trajet', icon: RouteIcon },
      { to: '/horaires', label: 'Horaires et départs', icon: CalendarClock },
      { to: '/vehicules', label: 'Bus et capacités', icon: BusFront },
      { to: '/chauffeurs', label: 'Chauffeurs', icon: UserRoundCog },
      { to: '/trajets', label: 'Suivi des trajets', icon: RouteIcon },
    ],
  },
  {
    id: 'billetterie',
    label: 'BILLETTERIE',
    items: [
      { to: '/reservations', label: 'Réservations', icon: ClipboardList },
      { to: '/billets', label: 'Billets de voyage', icon: Ticket },
      { to: '/sieges', label: 'Sièges achetés / libres', icon: Armchair },
      { to: '/embarquement', label: 'Contrôle embarquement', icon: TicketCheck },
    ],
  },
  {
    id: 'finance',
    label: 'FINANCES',
    items: [
      { to: '/portefeuille', label: 'Portefeuille compagnie', icon: Wallet },
      { to: '/transactions', label: 'Paiements et commissions', icon: Building2 },
      { to: '/retraits', label: 'Retraits', icon: Landmark },
      { to: '/rapports', label: 'Rapports des ventes', icon: BarChart3 },
    ],
  },
  {
    id: 'configuration',
    label: 'CONFIGURATION',
    items: [
      { to: '/notifications', label: 'Notifications', icon: Bell },
      { to: '/parametres', label: 'Paramètres et accès', icon: Settings2 },
      { to: '/assistance', label: 'Aide et assistance', icon: CircleHelp },
    ],
  },
];

function normalizePath(path: string): string {
  const withoutTrailingSlash = path.replace(/\/+$/, '');
  return withoutTrailingSlash || '/';
}

function pathMatches(pathname: string, target: string): boolean {
  const current = normalizePath(pathname);
  const expected = normalizePath(target);
  return current === expected || (expected !== '/' && current.startsWith(`${expected}/`));
}

function navItemForPath(pathname: string): NavItem | undefined {
  return COMPANY_NAV.flatMap((section) => section.items)
    .filter((item) => pathMatches(pathname, item.to))
    .sort((a, b) => b.to.length - a.to.length)[0];
}

/** Conserve cet export : DirectionLayout l'utilise dans son en-tête. */
export function titleForPath(pathname: string): string {
  return navItemForPath(pathname)?.label ?? 'Espace compagnie';
}

function sectionForPath(pathname: string): string {
  const item = navItemForPath(pathname);
  return COMPANY_NAV.find((section) => section.items.some((entry) => entry.to === item?.to))?.id
    ?? 'pilotage';
}

export type SidebarProps = {
  mobileOpen: boolean;
  onClose: () => void;
  onLogout: () => void | Promise<void>;
};

export default function Sidebar({ mobileOpen, onClose, onLogout }: SidebarProps) {
  const { pathname } = useLocation();
  const activeSection = useMemo(() => sectionForPath(pathname), [pathname]);
  const [expandedSection, setExpandedSection] = useState<string>(activeSection);

  // Change de rubrique lors de la navigation, et ferme le tiroir mobile.
  // DirectionLayout fournit une fonction onClose stable (useCallback).
  useEffect(() => {
    setExpandedSection(activeSection);
    onClose();
  }, [activeSection, pathname, onClose]);

  useEffect(() => {
    if (!mobileOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onClose]);

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fermer le menu de navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        id="messay-sidebar"
        aria-label="Navigation de la direction MESSAY PRO"
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-[285px] shrink-0 flex-col border-r border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5">
          <NavLink to="/" end onClick={onClose} className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/20">
              <BusFront size={22} />
            </span>
            <span className="min-w-0">
              <span className="block text-xl font-black tracking-tight text-slate-900">
                MESSAY <span className="text-orange-500">PRO</span>
              </span>
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.13em] text-slate-400">
                Transport interurbain
              </span>
            </span>
          </NavLink>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la navigation"
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <X size={21} />
          </button>
        </div>

        <div className="mx-4 mt-4 flex items-center gap-2 rounded-2xl border border-orange-100 bg-orange-50 px-3 py-3 text-xs font-semibold text-orange-800">
          <ShieldCheck size={17} className="shrink-0" />
          Espace Direction de compagnie
        </div>

        <nav
          aria-label="Rubriques Direction"
          className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-4"
        >
          {COMPANY_NAV.map((section) => {
            const expanded = section.id === expandedSection;
            const isSectionActive = section.id === activeSection;
            const panelId = `menu-direction-${section.id}`;

            return (
              <section key={section.id} aria-label={section.label}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => setExpandedSection(expanded ? '' : section.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-[10px] font-black tracking-[0.15em] transition-colors hover:bg-slate-50 ${
                    isSectionActive ? 'text-orange-600' : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {section.label}
                  <ChevronDown
                    size={15}
                    aria-hidden="true"
                    className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                  />
                </button>

                <div id={panelId} hidden={!expanded} className="mt-1 space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;

                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-200 ${
                            isActive
                              ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-100'
                              : 'text-slate-600 hover:bg-orange-50 hover:text-orange-700'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <Icon
                              size={18}
                              strokeWidth={isActive ? 2.5 : 2}
                              className="shrink-0"
                              aria-hidden="true"
                            />
                            <span className="min-w-0 flex-1">{item.label}</span>
                            {isActive && <ChevronRight size={15} className="shrink-0" aria-hidden="true" />}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-4">
          <p className="mb-3 px-2 text-[11px] leading-relaxed text-slate-400">
            La validation d’une nouvelle compagnie est effectuée par l’administration MESSAY.
          </p>
          <button
            type="button"
            onClick={() => void onLogout()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-600"
          >
            <LogOut size={18} aria-hidden="true" />
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
}

export function SidebarMenuButton({
  onClick,
  expanded,
}: {
  onClick: () => void;
  expanded: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={expanded ? 'Fermer le menu' : 'Ouvrir le menu'}
      aria-controls="messay-sidebar"
      aria-expanded={expanded}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 transition hover:border-orange-200 hover:text-orange-500 lg:hidden"
    >
      {expanded ? <X size={21} /> : <Menu size={22} />}
    </button>
  );
}
