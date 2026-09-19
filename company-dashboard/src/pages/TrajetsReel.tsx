import MapLive from '../components/MapLive'
import { Navigation } from 'lucide-react'

export default function TrajetsReel() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* En-tête de la page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Trajets en temps réel</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Suivi GPS direct des flux • Gare de Départ vers Gare d'Arrivée
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Trafic en direct
          </span>
        </div>
      </div>

      {/* Composant Carte Live */}
      <MapLive />
    </div>
  )
}