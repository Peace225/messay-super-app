import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { garesHierarchyApi, type GareTransaction } from '../../services/garesManagementApi';
import {
  Alert, Card, EmptyState, Field, StationScope, StatusTag,
  actionClass, inputClass, localDay, money, outlineClass, previousDay, toMessage,
  useChefStation,
} from './ChefShared';

export function useChefTransactions() {
  const station = useChefStation();
  const gareId = station.gare?.id ?? '';
  const [from, setFrom] = useState(previousDay(6));
  const [to, setTo] = useState(localDay());
  const [rows, setRows] = useState<GareTransaction[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);

  const load = useCallback(async (next: string | null = null) => {
    if (!gareId || from > to) {
      setRows([]); setCursor(null);
      if (gareId && from > to) setError('La date de début doit précéder la date de fin.');
      return;
    }
    const request = ++generation.current;
    setLoading(true); setError('');
    try {
      const result = await garesHierarchyApi.transactions(gareId, from, to, next);
      if (generation.current !== request) return;
      setRows(previous => next ? [
        ...previous,
        ...result.transactions.filter(item => !previous.some(p => p.id === item.id)),
      ] : result.transactions);
      setCursor(result.next_cursor);
    } catch (err) {
      if (generation.current === request) setError(toMessage(err));
    } finally {
      if (generation.current === request) setLoading(false);
    }
  }, [gareId, from, to]);

  useEffect(() => {
    setRows([]); setCursor(null);
    void load();
    return () => {generation.current++;};
  }, [load]);

  return { station, gareId, from, setFrom, to, setTo, rows, cursor, loading, error, load };
}

export function TransactionFilters({
  state,
}: { state: ReturnType<typeof useChefTransactions> }) {
  return <>
    <StationScope gares={state.station.gares} selectedId={state.station.selectedId} onSelect={state.station.setSelectedId} onReload={() => {void state.station.reload(); void state.load();}} loading={state.station.loading || state.loading}/>
    {state.station.error && <Alert>{state.station.error}</Alert>}
    {state.error && <Alert>{state.error}</Alert>}
    <Card className="flex flex-wrap items-end gap-3">
      <Field label="Du"><input className={inputClass} type="date" value={state.from} max={state.to} onChange={e=>state.setFrom(e.target.value)} /></Field>
      <Field label="Au"><input className={inputClass} type="date" value={state.to} min={state.from} onChange={e=>state.setTo(e.target.value)} /></Field>
      <button type="button" className={outlineClass} disabled={state.loading} onClick={()=>void state.load()}><RefreshCw size={17} className={state.loading ? 'animate-spin' : ''}/> Actualiser les opérations</button>
      <p className="w-full text-xs text-slate-400">Données issues des transactions enregistrées par le backend. Aucun montant fictif.</p>
    </Card>
  </>;
}

export function TransactionList({ rows, loading, emptyText = 'Aucune transaction pour la période sélectionnée.' }: {
  rows: GareTransaction[];
  loading?: boolean;
  emptyText?: string;
}) {
  const [query,setQuery] = useState('');
  const visible = rows.filter(r => `${r.reference_billet ?? ''} ${r.agent_nom ?? ''} ${r.canal} ${r.mode_paiement}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <Card>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-lg font-black text-slate-900">Historique des opérations</h3>
      <div className="relative w-full max-w-sm"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input className={`${inputClass} pl-9`} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher une référence, un agent…" aria-label="Rechercher les mouvements chargés"/></div>
    </div>
    {loading && rows.length===0 ? <p className="text-sm text-slate-500">Chargement des mouvements réels…</p> : visible.length===0 ? <EmptyState>{emptyText}</EmptyState> :
    <div className="overflow-x-auto">
      <table className="w-full min-w-[780px] border-collapse text-left text-sm">
        <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400"><th className="p-3">Date</th><th className="p-3">Référence</th><th className="p-3">Agent</th><th className="p-3">Canal</th><th className="p-3">Paiement</th><th className="p-3">Statut</th><th className="p-3 text-right">Montant</th></tr></thead>
        <tbody>{visible.map(tx=><tr key={tx.id} className="border-b border-slate-100 text-slate-700 last:border-0"><td className="whitespace-nowrap p-3">{new Date(tx.occurred_at).toLocaleString('fr-FR')}</td><td className="p-3 font-semibold">{tx.reference_billet || '—'}</td><td className="p-3">{tx.agent_nom || '—'}</td><td className="p-3">{tx.canal}</td><td className="p-3">{tx.mode_paiement}</td><td className="p-3"><StatusTag value={tx.statut}/></td><td className={`whitespace-nowrap p-3 text-right font-extrabold ${tx.montant_fcfa < 0 ? 'text-red-700' : 'text-slate-900'}`}>{money(tx.montant_fcfa)}</td></tr>)}</tbody>
      </table>
    </div>}
    <p className="mt-3 text-xs text-slate-500">Recherche limitée aux {rows.length} opérations déjà chargées. Utilisez le chargement suivant pour récupérer d’autres lignes.</p>
  </Card>;
}

export function LoadMore({ cursor, loading, onClick }: { cursor: string | null; loading: boolean; onClick: () => void }) {
  return cursor ? <div className="text-center"><button className={actionClass} type="button" disabled={loading} onClick={onClick}>{loading ? 'Chargement…' : 'Charger les 50 opérations suivantes'}</button></div> : null;
}
