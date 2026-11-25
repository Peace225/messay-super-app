import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

import { useAuthStore } from '../store/authStore';

// ============================================================
// 1. CONFIGURATION DE L'API MESSAY
// ============================================================

const API_URL = (
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  'https://messay-api.onrender.com/api'
).replace(/\/+$/, '');

const API_TIMEOUT = 90_000;

if (__DEV__) {
  console.log('[MESSAY API] URL :', API_URL);
}

// ============================================================
// 2. CLIENT AXIOS
// ============================================================

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ============================================================
// 3. TYPES ET ROUTES D'AUTHENTIFICATION PUBLIQUES
// ============================================================

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _sentAccessToken?: string;
  _sentUserId?: string;
};

type RefreshTokenResponse = {
  accessToken: string;
  refreshToken?: string;
};

/** Les endpoints publics d'auth ne doivent pas utiliser un JWT ancien
 * ni déclencher un refresh automatique après un HTTP 401.
 */
function isAuthEndpoint(url?: string): boolean {
  if (!url) return false;

  // Accepte les chemins /auth/*, auth/* et /api/auth/*,
  // y compris lorsqu'ils contiennent une query string.
  let pathname = url.split('?')[0];
  try {
    pathname = new URL(url, `${API_URL}/`).pathname;
  } catch {
    // Le chemin brut est exploitable pour la vérification ci-dessous.
  }

  return /(?:^|\/)auth\/(?:login|register|refresh|verify-otp|otp\/(?:request|verify))(?:\/|$)/i.test(
    pathname
  );
}

/** Evite d'envoyer par erreur le JWT MESSAY vers un hôte externe
 * si un appel Axios reçoit une URL absolue.
 */
function isExternalUrl(url?: string): boolean {
  if (!url || !/^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(url)) return false;

  try {
    return new URL(url, API_URL).origin !== new URL(API_URL).origin;
  } catch {
    return true;
  }
}

// Une seule demande de renouvellement en cours pour toutes les requêtes.
let refreshPromise: Promise<string> | null = null;

// ============================================================
// 4. RENOUVELLEMENT DU TOKEN
// ============================================================

async function renewAccessToken(): Promise<string> {
  const stateBefore = useAuthStore.getState();
  const oldRefreshToken = stateBefore.refreshToken;
  const userId = stateBefore.user?.id;

  if (!oldRefreshToken || !userId) {
    await stateBefore.logout();
    throw new Error('Session expirée : veuillez vous reconnecter.');
  }

  try {
    // Client séparé : aucune boucle dans les intercepteurs principaux.
    const { data } = await axios.post<RefreshTokenResponse>(
      `${API_URL}/auth/refresh`,
      { refreshToken: oldRefreshToken },
      {
        timeout: API_TIMEOUT,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    if (typeof data?.accessToken !== 'string' || !data.accessToken.trim()) {
      throw new Error('Réponse de renouvellement JWT invalide.');
    }

    const nextRefreshToken = data.refreshToken || oldRefreshToken;

    // Un logout ou une autre connexion peut intervenir pendant l'appel.
    // Ne surtout pas réactiver l'ancienne session dans ce cas.
    const current = useAuthStore.getState();
    if (
      current.user?.id !== userId ||
      current.refreshToken !== oldRefreshToken
    ) {
      throw new Error('La session a changé pendant le renouvellement.');
    }

    await current.setTokens(data.accessToken, nextRefreshToken);

    if (__DEV__) console.log('[MESSAY AUTH] Token renouvelé');
    return data.accessToken;
  } catch (error: unknown) {
    // Ne déconnecter que lorsque le backend a REFUSÉ le refresh token.
    // Ne pas effacer les sessions en cas de panne réseau ou HTTP 5xx.
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 400 || status === 401 || status === 403) {
        const current = useAuthStore.getState();
        if (
          current.user?.id === userId &&
          current.refreshToken === oldRefreshToken
        ) {
          await current.logout();
        }
      }
    }

    if (__DEV__) {
      console.warn('[MESSAY AUTH] Renouvellement impossible');
    }
    throw error;
  }
}

// ============================================================
// 5. INTERCEPTEUR DES REQUÊTES
// ============================================================

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const request = config as RetryableRequestConfig;
    const { accessToken, user } = useAuthStore.getState();

    if (isAuthEndpoint(request.url) || isExternalUrl(request.url)) {
      delete request.headers.Authorization;
      request._sentAccessToken = undefined;
      request._sentUserId = undefined;
      return request;
    }

    if (accessToken) {
      request.headers.Authorization = `Bearer ${accessToken}`;
      request._sentAccessToken = accessToken;
      request._sentUserId = user?.id;
    } else {
      delete request.headers.Authorization;
      request._sentAccessToken = undefined;
      request._sentUserId = undefined;
    }

    return request;
  },
  (error: unknown) => Promise.reject(error)
);

// ============================================================
// 6. INTERCEPTEUR DES RÉPONSES
// ============================================================

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);

    const request = error.config as RetryableRequestConfig | undefined;
    const status = error.response?.status;

    if (__DEV__) {
      console.warn(
        '[MESSAY API]',
        request?.method?.toUpperCase() ?? 'REQUEST',
        request?.url ?? 'UNKNOWN',
        status ?? 'NETWORK_ERROR'
      );
    }

    if (
      status !== 401 ||
      !request ||
      request._retry ||
      !request._sentAccessToken ||
      isAuthEndpoint(request.url) ||
      isExternalUrl(request.url)
    ) {
      return Promise.reject(error);
    }

    // Une réponse tardive ne peut pas être rejouée avec le compte
    // d'un autre utilisateur si celui-ci s'est connecté entre-temps.
    const current = useAuthStore.getState();
    if (!current.user || current.user.id !== request._sentUserId) {
      return Promise.reject(error);
    }

    request._retry = true;

    try {
      // Si une autre requête a DÉJÀ renouvelé le JWT, le réutiliser.
      // Cela évite une seconde rotation avec un ancien refresh token.
      const latestToken = useAuthStore.getState().accessToken;
      if (latestToken && latestToken !== request._sentAccessToken) {
        return api(request);
      }

      if (!refreshPromise) {
        refreshPromise = renewAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      await refreshPromise;

      // L'intercepteur de requête insérera le token le plus récent.
      return api(request);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  }
);

export default api;
