import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { getTransportError } from '../services/adminTransportService';

/** Totaux calculés par Prisma : aucun chiffre de démonstration. */
export interface FleetOverviewStats {
  generatedAt: string;
  users: { total: number };
  drivers: { total: number; pendingValidation: number };
  vehicles: {
    total: number;
    disponible: number;
    enCourse: number;
    maintenance: number;
    horsLigne: number;
    autres: number;
  };
  courses: {
    total: number;
    enCours: number;
    terminees: number;
    annulees: number;
  };
}

export function useFleetOverviewStats() {
  const [stats, setStats] = useState<FleetOverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    // La mise à jour périodique conserve les données précédemment reçues.
    try {
      const response = await api.get<FleetOverviewStats>('/admin/transport/stats', { signal });
      if (signal?.aborted) return;
      setStats(response.data);
      setUpdatedAt(new Date());
      setError(null);
    } catch (reason) {
      if (signal?.aborted) return;
      setError(getTransportError(reason));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const timer = window.setInterval(() => void refresh(controller.signal), 30_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [refresh]);

  return { stats, loading, error, updatedAt, refresh: () => void refresh() };
}
