/** Toutes les courses du système via GET /api/admin/transport/courses. */
import { useCallback, useEffect, useState } from 'react';
import { adminTransportService, getTransportError, type AdminCourse } from '../services/adminTransportService';

export type { AdminCourse } from '../services/adminTransportService';
export function useAdminCourses() {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const rows = await adminTransportService.courses(signal);
      if (signal?.aborted) return;
      setCourses(rows);
      setUpdatedAt(new Date());
      setError(null);
    } catch (err) {
      if (!signal?.aborted) setError(getTransportError(err));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const interval = window.setInterval(() => void refresh(controller.signal), 30_000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [refresh]);
  return { courses, loading, error, updatedAt, refresh: () => void refresh(), limitedScope: false };
}
