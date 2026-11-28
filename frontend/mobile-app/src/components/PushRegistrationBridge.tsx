import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { registerForPushNotifications } from '../services/pushNotifications';
import { savePushDeviceOnBackend } from '../services/pushDeviceApi';

/**
 * N'affiche aucun écran. Enregistre le téléphone uniquement lorsqu'une
 * session MESSAY valide est disponible, puis au retour au premier plan.
 * Les requêtes annulées ne doivent jamais lier un ancien compte au nouveau.
 */
export default function PushRegistrationBridge() {
  const userId = useAuthStore(state => state.user?.id ?? null);
  const accessToken = useAuthStore(state => state.accessToken);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const isLoading = useAuthStore(state => state.isLoading);
  const [foregroundRevision, setForegroundRevision] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        setForegroundRevision(value => value + 1);
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !userId || !accessToken) return;

    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      try {
        const expoPushToken = await registerForPushNotifications();
        if (cancelled || !expoPushToken) return;
        await savePushDeviceOnBackend(accessToken, expoPushToken, controller.signal);
        if (!cancelled) console.info('[MESSAY/PUSH] Appareil enregistré.');
      } catch (error) {
        if (!cancelled) {
          console.warn('[MESSAY/PUSH] Enregistrement indisponible :',
            error instanceof Error ? error.message : 'Erreur inconnue');
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isLoading, isAuthenticated, userId, accessToken, foregroundRevision]);

  return null;
}
