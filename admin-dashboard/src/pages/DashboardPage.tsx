/**
 * MESSAY Admin — Vue d'ensemble (courses tricycle et billetterie interurbaine).
 *
 * Backend vérifié :
 * - GET /api/finance/stats (JWT ADMIN)
 * - Socket.IO auth: { token: JWT_ADMIN }
 * - tricycles:get-all -> tricycles:list (100 derniers véhicules au maximum)
 *
 * La liste Socket.IO contient des POSITIONS ENREGISTRÉES, pas un flux GPS
 * continu. Le serveur n'émet pas ride:new, ride:update, client-position,
 * position-updated, ni les positions de tous les passagers vers admin-room.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  Activity,
  AlertCircle,
  Bike,
  Bus,
  Clock3,
  MapPin,
  RefreshCw,
  Users,
  Wallet,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../services/api';

const API_URL = (
  import.meta.env.VITE_API_URL?.trim() ||
  'https://messay-api.onrender.com/api'
).replace(/\/+$/, '');

const SOCKET_URL = (
  import.meta.env.VITE_SOCKET_URL?.trim() ||
  API_URL.replace(/\/api$/, '')
).replace(/\/+$/, '');

const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_KEY?.trim() || '';
const REFRESH_MS = 30_000;
const ABIDJAN_CENTER: [number, number] = [5.345317, -4.024429];

// Marqueurs statiques : pas de chargement d'icônes Leaflet externes.
function makeMarker(color: string): L.DivIcon {
  return L.divIcon({
    className: 'messay-tricycle-marker',
    html: `<span style="display:block;width:18px;height:18px;border:3px solid white;border-radius:50%;background:${color};box-shadow:0 1px 8px #33415580"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}
const availableMarker = makeMarker('#16a34a');
const movingMarker = makeMarker('#ea580c');
const otherMarker = makeMarker('#64748b');

type FinanceStats = {
  chauffeursActifs?: number | null;
  totalCourses?: number | null;
  ticketsJour?: number | null;
  revenuTotal?: number | null;
  flotteActive?: number | null;
  flotteTotal?: number | null;
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
};

type MappedTricycle = Tricycle & {
  lat: number;
  lng: number;
};

type DashboardPageProps = {
  /** Fournir le JWT du compte ADMIN depuis le store d'authentification. */
  accessToken?: string | null;
};

function getStoredAdminToken(explicit?: string | null): string | null {
  if (explicit?.trim()) return explicit.trim();
  if (typeof window === 'undefined') return null;

  // Compatibilité avec les clés communes et les stores Zustand persistés.
  // À terme : brancher directement accessToken depuis src/store/authStore.ts.
  const keys = [
    'accessToken',
    'token',
    'authToken',
    'messay-admin-auth',
    'admin-auth-storage',
    'auth-storage',
  ];

  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    if (raw.startsWith('eyJ')) return raw;
    try {
      const decoded: unknown = JSON.parse(raw);
      if (!decoded || typeof decoded !== 'object') continue;
      const root = decoded as Record<string, unknown>;
      const state = root.state && typeof root.state === 'object'
        ? root.state as Record<string, unknown>
        : root;
      const value = state.accessToken ?? state.token;
      if (typeof value === 'string' && value.trim()) return value.trim();
    } catch {
      // Une autre clé du stockage ne contient pas de JSON.
    }
  }
  return null;
}

function numeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatCount(value: number | null | undefined): string {
  return numeric(value)?.toLocaleString('fr-FR') ?? '—';
}

function formatFCFA(value: number | null | undefined): string {
  const amount = numeric(value);
  return amount === null ? '—' : `${amount.toLocaleString('fr-FR')} FCFA`;
}

function isTricycle(value: unknown): value is Tricycle {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return typeof t.id === 'string' &&
    typeof t.immatriculation === 'string' &&
    typeof t.status === 'string';
}

function readCoordinates(t: Tricycle): MappedTricycle | null {
  const lat = numeric(t.position?.lat);
  const lng = numeric(t.position?.lng);
  if (lat === null || lng === null ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180 ||
      (lat === 0 && lng === 0)) {
    return null;
  }
  return { ...t, lat, lng };
}

/** Centrer une fois la carte sur la flotte : préserver ensuite les déplacements manuels. */
function FleetViewport({ vehicles }: { vehicles: MappedTricycle[] }) {
  const map = useMap();
  const centeredRef = useRef(false);

  useEffect(() => {
    if (centeredRef.current || vehicles.length === 0) return;
    centeredRef.current = true;
    if (vehicles.length === 1) {
      map.setView([vehicles[0].lat, vehicles[0].lng], 13);
    } else {
      map.fitBounds(vehicles.map(t => [t.lat, t.lng] as [number, number]), {
        padding: [36, 36],
        maxZoom: 14,
      });
    }
  }, [map, vehicles]);
  return null;
}

function formattedActivity(value?: string | null): string {
  if (!value) return 'Non renseignée';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fr-FR');
}

export default function DashboardPage({ accessToken }: DashboardPageProps) {
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [fleet, setFleet] = useState<Tricycle[]>([]);
  const [fleetLoading, setFleetLoading] = useState(true);
  const [fleetError, setFleetError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastFleetUpdate, setLastFleetUpdate] = useState<Date | null>(null);
  const [showTraffic, setShowTraffic] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const mountedRef = useRef(true);
  const refreshingRef = useRef(false);

  const fetchStats = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    if (mountedRef.current) setStatsLoading(true);
    try {
      // Ce sont des statistiques issues de transactions et courses validées,
      // et non des statistiques de sessions/positions GPS en temps réel.
      const { data } = await api.get<FinanceStats>('/finance/stats');
      if (mountedRef.current) {
        setStats(data);
        setStatsError(null);
      }
    } catch (error) {
      console.error('[MESSAY/DASHBOARD] Statistiques indisponibles', error);
      if (mountedRef.current) {
        setStatsError('Statistiques indisponibles : vérifiez la session ADMIN et l’API.');
      }
    } finally {
      if (mountedRef.current) setStatsLoading(false);
      refreshingRef.current = false;
    }
  }, []);

  const refresh = useCallback(() => {
    void fetchStats();
    if (socketRef.current?.connected) {
      socketRef.current.emit('tricycles:get-all');
    }
  }, [fetchStats]);

  useEffect(() => {
    mountedRef.current = true;
    void fetchStats();
    const interval = window.setInterval(refresh, REFRESH_MS);
    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
    };
  }, [fetchStats, refresh]);

  useEffect(() => {
    const token = getStoredAdminToken(accessToken);
    if (!token) {
      setFleetLoading(false);
      setFleetError('Aucun JWT ADMIN détecté. Transmettez accessToken depuis votre authStore.');
      return;
    }

    setFleetLoading(true);
    setFleetError(null);
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1_000,
      autoConnect: false,
    });
    socketRef.current = socket;
   let responseTimeout: number | null = null;
    const clearResponseTimeout = () => {
      if (responseTimeout !== null) {
        window.clearTimeout(responseTimeout);
        responseTimeout = null;
      }
    };

    const onConnect = () => {
      setSocketConnected(true);
      setFleetError(null);
      socket.emit('join-admin-panel');
      socket.emit('tricycles:get-all');
      clearResponseTimeout();
      responseTimeout = window.setTimeout(() => {
        setFleetLoading(false);
        setFleetError('Le serveur ne répond pas à tricycles:get-all. Vérifiez le rôle ADMIN.');
      }, 12_000);
    };
    const onDisconnect = () => {
      clearResponseTimeout();
      setSocketConnected(false);
      setFleetLoading(false);
      setFleetError('Socket.IO déconnecté. Reconnexion en cours…');
    };
    const onConnectError = (error: Error) => {
      clearResponseTimeout();
      setSocketConnected(false);
      setFleetLoading(false);
      setFleetError(`Connexion Socket.IO refusée : ${error.message}`);
    };
    const onFleet = (payload: unknown) => {
      clearResponseTimeout();
      if (!Array.isArray(payload)) {
        setFleetError('Format de liste des tricycles inattendu.');
        setFleetLoading(false);
        return;
      }
      setFleet(payload.filter(isTricycle));
      setFleetLoading(false);
      setFleetError(null);
      setLastFleetUpdate(new Date());
    };
    const onServerError = (payload: unknown) => {
      if (payload && typeof payload === 'object' && 'message' in payload) {
        setFleetError(String((payload as { message: unknown }).message));
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('tricycles:list', onFleet);
    socket.on('server:error', onServerError);
    socket.connect();

    return () => {
      clearResponseTimeout();
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('tricycles:list', onFleet);
      socket.off('server:error', onServerError);
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [accessToken]);

  const mappedFleet = useMemo(
    () => fleet.map(readCoordinates).filter((t): t is MappedTricycle => t !== null),
    [fleet],
  );

  const available = fleet.filter(t => t.status === 'DISPONIBLE').length;
  const inRide = fleet.filter(t => t.status === 'EN_COURSE').length;
  const trafficFlowUrl = TOMTOM_KEY
    ? `https://api.tomtom.com/traffic/map/4/flow/relative/{z}/{x}/{y}.png?key=${encodeURIComponent(TOMTOM_KEY)}`
    : '';
  const trafficIncidentsUrl = TOMTOM_KEY
    ? `https://api.tomtom.com/traffic/map/4/incidents/s3/{z}/{x}/{y}.png?key=${encodeURIComponent(TOMTOM_KEY)}`
    : '';

  const cards = [
    {
      title: 'Conducteurs actifs',
      value: formatCount(stats?.chauffeursActifs),
      icon: Users,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      title: 'Courses terminées (cumul)',
      value: formatCount(stats?.totalCourses),
      icon: Bike,
      color: 'text-orange-600 bg-orange-50',
    },
    {
      title: 'Billets payés aujourd’hui',
      value: formatCount(stats?.ticketsJour),
      icon: Bus,
      color: 'text-green-600 bg-green-50',
    },
    {
      title: 'Recettes validées',
      value: formatFCFA(stats?.revenuTotal),
      icon: Wallet,
      color: 'text-purple-600 bg-purple-50',
    },
  ];

  return (
    <div className="space-y-6 p-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900">Vue d’ensemble MESSAY</h1>
          <p className="mt-1 text-sm text-gray-500">
            Tricycles et billetterie interurbaine — données du backend.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={statsLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={16} className={statsLoading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {statsError && (
        <div role="alert" className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle size={18} className="shrink-0" /> {statsError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => (
          <div key={card.title} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className={`mb-4 inline-flex rounded-2xl p-3 ${card.color}`}>
              <card.icon size={24} />
            </div>
            <div className="text-2xl font-black text-gray-900">
              {statsLoading && !stats ? '…' : card.value}
            </div>
            <p className="mt-1 text-sm font-semibold text-gray-500">{card.title}</p>
          </div>
        ))}
      </div>

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Flotte de tricycles</h2>
            <p className="text-xs text-gray-500">
              Dernières informations enregistrées (liste limitée à 100 véhicules par le serveur).
            </p>
          </div>
          <div className={`inline-flex items-center gap-2 text-xs font-bold ${socketConnected ? 'text-green-700' : 'text-gray-500'}`}>
            {socketConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
            {socketConnected ? 'Socket ADMIN connecté' : 'Socket hors ligne'}
          </div>
        </div>

        {fleetError && (
          <div role="alert" className="mb-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle size={17} className="shrink-0" /> {fleetError}
          </div>
        )}

        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-gray-50 p-4">
            <p className="text-xs font-semibold text-gray-500">Dans la liste</p>
            <p className="mt-1 text-2xl font-black">{fleetLoading ? '…' : fleet.length}</p>
          </div>
          <div className="rounded-2xl bg-green-50 p-4">
            <p className="text-xs font-semibold text-green-700">Disponibles</p>
            <p className="mt-1 text-2xl font-black text-green-800">{fleetLoading ? '…' : available}</p>
          </div>
          <div className="rounded-2xl bg-orange-50 p-4">
            <p className="text-xs font-semibold text-orange-700">En course (statut)</p>
            <p className="mt-1 text-2xl font-black text-orange-800">{fleetLoading ? '…' : inRide}</p>
          </div>
          <div className="rounded-2xl bg-blue-50 p-4">
            <p className="text-xs font-semibold text-blue-700">Positions disponibles</p>
            <p className="mt-1 text-2xl font-black text-blue-800">{fleetLoading ? '…' : mappedFleet.length}</p>
          </div>
        </div>

        <div className="relative h-[470px] overflow-hidden rounded-2xl border border-gray-200">
          <div className="absolute left-3 top-3 z-[500] flex flex-col gap-2">
            <div className="rounded-lg border bg-white/95 px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm">
              <span className="inline-flex items-center gap-1"><MapPin size={13} /> Dernières positions connues</span>
            </div>
            {TOMTOM_KEY ? (
              <button
                type="button"
                onClick={() => setShowTraffic(value => !value)}
                className={`rounded-lg border px-3 py-2 text-xs font-bold shadow-sm ${showTraffic ? 'border-orange-600 bg-orange-600 text-white' : 'bg-white/95 text-gray-700'}`}
              >
                Trafic TomTom : {showTraffic ? 'activé' : 'désactivé'}
              </button>
            ) : null}
          </div>

          <MapContainer center={ABIDJAN_CENTER} zoom={11} className="h-full w-full" style={{ height: '100%', width: '100%' }}>
            <FleetViewport vehicles={mappedFleet} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {showTraffic && TOMTOM_KEY && (
              <>
                <TileLayer url={trafficFlowUrl} opacity={0.7} zIndex={10} />
                <TileLayer url={trafficIncidentsUrl} opacity={0.8} zIndex={11} />
              </>
            )}
            {mappedFleet.map(t => (
              <Marker key={t.id} position={[t.lat, t.lng]} icon={t.status === 'DISPONIBLE' ? availableMarker : t.status === 'EN_COURSE' ? movingMarker : otherMarker}>
                <Popup>
                  <div className="min-w-[180px] text-sm">
                    <strong>{t.immatriculation}</strong>
                    <div>Conducteur : {t.chauffeur || 'Non affecté'}</div>
                    <div>Statut : {t.status.replace(/_/g, ' ')}</div>
                    <div>Vitesse enregistrée : {numeric(t.vitesse) ?? '—'} km/h</div>
                    <div>Batterie : {numeric(t.batterie) ?? '—'} %</div>
                    <div>Dernière activité : {formattedActivity(t.derniereActivite)}</div>
                    <div>GPS : {t.lat.toFixed(5)}, {t.lng.toFixed(5)}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1"><Clock3 size={13} /> Dernière récupération : {lastFleetUpdate ? lastFleetUpdate.toLocaleTimeString('fr-FR') : 'Aucune'}</span>
          <span className="inline-flex items-center gap-1"><Activity size={13} /> Actualisation toutes les 30 secondes</span>
        </div>
      </section>
    </div>
  );
}
