import { useState } from 'react'
import { 
  Bus, 
  MapPin, 
  Ticket, 
  Wallet, 
  TrendingUp, 
  Download, 
  Plus, 
  ArrowUpRight,
  Clock,
  Shield,
  Building2,
  ChevronRight
} from 'lucide-react'

export default function Dashboard() {
  const [viewMode, setViewMode] = useState<'superadmin' | 'company'>('superadmin')
  const [selectedComp, setSelectedComp] = useState('MD Transport')

  // Données Super Admin
  const adminStats = [
    { label: 'COMPAGNIES ACTIVES', val: '4', max: '/ 5', trend: '+2', trendUp: true, icon: Building2, iconColor: 'text-orange-500', iconBg: 'bg-orange-50' },
    { label: 'GARES TOTALES', val: '06', max: '/ 8', trend: '+12%', trendUp: true, icon: MapPin, iconColor: 'text-gray-700', iconBg: 'bg-gray-100' },
    { label: 'TICKETS VENDUS', val: '6', max: 'global', pill: '5 ajd.', icon: Ticket, iconColor: 'text-gray-700', iconBg: 'bg-gray-100' },
    { label: 'VOLUME PLATEFORME', val: '35 000', currency: 'FCFA', sub: 'Total encaissé', icon: Wallet, iconColor: 'text-orange-500', iconBg: 'bg-orange-50' },
  ]

  const companiesList = [
    { name: 'MD Transport', lieu: 'Adjamé, Abidjan', gares: 3, tickets: 4, solde: '2 120 000', quota: 55, color: 'bg-orange-500' },
    { name: 'UTB CI', lieu: 'Yopougon, Abidjan', gares: 2, tickets: 1, solde: '980 000', quota: 66, color: 'bg-blue-600' },
    { name: 'SBTA', lieu: 'Treichville, Abidjan', gares: 1, tickets: 1, solde: '450 000', quota: 80, color: 'bg-emerald-600' },
    { name: 'CFA Voyage', lieu: 'Bouaké Centre', gares: 0, tickets: 0, solde: '0', quota: 0, color: 'bg-purple-600' },
  ]

  // Données Compagnie
  const stats = [
    { 
      label: 'SOLDE DISPONIBLE', 
      val: '2 450 000', 
      currency: 'FCFA', 
      sub: 'Ce mois', 
      trend: '+12.5%', 
      trendUp: true,
      icon: Wallet, 
      iconColor: 'text-orange-500', 
      iconBg: 'bg-orange-50'
    },
    { 
      label: 'BILLETS VENDUS', 
      val: '342', 
      max: '/ 500', 
      sub: 'vs hier', 
      trend: '+8.2%', 
      trendUp: true,
      progress: 68,
      icon: Ticket, 
      iconColor: 'text-gray-700', 
      iconBg: 'bg-gray-100'
    },
    { 
      label: 'GARES ACTIVES', 
      val: '08', 
      max: '/ 10',
      sub: 'actives',
      pill: '2 en attente',
      progress: 80,
      icon: MapPin, 
      iconColor: 'text-gray-700', 
      iconBg: 'bg-gray-100'
    },
    { 
      label: 'CHAUFFEURS EN LIGNE', 
      val: '24', 
      max: '/ 32',
      sub: 'disponibles',
      pill: 'En direct',
      pillColor: 'bg-red-50 text-red-600',
      pillDot: 'bg-red-500',
      progress: 75,
      icon: Bus, 
      iconColor: 'text-orange-500', 
      iconBg: 'bg-orange-50'
    },
  ]

  const gares = [
    { nom: 'Gare Yopougon', lieu: 'Abidjan • Yopougon', chef: 'Kouadio M.', initials: 'KM', quota: 120, vendus: 98, progress: 81 },
    { nom: 'Gare Adjamé', lieu: 'Abidjan • Adjamé', chef: 'Aïcha T.', initials: 'AT', quota: 150, vendus: 132, progress: 88 },
    { nom: 'Gare Daloa', lieu: 'Daloa • Centre', chef: 'Jean-Paul F.', initials: 'JP', quota: 80, vendus: 45, progress: 56 },
    { nom: 'Gare Akoupé', lieu: 'Akoupé • Ville', chef: 'Yao B.', initials: 'YB', quota: 50, vendus: 50, progress: 100 },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* En-tête & Sélecteur de Vue (Super Admin / Compagnie) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {viewMode === 'superadmin' 
              ? "Vue globale Super Admin • Contrôle et supervision de la plateforme" 
              : `Espace de gestion : ${selectedComp}`}
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
          <button 
            onClick={() => setViewMode('superadmin')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              viewMode === 'superadmin' 
                ? 'bg-[#1a1a1c] text-white shadow-md' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Shield size={14} /> Super Admin
          </button>
          <button 
            onClick={() => setViewMode('company')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              viewMode === 'company' 
                ? 'bg-orange-500 text-white shadow-md shadow-orange-200' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Building2 size={14} /> Vue Compagnie
          </button>
        </div>
      </div>

      {viewMode === 'superadmin' ? (
        /* ================= VUE SUPER ADMIN ================= */
        <div className="space-y-6">
          
          {/* Statistiques Globales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {adminStats.map((c, i) => (
              <div key={i} className="bg-white rounded-[24px] p-5 border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div className={`w-10 h-10 rounded-xl ${c.iconBg} ${c.iconColor} flex items-center justify-center`}>
                    <c.icon size={20} strokeWidth={2.5} />
                  </div>
                  {c.trend && (
                    <div className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-green-50 text-green-600">
                      <TrendingUp size={12} /> {c.trend}
                    </div>
                  )}
                  {c.pill && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-100">
                      {c.pill}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-400 tracking-wider mb-1">{c.label}</p>
                  <div className="flex items-baseline gap-1">
                    <h3 className="text-2xl font-black text-gray-900">{c.val}</h3>
                    {c.max && <span className="text-sm font-bold text-gray-400">{c.max}</span>}
                    {c.currency && <span className="text-sm font-bold text-gray-400 ml-1">{c.currency}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Liste des Compagnies */}
          <div className="bg-white rounded-[24px] border border-gray-100 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-black text-gray-900">Toutes les compagnies</h3>
                <p className="text-xs text-gray-500">Supervisez l'activité et l'état des quotas de chaque opérateur</p>
              </div>
              <button className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-sm shadow-orange-200">
                <Plus size={16} /> Ajouter compagnie
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {companiesList.map((comp, i) => (
                <div key={i} className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100 hover:border-orange-200 hover:bg-white transition-all flex flex-col justify-between group">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl ${comp.color} text-white flex items-center justify-center font-bold text-sm shadow-sm`}>
                        {comp.name.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    </div>
                    <h4 className="font-bold text-gray-900">{comp.name}</h4>
                    <p className="text-[11px] text-gray-400 mb-4">{comp.lieu}</p>

                    <div className="grid grid-cols-3 gap-2 py-3 border-y border-gray-100 mb-4 text-center">
                      <div>
                        <p className="text-xs font-black text-gray-900">{comp.gares}</p>
                        <p className="text-[9px] text-gray-400 uppercase">Gares</p>
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-900">{comp.tickets}</p>
                        <p className="text-[9px] text-gray-400 uppercase">Tickets</p>
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-900">{comp.solde.substring(0, 4)}...</p>
                        <p className="text-[9px] text-gray-400 uppercase">Solde</p>
                      </div>
                    </div>

                    <div className="space-y-1 mb-4">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-gray-400">Occupation quota</span>
                        <span className="font-bold text-gray-900">{comp.quota}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${comp.color}`} style={{ width: `${comp.quota}%` }}></div>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => { setSelectedComp(comp.name); setViewMode('company'); }}
                    className="w-full py-2.5 bg-[#1a1a1c] hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    Gérer la compagnie <ChevronRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Tickets Récents & Retraits en attente */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-[24px] border border-gray-100 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-gray-900 text-sm">Tickets récents • Toutes compagnies</h3>
                <span className="text-xs font-bold text-orange-500 cursor-pointer hover:underline">Voir tout</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-orange-500 text-white font-bold text-xs flex items-center justify-center">MD</div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">Abidjan → Akoupé • Adjamé</p>
                    <p className="text-[10px] text-gray-400">Kouamé Fabrice • Aujourd'hui 08:30</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-900">3 500 F</p>
                  <span className="text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-md">payé</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[24px] border border-gray-100 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-gray-900 text-sm">Retraits en attente</h3>
                <span className="text-xs font-bold text-orange-500 cursor-pointer hover:underline">1 en attente</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-orange-50/50 rounded-2xl border border-orange-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-orange-500 text-white font-bold text-xs flex items-center justify-center">MD</div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">MD Transport</p>
                    <p className="text-[10px] text-gray-400">Orange Money • 10 Nov 2024</p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <div>
                    <p className="text-xs font-black text-gray-900">250,000 F</p>
                  </div>
                  <button className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold shadow-sm transition-colors">
                    Valider
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ================= VUE COMPAGNIE ================= */
        <div className="space-y-8">
          
          {/* Cartes de statistiques (Top Row) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {stats.map((c, i) => (
              <div key={i} className="bg-white rounded-[24px] p-5 border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div className={`w-10 h-10 rounded-xl ${c.iconBg} ${c.iconColor} flex items-center justify-center`}>
                    <c.icon size={20} strokeWidth={2.5} />
                  </div>
                  
                  {c.trend && (
                    <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${c.trendUp ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      <TrendingUp size={12} />
                      {c.trend}
                    </div>
                  )}
                  {c.pill && (
                    <div className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${c.pillColor || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {c.pillDot && <span className={`w-1.5 h-1.5 rounded-full ${c.pillDot}`}></span>}
                      {c.pill}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-[11px] font-bold text-gray-400 tracking-wider mb-1">{c.label}</p>
                  <div className="flex items-baseline gap-1">
                    <h3 className="text-2xl font-black text-gray-900">{c.val}</h3>
                    {c.max && <span className="text-sm font-bold text-gray-400">{c.max}</span>}
                    {c.currency && <span className="text-sm font-bold text-gray-400 ml-1">{c.currency}</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
                </div>

                {c.progress !== undefined && (
                  <div className="mt-5 w-full bg-gray-100 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full ${c.progress > 85 ? 'bg-green-500' : c.progress > 50 ? 'bg-gray-800' : 'bg-orange-500'}`} 
                      style={{ width: `${c.progress}%` }}
                    ></div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Section Principale : Tableau et Compte de Revue */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Colonne de Gauche (Gares & Ventes) */}
            <div className="lg:col-span-2 bg-white rounded-[24px] border border-gray-100 shadow-sm p-1">
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900">Gares & Ventes</h3>
                    <p className="text-xs text-gray-500">Suivi en temps réel des quotas par gare</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl transition-colors">
                    <Download size={14} /> Exporter CSV
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-colors shadow-sm shadow-orange-200">
                    <Plus size={14} /> Ajouter Gare
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-50">
                      <th className="p-4 font-bold">Gare / Département</th>
                      <th className="p-4 font-bold">Chef de Gare</th>
                      <th className="p-4 font-bold">Quota</th>
                      <th className="p-4 font-bold">Ventes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {gares.map((gare, i) => (
                      <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-bold">
                              {gare.nom.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-sm text-gray-900">{gare.nom}</p>
                              <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                                <MapPin size={10} /> {gare.lieu}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gray-800 text-white flex items-center justify-center text-[10px] font-bold">
                              {gare.initials}
                            </div>
                            <span className="text-sm font-semibold text-gray-700">{gare.chef}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="text-sm font-black text-gray-900">{gare.quota} <span className="text-xs font-normal text-gray-500">billets</span></p>
                          <p className="text-[10px] text-gray-400">Quota journalier</p>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="text-sm font-black text-gray-900">{gare.vendus}</p>
                              <p className="text-[10px] text-gray-400">vendus</p>
                            </div>
                            <div className="flex-1 min-w-[60px] max-w-[100px] h-1.5 bg-gray-100 rounded-full">
                              <div 
                                className={`h-1.5 rounded-full ${gare.progress >= 100 ? 'bg-green-500' : 'bg-gray-800'}`}
                                style={{ width: `${gare.progress}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Colonne de Droite (Finance & Widgets) */}
            <div className="space-y-6">
              
              {/* Carte Sombre Compte de Revue */}
              <div className="bg-[#1C1C1E] rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl"></div>
                
                <div className="flex justify-between items-start relative z-10">
                  <p className="text-[11px] font-bold text-gray-400 tracking-widest">COMPTE DE REVUE</p>
                  <button className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                    <Wallet size={14} className="text-gray-300" />
                  </button>
                </div>

                <div className="mt-4 relative z-10">
                  <h3 className="text-3xl font-black">
                    2 450 000 <span className="text-sm font-normal text-gray-400">FCFA</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">Disponible pour retrait immédiat</p>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6 relative z-10">
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <p className="text-[10px] text-gray-400 mb-1">Aujourd'hui</p>
                    <p className="text-sm font-bold text-green-400">+ 185 000</p>
                    <p className="text-[10px] text-gray-500">FCFA</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <p className="text-[10px] text-gray-400 mb-1">Frais Plateforme</p>
                    <p className="text-sm font-bold text-red-400">- 12 500</p>
                    <p className="text-[10px] text-gray-500">FCFA</p>
                  </div>
                </div>

                <button className="w-full mt-6 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all relative z-10 shadow-sm shadow-orange-900">
                  Faire un retrait <ArrowUpRight size={16} />
                </button>
                <p className="text-center text-[10px] text-gray-500 mt-3 relative z-10">
                  Retrait temps réel • Mobile Money / Banque
                </p>
              </div>

              {/* Mini Widget Chauffeurs */}
              <div className="bg-white border border-gray-100 rounded-[24px] p-5 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900">Chauffeurs Connectés</h4>
                    <p className="text-[11px] text-gray-500">Trajets temps réel</p>
                  </div>
                </div>
                <div className="bg-green-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm shadow-green-200">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                  24 LIVE
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}