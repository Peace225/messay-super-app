import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
export default function Login() {
  const [company, setCompany] = useState('MD Transport')
  const nav = useNavigate()
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0B4DA1] to-[#10B981] p-4">
      <div className="bg-white rounded-[24px] p-8 w-full max-w-sm shadow-xl">
        <h1 className="text-2xl font-black">MESSAY PRO</h1>
        <p className="text-sm text-gray-500 mt-1">Dashboard Compagnie • Gare Départ → Arrivée</p>
        <select value={company} onChange={e => setCompany(e.target.value)} className="w-full mt-6 h-12 rounded-xl border px-4 bg-gray-50">
          <option>MD Transport</option><option>UTB CI</option><option>CTE Transport Express</option>
        </select>
        <input className="w-full mt-3 h-12 rounded-xl border px-4 bg-gray-50" placeholder="Mot de passe" type="password" defaultValue="123456" />
        <button onClick={() => { localStorage.setItem('company', company); nav('/'); }} className="w-full mt-6 h-12 rounded-xl bg-[#0B4DA1] text-white font-black">Se connecter</button>
      </div>
    </div>
  )
}
