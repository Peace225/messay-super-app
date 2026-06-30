import React, { useEffect, useState } from 'react';
import { Users, Car, Ticket, Wallet, Activity } from 'lucide-react';
import { io } from 'socket.io-client';
import api from '../services/api';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// 🔑 TOMTOM - Remplace par ta clé complète
const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_KEY;

// Icônes
const tricycleIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const clientIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://192.168.1.73:5000';

interface PositionData {
  courseId?: string;
  tricycleId?: string;
  lat: number;
  lng: number;
  chauffeurId?: string;
  timestamp?: number;
  vitesse?: number;
  batterie?: number;
}

interface ClientPosition {
  userId: string;
  lat: number;
  lng: number;
  timestamp?: number;
}

interface TricycleRide {
  id: string;
  pickup: { address: string };
  destination: { address: string };
  status: string;
  price: number;
  service: string;
  clientId?: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState({ chauffeurs: 0, courses: 0, tickets: 0, volume: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [livePositions, setLivePositions] = useState<PositionData[]>([]);
  const [clientPositions, setClientPositions] = useState<ClientPosition[]>([]);
  const [tricycleRides, setTricycleRides] = useState<TricycleRide[]>([]);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [showTraffic, setShowTraffic] = useState(true); // ✅ NOUVEAU

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    });

    const fetchStats = async () => {
      try {
        const response = await api.get('/stats');
        setStats({
          chauffeurs: response.data.chauffeurs || 0,
          courses: response.data.courses || 0,
          tickets: response.data.tickets || 0,
          volume: response.data.volume || 0
        });
      } catch (error) {
        console.error("Erreur stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000);

    const onConnect = () => {
      console.log('✅ Admin connecté au socket');
      setIsSocketConnected(true);
      newSocket.emit('join-admin-panel');
    };

    const onDisconnect = () => {
      console.log('❌ Socket déconnecté');
      setIsSocketConnected(false);
    };

    const onPositionUpdated = (data: PositionData) => {
      setLivePositions(prev => {
        const id = data.courseId || data.tricycleId || '';
        const idx = prev.findIndex(p => (p.courseId || p.tricycleId) === id);
        const updated = {...data, timestamp: Date.now() };

        if (idx >= 0) {
          const newArr = [...prev];
          newArr[idx] = updated;
          return newArr;
        }
        return [updated,...prev].slice(0, 50);
      });
    };

    const onClientPosition = (data: ClientPosition) => {
      setClientPositions(prev => {
        const idx = prev.findIndex(p => p.userId === data.userId);
        const updated = {...data, timestamp: Date.now() };

        if (idx >= 0) {
          const newArr = [...prev];
          newArr[idx] = updated;
          return newArr;
        }
        return [updated,...prev].slice(0, 50);
      });
    };

    const onNewRide = (ride: TricycleRide) => {
      console.log('🆕 Nouvelle course:', ride);
      setTricycleRides(prev => [ride,...prev].slice(0, 20));
      setStats(s => ({...s, courses: s.courses + 1 }));
    };

    const onRideUpdate = (update: any) => {
      setTricycleRides(prev =>
        prev.map(r => r.id === update.id? {...r,...update } : r)
      );
    };

    const onClientConnected = (data: any) => {
      if (data.position) {
        onClientPosition({
          userId: data.id,
          lat: data.position.lat,
          lng: data.position.lng
        });
      }
    };

    newSocket.on('connect', onConnect);
    newSocket.on('disconnect', onDisconnect);
    newSocket.on('position-updated', onPositionUpdated);
    newSocket.on('client-position', onClientPosition);
    newSocket.on('client:connected', onClientConnected);
    newSocket.on('ride:new', onNewRide);
    newSocket.on('ride:update', onRideUpdate);
    newSocket.on('ride:accepted', onRideUpdate);

    return () => {
      clearInterval(interval);
      newSocket.off('connect', onConnect);
      newSocket.off('disconnect', onDisconnect);
      newSocket.off('position-updated', onPositionUpdated);
      newSocket.off('client-position', onClientPosition);
      newSocket.off('client:connected', onClientConnected);
      newSocket.off('ride:new', onNewRide);
      newSocket.off('ride:update', onRideUpdate);
      newSocket.off('ride:accepted', onRideUpdate);
      newSocket.disconnect();
    };
  }, []);

  const statCards = [
    {
      title: "Chauffeurs Actifs",
      value: stats.chauffeurs,
      icon: <Users size={28} />,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100"
    },
    {
      title: "Courses en direct",
      value: tricycleRides.length > 0? tricycleRides.length : livePositions.length || stats.courses,
      icon: <Car size={28} />,
      color: "text-orange-600",
      bg: "bg-orange-50",
      border: "border-orange-100"
    },
    {
      title: "Tickets de Bus",
      value: stats.tickets,
      icon: <Ticket size={28} />,
      color: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-100"
    },
    {
      title: "Volume d'Affaires",
      value: `${stats.volume.toLocaleString('fr-FR')} F`,
      icon: <Wallet size={28} />,
      color: "text-purple-600",
      bg: "bg-purple-50",
      border: "border-purple-100"
    }
  ];

  const abidjanCenter: [number, number] = [5.345317, -4.024429];

  // ✅ URLs TomTom
  const trafficFlowUrl = `https://api.tomtom.com/traffic/map/4/flow/relative/{z}/{x}/{y}.png?key=${TOMTOM_KEY}`;
  const trafficIncidentsUrl = `https://api.tomtom.com/traffic/map/4/incidents/s3/{z}/{x}/{y}.png?key=${TOMTOM_KEY}`;

  return (
    <div className="space-y-8 p-2">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Vue d'ensemble</h1>
          <p className="text-gray-500 font-medium mt-1">Statistiques en direct de l'activité MESSAY.</p>
        </div>
        <div className="flex items-center space-x-2 bg-green-50 px-4 py-2 rounded-full border border-green-200 shadow-sm w-max">
          <Activity size={18} className="text-green-600 animate-pulse" />
          <span className="text-sm font-bold text-green-700 tracking-wide uppercase">Live Updates</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {statCards.map((card, idx) => (
          <div key={idx} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-center transition-all hover:shadow-md hover:-translate-y-1 duration-300">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-4 rounded-2xl ${card.bg} ${card.color} ${card.border} border`}>
                {card.icon}
              </div>
            </div>
            <div>
              <h3 className="text-4xl font-black text-gray-900 tracking-tight">
                {isLoading? <span className="text-gray-300">...</span> : card.value}
              </h3>
              <p className="text-sm text-gray-500 font-bold mt-1">{card.title}</p>
            </div>
          </div>
        ))}
      </div>

      {tricycleRides.length > 0 && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            🚲 Courses Tricycle Récentes
            <span className="text-sm bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
              {tricycleRides.length}
            </span>
          </h2>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {tricycleRides.slice(0, 5).map(ride => (
              <div key={ride.id} className="flex justify-between items-center p-3 bg-orange-50 rounded-xl hover:bg-orange-100 transition-colors">
                <div>
                  <p className="font-semibold text-sm text-gray-900">
                    {ride.pickup?.address || 'Départ'} → {ride.destination?.address || 'Arrivée'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {ride.service} • {ride.price?.toLocaleString()} FCFA
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  ride.status === 'pending'? 'bg-yellow-200 text-yellow-800' :
                  ride.status === 'accepted'? 'bg-blue-200 text-blue-800' :
                  'bg-green-200 text-green-800'
                }`}>
                  {ride.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ✅ CORRIGÉ: h-[600px] au lieu de h- */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm flex flex-col h-[600px] relative overflow-hidden">
        {/* Bouton Trafic */}
        <div className="absolute top-4 left-4 z-[400]">
          <button
            onClick={() => setShowTraffic(!showTraffic)}
            className={`px-4 py-2 rounded-xl text-xs font-bold shadow-lg backdrop-blur-sm border transition-all ${
              showTraffic
               ? 'bg-orange-500 text-white border-orange-600'
                : 'bg-white/90 text-gray-700 border-gray-200'
            }`}
          >
            🚦 TRAFIC {showTraffic? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="absolute top-4 right-4 z-[400]">
          <div className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold shadow-lg bg-white/90 backdrop-blur-sm border ${isSocketConnected? 'text-green-700 border-green-200' : 'text-red-700 border-red-200'}`}>
            <div className={`w-2.5 h-2.5 rounded-full ${isSocketConnected? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span>{isSocketConnected? 'GPS CONNECTÉ' : 'HORS LIGNE'}</span>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 z-[400] bg-white/90 backdrop-blur px-3 py-2 rounded-xl border shadow-sm">
          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full"></span>
              {livePositions.length} Chauffeurs
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-blue-500 rounded-full"></span>
              {clientPositions.length} Clients
            </span>
          </div>
        </div>

        <MapContainer center={abidjanCenter} zoom={12} style={{ height: '100%', width: '100%', zIndex: 0 }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* ✅ TRAFIC TOMTOM */}
          {showTraffic && (
            <>
              <TileLayer url={trafficFlowUrl} opacity={0.7} zIndex={10} />
              <TileLayer url={trafficIncidentsUrl} opacity={0.8} zIndex={11} />
            </>
          )}

          {livePositions.map((pos) => (
            <Marker
              key={`driver-${pos.courseId || pos.tricycleId}`}
              position={[pos.lat, pos.lng]}
              icon={tricycleIcon}
            >
              <Popup>
                <div className="font-sans min-w-[200px]">
                  <div className="font-bold text-gray-900 text-sm mb-1">
                    🚕 Tricycle #{(pos.courseId || pos.tricycleId || '').slice(-6)}
                  </div>
                  <div className="text-gray-600 text-xs space-y-1">
                    <div>Lat: {pos.lat?.toFixed(5)}</div>
                    <div>Lng: {pos.lng?.toFixed(5)}</div>
                    {pos.vitesse!== undefined && <div>Vitesse: {pos.vitesse} km/h</div>}
                    {pos.batterie!== undefined && <div>Batterie: {pos.batterie}%</div>}
                  </div>
                  {pos.timestamp && (
                    <div className="text-gray-400 text-[10px] mt-2 border-t border-gray-100 pt-1">
                      {new Date(pos.timestamp).toLocaleTimeString('fr-FR')}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {clientPositions.map((pos) => (
            <Marker key={`client-${pos.userId}`} position={[pos.lat, pos.lng]} icon={clientIcon}>
              <Popup>
                <div className="font-sans min-w-[180px]">
                  <div className="font-bold text-blue-700 text-sm mb-1">
                    👤 Client #{pos.userId?.slice(-6)}
                  </div>
                  <div className="text-gray-600 text-xs">
                    <div>Lat: {pos.lat?.toFixed(5)}</div>
                    <div>Lng: {pos.lng?.toFixed(5)}</div>
                  </div>
                  {pos.timestamp && (
                    <div className="text-gray-400 text-[10px] mt-2 border-t border-gray-100 pt-1">
                      {new Date(pos.timestamp).toLocaleTimeString('fr-FR')}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}