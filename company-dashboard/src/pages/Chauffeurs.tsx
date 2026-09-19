import { User, Bus, MapPin, Building2 } from 'lucide-react'

interface Chauffeur {
  id: string;
  name: string;
  bus: string;
  gare: string;
  company: string;
  status: 'En ligne' | 'Hors ligne';
}

const CHAUFFEURS: Chauffeur[] = [
  { id: '1', name: 'Kouamé S.', bus: 'AB-123', gare: 'Yopougon → Akoupé', company: 'Messay Express Abidjan', status: 'En ligne' },
  { id: '2', name: 'Diabaté M.', bus: 'AB-456', gare: 'Adjamé → Daloa', company: 'Messay Transport Ouest', status: 'En ligne' },
];

export default function Chauffeurs() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-gray-900">Gestion des Chauffeurs</h2>
          <p className="text-xs text-gray-500 mt-0.5">Suivi de la disponibilité, des compagnies et des affectations des conducteurs</p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shadow-sm">
          <User size={22} />
        </div>
      </div>

      {/* Grille adaptative */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CHAUFFEURS.map((c) => (
          <div 
            key={c.id} 
            className="bg-white rounded-[24px] p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-orange-100 transition-all flex flex-col justify-between gap-4 group"
          >
            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-900 font-black text-sm group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors">
                  {c.name.split(' ').map(n => n[0]).join('')}
                </div>
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border shadow-sm ${
                  c.status === 'En ligne' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                    : 'bg-gray-50 text-gray-600 border-gray-100'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'En ligne' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
                  {c.status}
                </span>
              </div>

              <h3 className="font-black text-gray-900 text-base">{c.name}</h3>
              
              <div className="space-y-2 mt-3 text-xs text-gray-600">
                <div className="flex items-center gap-2 bg-orange-50/50 p-2.5 rounded-xl border border-orange-100/60">
                  <Building2 size={14} className="text-orange-500 shrink-0" />
                  <span className="font-bold text-gray-900">Compagnie :</span>
                  <span className="truncate text-orange-600 font-semibold">{c.company}</span>
                </div>
                <div className="flex items-center gap-2 bg-gray-50/70 p-2.5 rounded-xl border border-gray-100/60">
                  <Bus size={14} className="text-orange-500 shrink-0" />
                  <span className="font-bold text-gray-900">Bus :</span>
                  <span>{c.bus}</span>
                </div>
                <div className="flex items-center gap-2 bg-gray-50/70 p-2.5 rounded-xl border border-gray-100/60">
                  <MapPin size={14} className="text-orange-500 shrink-0" />
                  <span className="font-bold text-gray-900">Gare :</span>
                  <span className="truncate">{c.gare}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-50 flex items-center justify-between text-[11px] text-gray-400 font-medium">
              <span>ID: #{c.id}</span>
              <span className="text-orange-600 font-bold group-hover:underline cursor-pointer">Détails →</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}