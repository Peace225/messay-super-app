import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Crosshair, MapPin, Wifi, WifiOff, Navigation, AlertCircle } from 'lucide-react';
import { io, type Socket } from 'socket.io-client';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FleetHeading } from '../../components/flotte/FlotteUI';
import { formatDateTime } from '../../utils/fleetFormat';

interface LivePosition { courseId: string; driverId?: string; lat: number; lng: number; timestamp: string; }
const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api').replace(/\/api\/?$/, '')).replace(/\/+$/, '');
const currentMarker = L.divIcon({ className: 'messay-current-gps', html: '<span style="display:block;width:18px;height:18px;border:3px solid white;border-radius:100%;background:#ea580c;box-shadow:0 2px 10px #0005"></span>', iconSize: [18,18], iconAnchor: [9,9] });
function MoveMap({ lat, lng }: { lat: number; lng: number }) { const map = useMap(); useEffect(() => { map.setView([lat, lng], Math.max(map.getZoom(), 14)); }, [lat, lng, map]); return null; }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function FlotteLivePage() {
  const [input, setInput] = useState('');
  const [courseId, setCourseId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positions, setPositions] = useState<LivePosition[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const courseIdRef = useRef<string | null>(null);
  const join = useCallback((id: string) => {
    if (!UUID.test(id)) { setError('Saisissez un identifiant UUID de course valide.'); return; }
    const socket = socketRef.current;
    if (courseIdRef.current) socket?.emit('leave-course', { courseId: courseIdRef.current });
    courseIdRef.current = id;
    setCourseId(id);
    setPositions([]);
    setError(null);
    if (socket?.connected) socket.emit('join-course', { courseId: id });
  }, []);
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { setError('Session ADMIN absente : reconnectez-vous.'); return; }
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'], reconnection: true });
    socketRef.current = socket;
    const onConnect = () => { setConnected(true); setError(null); if (courseIdRef.current) socket.emit('join-course', { courseId: courseIdRef.current }); };
    const onDisconnect = () => setConnected(false);
    const onConnectError = (err: Error) => { setConnected(false); setError(`Connexion Socket.IO : ${err.message}`); };
    const onGps = (raw: unknown) => {
      if (!raw || typeof raw !== 'object') return;
      const p = raw as Record<string, unknown>;
      const id = p.courseId ?? p.rideId;
      if (id !== courseIdRef.current || typeof p.lat !== 'number' || typeof p.lng !== 'number' || !Number.isFinite(p.lat) || !Number.isFinite(p.lng) || Math.abs(p.lat)>90 || Math.abs(p.lng)>180) return;
      const pos: LivePosition = { courseId: courseIdRef.current as string, driverId: typeof p.driverId === 'string' ? p.driverId : undefined, lat: p.lat, lng: p.lng, timestamp: typeof p.timestamp === 'string' ? p.timestamp : new Date().toISOString() };
      setPositions(prev => [pos, ...prev].slice(0, 50));
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('driver_location', onGps);
    return () => { if (courseIdRef.current) socket.emit('leave-course', { courseId: courseIdRef.current }); socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); socket.off('connect_error', onConnectError); socket.off('driver_location', onGps); socket.disconnect(); socketRef.current=null; };
  }, []);
  const latest = positions[0];
  return <main className="space-y-6 p-4 md:p-6">
    <FleetHeading title="Suivi GPS en direct" subtitle="Suivre une course connue et recevoir les positions réellement envoyées par son conducteur."/>
    <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${connected ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{connected ? <Wifi size={18}/> : <WifiOff size={18}/>} {connected ? 'Connecté au serveur de localisation' : 'Non connecté au serveur de localisation'}</div>
    {error && <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={17}/>{error}</p>}
    <section className="rounded-2xl border bg-white p-5 shadow-sm"><form onSubmit={e => { e.preventDefault(); join(input.trim()); }} className="flex flex-wrap gap-3"><label className="min-w-[220px] flex-1"><span className="mb-2 block text-xs font-bold uppercase text-gray-500">Identifiant de la course</span><input value={input} onChange={e => setInput(e.target.value)} placeholder="UUID de la course" className="w-full rounded-xl border px-4 py-3 font-mono text-sm outline-none focus:border-orange-500"/></label><button type="submit" disabled={!connected} className="self-end rounded-xl bg-orange-600 px-5 py-3 font-semibold text-white disabled:opacity-40"><Crosshair size={17} className="mr-2 inline"/>Suivre cette course</button></form><p className="mt-3 text-xs text-gray-500">L'accès au salon de course est vérifié côté serveur. Seules les positions ultérieures à l'abonnement s'affichent.</p></section>
    <div className="grid gap-5 lg:grid-cols-3"><section className="rounded-2xl border bg-white p-6 shadow-sm lg:col-span-1"><h2 className="flex items-center gap-2 font-black"><Activity className="text-orange-500"/>Position actuelle</h2>{latest ? <div className="mt-6 space-y-4"><p className="text-sm text-gray-500">Course #{latest.courseId.slice(0, 8)}</p><p className="text-2xl font-black">{latest.lat.toFixed(6)}, {latest.lng.toFixed(6)}</p><p className="text-sm text-gray-500">Réception : {formatDateTime(latest.timestamp)}</p><a className="inline-flex items-center gap-2 text-sm font-bold text-orange-600 underline" href={`https://www.openstreetmap.org/?mlat=${latest.lat}&mlon=${latest.lng}#map=16/${latest.lat}/${latest.lng}`} target="_blank" rel="noopener noreferrer"><Navigation size={16}/>Voir la position sur une carte</a></div> : <p className="mt-5 text-sm text-gray-500">{courseId ? 'Abonné à la course. En attente de positions GPS…' : 'Choisissez une course à suivre.'}</p>}</section>
    <section className="rounded-2xl border bg-white p-6 shadow-sm lg:col-span-2"><h2 className="flex items-center gap-2 font-black"><MapPin className="text-orange-500"/>Historique reçu pendant la session</h2>{positions.length===0 ? <div className="py-12 text-center text-gray-500">Aucune coordonnée reçue.</div> : <div className="mt-5 max-h-[440px] divide-y overflow-auto">{positions.map((p,i) => <div key={`${p.timestamp}-${i}`} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><strong className="font-mono">{p.lat.toFixed(6)}, {p.lng.toFixed(6)}</strong><span className="text-gray-500">{formatDateTime(p.timestamp)}</span></div>)}</div>}</section></div>
    {latest && <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><h2 className="border-b p-4 font-black">Carte du conducteur suivi</h2><div className="h-[380px]"><MapContainer center={[latest.lat, latest.lng]} zoom={14} style={{ width: '100%', height: '100%' }}><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><MoveMap lat={latest.lat} lng={latest.lng}/><Marker position={[latest.lat, latest.lng]} icon={currentMarker}><Popup>Course #{latest.courseId.slice(0,8)}<div>{formatDateTime(latest.timestamp)}</div></Popup></Marker></MapContainer></div></section>}
    <p className="text-xs text-gray-500">Le backend diffuse <code>driver_location</code> aux membres autorisés du salon <code>course-ID</code>. Il ne diffuse pas une carte globale en continu de toutes les courses.</p>
  </main>;
}
