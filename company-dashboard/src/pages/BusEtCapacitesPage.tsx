import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { BusFront, ClipboardList, RefreshCw, ShieldCheck } from 'lucide-react';
import { messayBusApi, type BusOverview } from '../services/messayBusApi';
import { garePlanningApi, type GarePlanningLigne } from '../services/garePlanningApi';

export default function BusEtCapacitesPage() {
  const [data, setData] = useState<BusOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [numero, setNumero] = useState('');
  const [plate, setPlate] = useState('');
  const [capacite, setCapacite] = useState('50');
  const [marque, setMarque] = useState('');
  const [modele, setModele] = useState('');
  const [gareId, setGareId] = useState('');
  const [lignes, setLignes] = useState<GarePlanningLigne[]>([]);
  const [ligneId, setLigneId] = useState('');
  const [horaireId, setHoraireId] = useState('');
  const [busId, setBusId] = useState('');
  const [dateDepart, setDateDepart] = useState(new Date().toISOString().slice(0, 10));

  const reload = useCallback(async () => {
    setError(''); setLoading(true);
    try {
      const result = await messayBusApi.lister();
      setData(result);
      setGareId(prev => prev || result.gares[0]?.id || '');
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur de lecture des bus.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (!gareId) { setLignes([]); return; }
    let current = true;
    garePlanningApi.gare(gareId).then(result => {
      if (!current) return;
      setLignes(result.lignes.filter(l => l.publie));
      setLigneId(''); setHoraireId('');
    }).catch(e => { if (current) { setLignes([]); setError(e instanceof Error ? e.message : 'Erreur lignes.'); } });
    return () => { current = false; };
  }, [gareId]);
  const currentLine = useMemo(() => lignes.find(l => l.id === ligneId), [lignes, ligneId]);
  const canRegister = data?.role === 'DIRECTION';
  const canAssign = canRegister || data?.role === 'CHEF_GARE';
  async function submitBus(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await messayBusApi.enregistrer({ numero_interne: numero, immatriculation: plate,
        capacite: Number(capacite), marque, modele });
      setNumero(''); setPlate(''); setMarque(''); setModele('');
      setNotice('Bus enregistré. Son numéro et son immatriculation sont tracés.');
      await reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'Échec enregistrement.'); }
    finally { setBusy(false); }
  }
  async function submitAssignment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (!gareId || !ligneId || !horaireId || !busId || !dateDepart) throw new Error('Complète tous les champs du départ.');
      await messayBusApi.affecter(gareId, {
        destination_id: ligneId, horaire_id: horaireId, bus_id: busId, date_depart: dateDepart,
      });
      setNotice('Bus affecté au départ. Immatriculation et numéro conservés dans le registre historique.');
      await reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'Échec affectation.'); }
    finally { setBusy(false); }
  }
  const inputStyle = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-orange-500';
  const labelStyle = 'block text-xs font-semibold text-slate-600 mb-1.5';
  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-orange-600"><BusFront size={22}/><span className="text-xs font-bold uppercase tracking-wider">MESSAY PRO · Transport interurbain</span></div>
            <h1 className="mt-2 text-2xl font-black text-slate-900">Bus, immatriculations et traçabilité</h1>
            <p className="mt-1 text-sm text-slate-500">Un bus identifié pour chaque départ daté. Aucune place n’est déclarée disponible sans inventaire de réservation.</p>
          </div>
          <button type="button" onClick={() => void reload()} disabled={loading || busy}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">
            <RefreshCw size={16}/> Actualiser
          </button>
        </div>
      </header>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
      {loading && <p className="text-sm text-slate-500">Chargement des véhicules autorisés…</p>}
      {canRegister && (
        <form onSubmit={submitBus} className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-bold">Enregistrer un bus — Direction</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <label><span className={labelStyle}>N° interne du bus *</span><input className={inputStyle} required maxLength={40} placeholder="Ex. BUS-015" value={numero} onChange={e => setNumero(e.target.value)}/></label>
            <label><span className={labelStyle}>Immatriculation *</span><input className={inputStyle} required minLength={3} maxLength={32} placeholder="Immatriculation réelle" value={plate} onChange={e => setPlate(e.target.value)}/></label>
            <label><span className={labelStyle}>Nombre de sièges *</span><input className={inputStyle} required type="number" min="1" max="120" value={capacite} onChange={e => setCapacite(e.target.value)}/></label>
            <label><span className={labelStyle}>Marque</span><input className={inputStyle} maxLength={80} value={marque} onChange={e => setMarque(e.target.value)}/></label>
            <label><span className={labelStyle}>Modèle</span><input className={inputStyle} maxLength={80} value={modele} onChange={e => setModele(e.target.value)}/></label>
          </div>
          <button disabled={busy} className="mt-4 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">Enregistrer le bus</button>
        </form>
      )}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-bold">Registre des bus de la compagnie</h2>
        {!data?.vehicules.length && !loading && <p className="text-sm text-slate-500">Aucun bus enregistré pour cette compagnie.</p>}
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">N° bus</th><th className="p-3">Immatriculation</th><th className="p-3">Modèle</th><th className="p-3">Capacité</th><th className="p-3">État</th></tr></thead>
          <tbody>{data?.vehicules.map(v => <tr key={v.id} className="border-t border-slate-100">
            <td className="p-3 font-bold">{v.numero_interne}</td><td className="p-3 font-mono">{v.immatriculation}</td>
            <td className="p-3">{[v.marque,v.modele].filter(Boolean).join(' ') || '—'}</td><td className="p-3">{v.capacite} sièges</td><td className="p-3">{v.statut}</td>
          </tr>)}</tbody>
        </table></div>
      </section>
      {canAssign && (
        <form onSubmit={submitAssignment} className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-lg font-bold">Affecter un bus à un départ</h2>
          <p className="mb-4 text-sm text-slate-500">Chef de gare ou Direction · Choisir une ligne publiée, son horaire et une date.</p>
          <div className="grid gap-4 md:grid-cols-3">
            <label><span className={labelStyle}>Gare de départ</span><select className={inputStyle} value={gareId} onChange={e => setGareId(e.target.value)} required><option value="">Sélectionner</option>{data?.gares.map(g => <option key={g.id} value={g.id}>{g.nom} ({g.ville})</option>)}</select></label>
            <label><span className={labelStyle}>Destination</span><select className={inputStyle} value={ligneId} required onChange={e => {setLigneId(e.target.value);setHoraireId('');}}><option value="">Choisir une ligne publiée</option>{lignes.map(l => <option key={l.id} value={l.id}>{l.ville}</option>)}</select></label>
            <label><span className={labelStyle}>Horaire</span><select className={inputStyle} value={horaireId} onChange={e => setHoraireId(e.target.value)} required><option value="">Choisir un horaire</option>{currentLine?.horaires.map(h => <option key={h.id} value={h.id}>{h.heure_depart}</option>)}</select></label>
            <label><span className={labelStyle}>Date du départ</span><input className={inputStyle} type="date" min={new Date().toISOString().slice(0,10)} value={dateDepart} onChange={e => setDateDepart(e.target.value)} required/></label>
            <label><span className={labelStyle}>Bus disponible</span><select className={inputStyle} value={busId} onChange={e => setBusId(e.target.value)} required><option value="">Choisir le bus</option>{data?.vehicules.filter(v => v.statut === 'DISPONIBLE').map(v => <option key={v.id} value={v.id}>{v.numero_interne} · {v.immatriculation} · {v.capacite} sièges</option>)}</select></label>
          </div>
          <button disabled={busy} className="mt-4 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">Affecter au départ</button>
        </form>
      )}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2"><ClipboardList size={19} className="text-orange-600"/><h2 className="text-lg font-bold">Historique des affectations</h2></div>
        {!data?.affectations.length && <p className="text-sm text-slate-500">Aucune affectation enregistrée.</p>}
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">Date</th><th className="p-3">N° bus</th><th className="p-3">Immatriculation au départ</th><th className="p-3">Capacité</th><th className="p-3">État</th></tr></thead><tbody>{data?.affectations.map(a => <tr className="border-t border-slate-100" key={a.id}><td className="p-3">{a.date_depart}</td><td className="p-3 font-bold">{a.numero_bus_snapshot}</td><td className="p-3 font-mono">{a.immatriculation_snapshot}</td><td className="p-3">{a.capacite_snapshot}</td><td className="p-3">{a.statut}</td></tr>)}</tbody></table></div>
        <p className="mt-4 flex items-start gap-2 text-xs text-slate-500"><ShieldCheck size={16} className="shrink-0"/>Chaque affectation conserve une copie du numéro et de l’immatriculation. L'historique ne valide pas encore la disponibilité des places ni l'embarquement.</p>
      </section>
    </div>
  );
}
