import { Clock, ArrowRight, User, Ticket, CheckCircle2, Building2 } from 'lucide-react'

export default function Billets() {
  const billets = [
    { h: '07:00', dep: 'Gare Yopougon (Abidjan)', arr: 'Gare Centre Akoupé', client: 'Kouadio M.', prix: '5 000 FCFA', status: 'Payé', company: 'Messay Express Abidjan' },
    { h: '14:00', dep: 'Gare Yopougon (Abidjan)', arr: 'Gare Daloa', client: 'Bamba A.', prix: '8 000 FCFA', status: 'Payé', company: 'Messay Transport Ouest' },
    { h: '08:00', dep: 'Gare Adjamé (Abidjan)', arr: 'Gare Akoupé', client: 'Yao K.', prix: '5 000 FCFA', status: 'Payé', company: 'Messay Express Abidjan' },
  ]

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-gray-900">Billets vendus</h2>
          <p className="text-xs text-gray-500 mt-0.5">Suivi en temps réel des trajets, des compagnies et des passagers</p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shadow-sm">
          <Ticket size={22} />
        </div>
      </div>

      {/* Liste des billets */}
      <div className="bg-white rounded-[24px] border border-gray-100 overflow-hidden shadow-sm divide-y divide-gray-100">
        {billets.map((b, i) => (
          <div 
            key={i} 
            className="p-5 hover:bg-orange-50/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            {/* Infos Horaire, Trajet & Compagnie */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col items-center justify-center shrink-0">
                <Clock size={14} className="text-orange-500 mb-0.5" />
                <span className="text-[11px] font-black text-gray-900">{b.h}</span>
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-gray-900 flex-wrap">
                  <span>{b.dep}</span>
                  <ArrowRight size={12} className="text-orange-500 shrink-0" />
                  <span>{b.arr}</span>
                </div>
                
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 font-bold text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-md border border-orange-100">
                    <Building2 size={11} /> {b.company}
                  </span>
                  <span className="flex items-center gap-1 font-medium text-gray-600">
                    <User size={12} className="text-gray-400" /> {b.client}
                  </span>
                </div>
              </div>
            </div>

            {/* Prix & Statut */}
            <div className="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-gray-50">
              <div className="text-left md:text-right">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Montant</p>
                <p className="text-sm font-black text-gray-900">{b.prix}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm">
                <CheckCircle2 size={13} className="text-emerald-500" />
                {b.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}