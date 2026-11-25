import { useAuthStore } from '../store/authStore';

/**
 * Récupère le JWT de la session MESSAY active.
 * Ne crée jamais de jeton fictif.
 * Refuse le checkout si aucune session n'existe.
 */
export function getMessayBackendToken(): string {
  const token = useAuthStore.getState().accessToken;

  if (typeof token !== 'string' || !token.trim()) {
    throw new Error(
      'Session MESSAY absente. Veuillez vous reconnecter.'
    );
  }

  return token.trim();
}
