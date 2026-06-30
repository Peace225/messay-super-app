import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Map, Users, Wallet,
  ChevronDown, Bike, Car,
  UserPlus, UserCog, Sparkles
} from 'lucide-react';

export default function Sidebar() {
  const [openSubMenu, setOpenSubMenu] = useState<string | null>('logistique');
  const location = useLocation();

  const menuItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: Home, path: '/' },
    {
      id: 'logistique',
      label: 'Logistique',
      icon: Map,
      subItems: [
        { label: 'Tricycles', icon: Bike, path: '/logistique/tricycles' },
        { label: 'Tickets Bus', icon: Car, path: '/logistique/tickets-bus' }
      ]
    },
    {
      id: 'rh',
      label: 'Ressources',
      icon: Users,
      subItems: [
        { label: 'Utilisateurs', icon: UserPlus, path: '/rh/utilisateurs' },
        { label: 'Chauffeurs', icon: UserCog, path: '/rh/chauffeurs' }
      ]
    },
    {
      id: 'finance',
      label: 'Finance',
      icon: Wallet,
      subItems: [
        { label: 'Trésorerie', icon: Wallet, path: '/finance/tresorerie' },
        { label: 'Rapports', icon: Wallet, path: '/finance/rapports' }
      ]
    },
  ];

  const toggleSubMenu = (id: string) => {
    setOpenSubMenu(openSubMenu === id? null : id);
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="fixed left-0 top-0 h-screen w-72 z-50 flex flex-col">
      {/* Background premium */}
      <div className="absolute inset-0 bg-[#050507] border-r border-white/[0.06]" />
      <div className="absolute inset-0 bg-gradient-to-b from-orange-500/[0.03] via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)`,
        backgroundSize: '24px 24px'
      }} />

      {/* Logo */}
      <div className="relative h-[88px] flex items-center px-7 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-orange-500 blur-xl opacity-30 rounded-2xl" />
            <div className="relative h-11 w-11 bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 rotate-3 hover:rotate-6 transition-transform">
              <span className="text-white font-black text-[22px] tracking-tighter">M</span>
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-0.5">
              <span className="text-[26px] font-black tracking-tight text-white">MESSAY</span>
              <span className="text-orange-500 text-[26px] font-black">.</span>
            </div>
            <p className="text-[10px] text-white/40 font-medium -mt-1 tracking-widest uppercase">Pro Dashboard</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="relative flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const hasSubItems =!!item.subItems;
          const isOpen = openSubMenu === item.id;
          const isItemActive = item.path && isActive(item.path);

          return (
            <div key={item.id}>
              {hasSubItems? (
                <button
                  onClick={() => toggleSubMenu(item.id)}
                  className={`group w-full relative flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-200 ${
                    isOpen
                     ? 'bg-white/[0.06] text-white'
                      : 'text-white/50 hover:text-white hover:bg-white/[0.03]'
                  }`}
                >
                  {isOpen && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-gradient-to-b from-orange-400 to-amber-500 rounded-r-full" />
                  )}
                  <div className={`p-2 rounded-lg transition-all ${
                    isOpen
                     ? 'bg-orange-500/15 text-orange-400'
                      : 'bg-white/[0.03] text-white/40 group-hover:bg-white/[0.06] group-hover:text-white/70'
                  }`}>
                    <Icon size={18} strokeWidth={2} />
                  </div>
                  <span className="flex-1 text-left text-[13.5px] font-medium tracking-wide">{item.label}</span>
                  <ChevronDown size={16} className={`text-white/30 transition-transform duration-200 ${isOpen? 'rotate-180' : ''}`} />
                </button>
              ) : (
                <Link
                  to={item.path!}
                  className={`group w-full relative flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-200 ${
                    isItemActive
                     ? 'bg-white/[0.06] text-white'
                      : 'text-white/50 hover:text-white hover:bg-white/[0.03]'
                  }`}
                >
                  {isItemActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-gradient-to-b from-orange-400 to-amber-500 rounded-r-full" />
                  )}
                  <div className={`p-2 rounded-lg transition-all ${
                    isItemActive
                     ? 'bg-orange-500/15 text-orange-400'
                      : 'bg-white/[0.03] text-white/40 group-hover:bg-white/[0.06] group-hover:text-white/70'
                  }`}>
                    <Icon size={18} strokeWidth={2} />
                  </div>
                  <span className="text-[13.5px] font-medium tracking-wide">{item.label}</span>
                </Link>
              )}

              {/* Sous-menu */}
              {hasSubItems && isOpen && (
                <div className="mt-1.5 ml-4 pl-4 border-l border-white/[0.06] space-y-1 animate-in slide-in-from-top-1 duration-200">
                  {item.subItems!.map((sub) => {
                    const SubIcon = sub.icon;
                    const isSubActive = isActive(sub.path);

                    return (
                      <Link
                        key={sub.path}
                        to={sub.path}
                        className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                          isSubActive
                           ? 'bg-orange-500/10 text-orange-400'
                            : 'text-white/40 hover:text-white/80 hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className={`transition-all ${isSubActive? 'text-orange-400' : 'text-white/30 group-hover:text-white/60'}`}>
                          <SubIcon size={15} strokeWidth={2} />
                        </div>
                        <span className="text-[13px] font-medium">{sub.label}</span>
                        {isSubActive && (
                          <div className="ml-auto w-1 h-1 rounded-full bg-orange-400" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer premium */}
      <div className="relative p-4 border-t border-white/[0.06]">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl border border-white/[0.08] p-4">
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-orange-500/20 rounded-full blur-3xl" />

          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-orange-500/15 border border-orange-500/20">
                <Sparkles size={14} className="text-orange-400" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-white tracking-wide">MESSAY PRO</p>
                <p className="text-[10px] text-white/40 mt-0.5">Abidjan • v2.0.4</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              <span className="text-[10px] font-medium text-emerald-400">LIVE</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}