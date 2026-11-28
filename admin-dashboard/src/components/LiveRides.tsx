/// <reference types="vite/client" />
/**
 * MESSAY Admin — flotte tricycle et suivi des courses connues.
 *
 * Contrat Socket.IO vérifié dans le backend MESSAY :
 * - connexion avec auth: { token: JWT_ADMIN }
 * - tricycles:get-all -> tricycles:list (instantané, jusqu'à 100 véhicules)
 * - join-course { courseId } -> driver_location (course existante)
 *
 * Le backend ne diffuse PAS ride:new / ride:update / driver:location.
 * La liste des courses doit être fournie par le service REST existant via
 * la prop `rides` : aucun trajet fictif n'est créé ici.
 */

import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import {
  AlertTriangle,
  Bike,
  Clock3,
  MapPin,
  Radio,
  RefreshCw,
  Search,
  WifiOff,
} from 'lucide-react';

const API_URL = (
  import.meta.env.VITE_API_URL?.trim() ||
  'https://messay-api.onrender.com/api'
).replace(/\/+$/, '');

const SOCKET_URL = (
  import.meta.env.VITE_SOCKET_URL?.trim() ||
  API_URL.replace(/\/api$/, '')
).replace(/\/+$/, '');

const REFRESH_MS = 30_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type GeoPosition = {
  lat: number;
  lng: number;
  timestamp?: string;
};

type Tricycle = {
  id: string;
  immatriculation: string;
  chauffeur?: string | null;
  status: string;
  vitesse?: number | null;
  batterie?: number | null;
  position?: { lat?: number | null; lng?: number | null } | null;
  derniereActivite?: string | null;
  coursesAujourdhui?: number | null;
};

export type Ride = {
  id: string;
  pickup?: { address?: string | null } | null;
  destination?: { address?: string | null } | null;
  status?: string;
  price?: number | null;
  service?: string | null;
  clientId?: string | null;
  driver?: {
    name?: string | null;
    location?: { lat: number; lng: number } | null;
  } | null;
};

interface LiveRidesProps {
  /** Recommandé : transmettre le JWT depuis le store d'authentification ADMIN. */
  accessToken?: string | null;
  /** Courses réelles chargées par CoursesPage / courseService (optionnel). */
  rides?: Ride[];
}

function readAdminToken(provided?: string | null): string | null {
  if (provided?.trim()) return provided.trim();
  if (typeof window === 'undefined') return null;

  // Compatibilité avec plusieurs noms de clés de stockage existants.
  // Préférer la prop accessToken pour éviter toute ambiguïté.
  for (const key of [
    'accessToken',
    'token',
    'authToken',
    'messay-admin-auth',
    'admin-auth-storage',
    'auth-storage',
  ]) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    if (raw.startsWith('eyJ')) return raw;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') continue;
      const object = parsed as Record<string, unknown>;
      const state = object.state && typeof object.state === 'object'
        ? object.state as Record<string, unknown>
        : object;
      const value = state.accessToken ?? state.token;
      if (typeof value === 'string' && value.trim()) return value.trim();
    } catch {
      // Clé non JSON : ignorer.
    }
  }
  return null;
}

function isTricycle(value: unknown): value is Tricycle {
  return !!value && typeof value === 'object' &&
    typeof (value as Tricycle).id === 'string' &&
    typeof (value as Tricycle).immatriculation === 'string' &&
    typeof (value as Tricycle).status === 'string';
}

function toDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR');
}

function formatPrice(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${value.toLocaleString('fr-FR')} FCFA`
    : 'Tarif non renseigné';
}

function formatCoordinates(lat?: number | null, lng?: number | null): string {
  return typeof lat === 'number' && Number.isFinite(lat) &&
    typeof lng === 'number' && Number.isFinite(lng)
    ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    : 'Position indisponible';
}

export default function LiveRides({ accessToken, rides = [] }: LiveRidesProps) {
  const [tricycles, setTricycles] = useState<Tricycle[]>([]);
  const [liveLocations, setLiveLocations] = useState<Record<string, GeoPosition>>({});
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Ne rejoindre que les salons de courses réellement connues (UUID backend).
  const courseIdsKey = rides.map(ride => ride.id)
    .filter(id => UUID_PATTERN.test(id))
    .sort()
    .join('|');

  useEffect(() => {
    const token = readAdminToken(accessToken);
    if (!token) {
      setError('Jeton administrateur introuvable. Connectez-vous au Dashboard Admin.');
      setLoading(false);
      setConnected(false);
      return;
    }

    setLoading(true);
    setError(null);

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      timeout: 12_000,
    });

    const refreshFleet = () => {
      if (socket.connected) socket.emit('tricycles:get-all');
    };

    const handleConnect = () => {
      setConnected(true);
      setError(null);
      socket.emit('join-admin-panel');
      refreshFleet();
      for (const courseId of courseIdsKey.split('|').filter(Boolean)) {
        socket.emit('join-course', { courseId });
      }
    };

    const handleDisconnect = () => setConnected(false);

    const handleConnectError = (err: Error) => {
      setConnected(false);
      setLoading(false);
      setError(err.message || 'Impossible de se connecter au serveur Socket.IO.');
    };

    const handleFleet = (payload: unknown) => {
      if (!Array.isArray(payload)) {
        setLoading(false);
        setError('Format inattendu pour la liste des tricycles.');
        return;
      }
      setTricycles(payload.filter(isTricycle));
      setLastSync(new Date().toISOString());
      setLoading(false);
      setError(null);
    };

    const handleLocation = (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      const data = payload as Record<string, unknown>;
      const courseId = typeof data.courseId === 'string'
        ? data.courseId
        : typeof data.rideId === 'string' ? data.rideId : null;
      if (!courseId || typeof data.lat !== 'number' ||
          typeof data.lng !== 'number' ||
          !Number.isFinite(data.lat) || !Number.isFinite(data.lng)) return;
      // Ne stocker que les positions des courses présentes dans la liste.
      if (!courseIdsKey.split('|').includes(courseId)) return;
      setLiveLocations(prev => ({
        ...prev,
        [courseId]: {
          lat: data.lat as number,
          lng: data.lng as number,
          timestamp: typeof data.timestamp === 'string' ? data.timestamp : undefined,
        },
      }));
    };

    const handleServerError = (payload: { message?: string }) => {
      setLoading(false);
      setError(payload?.message || 'Le serveur a refusé la requête.');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('tricycles:list', handleFleet);
    socket.on('driver_location', handleLocation);
    socket.on('server:error', handleServerError);

    const interval = window.setInterval(refreshFleet, REFRESH_MS);

    return () => {
      window.clearInterval(interval);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('tricycles:list', handleFleet);
      socket.off('driver_location', handleLocation);
      socket.off('server:error', handleServerError);
      socket.disconnect();
    };
  }, [accessToken, courseIdsKey, refreshKey]);

  const filteredTricycles = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tricycles;
    return tricycles.filter(item =>
      `${item.immatriculation} ${item.chauffeur ?? ''} ${item.status}`
        .toLowerCase().includes(term)
    );
  }, [tricycles, search]);

  const available = tricycles.filter(item => item.status === 'DISPONIBLE').length;
  const moving = tricycles.filter(item => typeof item.vitesse === 'number' && item.vitesse > 0).length;

  return (
    <section className="space-y-5" aria-label="Suivi des tricycles MESSAY">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-gray-900">
            <Bike size={22} className="text-orange-600" /> Suivi des tricycles
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Flotte enregistrée dans MESSAY · actualisation toutes les 30 secondes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${
            connected ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {connected ? <Radio size={14} /> : <WifiOff size={14} />}
            {connected ? 'Connecté' : 'Déconnecté'}
          </span>
          <button type="button" onClick={() => setRefreshKey(value => value + 1)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50">
            <RefreshCw size={16} /> Actualiser
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Tricycles chargés', value: tricycles.length },
          { label: 'Disponibles', value: available },
          { label: 'Dernière vitesse > 0', value: moving },
        ].map(stat => (
          <div key={stat.label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="mt-2 text-2xl font-black text-gray-900">{loading ? '…' : stat.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <h3 className="font-bold text-gray-900">Flotte de tricycles</h3>
          <label className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
            <Search size={16} className="text-gray-400" />
            <input type="search" value={search} onChange={event => setSearch(event.target.value)}
              placeholder="Immatriculation, conducteur…" aria-label="Rechercher un tricycle"
              className="w-52 bg-transparent text-sm outline-none" />
          </label>
        </div>
        {loading ? (
          <p className="p-8 text-center text-sm text-gray-500">Chargement de la flotte…</p>
        ) : filteredTricycles.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">Aucun tricycle disponible pour ce filtre.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr><th className="p-3">Tricycle</th><th className="p-3">Conducteur</th><th className="p-3">Statut</th><th className="p-3">Vitesse</th><th className="p-3">Position</th><th className="p-3">Dernière activité</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTricycles.map(item => (
                  <tr key={item.id}>
                    <td className="p-3 font-semibold text-gray-900">{item.immatriculation}</td>
                    <td className="p-3">{item.chauffeur || 'Non assigné'}</td>
                    <td className="p-3">{item.status}</td>
                    <td className="p-3">{typeof item.vitesse === 'number' ? `${item.vitesse} km/h` : '—'}</td>
                    <td className="p-3 font-mono text-xs">{formatCoordinates(item.position?.lat, item.position?.lng)}</td>
                    <td className="p-3 text-xs text-gray-500">{toDateTime(item.derniereActivite)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 font-bold text-gray-900">
          <MapPin size={18} className="text-orange-600" /> Courses suivies ({rides.length})
        </h3>
        {rides.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aucune liste de courses n'a été transmise à ce composant. Branchez la prop
            <code className="mx-1 rounded bg-gray-100 px-1">rides</code>
            sur le service de courses du Dashboard pour suivre leurs positions.
          </p>
        ) : (
          <div className="space-y-3">
            {rides.map(ride => {
              const livePosition = liveLocations[ride.id];
              const location = livePosition ?? ride.driver?.location;
              return (
                <article key={ride.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong className="text-sm text-gray-900">
                      {ride.pickup?.address || 'Départ non renseigné'} → {ride.destination?.address || 'Destination non renseignée'}
                    </strong>
                    <span className="text-xs font-bold text-orange-700">{ride.status || 'Statut inconnu'}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-600">
                    <span>{formatPrice(ride.price)}</span>
                    <span>Conducteur : {ride.driver?.name || 'Non renseigné'}</span>
                    <span>Course : {ride.id.slice(0, 8)}</span>
                  </div>
                  {location && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-sky-700">
                      <MapPin size={13} /> {formatCoordinates(location.lat, location.lng)}
                      {livePosition?.timestamp &&
                        <span className="ml-2 inline-flex items-center gap-1 text-gray-500"><Clock3 size={12} /> {toDateTime(livePosition.timestamp)}</span>}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Dernière synchronisation : {toDateTime(lastSync)}. Les données de flotte sont des instantanés,
        limités aux 100 derniers véhicules renvoyés par le backend. Une vitesse enregistrée
        supérieure à zéro ne prouve pas que le conducteur se déplace encore à cet instant.
      </p>
    </section>
  );
}
