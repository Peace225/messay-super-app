import { useEffect, useState } from 'react'
import { api } from '../services/api'
import GareForm from '../components/GareForm'
import { 
  MapPin, 
  Search, 
  Plus, 
  User, 
  Phone, 
  Clock, 
  Trash2, 
  ChevronRight, 
  Navigation,
  X
} from 'lucide-react'

export default function Gares() {
  const [gares, setGares] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [destinations, setDestinations] = useState<any[]>([])
  const [arrivees, setArrivees] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'departs' | 'arrivees'>('departs')
  const [allGares, setAllGares] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showAddDest, setShowAddDest] = useState(false)
  const [newDest, setNewDest] = useState({ ville: '', gare_arrivee_id: '', prix: '', duree: '4h', horaires: '07:00,14:00' })
  const [searchQuery, setSearchQuery] = useState('')

  const load = async () => {
    const g = await api.getGares('1')
    setGares(g)
    const ag = await api.getAllGares()
    setAllGares(ag)
    if (g[0] && !selected) { 
      setSelected(g[0]); 
      const d = await api.getDestinationsByGareDepart(g[0].id); 
      setDestinations(d);
      try {
        const arr = await api.getDestinationsByGareArrivee(g[0].id)
        setArrivees(arr)
      } catch {
        setArrivees([])
      }
    }
  }
  
  useEffect(() => { load() }, [])

  const selectGare = async (gare: any) => {
    setSelected(gare)
    const d = await api.getDestinationsByGareDepart(gare.id)
    setDestinations(d)
    try {
      const arr = await api.getDestinationsByGareArrivee(gare.id)
      setArrivees(arr)
    } catch {
      setArrivees([])
    }
  }

  const handleAddDest = async () => {
    if (!selected) return
    const horaires = newDest.horaires.split(',').map(s => s.trim()).filter(Boolean)
    const gareArr = allGares.find((g: any) => g.id === newDest.gare_arrivee_id)
    const dest = {
      company_id: selected.company_id,
      gare_depart_id: selected.id,
      gare_arrivee_id: newDest.gare_arrivee_id || null,
      ville: newDest.ville || gareArr?.ville || '',
      prix: Number(newDest.prix) || 5000,
      duree: newDest.duree,
    }
    const saved = await api.addDestination(dest, horaires)
    setDestinations([...destinations, { ...saved, gare_arrivee: gareArr, horaires: horaires.map((h: any) => ({ heure_depart: h })) }])
    setShowAddDest(false)
    setNewDest({ ville: '', gare_arrivee_id: '', prix: '', duree: '4h', horaires: '07:00,14:00' })
  }

  const filteredGares = gares.filter(g => g.nom.toLowerCase().includes(searchQuery.toLowerCase()) || g.ville.toLowerCase().includes(searchQuery.toLowerCase()))
  const currentList = activeTab === 'departs' ? destinations : arrivees

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-100px)] pb-6">
      
      {/* ---------------- BARRE LATERALE GAUCHE (Mes Gares) ---------------- */}
      <div className="w-full lg:w-[340px] flex flex-col gap-4">
        <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-4 flex-1 flex flex-col overflow-hidden">
          
          {/* En-tête Sidebar */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Navigation className="text-gray-400" size={18} /> 
              Mes Gares ({gares.length})
            </h2>
            <button 
              onClick={() => setShowForm(true)} 
              className="w-8 h-8 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Recherche */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Rechercher une gare..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-4 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Liste des gares */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
            {filteredGares.map((g: any) => {
              const isSelected = selected?.id === g.id;
              return (
                <div 
                  key={g.id} 
                  onClick={() => selectGare(g)} 
                  className={`p-4 rounded-[20px] cursor-pointer relative overflow-hidden transition-all duration-200 border ${
                    isSelected 
                      ? 'bg-[#1a1a1c] text-white border-transparent shadow-md' 
                      : 'bg-white text-gray-900 border-gray-100 hover:border-orange-200 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isSelected ? 'bg-white/10 text-orange-500' : 'bg-orange-50 text-orange-500'}`}>
                        <MapPin size={16} />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">{g.nom}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${isSelected ? 'bg-white/10 text-gray-300' : 'bg-orange-50 text-orange-600'}`}>
                            {g.ville}
                          </span>
                          <span className={`text-xs truncate max-w-[120px] ${isSelected ? 'text-gray-400' : 'text-gray-500'}`}>
                            {g.adresse || 'Centre-ville'}
                          </span>
                        </div>
                        <div className={`flex items-center gap-3 mt-3 text-[11px] ${isSelected ? 'text-gray-400' : 'text-gray-500'}`}>
                          <span className="flex items-center gap-1"><User size={12} /> {g.chef_nom || 'Non assigné'}</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={isSelected ? 'text-white' : 'text-gray-300'} size={16} />
                  </div>

                  {isSelected && (
                    <div className="absolute bottom-3 left-4 right-4 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="w-[60%] h-full bg-orange-500 rounded-full"></div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ---------------- ZONE PRINCIPALE DROITE ---------------- */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        {!selected ? (
          <div className="flex-1 bg-white rounded-[24px] border border-gray-100 flex items-center justify-center flex-col text-gray-400">
            <MapPin className="mb-4 text-gray-200" size={48} />
            <p>Sélectionnez une gare pour voir ses détails</p>
          </div>
        ) : (
          <>
            {/* Carte En-tête Gare */}
            <div className="bg-white rounded-[24px] border border-gray-100 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center text-white shadow-sm shadow-orange-200">
                  <MapPin size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900">{selected.nom} • {selected.ville}</h2>
                  <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-gray-500 font-medium">
                    <span className="flex items-center gap-1"><Navigation size={14} /> {selected.adresse || 'Zone Industrielle'}</span>
                    <span className="flex items-center gap-1"><User size={14} /> {selected.chef_nom || 'Chef non assigné'}</span>
                    <span className="flex items-center gap-1"><Phone size={14} /> 07 09 12 34 56</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-full text-[11px] font-bold border border-green-100">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Opérationnelle
                </span>
                <span className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-full text-[11px] font-bold border border-gray-200">
                  8 quais
                </span>
              </div>
            </div>

            {/* Contenu principal (Départs / Arrivées) */}
            <div className="flex-1 bg-white rounded-[24px] border border-gray-100 p-5 shadow-sm flex flex-col overflow-hidden">
              
              {/* Header Tabs & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setActiveTab('departs')}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                      activeTab === 'departs' 
                        ? 'bg-[#1a1a1c] text-white shadow-md' 
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-600'
                    }`}
                  >
                    <Navigation size={16} /> Départs <span className={`${activeTab === 'departs' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'} px-2 py-0.5 rounded-full text-[10px]`}>{destinations.length}</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('arrivees')}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                      activeTab === 'arrivees' 
                        ? 'bg-[#1a1a1c] text-white shadow-md' 
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-600'
                    }`}
                  >
                    <Navigation className="rotate-180" size={16} /> Arrivées <span className={`${activeTab === 'arrivees' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'} px-2 py-0.5 rounded-full text-[10px]`}>{arrivees.length}</span>
                  </button>
                </div>
                {activeTab === 'departs' && (
                  <button 
                    onClick={() => setShowAddDest(true)} 
                    className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm shadow-orange-200"
                  >
                    <Plus size={16} /> Ajouter destination
                  </button>
                )}
              </div>

              {/* Table / List */}
              <div className="flex-1 overflow-auto mt-4">
                <div className="min-w-[800px]">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">
                    <div className="col-span-3">{activeTab === 'departs' ? "Destination d'arrivée" : "Gare de départ / Origine"}</div>
                    <div className="col-span-2">Prix</div>
                    <div className="col-span-1">Durée</div>
                    <div className="col-span-2">Quota / Vendus</div>
                    <div className="col-span-1">Dispo</div>
                    <div className="col-span-3">Horaires</div>
                  </div>

                  {/* Table Body */}
                  <div className="space-y-3">
                    {currentList.length === 0 ? (
                      <div className="text-center py-10 text-gray-400 text-sm">
                        {activeTab === 'departs' ? "Aucune destination configurée depuis cette gare." : "Aucune arrivée enregistrée pour cette gare."}
                      </div>
                    ) : (
                      currentList.map((d: any) => {
                        const quota = d.quota || 50;
                        const vendus = d.billets_vendus || Math.floor(Math.random() * 45);
                        const percentage = Math.round((vendus / quota) * 100);
                        
                        return (
                          <div key={d.id} className="grid grid-cols-12 gap-4 items-center p-3 rounded-2xl border border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm transition-all group">
                            
                            {/* Destination / Origine */}
                            <div className="col-span-3 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
                                <MapPin size={14} />
                              </div>
                              <div>
                                <h4 className="font-bold text-sm text-gray-900">
                                  {activeTab === 'departs' ? (d.gare_arrivee?.ville || d.ville) : (d.gare_depart?.nom || d.ville || 'Origine')}
                                </h4>
                                <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                                  <Navigation size={10} /> {activeTab === 'departs' ? `Depuis ${selected.nom}` : `Vers ${selected.nom}`}
                                </p>
                              </div>
                            </div>

                            {/* Prix */}
                            <div className="col-span-2">
                              <div className="w-24 h-10 bg-gray-50 border border-gray-100 rounded-lg flex items-center px-3 font-bold text-sm text-gray-900">
                                {d.prix} <span className="ml-auto text-xs text-gray-400 font-normal">F</span>
                              </div>
                            </div>

                            {/* Durée */}
                            <div className="col-span-1 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                              <Clock className="text-gray-400" size={14} /> {d.duree}
                            </div>

                            {/* Quota / Vendus */}
                            <div className="col-span-2 flex items-center gap-2">
                              <span className="font-bold text-sm text-gray-900">{quota}</span>
                              <span className="text-gray-300">/</span>
                              <span className="text-sm text-gray-500">{vendus}</span>
                            </div>

                            {/* Dispo (Progress Bar) */}
                            <div className="col-span-1">
                              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                                <div 
                                  className={`h-full rounded-full ${percentage > 80 ? 'bg-orange-500' : 'bg-green-500'}`}
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                              <span className="text-[10px] text-gray-400">{percentage}% rempli</span>
                            </div>

                            {/* Horaires & Actions */}
                            <div className="col-span-3 flex items-center justify-between gap-2">
                              <div className="flex flex-wrap gap-1.5">
                                {(d.horaires || []).slice(0, 3).map((h: any, i: number) => (
                                  <div key={i} className="flex items-center gap-1 px-2.5 py-1 bg-[#1a1a1c] text-white rounded-full text-[10px] font-bold">
                                    <Clock className="text-gray-400" size={10} />
                                    {String(h.heure_depart || h).slice(0,5)}
                                  </div>
                                ))}
                              </div>
                              
                              {activeTab === 'departs' && (
                                <button 
                                  onClick={async () => { 
                                    await api.deleteDestination(d.id); 
                                    setDestinations(destinations.filter((x: any) => x.id !== d.id)) 
                                  }} 
                                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors shrink-0"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ---------------- MODALS ---------------- */}
      {showForm && <GareForm onClose={() => setShowForm(false)} onSave={async (g: any) => { await api.addGare(g); setShowForm(false); load() }} />}

      {showAddDest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[24px] p-6 w-full max-w-md shadow-2xl">
            <h4 className="font-black text-xl text-gray-900">Nouveau départ</h4>
            <p className="text-sm text-gray-500 mb-6 mt-1">Depuis {selected.nom}</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Gare d'arrivée</label>
                <select 
                  className="w-full h-12 border border-gray-200 rounded-xl px-4 bg-gray-50 focus:bg-white focus:border-orange-500 focus:outline-none transition-colors text-sm font-medium" 
                  value={newDest.gare_arrivee_id} 
                  onChange={e => { const g = allGares.find((x: any) => x.id === e.target.value); setNewDest({ ...newDest, gare_arrivee_id: e.target.value, ville: g?.ville || newDest.ville }) }}
                >
                  <option value="">-- Choisir une gare --</option>
                  {allGares.filter((g: any) => g.id !== selected.id).map((g: any) => <option key={g.id} value={g.id}>{g.nom} ({g.ville})</option>)}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Ville (si pas de gare existante)</label>
                <input 
                  placeholder="Ex: Akoupé" 
                  className="w-full h-12 border border-gray-200 rounded-xl px-4 bg-gray-50 focus:bg-white focus:border-orange-500 focus:outline-none transition-colors text-sm" 
                  value={newDest.ville} 
                  onChange={e => setNewDest({ ...newDest, ville: e.target.value })} 
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Prix (FCFA)</label>
                  <input placeholder="5000" className="w-full h-12 border border-gray-200 rounded-xl px-4 focus:border-orange-500 focus:outline-none transition-colors text-sm" value={newDest.prix} onChange={e => setNewDest({ ...newDest, prix: e.target.value })} />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Durée</label>
                  <input placeholder="ex: 3h30" className="w-full h-12 border border-gray-200 rounded-xl px-4 focus:border-orange-500 focus:outline-none transition-colors text-sm" value={newDest.duree} onChange={e => setNewDest({ ...newDest, duree: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Horaires de départ</label>
                <input 
                  placeholder="07:00, 10:30, 14:00" 
                  className="w-full h-12 border border-gray-200 rounded-xl px-4 bg-gray-50 focus:bg-white focus:border-orange-500 focus:outline-none transition-colors text-sm" 
                  value={newDest.horaires} 
                  onChange={e => setNewDest({ ...newDest, horaires: e.target.value })} 
                />
                <p className="text-[10px] text-gray-400 mt-1">Séparez les heures par des virgules.</p>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowAddDest(false)} className="flex-1 h-12 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-colors">
                Annuler
              </button>
              <button onClick={handleAddDest} className="flex-1 h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-colors shadow-sm shadow-orange-200">
                Ajouter la destination
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}