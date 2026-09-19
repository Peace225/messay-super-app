import { useEffect, useState, useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../services/api'
import { connectSocket, onNewReservation, onReservationUpdate, emitReservationStatus } from '../services/socket'
import { 
  Search, 
  MapPin, 
  QrCode, 
  CheckCircle, 
  Clock, 
  Bus, 
  User, 
  Phone, 
  CreditCard, 
  PackageCheck, 
  AlertCircle,
  X,
  ArrowRight,
  ShieldCheck,
  FileText,
  Receipt
} from 'lucide-react'

type TimelineEvent = {
  status: 'CREE' | 'PAYE' | 'VALIDE' | 'EMBARQUE' | 'EN_COURS' | 'ARRIVE'
  at: string
  actor: string
  note?: string
  location?: string
}

type Reservation = {
  id: string
  code: string
  passenger: { name: string; phone: string; email?: string; photo?: string }
  gare_depart: { id: string; nom: string; ville: string }
  gare_arrivee: { id: string; nom: string; ville: string }
  destination: string
  heure: string
  date: string
  prix: number
  seat: string
  payment_method: 'WAVE' | 'OM' | 'MOMO' | 'CASH'
  payment_status: 'PAYE' | 'EN_ATTENTE' | 'ECHOUE'
  status: 'PAYE' | 'VALIDE' | 'EMBARQUE' | 'EN_COURS' | 'ARRIVE'
  company: string // Compagnie de transport / Partenaire
  chauffeur?: { name: string; bus: string }
  timeline: TimelineEvent[]
  qr: string
}

const mockReservations: Reservation[] = [
  {
    id: 'r1',
    code: 'MES-ABJ-AKP-001',
    date: '2026-07-21',
    heure: '07:00',
    passenger: { name: 'Kouadio Mensah', phone: '0701234567', email: 'kouadio@gmail.com' },
    gare_depart: { id: 'g1', nom: 'Gare Yopougon', ville: 'Abidjan' },
    gare_arrivee: { id: 'g3', nom: 'Gare Centre Akoupé', ville: 'Akoupé' },
    destination: 'Akoupé',
    prix: 5000,
    seat: 'A12',
    payment_method: 'WAVE',
    payment_status: 'PAYE',
    status: 'PAYE',
    company: 'Messay Express Abidjan',
    chauffeur: { name: 'Koffi S.', bus: 'AB-123-CI' },
    qr: 'MES-ABJ-AKP-001-QR',
    timeline: [
      { status: 'CREE', at: '2026-07-20T10:00:00', actor: 'App Mobile', note: 'Reçu émis suite achat Abidjan → Akoupé', location: 'Abidjan' },
      { status: 'PAYE', at: '2026-07-20T10:02:15', actor: 'Wave CI', note: 'Paiement 5000F validé #WAVE-9981', location: 'Paiement' },
      { status: 'VALIDE', at: '2026-07-20T10:03:00', actor: 'Système', note: 'Siège A12 attribué automatiquement', location: 'Gare Yopougon' },
    ]
  },
  {
    id: 'r2',
    code: 'MES-ABJ-DAL-042',
    date: '2026-07-21',
    heure: '08:00',
    passenger: { name: 'Bamba Aminata', phone: '0502345678' },
    gare_depart: { id: 'g2', nom: 'Gare Adjamé', ville: 'Abidjan' },
    gare_arrivee: { id: 'g4', nom: 'Gare Daloa', ville: 'Daloa' },
    destination: 'Daloa',
    prix: 8000,
    seat: 'B05',
    payment_method: 'OM',
    payment_status: 'PAYE',
    status: 'EMBARQUE',
    company: 'Messay Transport Ouest',
    chauffeur: { name: 'Diabaté M.', bus: 'AB-456-CI' },
    qr: 'MES-ABJ-DAL-042-QR',
    timeline: [
      { status: 'CREE', at: '2026-07-20T09:00:00', actor: 'App Mobile', note: 'Reçu de billet mobile généré', location: 'Abidjan' },
      { status: 'PAYE', at: '2026-07-20T09:01:30', actor: 'Orange Money', note: '8000F #OM-4421' },
      { status: 'VALIDE', at: '2026-07-20T09:02:00', actor: 'Chef Gare Adjamé', note: 'Validé par chef gare Yao' },
      { status: 'EMBARQUE', at: '2026-07-21T07:45:00', actor: 'Chef Gare Adjamé', note: 'QR scanné, passager à bord', location: 'Gare Adjamé' },
    ]
  },
  {
    id: 'r3',
    code: 'MES-ABJ-AKP-009',
    date: '2026-07-21',
    heure: '14:00',
    passenger: { name: 'Yao Kouakou', phone: '0709988776' },
    gare_depart: { id: 'g1', nom: 'Gare Yopougon', ville: 'Abidjan' },
    gare_arrivee: { id: 'g3', nom: 'Gare Centre Akoupé', ville: 'Akoupé' },
    destination: 'Akoupé',
    prix: 5000,
    seat: 'A13',
    payment_method: 'WAVE',
    payment_status: 'PAYE',
    status: 'EN_COURS',
    company: 'Messay Express Abidjan',
    chauffeur: { name: 'Koffi S.', bus: 'AB-123-CI' },
    qr: 'MES-ABJ-AKP-009-QR',
    timeline: [
      { status: 'CREE', at: '2026-07-20T18:00:00', actor: 'App Mobile', note: 'Réception reçu application' },
      { status: 'PAYE', at: '2026-07-20T18:01:00', actor: 'Wave' },
      { status: 'VALIDE', at: '2026-07-20T18:02:00', actor: 'Système' },
      { status: 'EMBARQUE', at: '2026-07-21T06:50:00', actor: 'Chef Gare Yopougon', location: 'Gare Yopougon' },
      { status: 'EN_COURS', at: '2026-07-21T07:05:00', actor: 'Chauffeur Koffi S.', note: 'Départ Yopougon → Akoupé, 35 passagers', location: 'Sur route' },
    ]
  },
]

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  PAYE: { label: 'Payé', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-400' },
  VALIDE: { label: 'Validé', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  EMBARQUE: { label: 'Embarqué', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500' },
  EN_COURS: { label: 'En Route', bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500' },
  ARRIVE: { label: 'Arrivé', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
}

const timelineIcon: Record<string, any> = {
  CREE: Receipt,
  PAYE: CreditCard,
  VALIDE: CheckCircle,
  EMBARQUE: QrCode,
  EN_COURS: Bus,
  ARRIVE: PackageCheck,
}

export default function Reservations() {
  const [reservations, setReservations] = useState<Reservation[]>(mockReservations)
  const [gares, setGares] = useState<any[]>([])
  const [filterDepart, setFilterDepart] = useState('all')
  const [filterArrivee, setFilterArrivee] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Reservation | null>(mockReservations[0])
  const [showQR, setShowQR] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)

  useEffect(() => {
    const companyId = localStorage.getItem('companyId') || '1'
    
    api.getGares(companyId).then(setGares).catch(() => setGares([]))
    connectSocket(companyId)

    const off1 = onNewReservation((newRes: Reservation) => {
      setReservations(prev => [newRes, ...prev])
      new Audio('https://cdn.pixabay.com/audio/2022/03/24/audio_4c8c28f6e8.mp3').play().catch(() => {})
    })

    const off2 = onReservationUpdate((updated: Reservation) => {
      setReservations(prev => prev.map(p => p.id === updated.id ? updated : p))
      setSelected(prev => (prev?.id === updated.id ? updated : prev))
    })

    return () => {
      off1()
      off2()
    }
  }, [])

  const garesDepartList = useMemo(() => {
    const set = new Set<string>()
    reservations.forEach(r => set.add(r.gare_depart.nom))
    gares.forEach(g => set.add(g.nom))
    return Array.from(set)
  }, [reservations, gares])

  const garesArriveeList = useMemo(() => {
    const set = new Set<string>()
    reservations.forEach(r => set.add(r.gare_arrivee.nom))
    return Array.from(set)
  }, [reservations])

  const filtered = useMemo(() => {
    return reservations.filter(r => {
      if (filterDepart !== 'all' && r.gare_depart.nom !== filterDepart) return false
      if (filterArrivee !== 'all' && r.gare_arrivee.nom !== filterArrivee) return false
      if (filterStatus !== 'all' && r.status !== filterStatus) return false
      if (
        search &&
        !`${r.passenger.name} ${r.code} ${r.passenger.phone} ${r.company}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ) {
        return false
      }
      return true
    })
  }, [reservations, filterDepart, filterArrivee, filterStatus, search])

  const updateStatus = (
    id: string,
    newStatus: Reservation['status'],
    actor: string,
    note?: string
  ) => {
    setReservations(prev =>
      prev.map(r => {
        if (r.id !== id) return r

        const event: TimelineEvent = {
          status: newStatus,
          at: new Date().toISOString(),
          actor,
          note,
          location: r.gare_depart.nom
        }

        const updated: Reservation = {
          ...r,
          status: newStatus,
          timeline: [...r.timeline, event]
        }

        emitReservationStatus(updated)

        if (selected?.id === id) {
          setSelected(updated)
        }

        return updated
      })
    )
  }

  const stats = {
    total: reservations.length,
    paye: reservations.filter(r => r.status === 'PAYE').length,
    embarque: reservations.filter(r => r.status === 'EMBARQUE').length,
    enCours: reservations.filter(r => r.status === 'EN_COURS').length,
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* En-tête de la page */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Billets & Traçabilité des Passagers</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Réception des reçus d'achat de billets mobiles, suivi des compagnies et contrôle des flux en direct
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Live Socket.io actif
          </span>
        </div>
      </div>

      {/* Cartes de Statistiques Rapides */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-[20px] p-5 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total reçus du jour</p>
            <p className="text-2xl font-black text-gray-900 mt-1">{stats.total}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-700 flex items-center justify-center font-bold">
            <Receipt size={22} />
          </div>
        </div>

        <div className="bg-white rounded-[20px] p-5 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Billets Payés</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{stats.paye}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock size={22} />
          </div>
        </div>

        <div className="bg-white rounded-[20px] p-5 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Embarqués</p>
            <p className="text-2xl font-black text-purple-600 mt-1">{stats.embarque}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <QrCode size={22} />
          </div>
        </div>

        <div className="bg-white rounded-[20px] p-5 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">En route</p>
            <p className="text-2xl font-black text-orange-500 mt-1">{stats.enCours}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center">
            <Bus size={22} />
          </div>
        </div>
      </div>

      {/* Barre de Filtres Avancée */}
      <div className="bg-white rounded-[24px] border border-gray-100 p-4 shadow-sm flex gap-3 flex-wrap items-center">
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3.5 h-12 flex-1 min-w-[260px] border border-gray-100 focus-within:border-orange-500 transition-colors">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, téléphone, code billet, compagnie..."
            className="bg-transparent outline-none text-xs font-medium text-gray-900 w-full placeholder:text-gray-400"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterDepart}
            onChange={e => setFilterDepart(e.target.value)}
            className="h-12 rounded-xl border border-gray-100 px-4 bg-gray-50 text-xs font-bold text-gray-700 outline-none hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <option value="all">📍 Toutes gares départ</option>
            {garesDepartList.map(nom => (
              <option key={nom} value={nom}>{nom}</option>
            ))}
          </select>

          <select
            value={filterArrivee}
            onChange={e => setFilterArrivee(e.target.value)}
            className="h-12 rounded-xl border border-gray-100 px-4 bg-gray-50 text-xs font-bold text-gray-700 outline-none hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <option value="all">🏁 Toutes arrivées</option>
            {garesArriveeList.map(nom => (
              <option key={nom} value={nom}>{nom}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="h-12 rounded-xl border border-gray-100 px-4 bg-gray-50 text-xs font-bold text-gray-700 outline-none hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <option value="all">⚡ Tous les statuts</option>
            <option value="PAYE">Payé</option>
            <option value="VALIDE">Validé</option>
            <option value="EMBARQUE">Embarqué</option>
            <option value="EN_COURS">En route</option>
            <option value="ARRIVE">Arrivé</option>
          </select>
        </div>
      </div>

      {/* Grille principale : Liste des reçus/billets et panneau de détail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Liste des Billets / Reçus (7 colonnes) */}
        <div className="lg:col-span-7 bg-white rounded-[24px] border border-gray-100 overflow-hidden shadow-sm">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h4 className="font-black text-gray-900 text-sm">Reçus & Billets App Mobile ({filtered.length})</h4>
            <span className="text-[11px] font-bold text-gray-400">Cliquez pour voir la traçabilité</span>
          </div>

          <div className="divide-y divide-gray-100 max-h-[650px] overflow-auto">
            {filtered.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-sm">
                Aucun reçu ou billet ne correspond à vos critères de recherche.
              </div>
            ) : (
              filtered.map(r => {
                const sc = statusConfig[r.status] || { label: r.status, bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' }
                const isSelected = selected?.id === r.id

                return (
                  <div
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className={`p-4 hover:bg-orange-50/30 cursor-pointer flex gap-4 transition-all relative ${
                      isSelected ? 'bg-orange-50/60 border-l-4 border-orange-500' : ''
                    }`}
                  >
                    <div className="w-11 h-11 rounded-2xl bg-orange-100 text-orange-700 flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
                      {r.passenger.name.charAt(0)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <div>
                          <p className="font-black text-sm text-gray-900 truncate">
                            {r.passenger.name}
                          </p>
                          <p className="text-[11px] font-bold text-orange-600 tracking-tight">
                            {r.code} • <span className="text-gray-500 font-medium">{r.company}</span>
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 shrink-0 ${sc.bg} ${sc.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}></span>
                          {sc.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 mt-2">
                        <span className="truncate">{r.gare_depart.nom}</span>
                        <ArrowRight size={12} className="text-gray-400 shrink-0" />
                        <span className="truncate">{r.gare_arrivee.nom}</span>
                        <span className="ml-auto text-[11px] font-normal text-gray-400">{r.date} à {r.heure}</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2 pt-2 border-t border-gray-50">
                        <span className="flex items-center gap-1 font-medium text-gray-500">
                          <Phone size={11} /> {r.passenger.phone}
                        </span>
                        <span className="flex items-center gap-1 font-bold text-gray-900">
                          {r.prix.toLocaleString()} F <span className="font-normal text-gray-400">({r.payment_method})</span>
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Panneau Détails & Traçabilité complète (5 colonnes) */}
        <div className="lg:col-span-5 bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden sticky top-6">
          {!selected ? (
            <div className="p-12 text-center text-gray-400 text-sm">
              Sélectionnez un billet pour afficher les détails du reçu mobile et la traçabilité complète.
            </div>
          ) : (
            <div>
              {/* En-tête Billet Carte */}
              <div className="p-6 bg-gradient-to-br from-[#1a1a1c] to-[#2c2c2e] text-white relative overflow-hidden">
                <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl"></div>
                
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-md border border-orange-500/20">
                      Reçu de billet mobile
                    </span>
                    <h3 className="font-black text-xl tracking-wide mt-2">{selected.code}</h3>
                    <p className="text-xs text-orange-300 font-semibold mt-0.5">Compagnie : {selected.company}</p>
                  </div>
                  <button
                    onClick={() => setShowQR(true)}
                    className="w-11 h-11 bg-white/10 hover:bg-orange-500 transition-colors rounded-2xl flex items-center justify-center text-white shadow-sm group"
                    title="Afficher le QR Code"
                  >
                    <QrCode size={20} className="group-hover:scale-110 transition-transform" />
                  </button>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 relative z-10">
                  <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
                    <p className="text-[10px] text-gray-400 uppercase">Départ</p>
                    <p className="text-xs font-bold truncate mt-0.5">{selected.gare_depart.nom}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{selected.heure} • {selected.date}</p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
                    <p className="text-[10px] text-gray-400 uppercase">Arrivée</p>
                    <p className="text-xs font-bold truncate mt-0.5">{selected.gare_arrivee.nom}</p>
                    <p className="text-[10px] text-orange-400 font-bold mt-0.5">Siège : {selected.seat}</p>
                  </div>
                </div>
              </div>

              {/* Info Passager & Paiement */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-black text-xs uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <User size={14} className="text-orange-500" /> Passager & Paiement mobile
                  </p>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                    Reçu validé ({selected.payment_status})
                  </span>
                </div>

                <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 font-medium">Nom complet</span>
                    <span className="text-xs font-bold text-gray-900">{selected.passenger.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 font-medium">Téléphone</span>
                    <span className="text-xs font-bold text-gray-900">{selected.passenger.phone}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 font-medium">Montant réglé</span>
                    <span className="text-xs font-black text-orange-600">{selected.prix.toLocaleString()} FCFA ({selected.payment_method})</span>
                  </div>
                </div>

                {selected.chauffeur && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-600 bg-orange-50/50 border border-orange-100 p-3 rounded-2xl">
                    <Bus size={16} className="text-orange-500 shrink-0" />
                    <div>
                      Chauffeur : <span className="font-bold text-gray-900">{selected.chauffeur.name}</span> • Bus : <span className="font-bold text-gray-900">{selected.chauffeur.bus}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Timeline Traçabilité complète */}
              <div className="p-6 max-h-[300px] overflow-auto space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-black text-xs uppercase tracking-wider text-gray-400">Traçabilité complète</p>
                  <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">Reçu numérique</span>
                </div>

                <div className="space-y-0 relative pl-2">
                  <div className="absolute left-[19px] top-3 bottom-3 w-0.5 bg-gray-100" />
                  
                  {selected.timeline.map((ev, i) => {
                    const Icon = timelineIcon[ev.status] || Clock
                    const isLast = i === selected.timeline.length - 1

                    return (
                      <div key={i} className="flex gap-4 pb-4 relative group">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center z-10 shrink-0 text-white shadow-sm ${
                            ev.status === 'PAYE'
                              ? 'bg-emerald-500'
                              : isLast
                              ? 'bg-orange-500 ring-4 ring-orange-100'
                              : 'bg-gray-900'
                          }`}
                        >
                          <Icon size={13} />
                        </div>
                        <div className="flex-1 pt-0.5">
                          <div className="flex justify-between items-baseline">
                            <p className="text-xs font-bold text-gray-900">
                              {ev.status}
                            </p>
                            <span className="text-[10px] text-gray-400 font-medium">
                              {new Date(ev.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 font-medium">
                            {ev.actor} {ev.location ? `• ${ev.location}` : ''}
                          </p>
                          {ev.note && (
                            <p className="text-[11px] text-gray-600 bg-gray-50 rounded-xl px-3 py-1.5 mt-1 border border-gray-100">
                              {ev.note}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Boutons d'actions contextuels (Sans annulation, gestion des reçus) */}
              <div className="p-6 bg-gray-50/50 border-t border-gray-100">
                <div className="grid grid-cols-1 gap-2">
                  {selected.status === 'PAYE' && (
                    <button
                      onClick={() => updateStatus(selected.id, 'VALIDE', 'Chef Gare', 'Reçu vérifié et validé manuellement')}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-colors shadow-sm"
                    >
                      Valider le reçu / billet
                    </button>
                  )}
                  {selected.status === 'VALIDE' && (
                    <button
                      onClick={() => updateStatus(selected.id, 'EMBARQUE', 'Chef Gare', 'QR reçu scanné à l\'embarquement')}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-xs font-bold transition-colors shadow-sm"
                    >
                      Scanner QR → Embarqué
                    </button>
                  )}
                  {selected.status === 'EMBARQUE' && (
                    <button
                      onClick={() => updateStatus(selected.id, 'EN_COURS', selected.chauffeur?.name || 'Chauffeur', 'Bus parti sur la route')}
                      className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-xs font-bold transition-colors shadow-sm shadow-orange-200"
                    >
                      Marquer en route (Départ)
                    </button>
                  )}
                  {selected.status === 'EN_COURS' && (
                    <button
                      onClick={() => updateStatus(selected.id, 'ARRIVE', 'Chauffeur', `Arrivé à destination (${selected.gare_arrivee.nom})`)}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition-colors shadow-sm"
                    >
                      Marquer Arrivé
                    </button>
                  )}
                  <div className="text-center pt-2">
                    <span className="text-[11px] text-gray-400 italic">
                      Les billets achetés via l'application mobile génèrent des reçus officiels (pas d'annulation directe en gare).
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal QR Code en grand */}
      {showQR && selected && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setShowQR(false)}
        >
          <div
            className="bg-white rounded-[32px] p-8 text-center relative max-w-sm w-full shadow-2xl border border-gray-100"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowQR(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-600 w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center transition-colors"
            >
              <X size={18} />
            </button>

            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-100">
              Reçu & Pass d'embarquement
            </span>
            <p className="font-black text-xl text-gray-900 mt-3">{selected.code}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {selected.gare_depart.nom} → {selected.gare_arrivee.nom} ({selected.company})
            </p>

            <div className="bg-white p-6 rounded-3xl mx-auto w-fit border border-gray-100 shadow-lg my-6">
              <QRCodeSVG value={selected.qr} size={220} level="H" includeMargin />
            </div>

            <p className="text-xs font-semibold text-gray-700">
              {selected.passenger.name} • Siège {selected.seat}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              Reçu officiel émis par l'application mobile Messay.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}