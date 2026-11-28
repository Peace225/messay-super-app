/// <reference types="vite/client" />
/**
 * MESSAY — Logistique (dashboard ADMIN)
 *
 * Contrat réellement présent dans backend/src/server.ts :
 *   Socket.IO auth: { token: JWT_ADMIN }
 *   tricycles:get-all  -> tricycles:list (100 véhicules max)
 *   tickets:get-today  -> tickets:list   (100 billets max, créés aujourd'hui en UTC)
 *
 * Le serveur ne possède pas encore de handlers pour tricycle:register,
 * tricycle:delete, tricycle:control ni position-updated. Aucune action de
 * modification simulée n'est exposée dans ces modules.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  AlertCircle,
  Battery,
  Bike,
  Building2,
  Bus,
  Clock3,
  Download,
  Gauge,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  Ticket,
  UserRound,
  Wifi,
  WifiOff,
} from 'lucide-react';

// Pour le développement : VITE_API_URL=http://localhost:5000/api
//                       VITE_SOCKET_URL=http://localhost:5000
const API_URL = (
  import.meta.env.VITE_API_URL?.trim() ||
  'https://messay-api.onrender.com/api'
).replace(/\/+$/, '');
const SOCKET_URL = (
  import.meta.env.VITE_SOCKET_URL?.trim() || API_URL.replace(/\/api$/, '')
).replace(/\/+$/, '');

const REFRESH_MS = 30_000;

type AdminModuleProps = {
  /** Recommandé : JWT transmis depuis le store d'authentification ADMIN. */
  accessToken?: string | null;
};

type TricycleComplet = {
  id: string;
  immatriculation: string;
  chauffeur?: string | null;
  chauffeurTel?: string | null;
  status: string;
  batterie?: number | null;
  vitesse?: number | null;
  position?: { lat?: number | null; lng?: number | null } | null;
  derniereActivite?: string | null;
  coursesAujourdhui?: number | null;
  distanceParcourue?: number | null;
  modele?: string | null;
  annee?: number | null;
};

type TicketComplet = {
  id: string;
  compagnie: string;
  passager: string;
  telephone?: string | null;
  trajet?: string | null;
  date?: string | null; // Date du DÉPART, pas date de vente
  heure?: string | null;
  prix?: number | null;
  siege?: string | null;
  paiement?: string | null;
  statut: string;
  gareDepart?: string | null;
  gareArrivee?: string | null;
};

function tokenFromStorage(explicit?: string | null): string | null {
  if (explicit?.trim()) return explicit.trim();
  if (typeof window === 'undefined') return null;

  // Compatibilité avec quelques persistances Zustand et clés usuelles.
  // L'injection explicite de `accessToken` reste la solution recommandée.
  for (const key of [
    'accessToken', 'token', 'authToken',
    'messay-admin-auth', 'admin-auth-storage', 'auth-storage',
  ]) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    if (raw.startsWith('eyJ')) return raw;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') continue;
      const obj = parsed as Record<string, unknown>;
      const state = obj.state && typeof obj.state === 'object'
        ? (obj.state as Record<string, unknown>)
        : obj;
      const value = state.accessToken ?? state.token;
      if (typeof value === 'string' && value.trim()) return value.trim();
    } catch {
      // Autre format de clé : poursuivre la recherche.
    }
  }
  return null;
}

function useAdminCollection<T>(
  requestEvent: 'tricycles:get-all' | 'tickets:get-today',
  responseEvent: 'tricycles:list' | 'tickets:list',
  accessToken?: string | null,
) {
  const [items, setItems] = useState<T[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const refresh = useCallback(() => {
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit(requestEvent);
    } else {
      setError('Serveur temps réel indisponible. Vérifiez votre connexion administrateur.');
    }
  }, [requestEvent]);

  useEffect(() => {
    const token = tokenFromStorage(accessToken);
    if (!token) {
      setLoading(false);
      setConnected(false);
      setError('Session ADMIN introuvable. Connectez-vous ou transmettez accessToken au composant.');
      return;
    }

    setLoading(true);
    setError(null);
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1_000,
      autoConnect: false,
    });
    socketRef.current = socket;
    let responseTimer: number | null = null;
    const clearResponseTimer = () => {
      if (responseTimer !== null) {
        window.clearTimeout(responseTimer);
        responseTimer = null;
      }
    };

    const onConnect = () => {
      setConnected(true);
      setError(null);
      // Le backend vérifie le rôle dans chaque événement ADMIN.
      socket.emit('join-admin-panel');
      socket.emit(requestEvent);
      clearResponseTimer();
      responseTimer = window.setTimeout(() => {
        setLoading(false);
        setError('Aucune réponse reçue. Vérifiez le rôle ADMIN et les événements Socket.IO du serveur.');
      }, 12_000);
    };
    const onDisconnect = () => {
      clearResponseTimer();
      setConnected(false);
      setLoading(false);
      setError('Connexion temps réel interrompue. Reconnexion en cours…');
    };
    const onConnectError = (reason: Error) => {
      clearResponseTimer();
      setConnected(false);
      setLoading(false);
      setError(`Connexion refusée : ${reason.message}. Vérifiez le JWT et le rôle ADMIN.`);
    };
    const onData = (payload: unknown) => {
      clearResponseTimer();
      if (!Array.isArray(payload)) {
        setError('Réponse du serveur inattendue.');
        setLoading(false);
        return;
      }
      setItems(payload as T[]);
      setLastUpdated(new Date());
      setLoading(false);
      setError(null);
    };
    const onServerError = (payload: unknown) => {
      clearResponseTimer();
      const message = payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : 'Impossible de récupérer les données.';
      setError(message);
      setLoading(false);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on(responseEvent, onData);
    socket.on('server:error', onServerError);
    socket.connect();

    // Le backend renvoie les listes sur demande ; aucun événement de mise
    // à jour globale des véhicules/billets n'est diffusé actuellement.
    const interval = window.setInterval(() => {
      if (socket.connected) socket.emit(requestEvent);
    }, REFRESH_MS);

    return () => {
      clearResponseTimer();
      window.clearInterval(interval);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off(responseEvent, onData);
      socket.off('server:error', onServerError);
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [requestEvent, responseEvent, accessToken]);

  return { items, connected, loading, error, lastUpdated, refresh };
}

function formatNumber(value: unknown, digits = 0): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('fr-FR', { maximumFractionDigits: digits })
    : '—';
}

function formatDate(value?: string | null): string {
  if (!value) return 'Non renseignée';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('fr-FR', { timeZone: 'Africa/Abidjan' });
}

function formatActivity(value?: string | null): string {
  if (!value) return 'Non renseignée';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan' });
}

function ConnectionState({ connected, lastUpdated }: { connected: boolean; lastUpdated: Date | null }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${
      connected ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-gray-200 bg-gray-100 text-gray-600'
    }`}>
      {connected ? <Wifi size={15} /> : <WifiOff size={15} />}
      <span>{connected ? 'Connecté' : 'Déconnecté'}</span>
      {lastUpdated && <span className="font-normal">· Actualisé à {lastUpdated.toLocaleTimeString('fr-FR', { timeZone: 'Africa/Abidjan' })}</span>}
    </div>
  );
}

function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <AlertCircle size={18} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function getStatusStyle(status: string): string {
  switch (status) {
    case 'DISPONIBLE': return 'bg-emerald-50 border-emerald-200 text-emerald-700';
    case 'EN_COURSE': return 'bg-orange-50 border-orange-200 text-orange-700';
    case 'MAINTENANCE': return 'bg-amber-50 border-amber-200 text-amber-700';
    case 'HORS_LIGNE': return 'bg-gray-100 border-gray-200 text-gray-600';
    default: return 'bg-blue-50 border-blue-200 text-blue-700';
  }
}

// ============================================================
// MODULE FLOTTES TRICYCLES
// ============================================================

export function TricyclesModule({ accessToken }: AdminModuleProps) {
  const { items: tricycles, connected, loading, error, lastUpdated, refresh } =
    useAdminCollection<TricycleComplet>('tricycles:get-all', 'tricycles:list', accessToken);
  const [status, setStatus] = useState('TOUS');
  const [query, setQuery] = useState('');

  const statuses = useMemo(() => Array.from(new Set(tricycles.map(t => t.status))).sort(), [tricycles]);
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return tricycles.filter(t =>
      (status === 'TOUS' || t.status === status) &&
      (!search || [t.immatriculation, t.chauffeur, t.chauffeurTel, t.modele]
        .some(v => (v ?? '').toLowerCase().includes(search)))
    );
  }, [tricycles, status, query]);

  return (
    <section className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
              <Bike className="text-orange-600" /> Flotte des tricycles
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Données PostgreSQL via Socket.IO · jusqu'à 100 véhicules par chargement
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ConnectionState connected={connected} lastUpdated={lastUpdated} />
            <button type="button" onClick={refresh} disabled={!connected}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">
              <RefreshCw size={16} /> Actualiser
            </button>
          </div>
        </header>
        <ErrorBanner message={error} />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Véhicules chargés', count: tricycles.length },
            { label: 'Disponibles', count: tricycles.filter(t => t.status === 'DISPONIBLE').length },
            { label: 'En course', count: tricycles.filter(t => t.status === 'EN_COURSE').length },
            { label: 'Maintenance', count: tricycles.filter(t => t.status === 'MAINTENANCE').length },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-gray-500">{s.label}</p>
              <p className="mt-2 text-3xl font-black text-gray-900">{s.count}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <div className="flex items-start gap-2">
            <ShieldAlert size={18} className="mt-0.5 shrink-0" />
            <p>
              Le serveur permet actuellement de consulter la flotte, mais n'expose pas les
              événements d'enregistrement, de suppression ou de commande des tricycles.
              Ces actions ne sont donc pas simulées ici. La vitesse et la dernière activité
              sont les dernières valeurs enregistrées, pas une preuve de mouvement instantané.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="relative min-w-[230px] flex-1">
            <Search size={17} className="absolute left-3 top-3 text-gray-400" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Immatriculation, conducteur, modèle…"
              aria-label="Rechercher un tricycle"
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-orange-500" />
          </label>
          <select value={status} onChange={e => setStatus(e.target.value)}
            aria-label="Filtrer les tricycles par statut"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm">
            <option value="TOUS">Tous les statuts</option>
            {statuses.map(value => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}
          </select>
        </div>

        {loading ? (
          <p className="rounded-xl border bg-white p-8 text-center text-gray-500">Chargement de la flotte…</p>
        ) : !lastUpdated ? (
          <p className="rounded-xl border bg-white p-8 text-center text-gray-500">Aucune liste de véhicules reçue.</p>
        ) : filtered.length === 0 ? (
          <p className="rounded-xl border bg-white p-8 text-center text-gray-500">Aucun véhicule correspondant.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(tri => {
              const lat = tri.position?.lat;
              const lng = tri.position?.lng;
              const hasPosition = typeof lat === 'number' && Number.isFinite(lat) &&
                typeof lng === 'number' && Number.isFinite(lng);
              return (
                <article key={tri.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-black text-gray-900">{tri.immatriculation || 'Sans immatriculation'}</h2>
                      <p className="mt-1 text-xs text-gray-500">{tri.modele || 'Modèle non renseigné'}{tri.annee ? ` · ${tri.annee}` : ''}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${getStatusStyle(tri.status)}`}>
                      {tri.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-gray-700">
                    <p className="flex items-center gap-2"><UserRound size={15} /> {tri.chauffeur || 'Conducteur non assigné'}</p>
                    {tri.chauffeurTel && <p className="text-xs text-gray-500">Téléphone : {tri.chauffeurTel}</p>}
                    <div className="grid grid-cols-3 gap-2 pt-2">
                      <div className="rounded-xl bg-gray-50 p-2 text-center">
                        <Battery size={16} className="mx-auto text-orange-600" />
                        <strong className="mt-1 block text-sm">{formatNumber(tri.batterie)} %</strong>
                        <span className="text-[10px] text-gray-500">Batterie</span>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-2 text-center">
                        <Gauge size={16} className="mx-auto text-orange-600" />
                        <strong className="mt-1 block text-sm">{formatNumber(tri.vitesse, 1)}</strong>
                        <span className="text-[10px] text-gray-500">km/h enregistré</span>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-2 text-center">
                        <Bike size={16} className="mx-auto text-orange-600" />
                        <strong className="mt-1 block text-sm">{formatNumber(tri.coursesAujourdhui)}</strong>
                        <span className="text-[10px] text-gray-500">Courses du jour</span>
                      </div>
                    </div>
                    <p className="flex items-center gap-2 border-t pt-3 text-xs text-gray-600">
                      <MapPin size={15} /> {hasPosition ? `${lat!.toFixed(5)}, ${lng!.toFixed(5)}` : 'Position GPS non renseignée'}
                    </p>
                    <p className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock3 size={15} /> Dernière activité : {formatActivity(tri.derniereActivite)}
                    </p>
                    {typeof tri.distanceParcourue === 'number' && (
                      <p className="text-xs text-gray-500">Distance enregistrée : {formatNumber(tri.distanceParcourue, 1)} km</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================
// MODULE BILLETTERIE INTERURBAINE
// ============================================================

function csvValue(value: unknown): string {
  let text = value == null ? '' : String(value);
  // Évite d'injecter des formules quand le CSV est ouvert dans Excel.
  if (/^[\s]*[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadTickets(tickets: TicketComplet[]) {
  const rows: unknown[][] = [
    ['Billet', 'Compagnie', 'Passager', 'Téléphone', 'Trajet', 'Date départ', 'Heure départ', 'Siège', 'Prix FCFA', 'Paiement', 'Statut'],
    ...tickets.map(t => [t.id, t.compagnie, t.passager, t.telephone ?? '', t.trajet ?? '', t.date ?? '', t.heure ?? '', t.siege ?? '', t.prix ?? '', t.paiement ?? '', t.statut]),
  ];
  const csv = '\uFEFF' + rows.map(row => row.map(csvValue).join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `messay-billets-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function BusTicketsModule({ accessToken }: AdminModuleProps) {
  const { items: tickets, connected, loading, error, lastUpdated, refresh } =
    useAdminCollection<TicketComplet>('tickets:get-today', 'tickets:list', accessToken);
  const [query, setQuery] = useState('');
  const [compagnie, setCompagnie] = useState('TOUTES');

  const compagnies = useMemo(() => Array.from(new Set(tickets.map(t => t.compagnie).filter(Boolean))).sort(), [tickets]);
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return tickets.filter(t =>
      (compagnie === 'TOUTES' || t.compagnie === compagnie) &&
      (!search || [t.passager, t.telephone, t.trajet, t.id]
        .some(v => (v ?? '').toLowerCase().includes(search)))
    );
  }, [tickets, compagnie, query]);
  const paidCount = tickets.filter(t => ['PAYE', 'VALIDE', 'UTILISE'].includes(t.statut)).length;

  return (
    <section className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
              <Bus className="text-blue-600" /> Billetterie interurbaine
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Billets créés aujourd'hui (UTC) · maximum 100 billets renvoyés par le backend
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ConnectionState connected={connected} lastUpdated={lastUpdated} />
            <button type="button" onClick={refresh} disabled={!connected}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <RefreshCw size={16} /> Actualiser
            </button>
            <button type="button" onClick={() => downloadTickets(filtered)} disabled={!filtered.length}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
              <Download size={16} /> Exporter CSV
            </button>
          </div>
        </header>
        <ErrorBanner message={error} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <Ticket className="text-blue-700" size={20} />
            <p className="mt-2 text-xs font-semibold uppercase text-gray-500">Billets chargés</p>
            <p className="mt-1 text-3xl font-black">{tickets.length}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <Bus className="text-emerald-600" size={20} />
            <p className="mt-2 text-xs font-semibold uppercase text-gray-500">Statuts payés / validés / utilisés</p>
            <p className="mt-1 text-3xl font-black">{paidCount}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <Building2 className="text-orange-600" size={20} />
            <p className="mt-2 text-xs font-semibold uppercase text-gray-500">Compagnies représentées</p>
            <p className="mt-1 text-3xl font-black">{compagnies.length}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="relative min-w-[230px] flex-1">
            <Search size={17} className="absolute left-3 top-3 text-gray-400" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Passager, téléphone, trajet, identifiant…"
              aria-label="Rechercher un billet"
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500" />
          </label>
          <select value={compagnie} onChange={e => setCompagnie(e.target.value)}
            aria-label="Filtrer les billets par compagnie"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm">
            <option value="TOUTES">Toutes les compagnies</option>
            {compagnies.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[990px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  {['Billet', 'Passager', 'Compagnie', 'Trajet', 'Départ', 'Siège', 'Paiement', 'Montant', 'Statut'].map(label => (
                    <th key={label} className="px-4 py-3 font-bold">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-700">{t.id.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{t.passager || 'Non renseigné'}</p>
                      <p className="text-xs text-gray-500">{t.telephone || 'Téléphone non renseigné'}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{t.compagnie}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{t.trajet || 'Trajet non renseigné'}</p>
                      <p className="text-xs text-gray-500">{[t.gareDepart, t.gareArrivee].filter(Boolean).join(' → ')}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p>{formatDate(t.date)}</p>
                      <p className="text-xs text-gray-500">{t.heure || 'Heure non renseignée'}</p>
                    </td>
                    <td className="px-4 py-3">{t.siege || '—'}</td>
                    <td className="px-4 py-3">{(t.paiement || '—').replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-bold">{formatNumber(t.prix)} FCFA</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold">{t.statut.replace(/_/g, ' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {loading ? (
            <p className="p-10 text-center text-gray-500">Chargement des billets…</p>
          ) : !lastUpdated ? (
            <p className="p-10 text-center text-gray-500">Aucune liste de billets reçue.</p>
          ) : filtered.length === 0 ? (
            <p className="p-10 text-center text-gray-500">Aucun billet correspondant.</p>
          ) : null}
        </div>
        <p className="text-xs text-gray-500">
          L'heure et la date affichées sont celles du départ. Le backend ne fournit pas encore
          de date de vente dans cet événement Socket.IO. L'export contient uniquement les billets chargés.
        </p>
      </div>
    </section>
  );
}

export default TricyclesModule;
