import { useState, useEffect, useRef } from 'react';
import { Bell, Search, User, LogOut, Settings, UserCircle, Trash2, Zap, Command } from 'lucide-react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

const socket = io('http://localhost:5000');

export default function Header() {
  const { user, logout } = useAuthStore();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifyOpen, setIsNotifyOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socket.emit('join-admin-panel');
    socket.on('new_notification', (data) => {
      setNotifications(prev => [data,...prev]);
      setUnreadCount(prev => prev + 1);
      const audio = new Audio('/notification.mp3');
      audio.play().catch(() => {});
    });
    return () => { socket.off('new_notification'); };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current &&!profileRef.current.contains(event.target as Node)) setIsProfileOpen(false);
      if (notifyRef.current &&!notifyRef.current.contains(event.target as Node)) setIsNotifyOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = () => {
    setIsNotifyOpen(!isNotifyOpen);
    setUnreadCount(0);
  };

  return (
    <header className="sticky top-0 z-40 h-[72px] w-full">
      {/* Glass background */}
      <div className="absolute inset-0 bg-[#050507]/80 backdrop-blur-2xl border-b border-white/[0.06]" />
      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/[0.02] via-transparent to-transparent pointer-events-none" />

      <div className="relative h-full flex items-center justify-between px-6 lg:px-8">
        {/* Search */}
        <div className="flex-1 max-w-[560px]">
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/5 to-orange-500/0 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-orange-400 transition-colors z-10" size={18} />
            <input
              type="text"
              placeholder="Rechercher chauffeur, course, ticket..."
              className="relative w-full h-11 pl-10 pr-24 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-[13.5px] text-white placeholder-white/30 outline-none transition-all hover:bg-white/[0.05] hover:border-white/[0.12] focus:bg-white/[0.06] focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1">
              <kbd className="px-1.5 py-1 text-[10px] font-medium bg-white/10 border border-white/10 rounded-lg text-white/40 flex items-center gap-1">
                <Command size={10} />K
              </kbd>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Notifications */}
          <div className="relative" ref={notifyRef}>
            <button
              onClick={handleMarkAsRead}
              className={`relative p-2.5 rounded-xl transition-all group ${
                isNotifyOpen
                ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Bell size={20} strokeWidth={1.8} className={unreadCount > 0? 'animate-[wiggle_0.5s_ease-in-out]' : ''} />
              {unreadCount > 0 && (
                <>
                  <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 flex items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-[10px] font-black text-white shadow-lg shadow-orange-500/25 animate-pulse">
                    {unreadCount}
                  </span>
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-orange-500 animate-ping opacity-30" />
                </>
              )}
            </button>

            {isNotifyOpen && (
              <div className="absolute right-0 top-full mt-3 w-[360px] overflow-hidden rounded-[24px] bg-[#0B0B0F]/95 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/50 animate-in slide-in-from-top-2 duration-200">
                <div className="absolute inset-0 bg-gradient-to-b from-orange-500/[0.03] to-transparent pointer-events-none" />

                <div className="relative px-5 py-4 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-orange-500/15 border border-orange-500/20">
                      <Bell size={14} className="text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-bold text-white tracking-wide">Centre d'alertes</h3>
                      <p className="text-[11px] text-white/40">{notifications.length} notifications</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setNotifications([])}
                    className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="max-h-[380px] overflow-y-auto">
                  {notifications.length === 0? (
                    <div className="py-16 text-center">
                      <div className="inline-flex p-3 rounded-2xl bg-white/5 border border-white/10 mb-3">
                        <Bell size={20} className="text-white/20" />
                      </div>
                      <p className="text-[13px] text-white/40 font-medium">Aucune alerte</p>
                      <p className="text-[11px] text-white/20 mt-1">Vous êtes à jour</p>
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {notifications.map((n, i) => (
                        <div key={i} className="group relative overflow-hidden rounded-2xl p-3.5 hover:bg-white/[0.03] transition-all cursor-pointer border border-transparent hover:border-white/5">
                          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-orange-400 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0 shadow-[0_0_8px_rgba(251,146,60,0.5)]" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-white leading-snug">{n.title}</p>
                              <p className="text-[12px] text-white/50 mt-1 leading-relaxed line-clamp-2">{n.message}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20">MAINTENANT</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-7 bg-white/10" />

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="group flex items-center gap-3 pl-1 pr-1 py-1 rounded-2xl hover:bg-white/5 transition-all"
            >
              <div className="hidden sm:block text-right">
                <p className="text-[13px] font-semibold text-white leading-tight">
                  {user?.nom || 'Admin Messé'}
                </p>
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  <Zap size={10} className="text-orange-400 fill-orange-400" />
                  <p className="text-[10px] font-bold text-orange-400/80 uppercase tracking-wider">Super Admin</p>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl blur-md opacity-50 group-hover:opacity-70 transition-opacity" />
                <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20 ring-1 ring-white/10 group-hover:ring-white/20 transition-all">
                  <User size={18} className="text-white" strokeWidth={2.5} />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#050507] flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                </div>
              </div>
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 top-full mt-3 w-[260px] overflow-hidden rounded-[20px] bg-[#0B0B0F]/95 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/50 animate-in slide-in-from-top-2 duration-200">
                <div className="p-1">
                  <div className="px-3 py-3 mb-1">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Compte</p>
                    <p className="text-[13px] font-semibold text-white truncate">{user?.email || 'admin@messay.ci'}</p>
                    <p className="text-[11px] text-white/40 mt-0.5">Abidjan, CI</p>
                  </div>

                  <div className="h-px bg-white/5 mx-2 my-1" />

                  <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-white/70 hover:text-white hover:bg-white/5 transition-all group">
                    <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                      <UserCircle size={16} />
                    </div>
                    <span>Mon profil</span>
                  </button>

                  <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-white/70 hover:text-white hover:bg-white/5 transition-all group">
                    <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                      <Settings size={16} />
                    </div>
                    <span>Paramètres</span>
                  </button>

                  <div className="h-px bg-white/5 mx-2 my-1" />

                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all group"
                  >
                    <div className="p-1.5 rounded-lg bg-red-500/10 group-hover:bg-red-500/15 transition-colors">
                      <LogOut size={16} />
                    </div>
                    <span>Déconnexion</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-10deg); }
          75% { transform: rotate(10deg); }
        }
      `}</style>
    </header>
  );
}