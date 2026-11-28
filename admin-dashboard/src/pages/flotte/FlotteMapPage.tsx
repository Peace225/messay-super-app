import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FleetConnection, FleetHeading, StatusTag } from '../../components/flotte/FlotteUI';
import { validCoordinates, useFleetAdmin, type FleetVehicle } from '../../hooks/useFleetAdmin';

const center: [number, number] = [5.345317, -4.024429];
type LocatedVehicle = { vehicle: FleetVehicle; coords: [number, number] };

function iconFor(color: string): L.DivIcon {
  return L.divIcon({
    className: 'messay-fleet-map-marker',
    html: `<span style="display:block;width:19px;height:19px;border:3px solid white;border-radius:50%;background:${color};box-shadow:0 2px 8px #33415560"></span>`,
    iconSize: [19, 19], iconAnchor: [9, 9],
  });
}
const markerReady = iconFor('#059669');
const markerBusy = iconFor('#ea580c');
const markerOther = iconFor('#64748b');

function FitBounds({ locations }: { locations: LocatedVehicle[] }) {
  const map = useMap();
  useEffect(() => {
    if (!locations.length) return;
    const bounds = L.latLngBounds(locations.map(loc => loc.coords));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [locations, map]);
  return null;
}

export default function FlotteMapPage() {
  const fleet = useFleetAdmin();
  const positions = useMemo((): LocatedVehicle[] => fleet.vehicles.flatMap(vehicle => {
    const coords = validCoordinates(vehicle);
    return coords ? [{ vehicle, coords }] : [];
  }), [fleet.vehicles]);
  return <main className="space-y-5 p-4 md:p-6">
    <FleetHeading title="Carte de la flotte" subtitle="Localisation des dernières positions GPS enregistrées pour les véhicules de la flotte."/>
    <FleetConnection {...fleet}/>
    <div className="flex flex-wrap items-center gap-5 text-xs font-semibold text-gray-600">
      <span>🟢 Disponible</span><span>🟠 En course</span><span>⚪ Autre statut</span>
      <span>{fleet.loadedAt ? positions.length : '—'} position(s) valide(s)</span>
    </div>
    <div className="h-[520px] overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-sm md:h-[650px]">
      <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
        <FitBounds locations={positions}/>
        {positions.map(({ vehicle, coords }) => (
          <Marker key={vehicle.id} position={coords} icon={vehicle.status === 'DISPONIBLE' ? markerReady : vehicle.status === 'EN_COURSE' ? markerBusy : markerOther}>
            <Popup>
              <strong>{vehicle.immatriculation || vehicle.id}</strong>
              <p>{vehicle.chauffeur || 'Conducteur non affecté'}</p>
              <StatusTag status={vehicle.status}/>
              <p>Dernière vitesse : {typeof vehicle.vitesse === 'number' ? `${vehicle.vitesse} km/h` : 'Non disponible'}</p>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
    {fleet.loadedAt && !positions.length && <p className="text-sm text-gray-500">Aucune coordonnée GPS valide n'a été reçue.</p>}
  </main>;
}
