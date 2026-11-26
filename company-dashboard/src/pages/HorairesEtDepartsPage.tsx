/** MESSAY PRO — supervision des horaires publiés et des départs datés. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, BusFront, Route, RefreshCw, AlertCircle, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { garePlanningApi, type GarePlanningLigne, type GarePlanningGare } from '../services/garePlanningApi';
import { messayBusApi, type BusAffectation } from '../services/messayBusApi';

const formatPrix = (value: number) => `${Number(value).toLocaleString('fr-FR')} FCFA`;
const ecran = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const champ = 'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-orange-500 focus:outline-none';

export default function HorairesEtDepartsPage() {
  const [gares, setGares] = useState<GarePlanningGare[]>([]);
  const [lignes, setLignes] = useState<GarePlanningLigne[]>([]);
  const [departs, setDeparts] = useState<BusAffectation[]>([]);
  const [filtreGare, setFiltreGare] = useState('');
  const [filtreVille, setFiltreVille] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const charger = useCallback(async () => {
    setLoading(true); setError(''); setWarning('');
    const [reseau, bus] = await Promise.allSettled([garePlanningApi.reseauDirection(), messayBusApi.lister()]);
    if (reseau.status === 'fulfilled') {
      setGares(reseau.value.gares); setLignes(reseau.value.lignes.filter(l => l.publie));
    } else {
      setGares([]); setLignes([]);
      setError(reseau.reason instanceof Error ? reseau.reason.message : 'Impossible de récupérer les horaires.');
    }
    if (bus.status === 'fulfilled') setDeparts(bus.value.affectations);
    else {
      setDeparts([]);
      setWarning('Le registre des bus et des départs n’est pas encore disponible. Les horaires seuls restent consultables.');
    }
    setLoading(false);
  }, []);
  useEffect(() => { void charger(); }, [charger]);
  const visibles = useMemo(() => lignes.filter(l =>
    (!filtreGare || l.gare_depart_id === filtreGare) &&
    (!filtreVille || l.ville.toLowerCase().includes(filtreVille.toLowerCase())),
  ), [lignes, filtreGare, filtreVille]);
  const departsNonRelies = date
    ? departs.filter(d => d.date_depart === date && d.statut === 'PROGRAMME' && (!filtreGare || d.gare_id === filtreGare))
    : [];
  return <div className="space-y-6">
    <header className={ecran}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-orange-600"><CalendarClock size={18}/> Direction · Exploitation</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">Horaires et départs</h1>
          <p className="mt-1 text-sm text-slate-500">Horaires publiés par gare, bus affectés et départs datés — données réelles.</p>
        </div>
        <button type="button" onClick={() => void charger()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-60"><RefreshCw size={16}/> Actualiser</button>
      </div>
    </header>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className={ecran}><p className="text-xs text-slate-500">Lignes publiées</p><strong className="mt-1 block text-3xl text-slate-900">{lignes.length}</strong></div>
      <div className={ecran}><p className="text-xs text-slate-500">Créneaux horaires</p><strong className="mt-1 block text-3xl text-slate-900">{lignes.reduce((n, l) => n + l.horaires.length, 0)}</strong></div>
      <div className={ecran}><p className="text-xs text-slate-500">Affectations bus {date ? 'pour la date' : 'dans le registre'}</p><strong className="mt-1 block text-3xl text-slate-900">{date ? departsNonRelies.length : departs.length}</strong></div>
    </div>
    {error && <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={16}/>{error}</p>}
    {warning && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{warning}</p>}
    <section className={ecran}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="text-lg font-bold text-slate-900">Programme des lignes</h2><p className="text-sm text-slate-500">La Direction supervise ; les Chefs de gare ajustent les nouveaux horaires dans leur espace.</p></div>
        <Link to="/lignes" className="text-sm font-bold text-orange-600 hover:underline">Demandes de lignes et tarifs</Link>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">Gare de départ
          <select className={champ} value={filtreGare} onChange={e => setFiltreGare(e.target.value)}><option value="">Toutes les gares</option>{gares.map(g => <option key={g.id} value={g.id}>{g.nom} — {g.ville}</option>)}</select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">Destination
          <input className={champ} value={filtreVille} onChange={e => setFiltreVille(e.target.value)} placeholder="Filtrer par ville"/>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">Date (pour les affectations)
          <input className={champ} type="date" value={date} onChange={e => setDate(e.target.value)}/>
        </label>
      </div>
      {loading && <p role="status" className="mt-5 text-sm text-slate-500">Chargement du programme…</p>}
      {!loading && !visibles.length && <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Aucune ligne publiée ne correspond aux filtres.</p>}
      <div className="mt-5 space-y-4">
        {visibles.map(l => <article key={l.id} className="overflow-hidden rounded-xl border border-slate-200">
          <div className="flex flex-wrap justify-between gap-3 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2"><Route size={17} className="text-orange-600"/><strong className="text-sm text-slate-900">{l.depart_nom || 'Gare'} → {l.arrivee_nom || l.ville}</strong></div>
            <span className="text-sm font-black text-orange-700">{formatPrix(l.prix)}</span>
          </div>
          {l.horaires.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="p-3">Horaire</th><th className="p-3">Affectation bus</th><th className="p-3">Immatriculation</th><th className="p-3">Date affectée</th></tr></thead><tbody>
            {l.horaires.map(h => {
              const matching = departs.filter(d => d.destination_id === l.id && d.horaire_id === h.id && d.statut === 'PROGRAMME' && (!date || d.date_depart === date));
              return <tr key={h.id} className="border-t border-slate-100"><td className="p-3 font-bold">{h.heure_depart}</td><td className="p-3">{matching.length ? matching.map(d => d.numero_bus_snapshot).join(', ') : 'Aucun bus confirmé'}</td><td className="p-3 font-mono text-xs">{matching.map(d => d.immatriculation_snapshot).join(', ') || '—'}</td><td className="p-3">{matching.map(d => d.date_depart).join(', ') || '—'}</td></tr>;
            })}
          </tbody></table></div> : <p className="p-4 text-sm text-slate-500">Aucun horaire publié.</p>}
        </article>)}
      </div>
    </section>
    <div className="flex items-start gap-3 rounded-xl border border-orange-100 bg-orange-50 p-4 text-sm text-orange-900"><ShieldCheck size={20} className="shrink-0"/><div><strong>Règle de traçabilité :</strong> un horaire récurrent n’est pas un billet. Seul un départ daté avec véhicule enregistré peut être affecté ; aucune disponibilité de siège n’est déduite de la capacité du bus. <Link to="/vehicules" className="font-bold underline"><BusFront size={14} className="inline"/> Voir les bus</Link>.</div></div>
  </div>;
}
