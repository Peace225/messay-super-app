import { AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';

type FleetStateProps = {
  loading: boolean;
  connected: boolean;
  error: string | null;
  loadedAt: Date | null;
  refresh: () => void;
};

export function FleetHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">MESSAY / Transport tricycle</p>
      <h1 className="mt-1 text-2xl font-black text-gray-900 md:text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-gray-500">{subtitle}</p>
    </header>
  );
}

export function FleetConnection({ loading, connected, error, loadedAt, refresh }: FleetStateProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={`flex items-center gap-2 text-xs font-semibold ${connected ? 'text-emerald-700' : 'text-amber-700'}`}>
          {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
          {connected ? 'API ADMIN connectée' : loading && !error && !loadedAt ? 'Connexion à l’API ADMIN…' : error ? 'Erreur de connexion API ADMIN' : 'API ADMIN non connectée'}
          {loadedAt && <span className="ml-1 font-normal text-gray-500">· Données lues à {loadedAt.toLocaleTimeString('fr-FR')}</span>}
        </div>
        <button type="button" disabled={loading} onClick={refresh}
          className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-40">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertCircle className="shrink-0" size={17}/>{error}</div>}
      <p className="text-xs text-gray-500">Inventaire synchronisé avec PostgreSQL toutes les 30 secondes. Les positions sont les dernières enregistrées, et non un flux GPS continu.</p>
    </div>
  );
}

export function StatusTag({ status }: { status?: string | null }) {
  const value = status || 'INCONNU';
  const style = value === 'DISPONIBLE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : value === 'EN_COURSE' ? 'bg-orange-50 text-orange-700 border-orange-200'
      : value === 'MAINTENANCE' ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-gray-100 text-gray-600 border-gray-200';
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${style}`}>{value.replace(/_/g, ' ')}</span>;
}
