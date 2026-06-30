import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface Ride {
  id: string;
  pickup: { address: string };
  destination: { address: string };
  status: string;
  price: number;
  service: string;
  clientId: string;
  driver?: { name: string; location?: { lat: number; lng: number } };
}

export default function LiveRides() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io('http://192.168.1.73:3000', {
      query: { role: 'admin' }
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('✅ Admin connecté');
    });

    newSocket.on('ride:new', (ride: Ride) => {
      console.log('🆕 Nouvelle course:', ride);
      setRides(prev => [ride, ...prev]);
    });

    newSocket.on('ride:update', (update: Partial<Ride> & { id: string }) => {
      setRides(prev => prev.map(r => 
        r.id === update.id ? { ...r, ...update } : r
      ));
    });

    newSocket.on('driver:location', (data: { rideId: string; location: any }) => {
      setRides(prev => prev.map(r => 
        r.id === data.rideId 
          ? { ...r, driver: { ...r.driver!, location: data.location } }
          : r
      ));
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h2 style={{ marginBottom: '20px' }}>
        🚲 Courses Tricycle en direct ({rides.length})
      </h2>

      {rides.length === 0 ? (
        <p style={{ color: '#666' }}>Aucune course en cours...</p>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {rides.map(ride => (
            <div
              key={ride.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                padding: '16px',
                backgroundColor: ride.status === 'pending' ? '#fef3c7' : '#f0fdf4',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong style={{ fontSize: '14px' }}>
                  {ride.pickup.address} → {ride.destination.address}
                </strong>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  backgroundColor: ride.status === 'pending' ? '#f59e0b' : '#22c55e',
                  color: 'white',
                  fontWeight: '600'
                }}>
                  {ride.status}
                </span>
              </div>

              <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', gap: '16px' }}>
                <span>💰 {ride.price.toLocaleString()} FCFA</span>
                <span>📦 {ride.service}</span>
                <span>👤 {ride.clientId?.slice(0, 8)}</span>
              </div>

              {ride.driver?.location && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#0ea5e9' }}>
                  📍 {ride.driver.location.lat.toFixed(4)}, {ride.driver.location.lng.toFixed(4)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}