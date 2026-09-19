import { useState } from 'react'
import { Wallet, ArrowUpRight, Clock, CheckCircle2, Plus } from 'lucide-react'
import WithdrawModal from '../components/WithdrawModal'

export default function Retraits() {
  const [show, setShow] = useState(false)

  const historiqueRetraits = [
    { id: '1', ref: 'RET-2026-001', montant: '500 000 FCFA', methode: 'Wave', statut: 'Validé', date: '20 juillet 2026' },
    { id: '2', ref: 'RET-2026-002', montant: '750 000 FCFA', methode: 'Orange Money', statut: 'En attente', date: '21 juillet 2026' },
  ]

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-gray-900">Gestion des Retraits</h2>
          <p className="text-xs text-gray-500 mt-0.5">Suivi du solde disponible et historique des reversements</p>
        </div>
        <button
          onClick={() => setShow(true)}
          className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-2xl text-xs font-bold transition-all shadow-sm shadow-orange-200 cursor-pointer"
        >
          <Plus size={16} /> Demander un retrait
        </button>
      </div>

      {/* Carte Solde Disponible */}
      <div className="bg-gradient-to-br from-[#1a1a1c] to-[#2c2c2e] text-white rounded-[24px] p-8 relative overflow-hidden shadow-sm">
        <div className="absolute -right-6 -bottom-6 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl"></div>
        
        <div className="flex justify-between items-start relative z-10">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 px-3 py-1 rounded-md border border-orange-500/20">
              Compte Messay CI
            </span>
            <p className="text-xs text-gray-400 font-medium mt-3">Solde disponible pour décaissement</p>
            <p className="text-3xl md:text-4xl font-black mt-1 tracking-tight text-white">1 250 000 <span className="text-orange-400 font-bold text-2xl">FCFA</span></p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-orange-400 shadow-sm">
            <Wallet size={26} />
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-gray-400 relative z-10">
          <span>Dernière mise à jour : En direct</span>
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Comptabilité active
          </span>
        </div>
      </div>

      {/* Historique des retraits */}
      <div className="bg-white rounded-[24px] border border-gray-100 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h4 className="font-black text-gray-900 text-sm">Historique des retraits récents</h4>
          <span className="text-[11px] font-bold text-gray-400">{historiqueRetraits.length} transactions</span>
        </div>

        <div className="divide-y divide-gray-100">
          {historiqueRetraits.map((r) => (
            <div key={r.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-orange-50/20 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold shrink-0">
                  <ArrowUpRight size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-gray-900">{r.ref}</span>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100">
                      {r.methode}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Demandé le {r.date}</p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-6 pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-50">
                <div className="text-left sm:text-right">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Montant</p>
                  <p className="text-sm font-black text-gray-900">{r.montant}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border shadow-sm ${
                  r.statut === 'Validé'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : 'bg-amber-50 text-amber-700 border-amber-100'
                }`}>
                  {r.statut === 'Validé' ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Clock size={13} className="text-amber-500" />}
                  {r.statut}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {show && <WithdrawModal onClose={() => setShow(false)} />}
    </div>
  )
}