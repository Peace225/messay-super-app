import { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, CheckCircle, ClipboardList, Loader2, RefreshCw, Wallet, XCircle } from 'lucide-react';
import { garesDirectionApi, garesHierarchyApi,
  type DirectionPendingReport, type DirectionTransaction } from '../services/garesManagementApi';

const dateLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const amount = (v: number) => Number.isFinite(v) ? `${v.toLocaleString('fr-FR')} FCFA` : '—';
const message = (e: unknown) => e instanceof Error ? e.message : 'Erreur inconnue';
export default function DirectionSupervision() {
  const [from, setFrom] = useState(() => dateLocal(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [to, setTo] = useState(() => dateLocal(new Date()));
  const [items, setItems] = useState<DirectionTransaction[]>([]);
  const [pending, setPending] = useState<DirectionPendingReport[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reportsError, setReportsError] = useState('');
  const seq = useRef(0);

  const load = useCallback(async (append = false, after: string | null = null) => {
    const current = ++seq.current;
    setBusy(true); setError('');
    try {
      const data = await garesDirectionApi.allTransactions(from, to, append ? after : null);
      if (!data || !Array.isArray(data.transactions)) throw new Error('Réponse globale des transactions invalide.');
      if (current !== seq.current) return;
      setItems(prev => append ? [...prev, ...data.transactions.filter(t => !prev.some(p => p.id === t.id))] : data.transactions);
      setCursor(data.next_cursor || null);
    } catch (e) { if (current === seq.current) setError(message(e)); }
    finally { if (current === seq.current) setBusy(false); }
  }, [from, to]);
  const loadPending = useCallback(async () => {
    setReportsError('');
    try {
      const data = await garesDirectionApi.pendingReports();
      if (!data || !Array.isArray(data.rapports)) throw new Error('Réponse des rapports à valider invalide.');
      setPending(data.rapports.filter(r => r.type === 'CHEF_GARE' && r.statut === 'SOUMIS_DIRECTION'));
    } catch (e) { setReportsError(message(e)); }
  }, []);

  useEffect(() => { setItems([]); setCursor(null); void load(); return () => { seq.current++; }; }, [load]);
  useEffect(() => { void loadPending(); }, [loadPending]);

  const review = async (report: DirectionPendingReport, decision: 'APPROUVER' | 'RETOURNER') => {
    if (busy) return;
    const motif = decision === 'RETOURNER' ? window.prompt('Motif du retour au chef de gare :') : null;
    if (decision === 'RETOURNER' && !motif?.trim()) return;
    if (decision === 'APPROUVER' && !window.confirm('Valider ce rapport ?')) return;
    setBusy(true); setReportsError('');
    try {
      await garesHierarchyApi.reviewReport(report.gare_id, report.id, decision, motif?.trim() || null);
      await loadPending();
    } catch (e) { setReportsError(message(e)); }
    finally { setBusy(false); }
  };

  return <div className="space-y-5">
    <section className="rounded-[24px] bg-slate-900 p-6 text-white">
      <Building2 size={25} className="text-orange-400"/>
      <h2 className="mt-3 text-xl font-black">Supervision générale de la compagnie</h2>
      <p className="mt-2 text-sm text-slate-300">Toutes les transactions de vos gares et les rapports des chefs en attente de validation. Les ventes sont consultables avant clôture.</p>
    </section>
    <section className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-bold text-slate-600">Du<input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 p-2"/></label>
        <label className="text-xs font-bold text-slate-600">Au<input type="date" value={to} min={from} max={dateLocal(new Date())} onChange={e => setTo(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 p-2"/></label>
        <button onClick={() => { void load(); void loadPending(); }} disabled={busy} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold disabled:opacity-50">{busy?<Loader2 size={15} className="animate-spin"/>:<RefreshCw size={15}/>} Actualiser</button>
      </div>
      <h3 className="mt-6 flex items-center gap-2 font-black"><Wallet size={18} className="text-orange-500"/> Transactions des gares</h3>
      <p className="mt-1 text-xs text-slate-500">Liste paginée des opérations réelles, y compris celles réalisées sur MESSAY Mobile et celles des agents en gare.</p>
      {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[820px] text-left text-xs">
        <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Date</th><th className="p-3">Gare</th><th className="p-3">Agent / Canal</th><th className="p-3">Billet</th><th className="p-3">Statut</th><th className="p-3 text-right">Montant</th></tr></thead>
        <tbody>{items.map(t => <tr key={t.id} className="border-b border-slate-100"><td className="p-3">{new Date(t.occurred_at).toLocaleString('fr-FR')}</td><td className="p-3 font-bold">{t.gare_nom}</td><td className="p-3">{t.agent_nom || t.canal}</td><td className="p-3">{t.reference_billet || '—'}</td><td className="p-3">{t.statut}</td><td className="p-3 text-right font-bold">{amount(t.montant_fcfa)}</td></tr>)}</tbody>
      </table></div>
      {!busy && !items.length && !error && <p className="py-5 text-sm text-slate-500">Aucune transaction retournée sur cette période.</p>}
      {cursor && <button disabled={busy} onClick={() => void load(true,cursor)} className="mt-3 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold disabled:opacity-50">Afficher la suite</button>}
    </section>
    <section className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="flex items-center gap-2 font-black"><ClipboardList size={18} className="text-orange-500"/> Rapports transmis par les chefs de gare</h3>
      {reportsError && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{reportsError}</p>}
      {!reportsError && !pending.length && <p className="py-5 text-sm text-slate-500">Aucun rapport actuellement en attente de validation.</p>}
      <div className="mt-3 space-y-3">{pending.map(r => <div key={r.id} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-100 p-4 md:flex-row md:items-center">
        <div><p className="font-bold text-slate-900">{r.gare_nom} — {r.auteur_nom}</p><p className="text-xs text-slate-500">Rapport du {r.date_rapport} · Espèces déclarées : {amount(r.especes_declarees_fcfa)}</p></div>
        <div className="flex gap-2"><button disabled={busy} onClick={() => void review(r,'RETOURNER')} className="flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 disabled:opacity-50"><XCircle size={14}/> Retourner</button><button disabled={busy} onClick={() => void review(r,'APPROUVER')} className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-50"><CheckCircle size={14}/> Valider</button></div>
      </div>)}</div>
    </section>
  </div>;
}
