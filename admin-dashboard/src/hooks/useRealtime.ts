import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// Connexion unique au serveur backend
const socket = io('http://127.0.0.1:5000');

/**
 * Hook personnalisé pour écouter des événements temps réel
 * @param eventName Le nom de l'événement défini dans server.ts
 */
export function useRealtime(eventName: string) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    // Écoute l'événement
    socket.on(eventName, (payload) => {
      setData(payload);
    });

    // Nettoyage à la destruction du composant
    return () => { 
      socket.off(eventName); 
    };
  }, [eventName]);

  return data;
}