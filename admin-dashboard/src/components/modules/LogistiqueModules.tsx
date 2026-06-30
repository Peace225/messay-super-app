import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { io } from 'socket.io-client';
import {
  MapPin, Battery, Gauge, User, Phone, TrendingUp,
  Activity, Zap, Navigation, CheckCircle, Plus, X,
  Trash2, Power, PowerOff, Wifi, WifiOff, AlertCircle,
  Bus, Search, CreditCard, Smartphone, Banknote,
  Building2
} from 'lucide-react';

const socket = io('http://127.0.0.1:5000', {
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});

type TricycleComplet = {
  id: string;
  immatriculation: string;
  chauffeur: string;
  chauffeurTel: string;
  status: 'DISPONIBLE' | 'EN_COURSE' | 'MAINTENANCE' | 'HORS_LIGNE';
  batterie: number;
  vitesse: number;
  position: { lat: number; lng: number };
  derniereActivite: string;
  coursesAujourdhui: number;
  distanceParcourue: number;
  modele?: string;
  annee?: number;
  createdAt?: string;
};

type TicketComplet = {
  id: string;
  compagnie: 'UTB' | 'SOTRA' | 'AVS' | 'SBTA' | 'TCI' | 'STIF' | 'UTS';
  passager: string;
  telephone: string;
  trajet: string;
  date: string;
  heure: string;
  prix: number;
  siege: string;
  paiement: 'MOBILE_MONEY' | 'ESPECES' | 'CARTE' | 'WAVE';
  statut: 'VALIDE' | 'UTILISE' | 'ANNULE' | 'REMBOURSE' | 'PAYE' | 'RESERVE';
  gareDepart: string;
  gareArrivee: string;
};

export const TricyclesModule: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [tricycles, setTricycles] = useState<TricycleComplet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'TOUS' | 'DISPONIBLE' | 'EN_COURSE' | 'MAINTENANCE' | 'HORS_LIGNE'>('TOUS');

  const [formData, setFormData] = useState({
    immatriculation: '',
    chauffeur: '',
    chauffeurTel: '',
    modele: 'TVS King',
    annee: new Date().getFullYear(),
  });

  useEffect(() => {
    const onConnect = () => {
      setIsConnected(true);
      setError(null);
      socket.emit('join-admin-panel');
      socket.emit('tricycles:get-all');
    };

    const onDisconnect = () => {
      setIsConnected(false);
      setError('Connexion perdue - Reconnexion...');
    };

    const onConnectError = (err: any) => {
      setError(`Erreur serveur: ${err.message}`);
      setLoading(false);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    socket.on('tricycles:list', (data: TricycleComplet[]) => {
      setTricycles(data);
      setLoading(false);
      setError(null);
    });

    socket.on('position-updated', (update: any) => {
      setTricycles(prev => prev.map(t =>
        t.id === update.tricycleId
       ? {...t, position: { lat: update.lat, lng: update.lng }, vitesse: update.vitesse?? t.vitesse, batterie: update.batterie?? Math.max(0, t.batterie - 0.1), derniereActivite: 'À l\'instant', status: 'EN_COURSE' as const }
          : t
      ));
    });

    socket.on('tricycle:registered', (newTri: TricycleComplet) => {
      setTricycles(prev => [newTri,...prev]);
      setShowRegister(false);
      setFormData({ immatriculation: '', chauffeur: '', chauffeurTel: '', modele: 'TVS King', annee: new Date().getFullYear() });
    });

    socket.on('tricycle:deleted', ({ id, success }) => {
      if (success) setTricycles(prev => prev.filter(t => t.id!== id));
    });

    socket.on('tricycle:status-changed', (update) => {
      setTricycles(prev => prev.map(t =>
        t.id === update.tricycleId? {...t, status: update.status, derniereActivite: new Date(update.timestamp).toLocaleTimeString('fr-FR') } : t
      ));
    });

    if (!socket.connected) socket.connect(); else onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('tricycles:list');
      socket.off('position-updated');
      socket.off('tricycle:registered');
      socket.off('tricycle:deleted');
      socket.off('tricycle:status-changed');
    };
  }, []);

  const handleRegister = useCallback(() => {
    if (!formData.immatriculation.trim() ||!formData.chauffeur.trim()) {
      setError('Immatriculation et chauffeur requis');
      return;
    }
    if (!isConnected) {
      setError('Non connecté au serveur');
      return;
    }
    socket.emit('tricycle:register', {
      immatriculation: formData.immatriculation.toUpperCase().trim(),
      chauffeur: formData.chauffeur.trim(),
      chauffeurTel: formData.chauffeurTel.trim(),
      modele: formData.modele,
      annee: formData.annee,
    });
  }, [formData, isConnected]);

  const handleDelete = useCallback((id: string, immat: string) => {
    if (!confirm(`Supprimer le tricycle ${immat}?`)) return;
    socket.emit('tricycle:delete', { id });
  }, []);

  const handleControl = useCallback((id: string, action: 'activate' | 'deactivate' | 'maintenance') => {
    socket.emit('tricycle:control', { tricycleId: id, action });
  }, []);

  const filtered = useMemo(() =>
    filterStatus === 'TOUS'? tricycles : tricycles.filter(t => t.status === filterStatus),
    [tricycles, filterStatus]
  );

  const stats = useMemo(() => ({
    total: tricycles.length,
    disponibles: tricycles.filter(t => t.status === 'DISPONIBLE').length,
    enCourse: tricycles.filter(t => t.status === 'EN_COURSE').length,
    maintenance: tricycles.filter(t => t.status === 'MAINTENANCE').length,
    horsLigne: tricycles.filter(t => t.status === 'HORS_LIGNE').length,
  }), [tricycles]);

  const getStatus = (s: string) => {
    const map = {
      DISPONIBLE: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
      EN_COURSE: { bg: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
      MAINTENANCE: { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
      HORS_LIGNE: { bg: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
    };
    return map[s as keyof typeof map] || map.HORS_LIGNE;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-900 font-medium">Connexion au serveur...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {!isConnected && (
        <div className="bg-red-600 text-white px-4 py-2 text-sm flex items-center justify-center gap-2">
          <WifiOff size={16} /> Déconnecté - Reconnexion...
        </div>
      )}
      {error && (
        <div className="bg-amber-500 text-white px-4 py-2 text-sm flex items-center justify-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-orange-100">
                <Navigation size={20} className="text-orange-600" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900">Flotte Tricycles • LIVE</h1>
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  {stats.total} véhicules
                  <span className={`w-1.5 h-1.5 rounded-full ${isConnected? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  {isConnected? 'Temps réel actif' : 'Hors ligne'}
                </p>
              </div>
            </div>
            <button onClick={() => setShowRegister(true)} disabled={!isConnected} className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black disabled:opacity-50">
              <Plus size={16} /> Enregistrer
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total', value: stats.total, color: 'text-gray-900' },
              { label: 'Disponibles', value: stats.disponibles, color: 'text-emerald-600' },
              { label: 'En course', value: stats.enCourse, color: 'text-orange-600' },
              { label: 'Maintenance', value: stats.maintenance, color: 'text-amber-600' },
              { label: 'Hors ligne', value: stats.horsLigne, color: 'text-gray-500' },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <p className="text-xs text-gray-500 uppercase font-bold">{s.label}</p>
                <p className={`text-3xl font-black mt-1.5 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2 overflow-x-auto">
            {(['TOUS', 'DISPONIBLE', 'EN_COURSE', 'MAINTENANCE', 'HORS_LIGNE'] as const).map(f => {
              const count = f === 'TOUS'? stats.total : tricycles.filter(t => t.status === f).length;
              return (
                <button key={f} onClick={() => setFilterStatus(f)} className={`px-4 py-2.5 rounded-xl text-sm font-bold border ${filterStatus === f? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}>
                  {f.replace('_', ' ')} <span className="opacity-60">({count})</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((tri) => {
              const st = getStatus(tri.status);
              const isLive = tri.derniereActivite === 'À l\'instant' || tri.status === 'EN_COURSE';
              return (
                <div key={tri.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-black text-gray-900">{tri.immatriculation}</h3>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text- font-bold border ${st.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot} ${isLive? 'animate-pulse' : ''}`} />
                          {tri.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 font-medium flex items-center gap-1.5 mt-2">
                        <User size={13} className="text-gray-400" />{tri.chauffeur}
                      </p>
                      <p className="text-xs text-gray-500 flex items-center gap-3">
                        <span className="flex items-center gap-1"><Phone size={11} />{tri.chauffeurTel}</span>
                        {tri.modele && <span>• {tri.modele}</span>}
                      </p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button onClick={() => handleControl(tri.id, tri.status === 'HORS_LIGNE'? 'activate' : 'deactivate')} className="p-2 hover:bg-gray-100 rounded-lg">
                        {tri.status === 'HORS_LIGNE'? <Power size={15} className="text-emerald-600" /> : <PowerOff size={15} className="text-gray-400" />}
                      </button>
                      <button onClick={() => handleDelete(tri.id, tri.immatriculation)} className="p-2 hover:bg-red-50 rounded-lg">
                        <Trash2 size={15} className="text-gray-400 hover:text-red-600" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 mb-4">
                    {[
                      { label: 'BATT', value: `${tri.batterie}%`, icon: Battery, color: tri.batterie > 30? 'text-emerald-600' : 'text-red-600' },
                      { label: 'VIT', value: tri.vitesse, suffix: 'km/h', icon: Gauge, color: 'text-gray-900' },
                      { label: 'COURSES', value: tri.coursesAujourdhui, icon: TrendingUp, color: 'text-gray-900' },
                    ].map((m) => (
                      <div key={m.label} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                        <m.icon size={14} className={`mx-auto mb-1 ${m.color}`} />
                        <p className={`text-lg font-black ${m.color}`}>{m.value}</p>
                        <p className="text- text-gray-500 font-bold uppercase mt-0.5">{m.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={12} className="text-gray-400" />
                        <span className="text-xs font-mono text-gray-600">{tri.position.lat.toFixed(5)}, {tri.position.lng.toFixed(5)}</span>
                      </div>
                      <span className="text-xs text-gray-500">{tri.distanceParcourue.toFixed(1)} km</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text- text-gray-400">Dernière activité</span>
                      <span className={`text-xs font-medium ${isLive? 'text-emerald-600' : 'text-gray-500'}`}>{tri.derniereActivite}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MODAL ENREGISTREMENT */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-black text-gray-900">Nouveau tricycle</h3>
                <p className="text-xs text-gray-500 mt-0.5">Enregistrement en temps réel</p>
              </div>
              <button onClick={() => setShowRegister(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Immatriculation *</label>
                <input
                  type="text"
                  value={formData.immatriculation}
                  onChange={e => setFormData({...formData, immatriculation: e.target.value.toUpperCase() })}
                  placeholder="4521 AB"
                  className="w-full mt-1.5 h-11 px-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Nom chauffeur *</label>
                <input
                  type="text"
                  value={formData.chauffeur}
                  onChange={e => setFormData({...formData, chauffeur: e.target.value })}
                  placeholder="Moussa Koné"
                  className="w-full mt-1.5 h-11 px-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Téléphone</label>
                <input
                  type="tel"
                  value={formData.chauffeurTel}
                  onChange={e => setFormData({...formData, chauffeurTel: e.target.value })}
                  placeholder="+225 07 00 00 00"
                  className="w-full mt-1.5 h-11 px-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Modèle</label>
                  <select value={formData.modele} onChange={e => setFormData({...formData, modele: e.target.value })} className="w-full mt-1.5 h-11 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-500">
                    <option>TVS King</option>
                    <option>Bajaj RE</option>
                    <option>Piaggio Ape</option>
                    <option>Autre</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Année</label>
                  <input type="number" min="2015" max={new Date().getFullYear() + 1} value={formData.annee} onChange={e => setFormData({...formData, annee: parseInt(e.target.value) || new Date().getFullYear() })} className="w-full mt-1.5 h-11 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-500" />
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3.5">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 bg-orange-100 rounded-lg mt-0.5">
                    <Wifi size={14} className="text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-orange-900">Connexion temps réel</p>
                    <p className="text- text-orange-700 mt-1">Le tricycle apparaîtra instantanément dans la flotte.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
              <button onClick={() => setShowRegister(false)} className="flex-1 h-11 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold hover:bg-gray-50">Annuler</button>
              <button onClick={handleRegister} disabled={!formData.immatriculation.trim() ||!formData.chauffeur.trim() ||!isConnected} className="flex-1 h-11 rounded-xl bg-gray-900 text-white font-bold hover:bg-black disabled:opacity-30 flex items-center justify-center gap-2">
                <CheckCircle size={16} /> Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const BusTicketsModule: React.FC = () => {
  const [tickets, setTickets] = useState<TicketComplet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompagnie, setSelectedCompagnie] = useState<'TOUTES' | 'UTB' | 'SOTRA' | 'AVS' | 'SBTA' | 'TCI' | 'STIF'>('TOUTES');

  useEffect(() => {
    socket.emit('tickets:get-today');
    socket.on('tickets:list', (data: TicketComplet[]) => {
      setTickets(data);
      setLoading(false);
    });
    return () => { socket.off('tickets:list'); };
  }, []);

  const filtered = useMemo(() => tickets.filter(t => {
    const matchComp = selectedCompagnie === 'TOUTES' || t.compagnie === selectedCompagnie;
    const matchSearch =!searchTerm || t.passager.toLowerCase().includes(searchTerm.toLowerCase()) || t.telephone.includes(searchTerm);
    return matchComp && matchSearch;
  }), [tickets, selectedCompagnie, searchTerm]);

  const getPaiement = (p: string) => {
    const map = {
      MOBILE_MONEY: { icon: Smartphone, color: 'text-orange-600 bg-orange-50', label: 'MoMo' },
      WAVE: { icon: Zap, color: 'text-blue-600 bg-blue-50', label: 'Wave' },
      CARTE: { icon: CreditCard, color: 'text-violet-600 bg-violet-50', label: 'Carte' },
      ESPECES: { icon: Banknote, color: 'text-emerald-600 bg-emerald-50', label: 'Espèces' }
    };
    return map[p as keyof typeof map] || map.ESPECES;
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-12 h-12 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100"><Bus size={20} className="text-blue-600" /></div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Tickets Bus • LIVE</h1>
              <p className="text-sm text-gray-500">{tickets.length} vendus</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-green-700">TEMPS RÉEL</span>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full h-11 pl-10 pr-4 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500" />
          </div>
          <select value={selectedCompagnie} onChange={e => setSelectedCompagnie(e.target.value as any)} className="h-11 px-4 bg-white border border-gray-200 rounded-xl text-sm">
            <option value="TOUTES">Toutes</option>
            <option value="UTB">UTB</option>
            <option value="SOTRA">SOTRA</option>
            <option value="AVS">AVS</option>
            <option value="SBTA">SBTA</option>
            <option value="TCI">TCI</option>
          </select>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Ticket', 'Passager', 'Compagnie', 'Trajet', 'Date', 'Paiement', 'Prix', 'Statut'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((t) => {
                  const paiement = getPaiement(t.paiement);
                  const Icon = paiement.icon;
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><p className="text-xs font-mono font-bold text-blue-600">{t.id.slice(0,8)}</p><p className="text- text-gray-500">Siège {t.siege}</p></td>
                      <td className="px-4 py-3"><p className="text-sm font-medium">{t.passager}</p><p className="text-xs text-gray-500">{t.telephone}</p></td>
                      <td className="px-4 py-3"><span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-bold"><Building2 size={12} />{t.compagnie}</span></td>
                      <td className="px-4 py-3"><p className="text-sm">{t.trajet}</p><p className="text-xs text-gray-500">{t.gareDepart} → {t.gareArrivee}</p></td>
                      <td className="px-4 py-3"><p className="text-xs">{t.date}</p><p className="text-xs text-gray-500">{t.heure}</p></td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${paiement.color}`}><Icon size={12} />{paiement.label}</span></td>
                      <td className="px-4 py-3 text-right"><p className="text-sm font-black">{t.prix.toLocaleString('fr-FR')} F</p></td>
                      <td className="px-4 py-3 text-center"><span className={`px-2.5 py-1 rounded-full text- font-bold ${t.statut === 'VALIDE' || t.statut === 'PAYE'? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{t.statut}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <Bus size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Aucun ticket</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TricyclesModule;