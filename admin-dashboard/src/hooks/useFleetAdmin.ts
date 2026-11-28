/** Source de vérité : API REST ADMIN paginée, pas une liste Socket.IO limitée à 100. */
import { useCallback, useEffect, useState } from 'react';
import { adminTransportService, getTransportError, type FleetVehicle } from '../services/adminTransportService';

export type { FleetVehicle } from '../services/adminTransportService';

export function useFleetAdmin() {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const rows = await adminTransportService.vehicles(signal);
      if (signal?.aborted) return;
      setVehicles(rows);
      setLoadedAt(new Date());
      setConnected(true);
      setError(null);
    } catch (err) {
      if (signal?.aborted) return;
      setConnected(false);
      setError(getTransportError(err));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    void refresh(abortController.signal);
    const interval = window.setInterval(() => void refresh(abortController.signal), 30_000);
    return () => { abortController.abort(); window.clearInterval(interval); };
  }, [refresh]);

  // refresh utilisé comme handler React sans argument.
  return { vehicles, loading, connected, error, loadedAt, refresh: () => void refresh() };
}

export function validCoordinates(vehicle: FleetVehicle): [number, number] | null {
  const lat = vehicle.position?.lat;
  const lng = vehicle.position?.lng;
  return typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? [lat, lng] : null;
}
