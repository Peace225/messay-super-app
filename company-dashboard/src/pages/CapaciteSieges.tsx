import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Armchair, CalendarDays, BusFront, CircleAlert, RefreshCcw, TicketCheck, Clock3 } from 'lucide-react';
import { companyDashboardApi, type DepartureOccupancy, type SeatStatus } from '../lib/companyDashboardApi';
import { getMessayBusAffectations, getBilletsAttribution, attribuerSiegeCompagnie, type MessayBusAffectation, type DepartBilletsAttribution } from '../services/messayBusSiegesClient';

const isoToday = () => {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
};
const statusStyles: Record<SeatStatus, string> = {
  available: 'border-green-200 bg-green-50 text-green-700',
  held: 'border-amber-200 bg-amber-50 text-amber-700',
  sold: 'border-orange-300 bg-orange-500 text-white',
  blocked: 'border-slate-300 bg-slate-300 text-slate-700',
};
const StatusPill = ({ label, count, icon }: { label: string; count: number; icon?: ReactNode }) =>
  <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{icon}{label} : {count}</span>;

function DepartureCard({ departure }: { departure: DepartureOccupancy }) {
  const [expanded, setExpanded] = useState(false);
  const capacity = Math.max(0, departure.capacity);
  const sold = Math.max(0, departure.sold);
  const held = Math.max(0, departure.held);
  const blocked = Math.max(0, departure.blocked);
  const available = Math.max(0, capacity - sold - held - blocked);
  const occupancy = capacity ? Math.min(100, Math.round((sold / capacity) * 100)) : 0;
  const invalid = sold + held + blocked > capacity || departure.seats.length > capacity || departure.seats.some(s => s.number < 1 || s.number > capacity);
  const when = new Date(departure.departure_at);
  return <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-extrabold uppercase tracking-wider text-orange-600">Départ programmé</p>
        <h3 className="mt-1 text-lg font-black text-slate-900">{departure.from_station} → {departure.to_station}</h3>
        <div className="mt-2 space-y-1 text-sm text-slate-500"><p><CalendarDays size={15} className="mr-2 inline"/>{Number.isNaN(when.getTime()) ? 'Date à confirmer' : when.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          <p><BusFront size={15} className="mr-2 inline"/>Bus {departure.vehicle_registration} {departure.driver_name ? `· ${departure.driver_name}` : ''}</p></div>
      </div>
      <div className="rounded-2xl bg-orange-50 px-4 py-3 text-center"><p className="text-2xl font-black text-orange-600">{sold}/{capacity}</p><p className="text-xs font-semibold text-orange-800">Sièges vendus</p></div>
    </div>
    <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${occupancy}%` }} /></div>
    <div className="mt-4 flex flex-wrap gap-2">
      <StatusPill label="Vendus" count={sold} icon={<TicketCheck size={13}/>}/>
      <StatusPill label="En attente" count={held} icon={<Clock3 size={13}/>}/>
      <StatusPill label="Solde théorique" count={available} />
      <StatusPill label="Bloqués" count={blocked} />
    </div>
    {invalid && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">Incohérence : le total des sièges dépasse la capacité du bus. Vérifier le backend avant toute vente.</p>}
    <button type="button" onClick={() => setExpanded(value => !value)} className="mt-5 rounded-xl border border-orange-200 px-4 py-2 text-sm font-bold text-orange-700 hover:bg-orange-50" aria-expanded={expanded}>
      {expanded ? 'Masquer les sièges' : 'Voir les sièges numérotés'}
    </button>
    {expanded && <div className="mt-5 space-y-3">
      <p className="text-xs text-slate-500">État renvoyé par le backend. Une place « en attente » ne devient « vendue » qu'après paiement confirmé.</p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
        {departure.seats.length > 0 ? departure.seats.slice().sort((a,b)=>a.number-b.number).map(seat =>
          <div key={seat.number} title={`Siège ${seat.number} · ${seat.status}`} className={`flex h-10 items-center justify-center rounded-xl border text-xs font-black ${statusStyles[seat.status] ?? statusStyles.blocked}`}>
            <Armchair size={14} className="mr-1"/>{seat.number}
          </div>
        ) : <p className="col-span-full rounded-xl bg-slate-50 p-4 text-xs text-slate-600">Plan de sièges indisponible pour ce départ. Ne pas générer de faux sièges vendus.</p>}
      </div>
    </div>}
  </article>;
}



/** Sièges physiques après paiement : totalement indépendants du registre de holds. */
export function AttributionCompagnie() {
  const [departs, setDeparts] = useState<MessayBusAffectation[]>([]);
  const [selected, setSelected] = useState('');
  const [liste, setListe] = useState<DepartBilletsAttribution | null>(null);
  const [choix, setChoix] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const selectionRef = useRef('');
  const loadSeq = useRef(0);

  useEffect(() => {
    let active = true;
    getMessayBusAffectations().then(result => {
      if (active) setDeparts(result.affectations);
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Départs indisponibles'); });
    return () => { active = false; };
  }, []);

  const loadTickets = async (id: string) => {
    const seq = ++loadSeq.current;
    setLoading(true); setError(null); setInfo(null); setListe(null);
    try {
      const next = await getBilletsAttribution(id);
      if (seq === loadSeq.current && selectionRef.current === id) setListe(next);
    } catch (e) {
      if (seq === loadSeq.current && selectionRef.current === id) {
        setError(e instanceof Error ? e.message : 'Attribution non disponible');
      }
    } finally {
      if (seq === loadSeq.current && selectionRef.current === id) setLoading(false);
    }
  };

  const send = async (ticketId: string) => {
    if (!liste || !selected || !liste.attribution_autorisee || pendingId) return;
    const departId = selected;
    const seq = loadSeq.current;
    const siege = Number(choix[ticketId]);
    if (!Number.isInteger(siege) || siege < 1 || siege > liste.capacite) {
      setError(`Numéro de siège attendu entre 1 et ${liste.capacite}.`); return;
    }
    if (liste.billets.some(b => b.billet_id !== ticketId && b.siege_numero === siege)) {
      setError('Ce siège apparaît déjà attribué. Rechargez les billets.'); return;
    }
    setError(null); setInfo(null); setPendingId(ticketId);
    try {
      const reply = await attribuerSiegeCompagnie(departId, ticketId, siege);
      if (seq !== loadSeq.current || selectionRef.current !== departId) return;
      setInfo(reply.resultat === 'DEJA_ATTRIBUE' ? 'Siège déjà attribué.' : 'Siège attribué avec succès.');
      const fresh = await getBilletsAttribution(departId);
      if (seq === loadSeq.current && selectionRef.current === departId) setListe(fresh);
    } catch (e) {
      if (seq === loadSeq.current && selectionRef.current === departId) {
        setError(`${e instanceof Error ? e.message : 'Attribution refusée'}. Rechargez la liste avant de réessayer.`);
      }
    } finally { setPendingId(null); }
  };

  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <h3 className="text-lg font-black text-slate-900">Attribution des sièges après paiement</h3>
    <p className="mt-2 text-sm text-slate-500">Seuls les billets confirmés sont proposés. Les places techniques du registre V1 ne déterminent pas les sièges passagers. Attribution disponible après rapprochement des billets historiques.</p>
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <label className="flex-1 text-xs font-bold text-slate-700">Départ concerné
        <select aria-label="Choisir un départ pour l'attribution" className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2 text-sm"
          value={selected} onChange={e => { loadSeq.current += 1; selectionRef.current = e.target.value; setSelected(e.target.value); setListe(null); setChoix({}); setError(null); setInfo(null); setLoading(false); }}>
          <option value="">Choisir un départ</option>
          {departs.map(d => <option key={d.id} value={d.id}>{d.date_depart} · Bus {d.numero_bus_snapshot || d.immatriculation_snapshot || d.id.slice(0,8)}</option>)}
        </select>
      </label>
      <button type="button" disabled={!selected || loading || !!pendingId}
        className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        onClick={() => void loadTickets(selected)}>{loading ? 'Chargement…' : 'Afficher les billets confirmés'}</button>
    </div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {info && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">{info}</p>}
    {liste && <div className="mt-5 space-y-3">
      {!liste.historique_rapproche && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{liste.avertissement || 'Attribution bloquée : rapprochement historique requis.'}</p>}
      {liste.billets.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucun nouveau billet payé et émis pour ce départ.</p> : liste.billets.map(b =>
        <div key={b.billet_id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3">
          <div><p className="text-sm font-bold text-slate-900">{b.passager_nom}</p><p className="text-xs text-slate-500">Billet {b.billet_id.slice(0,8)} · {b.prix_xof.toLocaleString('fr-FR')} FCFA</p></div>
          {b.siege_numero !== null ? <span className="rounded-lg bg-green-50 px-3 py-2 text-sm font-bold text-green-700">Siège n° {b.siege_numero}</span> :
            <div className="flex items-center gap-2"><label className="text-xs text-slate-600">Numéro
              <input type="number" min={1} max={liste.capacite} step={1} placeholder="N°" aria-label={`Siège pour ${b.passager_nom}`}
                value={choix[b.billet_id] || ''} onChange={e => setChoix(old => ({ ...old, [b.billet_id]: e.target.value }))}
                className="ml-2 w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" disabled={!liste.attribution_autorisee || !!pendingId} />
            </label><button type="button" disabled={!liste.attribution_autorisee || !!pendingId}
              onClick={() => void send(b.billet_id)} className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
              {pendingId === b.billet_id ? 'Traitement…' : 'Attribuer'}
            </button></div>}
        </div>)}
    </div>}
  </section>;
}

export default function CapaciteSieges() {
  const [from, setFrom] = useState(isoToday);
  const [to, setTo] = useState(isoToday);
  const [departures, setDepartures] = useState<DepartureOccupancy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true); setError(null);
    try { const result = await companyDashboardApi.getOccupancy(from, to); setDepartures(result.departures); }
    catch(e) { setDepartures([]); setError(e instanceof Error ? e.message : 'Chargement impossible'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const total = useMemo(() => departures.reduce((sum,d) => ({
    capacity: sum.capacity + Math.max(d.capacity,0), sold: sum.sold + Math.max(d.sold,0),
    held: sum.held + Math.max(d.held,0), blocked: sum.blocked + Math.max(d.blocked,0),
  }), {capacity:0,sold:0,held:0,blocked:0}), [departures]);
  return <div className="mx-auto max-w-6xl space-y-5">
    <div><p className="text-xs font-extrabold uppercase tracking-wider text-orange-600">Exploitation des bus</p>
      <h2 className="mt-1 text-2xl font-black text-slate-900">Sièges et occupation</h2>
      <p className="mt-2 text-sm text-slate-500">Les sièges achetés sont comptés par départ, date et bus. Les réservations non payées sont distinguées des ventes confirmées.</p></div>
    <form onSubmit={event => {event.preventDefault(); void load();}} className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <label className="text-xs font-bold text-slate-700">Du <input type="date" value={from} onChange={e=>setFrom(e.target.value)} max={to} className="mt-1 block rounded-xl border border-slate-300 px-3 py-2 text-sm" required /></label>
      <label className="text-xs font-bold text-slate-700">Au <input type="date" value={to} onChange={e=>setTo(e.target.value)} min={from} className="mt-1 block rounded-xl border border-slate-300 px-3 py-2 text-sm" required /></label>
      <button type="submit" disabled={loading || from > to} className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><RefreshCcw size={16}/>{loading ? 'Chargement…' : 'Afficher'}</button>
    </form>
    {error && <div role="alert" className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><CircleAlert size={18}/><div><strong>Informations indisponibles.</strong> {error}<p className="mt-2 text-xs">La page ne crée pas de chiffres fictifs. Le backend doit exposer les départs et les billets réellement confirmés.</p></div></div>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[['Sièges totaux',total.capacity], ['Sièges vendus',total.sold], ['En attente',total.held], ['Solde théorique (non certifié)',Math.max(0,total.capacity-total.sold-total.held-total.blocked)]].map(([label,value])=><div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-900">{value}</p></div>)}
    </div>
    {departures.length === 0 && !loading && !error && <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Aucun départ enregistré sur cette période.</div>}
    {departures.map(departure=><DepartureCard key={departure.id} departure={departure}/>)}
    <AttributionCompagnie />
  </div>;
}
