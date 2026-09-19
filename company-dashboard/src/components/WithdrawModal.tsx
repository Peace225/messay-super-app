import { useState } from 'react'
export default function WithdrawModal({ onClose }: any) {
  const [amount, setAmount] = useState('')
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[20px] p-6 w-full max-w-sm">
        <h3 className="font-black text-lg">Demande de retrait</h3>
        <p className="text-sm text-gray-500 mt-1">Solde dispo: 1 250 000 F</p>
        <input className="w-full border rounded-xl px-4 h-12 mt-4 bg-gray-50" placeholder="Montant" value={amount} onChange={e => setAmount(e.target.value)} />
        <select className="w-full border rounded-xl px-4 h-12 mt-3 bg-gray-50"><option>Wave</option><option>Orange Money</option><option>MoMo</option></select>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl bg-gray-100 font-bold">Annuler</button>
          <button onClick={onClose} className="flex-1 h-11 rounded-xl bg-green-600 text-white font-bold">Retirer</button>
        </div>
      </div>
    </div>
  )
}