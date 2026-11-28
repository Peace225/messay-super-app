import { useMemo, useState } from 'react';
import { Bus, CalendarClock, Download, Search, TicketCheck, Wallet, Wifi, WifiOff, X } from 'lucide-react';
import { FleetHeading } from '../../components/flotte/FlotteUI';
import { useTicketsAdmin, type InterurbanTicket } from '../../hooks/useTicketsAdmin';
import { exportCsv, formatAmount, formatDateTime } from '../../utils/fleetFormat';

export default function FlotteBilletsPage() {
  const data = useTicketsAdmin();
  const [company, setCompany] = useState('TOUTES');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<InterurbanTicket | null>(null);
  const companies = useMemo(() => ['TOUTES', ...Array.from(new Set(data.tickets.map(t => t.compagnie).filter(Boolean)))], [data.tickets]);
  const filtered = useMemo(() => data.tickets.filter(t => {
    const term = [t.id, t.compagnie, t.passager, t.telephone, t.trajet, t.siege].join(' ').toLowerCase();
    return (company === 'TOUTES' || t.compagnie === company) && term.includes(search.trim().toLowerCase());
  }), [data.tickets, company, search]);
  const paid = data.tickets.filter(t => ['PAYE', 'VALIDE', 'UTILISE'].includes(t.statut || ''));
  const receipts = paid.reduce((sum, t) => sum + (typeof t.prix === 'number' ? t.prix : 0), 0);
  const byCompany = useMemo(() => companies.filter(c => c !== 'TOUTES').map(compagnie => ({ compagnie, count: data.tickets.filter(t => t.compagnie === compagnie).length })), [companies, data.tickets]);
  return <main className="space-y-6 p-4 md:p-6">
    <FleetHeading title="Billetterie interurbaine" subtitle="Billets enregistrés aujourd'hui, compagnies, passagers et horaires de départ." />
    <div className={`flex items-center gap-2 text-sm ${data.connected ? 'text-green-700' : 'text-amber-700'}`}>{data.connected ? <Wifi size={17}/> : <WifiOff size={17}/>} {data.connected ? 'Socket.IO connecté' : 'Socket.IO déconnecté'} <button type="button" onClick={data.refresh} disabled={!data.connected || data.loading} className="ml-auto rounded-lg border bg-white px-3 py-2 text-xs font-bold disabled:opacity-40">Actualiser</button></div>
    {data.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{data.error}</p>}
    <div className="grid gap-4 md:grid-cols-3">{[
      {title:'Billets chargés',value:data.tickets.length,icon:Bus},
      {title:'Billets payés/validés',value:paid.length,icon:TicketCheck},
      {title:'Montant des billets payés*',value:formatAmount(receipts,' F'),icon:Wallet},
    ].map(item => <div key={item.title} className="rounded-2xl border bg-white p-5 shadow-sm"><item.icon className="mb-3 text-orange-500" size={22}/><p className="text-xs font-bold uppercase text-gray-500">{item.title}</p><p className="mt-2 text-2xl font-black">{data.updatedAt? item.value:'—'}</p></div>)}</div>
    <section className="rounded-2xl border bg-white p-5"><h2 className="mb-3 font-bold">Billets par compagnie</h2><div className="flex flex-wrap gap-2">{byCompany.length ? byCompany.map(item => <button type="button" key={item.compagnie} onClick={() => setCompany(item.compagnie)} className={`rounded-xl border px-4 py-2 text-sm ${company === item.compagnie ? 'border-orange-500 bg-orange-50 text-orange-700' : 'bg-gray-50'}`}>{item.compagnie} <strong className="ml-1">{item.count}</strong></button>) : <p className="text-sm text-gray-500">Aucune compagnie chargée.</p>}</div></section>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="flex flex-wrap items-center gap-3 border-b p-4"><label className="relative min-w-[180px] flex-1"><Search size={16} className="absolute left-3 top-3 text-gray-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Passager, billet, compagnie…" className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm outline-none"/></label><select aria-label="Compagnie" value={company} onChange={e => setCompany(e.target.value)} className="rounded-xl border bg-white px-3 py-2.5 text-sm">{companies.map(s => <option key={s} value={s}>{s}</option>)}</select><button disabled={!data.updatedAt} onClick={() => exportCsv('messay-billets-du-jour',['Ticket','Passager','Telephone','Compagnie','Trajet','Gare depart','Gare arrivee','Date depart','Heure','Siege','Statut','Paiement','Prix'],filtered.map(t => [t.id,t.passager,t.telephone,t.compagnie,t.trajet,t.gareDepart,t.gareArrivee,t.date,t.heure,t.siege,t.statut,t.paiement,t.prix]))} className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"><Download size={16}/>CSV</button></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr>{['Billet','Passager','Compagnie','Trajet','Départ','Siège','Statut','Prix',''].map(x => <th className="p-4" key={x}>{x}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{filtered.map(t => <tr key={t.id} className="hover:bg-gray-50"><td className="p-4 font-mono font-bold text-blue-700">#{t.id.slice(0,8)}</td><td className="p-4"><p className="font-semibold">{t.passager || 'Non renseigné'}</p><p className="text-xs text-gray-500">{t.telephone || '—'}</p></td><td className="p-4 font-bold">{t.compagnie}</td><td className="p-4">{t.trajet || '—'}</td><td className="p-4"><p>{formatDateTime(t.date)}</p><p className="flex items-center gap-1 text-xs text-gray-500"><CalendarClock size={13}/>{t.heure || '—'}</p></td><td className="p-4">{t.siege || '—'}</td><td className="p-4"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{t.statut || '—'}</span></td><td className="p-4 font-black">{formatAmount(t.prix,' F')}</td><td className="p-4"><button onClick={() => setSelected(t)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Détails</button></td></tr>)}</tbody></table></div>
    {!data.loading && data.updatedAt && filtered.length===0 && <p className="p-10 text-center text-gray-500">Aucun billet pour ces filtres.</p>}
    {!data.updatedAt && <p className="p-6 text-center text-gray-500">{data.loading?'Chargement…':'Billets indisponibles.'}</p>}</section>
    <p className="text-xs text-gray-500">* Total indicatif du prix des billets payés/validés de cette liste, pas un chiffre d'affaires encaissé. Le serveur renvoie au maximum 100 billets créés depuis minuit UTC ; les départs peuvent être à une date ultérieure.</p>
    {selected && <div className="fixed inset-0 z-[90] flex justify-end bg-black/50" onClick={() => setSelected(null)}><aside role="dialog" aria-modal="true" aria-label="Détail du billet" onClick={e => e.stopPropagation()} className="h-full w-full max-w-md overflow-auto bg-white p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-black">Billet #{selected.id.slice(0,8)}</h2><button onClick={() => setSelected(null)} aria-label="Fermer"><X/></button></div><div className="mt-7 space-y-4">{[
      ['Compagnie',selected.compagnie],['Passager',selected.passager],['Téléphone',selected.telephone],['Trajet',selected.trajet],['Gare de départ',selected.gareDepart],['Gare d’arrivée',selected.gareArrivee],['Date de départ',formatDateTime(selected.date)],['Heure',selected.heure],['Siège',selected.siege],['Mode de paiement',selected.paiement],['Statut',selected.statut],['Tarif',formatAmount(selected.prix,' F')]
    ].map(([key,value])=><div key={key} className="border-b pb-3 text-sm"><p className="text-gray-500">{key}</p><p className="mt-1 font-semibold">{value||'Non renseigné'}</p></div>)}</div></aside></div>}
  </main>;
}
