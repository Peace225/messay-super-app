import { useMemo, useState } from 'react';
import { Bike, Download, RefreshCw, Search, ShieldAlert, Wrench, X } from 'lucide-react';
import { FleetConnection, FleetHeading, StatusTag } from '../../components/flotte/FlotteUI';
import { useFleetAdmin, validCoordinates, type FleetVehicle } from '../../hooks/useFleetAdmin';
import { exportCsv, formatAmount, formatDateTime } from '../../utils/fleetFormat';
import { adminTransportService, getTransportError } from '../../services/adminTransportService';

const changeable = ['DISPONIBLE', 'MAINTENANCE', 'HORS_LIGNE'] as const;
type ChangeableStatus = typeof changeable[number];

export default function FlotteTricyclesPage() {
  const fleet = useFleetAdmin();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('TOUS');
  const [selected, setSelected] = useState<FleetVehicle | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const statuses = useMemo(() => ['TOUS', ...new Set(fleet.vehicles.map(v=>v.status).filter(Boolean))], [fleet.vehicles]);
  const filtered = useMemo(() => fleet.vehicles.filter(v => {
    const text = [v.immatriculation, v.modele, v.chauffeur, v.chauffeurTel].join(' ').toLowerCase();
    return (status === 'TOUS' || v.status === status) && text.includes(search.trim().toLowerCase());
  }), [fleet.vehicles, search, status]);

  async function changeStatus(vehicle: FleetVehicle, next: ChangeableStatus) {
    if (vehicle.status === next) return;
    if (!window.confirm(`Passer le tricycle ${vehicle.immatriculation} en statut ${next} ?`)) return;
    setEditingId(vehicle.id);
    setActionError(null);
    try {
      await adminTransportService.changeVehicleStatus(vehicle.id, next);
      await fleet.refresh();
      setSelected(prev => prev?.id === vehicle.id ? { ...prev, status: next } : prev);
    } catch (err) { setActionError(getTransportError(err)); }
    finally { setEditingId(null); }
  }

  return <main className="space-y-6 p-4 md:p-6">
    <FleetHeading title="Flotte des tricycles" subtitle="Véhicules réellement enregistrés dans PostgreSQL, affectations et états opérationnels." />
    <FleetConnection {...fleet} />
    {actionError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{actionError}</p>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
      ['Tricycles', fleet.vehicles.length, 'text-gray-900'],
      ['Disponibles', fleet.vehicles.filter(v=>v.status==='DISPONIBLE').length, 'text-green-700'],
      ['En course', fleet.vehicles.filter(v=>v.status==='EN_COURSE').length, 'text-orange-700'],
      ['Maintenance', fleet.vehicles.filter(v=>v.status==='MAINTENANCE').length, 'text-amber-700'],
    ].map(([label,value,color]) => <article key={label} className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold text-gray-500">{label}</p><p className={`mt-2 text-3xl font-black ${color}`}>{fleet.loadedAt ? value : '—'}</p></article>)}</div>
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-4"><label className="relative flex min-w-[200px] flex-1 items-center"><Search size={18} className="absolute left-3 text-gray-400"/><input aria-label="Chercher un tricycle" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Plaque, chauffeur, modèle" className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm"/></label><select aria-label="Filtrer par statut" className="rounded-xl border p-2.5 text-sm" value={status} onChange={e=>setStatus(e.target.value)}>{statuses.map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}</select><button onClick={()=>void fleet.refresh()} disabled={fleet.loading} className="rounded-xl border px-3 py-2.5 text-sm"><RefreshCw className="inline" size={16}/> Actualiser</button><button type="button" onClick={()=>exportCsv('messay-flotte',['ID','Immatriculation','Modèle','Conducteur','Téléphone','Statut','Batterie'],filtered.map(v=>[v.id,v.immatriculation,v.modele,v.chauffeur,v.chauffeurTel,v.status,v.batterie]))} className="rounded-xl bg-gray-900 px-3 py-2.5 text-sm font-bold text-white"><Download size={16} className="mr-1 inline"/>CSV</button></div>
    <section className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-gray-50 text-xs font-bold uppercase text-gray-500"><tr>{['Véhicule','Conducteur','État','Batterie','Dernier GPS','Actions'].map(label=><th key={label} className="p-4">{label}</th>)}</tr></thead><tbody className="divide-y">{filtered.map(v=><tr key={v.id} className="hover:bg-orange-50/30"><td className="p-4"><p className="flex items-center gap-2 font-bold"><Bike size={17} className="text-orange-500"/>{v.immatriculation}</p><p className="text-xs text-gray-500">{v.modele || 'Modèle non renseigné'}</p></td><td className="p-4">{v.chauffeur || 'Non affecté'}<p className="text-xs text-gray-500">{v.chauffeurTel || '—'}</p></td><td className="p-4"><StatusTag status={v.status}/></td><td className="p-4">{formatAmount(v.batterie,' %')}</td><td className="p-4 text-xs">{formatDateTime(v.derniereActivite)}</td><td className="p-4"><button onClick={()=>setSelected(v)} className="rounded-xl border px-3 py-2 text-xs font-bold">Détails / Statut</button></td></tr>)}</tbody></table>{!fleet.loading && !filtered.length && <p className="p-8 text-center text-gray-500">Aucun tricycle correspondant.</p>}</section>
    <p className="flex items-center gap-2 text-xs text-gray-500"><ShieldAlert size={15}/>Le changement d'état est refusé côté serveur durant une course active. Pour ajouter un tricycle, crée d'abord le compte conducteur dans « Conducteurs ».</p>
    {selected && <div className="fixed inset-0 z-[90] flex justify-end bg-black/50" onClick={()=>setSelected(null)}><aside role="dialog" aria-modal="true" aria-label="Tricycle" className="h-full w-full max-w-md overflow-auto bg-white p-6 shadow-2xl" onClick={e=>e.stopPropagation()}><div className="flex justify-between"><h2 className="text-xl font-black">{selected.immatriculation}</h2><button aria-label="Fermer" onClick={()=>setSelected(null)}><X/></button></div><p className="mt-1 text-sm text-gray-500">{selected.modele} · {selected.annee || 'Année inconnue'}</p><div className="mt-5"><StatusTag status={selected.status}/></div><div className="mt-6 space-y-3 text-sm"><p>Conducteur : <strong>{selected.chauffeur || 'Non affecté'}</strong></p><p>Coordonnées : {validCoordinates(selected)?.join(', ') || 'Non renseignées'}</p><p>Batterie : {formatAmount(selected.batterie,' %')}</p><p>Distance : {formatAmount(selected.distanceParcourue,' km',1)}</p><p>Dernière activité : {formatDateTime(selected.derniereActivite)}</p></div><h3 className="mt-8 flex items-center gap-2 font-bold"><Wrench size={17}/>Modifier l'état</h3><div className="mt-3 grid grid-cols-1 gap-2">{changeable.map(s=><button key={s} onClick={()=>void changeStatus(selected,s)} disabled={editingId===selected.id || selected.status==='EN_COURSE'} className={`rounded-xl border p-3 text-left text-sm font-bold disabled:opacity-40 ${selected.status===s ? 'border-orange-400 bg-orange-50' : 'hover:bg-gray-50'}`}>{s.replace(/_/g,' ')}</button>)}</div></aside></div>}
  </main>;
}
