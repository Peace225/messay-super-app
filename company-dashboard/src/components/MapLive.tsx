import { Navigation, Radio, MapPin, Building2, Bus } from 'lucide-react'

export default function MapLive() {
  const trajetsLive = [
    { id: '1', route: 'Abidjan → Akoupé', time: '12h30', company: 'Messay Express Abidjan', bus: 'AB-123-CI', status: 'En route' },
    { id: '2', route: 'Abidjan → Daloa', time: '08:00', company: 'Messay Transport Ouest', bus: 'AB-456-CI', status: 'En route' },
  ]

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-gray-900">Trajets en cours • Live</h2>
          <p className="text-xs text-gray-500 mt-0.5">Suivi géolocalisé en temps réel des véhicules et des compagnies</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-3.5 py-2 rounded-full text-emerald-600 text-xs font-bold shadow-sm w-fit">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Socket.io connecté (/api/trajets)
        </div>
      </div>

      {/* Conteneur Carte / Radar Live */}
      <div className="bg-white rounded-[24px] border border-gray-100 p-6 shadow-sm">
        <div className="h-[400px] bg-gradient-to-br from-blue-50/60 via-slate-50 to-emerald-50/60 rounded-[20px] border border-gray-100 relative overflow-hidden flex flex-col items-center justify-center p-6">
          {/* Motif de grille radar en arrière-plan */}
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#0B4DA1 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }} />
          
          {/* Badge d'indication GPS */}
          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-2 text-xs font-bold text-gray-700 z-10">
            <Radio size={16} className="text-orange-500 animate-pulse" />
            <span>Flux GPS Actif (2 véhicules en mouvement)</span>
          </div>

          {/* Cartes des trajets live flottantes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl z-10 mt-10">
            {trajetsLive.map((t) => (
              <div 
                key={t.id} 
                className="bg-white/95 backdrop-blur-md shadow-xl rounded-[20px] p-5 border border-gray-100 hover:border-orange-200 transition-all group"
              >
                <div className="flex justify-between items-start gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-100">
                    <Building2 size={12} /> {t.company}
                  </span>
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    {t.status}
                  </span>
                </div>

                <div className="flex items-center gap-2 font-black text-gray-900 text-base mt-2">
                  <Navigation size={18} className="text-orange-500 shrink-0 group-hover:rotate-45 transition-transform" />
                  <span>{t.route}</span>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 mt-4 pt-3 border-t border-gray-100">
                  <span className="flex items-center gap-1 font-semibold text-gray-700">
                    <Bus size={13} className="text-gray-400" /> Bus : {t.bus}
                  </span>
                  <span className="font-bold text-gray-900 bg-gray-50 px-2.5 py-1 rounded-lg">
                    Départ : {t.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}