
import axios, {
  AxiosHeaders,
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

/**
 * MESSAY Admin — Client HTTP sécurisé.
 *
 * - Ajout automatique du Bearer token.
 * - Renouvellement automatique après HTTP 401.
 * - Une seule requête refresh à la fois.
 * - Une seule nouvelle tentative par requête.
 * - Protection contre les changements de session.
 * - Pas de rechargement forcé du navigateur.
 *
 * Contrat backend attendu :
 * POST /api/auth/refresh
 * Body: { refreshToken: string }
 * Response: { accessToken: string, refreshToken: string }
 */

const API_URL = (
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:5000/api'
).replace(/\/+$/, '');

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

interface RetryableRequest extends InternalAxiosRequestConfig {
  _messayRetry?: boolean;
}

type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

/**
 * Un seul renouvellement pour plusieurs erreurs 401
 * simultanées.
 */
let refreshInProgress: Promise<string> | null = null;

/**
 * Identifie les endpoints d'authentification.
 * Ceux-ci ne doivent jamais déclencher un refresh.
 */
function isAuthEndpoint(url?: string): boolean {
  if (!url) return false;

  return /(?:^|\/)auth\/(?:login|refresh)(?:\/|\?|$)/.test(
    url,
  );
}

function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Supprime uniquement la session qui a réellement
 * échoué. Une connexion plus récente ne doit pas
 * être invalidée par une ancienne requête.
 */
function invalidateExpiredSession(
  expectedRefreshToken: string,
): void {
  const currentRefreshToken = getRefreshToken();

  if (
    !currentRefreshToken ||
    currentRefreshToken !== expectedRefreshToken
  ) {
    return;
  }

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);

  window.dispatchEvent(
    new Event('messay:session-expired'),
  );
}

/**
 * Conserve un instantané du refresh token utilisé,
 * afin de ne pas effacer une nouvelle session.
 */
async function performRefresh(
  savedRefreshToken: string,
): Promise<string> {
  const response = await axios.post<TokenPair>(
    `${API_URL}/auth/refresh`,
    {
      refreshToken: savedRefreshToken,
    },
    {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    },
  );

  const data = response.data;

  if (
    !data ||
    typeof data.accessToken !== 'string' ||
    !data.accessToken.trim() ||
    typeof data.refreshToken !== 'string' ||
    !data.refreshToken.trim()
  ) {
    throw new Error(
      'Réponse de renouvellement invalide.',
    );
  }

  /**
   * Si l'utilisateur s'est déconnecté ou connecté
   * avec un autre compte pendant le refresh,
   * ne jamais écraser ses nouveaux tokens.
   */
  if (getRefreshToken() !== savedRefreshToken) {
    throw new Error(
      'Session modifiée pendant le renouvellement.',
    );
  }

  localStorage.setItem(
    ACCESS_TOKEN_KEY,
    data.accessToken,
  );

  localStorage.setItem(
    REFRESH_TOKEN_KEY,
    data.refreshToken,
  );

  // Synchroniser le store après la rotation complète.
  window.dispatchEvent(
    new Event('messay:tokens-refreshed'),
  );

  return data.accessToken;
}

/**
 * Évite plusieurs appels concurrents à /refresh.
 */
function renewAccessToken(): Promise<string> {
  if (refreshInProgress) {
    return refreshInProgress;
  }

  const savedRefreshToken = getRefreshToken();

  if (!savedRefreshToken) {
    return Promise.reject(
      new Error('Aucun refresh token disponible.'),
    );
  }

  const operation = performRefresh(savedRefreshToken);

  refreshInProgress = operation;

  void operation.then(
    () => {
      if (refreshInProgress === operation) {
        refreshInProgress = null;
      }
    },
    () => {
      if (refreshInProgress === operation) {
        refreshInProgress = null;
      }
    },
  );

  return operation;
}

/**
 * Ajout du JWT sur les requêtes API.
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (isAuthEndpoint(config.url)) {
      return config;
    }

    const token = getAccessToken();

    config.headers = AxiosHeaders.from(config.headers);

    if (token) {
      config.headers.set(
        'Authorization',
        `Bearer ${token}`,
      );
    } else {
      config.headers.delete('Authorization');
    }

    return config;
  },
);

/**
 * Gestion centralisée des erreurs HTTP.
 */
api.interceptors.response.use(
  response => response,

  async (error: AxiosError) => {
    if (error.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }

    const originalRequest =
      error.config as RetryableRequest | undefined;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._messayRetry ||
      isAuthEndpoint(originalRequest.url)
    ) {
      return Promise.reject(error);
    }

    const savedRefreshToken = getRefreshToken();

    if (!savedRefreshToken) {
      return Promise.reject(error);
    }

    originalRequest._messayRetry = true;

    /**
     * Si l'access token a déjà changé pendant que
     * cette requête était en cours, réessayer avec
     * ce nouveau token sans refaire un refresh.
     */
    const requestAuthorization =
      AxiosHeaders.from(
        originalRequest.headers,
      ).get('Authorization');

    const currentAccessToken = getAccessToken();

    if (
      currentAccessToken &&
      requestAuthorization &&
      requestAuthorization !==
        `Bearer ${currentAccessToken}`
    ) {
      originalRequest.headers = AxiosHeaders.from(
        originalRequest.headers,
      );

      originalRequest.headers.set(
        'Authorization',
        `Bearer ${currentAccessToken}`,
      );

      return api(originalRequest);
    }

    try {
      const newAccessToken =
        await renewAccessToken();

      /**
       * La session peut avoir changé pendant
       * l'attente du refresh.
       */
      if (
        !getRefreshToken() ||
        getAccessToken() !== newAccessToken
      ) {
        return Promise.reject(error);
      }

      originalRequest.headers = AxiosHeaders.from(
        originalRequest.headers,
      );

      originalRequest.headers.set(
        'Authorization',
        `Bearer ${newAccessToken}`,
      );

      return api(originalRequest);
    } catch (refreshError: unknown) {
      /**
       * Déconnexion uniquement si le serveur
       * refuse explicitement le refresh token.
       *
       * Pas de déconnexion pour :
       * - erreur réseau
       * - timeout
       * - HTTP 500 / 502 / 503
       */
      if (
        axios.isAxiosError(refreshError) &&
        [400, 401, 403].includes(
          refreshError.response?.status ?? 0,
        )
      ) {
        invalidateExpiredSession(
          savedRefreshToken,
        );
      }

      return Promise.reject(error);
    }
  },
);

export default api;
