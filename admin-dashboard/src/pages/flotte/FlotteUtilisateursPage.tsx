import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, Search, Users } from 'lucide-react';
import { FleetHeading } from '../../components/flotte/FlotteUI';
import { adminTransportService, getTransportError, type TransportUser } from '../../services/adminTransportService';
import { exportCsv, formatDateTime } from '../../utils/fleetFormat';

export default function FlotteUtilisateursPage() {
  const [users, setUsers] = useState<TransportUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const rows = await adminTransportService.users(signal);
      if (!signal?.aborted) { setUsers(rows); setError(null); }
    } catch (err) { if (!signal?.aborted) setError(getTransportError(err)); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const timer = window.setInterval(() => void refresh(controller.signal), 60_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [refresh]);
  const filtered = useMemo(() => users.filter(u => [u.nom,u.prenom,u.telephone,u.email].join(' ').toLowerCase().includes(search.trim().toLowerCase())), [users,search]);
  return <main className="space-y-6 p-4 md:p-6">
    <FleetHeading title="Utilisateurs — transport MESSAY" subtitle="Passagers authentifiés par OTP, issus de PostgreSQL. Aucun compte de démonstration." />
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-5"><div className="flex items-center gap-3"><Users className="text-orange-600"/><div><p className="text-2xl font-black">{loading?'…':users.length}</p><p className="text-xs text-gray-500">Passagers inscrits</p></div></div><div className="flex gap-2"><button onClick={()=>void refresh()} disabled={loading} className="rounded-xl border px-3 py-2 text-sm disabled:opacity-40"><RefreshCw size={16} className="mr-1 inline"/>Actualiser</button><button onClick={()=>exportCsv('messay-passagers',['ID','Nom','Prénom','Téléphone','Email','Statut','Date'],filtered.map(u=>[u.id,u.nom,u.prenom,u.telephone,u.email,u.isBlocked?'BLOQUÉ':'ACTIF',u.createdAt]))} className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-bold text-white"><Download className="mr-1 inline" size={16}/>CSV</button></div></div>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <label className="relative block"><Search size={18} className="absolute left-3 top-3 text-gray-400"/><input aria-label="Rechercher un utilisateur" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nom, téléphone ou email" className="w-full rounded-xl border bg-white py-2.5 pl-10 pr-3 text-sm"/></label>
    <div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[690px] text-left text-sm"><thead className="bg-gray-50 text-xs font-bold uppercase text-gray-500"><tr>{['Utilisateur','Téléphone','Email','État du compte','Inscription'].map(h=><th key={h} className="p-4">{h}</th>)}</tr></thead><tbody className="divide-y">{filtered.map(user=><tr key={user.id}><td className="p-4 font-bold">{user.prenom || ''} {user.nom}</td><td className="p-4">{user.telephone||'—'}</td><td className="p-4">{user.email||'Connexion OTP'}</td><td className="p-4"><span className={`rounded-full px-2 py-1 text-xs font-bold ${user.isBlocked ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{user.isBlocked?'BLOQUÉ':'ACTIF'}</span></td><td className="p-4 text-xs">{formatDateTime(user.createdAt)}</td></tr>)}</tbody></table>{!loading&&!filtered.length&&<p className="p-8 text-center text-gray-500">Aucun passager trouvé.</p>}</div>
    <p className="text-xs text-gray-500">« ACTIF » signifie compte non bloqué, pas utilisateur connecté en ce moment. Le suivi des sessions et des déplacements demande un journal d'activité distinct, avec contrôles d'accès et conservation limitée.</p>
  </main>;
}
