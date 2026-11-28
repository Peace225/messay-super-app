import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

export interface InterurbanTicket {
  id: string;
  compagnie: string;
  passager: string;
  telephone?: string | null;
  trajet?: string | null;
  date?: string | null;
  heure?: string | null;
  prix?: number | null;
  siege?: string | null;
  paiement?: string | null;
  statut?: string | null;
  gareDepart?: string | null;
  gareArrivee?: string | null;
}
const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api').replace(/\/api\/?$/, '')).replace(/\/+$/, '');
export function useTicketsAdmin() {
  const [tickets, setTickets] = useState<InterurbanTicket[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<number | null>(null);
  const clearTimer = useCallback(() => { if (timerRef.current !== null) window.clearTimeout(timerRef.current); timerRef.current = null; }, []);
  const refresh = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected) { setError('Socket.IO déconnecté.'); setLoading(false); return; }
    setLoading(true); setError(null); clearTimer();
    socket.emit('tickets:get-today');
    timerRef.current = window.setTimeout(() => { setLoading(false); setError('Aucune réponse à la demande des billets. Vérifiez le rôle ADMIN.'); }, 12_000);
  }, [clearTimer]);
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { setLoading(false); setError('Session ADMIN absente. Reconnectez-vous.'); return; }
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'], reconnection: true, autoConnect: false });
    socketRef.current = socket;
    const onConnect = () => { setConnected(true); socket.emit('join-admin-panel'); refresh(); };
    const onDisconnect = () => { setConnected(false); setLoading(false); clearTimer(); setError('Connexion aux billets interrompue.'); };
    const onConnectError = (e: Error) => { setConnected(false); setLoading(false); clearTimer(); setError(e.message); };
    const onList = (payload: unknown) => {
      clearTimer(); setLoading(false);
      if (!Array.isArray(payload)) { setError('Réponse tickets invalide.'); return; }
      setTickets(payload.filter((t): t is InterurbanTicket => Boolean(t && typeof t === 'object' && typeof t.id === 'string')));
      setUpdatedAt(new Date()); setError(null);
    };
    const onServerError = (e: { message?: string }) => { clearTimer(); setLoading(false); setError(e?.message || 'Erreur serveur.'); };
    socket.on('connect', onConnect);socket.on('disconnect', onDisconnect);socket.on('connect_error',onConnectError);socket.on('tickets:list',onList);socket.on('server:error',onServerError);
    socket.connect();
    const interval = window.setInterval(() => { if (socket.connected) refresh(); }, 30_000);
    return () => { window.clearInterval(interval);clearTimer();socket.off('connect',onConnect);socket.off('disconnect',onDisconnect);socket.off('connect_error',onConnectError);socket.off('tickets:list',onList);socket.off('server:error',onServerError);socket.disconnect();socketRef.current=null; };
  }, [clearTimer, refresh]);
  return { tickets, connected, loading, error, updatedAt, refresh };
}
