import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertCircle, Building2, ChevronDown, RefreshCw } from 'lucide-react';
import { garesManagementApi, type Gare, type GareAccessContext } from '../../services/garesManagementApi';

export function localDay(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function previousDay(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localDay(date);
}

export function money(amount: number | null | undefined): string {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  return `${new Intl.NumberFormat('fr-FR').format(value)} F CFA`;
}

export function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Une erreur inattendue est survenue.';
}

export function useChefStation() {
  const access = useOutletContext<GareAccessContext>();
  const [gares, setGares] = useState<Gare[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const scopeKey = access.gare_ids.join('|');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await garesManagementApi.list();
      // Le backend renvoie déjà le périmètre autorisé ; ce filtre reste défensif.
      const valid = response.filter(g =>
        access.gare_ids.includes(g.id) && g.company_id === access.company_id
      );
      setGares(valid);
      setSelectedId(prev => valid.some(g => g.id === prev) ? prev : (valid[0]?.id ?? ''));
    } catch (err) {
      setError(toMessage(err));
      setGares([]);
      setSelectedId('');
    } finally {
      setLoading(false);
    }
  }, [access.company_id, scopeKey]);

  useEffect(() => { void reload(); }, [reload]);
  const gare = useMemo(() => gares.find(g => g.id === selectedId) ?? null, [gares, selectedId]);
  return { access, gares, gare, selectedId, setSelectedId, loading, error, reload };
}

export function ChefPage({
  title, description, children,
}: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-orange-600">MESSAY PRO · CHEF DE GARE</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
      </header>
      {children}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}>{children}</section>;
}

export function Alert({ children, variant = 'error' }: { children: ReactNode; variant?: 'error'|'success'|'info' }) {
  const colors = variant === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' :
    variant === 'info' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-red-200 bg-red-50 text-red-700';
  return <div role={variant === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${colors}`}>
    <AlertCircle size={17} className="mt-0.5 shrink-0" /> <span>{children}</span>
  </div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm font-semibold text-slate-700"><span className="mb-2 block">{label}</span>{children}</label>;
}

export const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:opacity-60';
export const actionClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50';
export const outlineClass = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

export function StationScope({
  gares, selectedId, onSelect, onReload, loading,
}: { gares: Gare[]; selectedId: string; onSelect: (value: string) => void; onReload: () => void; loading?: boolean }) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="rounded-xl bg-orange-50 p-3 text-orange-600"><Building2 size={20}/></span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Périmètre autorisé</p>
          {gares.length <= 1 ? (
            <p className="font-extrabold text-slate-900">{gares[0]?.nom ?? 'Aucune gare'} · {gares[0]?.ville ?? ''}</p>
          ) : (
            <div className="relative mt-1">
              <select className={`${inputClass} min-w-48 appearance-none pr-9`} value={selectedId} onChange={e => onSelect(e.target.value)}>
                {gares.map(g => <option key={g.id} value={g.id}>{g.nom} · {g.ville}</option>)}
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-slate-400"/>
            </div>
          )}
        </div>
      </div>
      <button type="button" className={outlineClass} disabled={loading} onClick={onReload}><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/> Actualiser</button>
    </Card>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">{children}</div>;
}

export function StatusTag({ value }: { value: string }) {
  const good = ['acceptee', 'VALIDE_CHEF', 'VALIDE_DIRECTION', 'PAYE'].includes(value);
  const bad = ['expiree', 'revoquee', 'RETOURNE_AGENT', 'RETOURNE_CHEF', 'REMBOURSE'].includes(value);
  const classes = good ? 'bg-emerald-50 text-emerald-700' : bad ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800';
  return <span className={`inline-flex max-w-full rounded-full px-2.5 py-1 text-xs font-bold ${classes}`}>{value.replaceAll('_', ' ')}</span>;
}
