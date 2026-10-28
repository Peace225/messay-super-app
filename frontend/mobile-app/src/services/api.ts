
import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

import { useAuthStore } from "../store/authStore";

// ============================================================
// 1. CONFIGURATION DE L'API MESSAY
// ============================================================

// Render est utilisé en développement et en production.
// La variable Expo permet de changer l'URL si nécessaire.

const API_URL = (
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  "https://messay-api.onrender.com/api"
).replace(/\/+$/, "");

const API_TIMEOUT = 90000;

if (__DEV__) {
  console.log("[MESSAY API] URL :", API_URL);
}

// ============================================================
// 2. CLIENT AXIOS
// ============================================================

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ============================================================
// 3. TYPES INTERNES
// ============================================================

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

type RefreshTokenResponse = {
  accessToken: string;
  refreshToken?: string;
};

// Empêche le renouvellement sur les routes de connexion.
function isAuthEndpoint(url?: string): boolean {
  return /(?:^|\/)auth\/(?:login|register|refresh)(?:\/|$|\?)/i.test(
    url ?? ""
  );
}

// Une seule demande de refresh à la fois.
let refreshPromise: Promise<string> | null = null;

// ============================================================
// 4. RENOUVELLEMENT DU TOKEN
// ============================================================

async function renewAccessToken(): Promise<string> {
  const {
    refreshToken,
    setTokens,
    logout,
  } = useAuthStore.getState();

  if (!refreshToken) {
    await logout();
    throw new Error("Session expirée : aucun refresh token");
  }

  try {
    // Client Axios séparé pour éviter la boucle
    // des intercepteurs de l'API principale.
    const response = await axios.post<RefreshTokenResponse>(
      `${API_URL}/auth/refresh`,
      { refreshToken },
      {
        timeout: API_TIMEOUT,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    const newAccessToken = response.data?.accessToken;

    const newRefreshToken =
      response.data?.refreshToken || refreshToken;

    if (
      typeof newAccessToken !== "string" ||
      !newAccessToken.trim()
    ) {
      throw new Error(
        "Réponse de renouvellement JWT invalide"
      );
    }

    // Sauvegarde les nouveaux tokens.
    await setTokens(newAccessToken, newRefreshToken);

    if (__DEV__) {
      console.log("[MESSAY AUTH] Token renouvelé");
    }

    return newAccessToken;
  } catch (error: unknown) {
    // Déconnecter uniquement lorsque le serveur
    // confirme que le refresh token est refusé.
    // Une erreur réseau ou un HTTP 5xx ne doit
    // pas supprimer automatiquement la session.
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;

      if (
        status === 400 ||
        status === 401 ||
        status === 403
      ) {
        await useAuthStore.getState().logout();
      }
    }

    if (__DEV__) {
      console.warn(
        "[MESSAY AUTH] Renouvellement impossible"
      );
    }

    throw error;
  }
}

// ============================================================
// 5. INTERCEPTEUR DES REQUÊTES
// ============================================================

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken } = useAuthStore.getState();

    // Les appels login/register/refresh ne doivent
    // pas transmettre un ancien access token.
    if (isAuthEndpoint(config.url)) {
      delete config.headers.Authorization;
      return config;
    }

    if (accessToken) {
      config.headers.Authorization =
        `Bearer ${accessToken}`;
    } else {
      delete config.headers.Authorization;

      if (__DEV__) {
        console.warn(
          "[MESSAY API] Aucun access token :",
          config.url
        );
      }
    }

    return config;
  },
  (error: unknown) => Promise.reject(error)
);

// ============================================================
// 6. INTERCEPTEUR DES RÉPONSES
// ============================================================

api.interceptors.response.use(
  (response) => response,

  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error);
    }

    const originalRequest =
      error.config as RetryableRequestConfig | undefined;

    const status = error.response?.status;

    if (__DEV__) {
      console.warn(
        "[MESSAY API]",
        originalRequest?.method?.toUpperCase() ?? "REQUEST",
        originalRequest?.url ?? "UNKNOWN",
        status ?? "NETWORK_ERROR"
      );
    }

    // Aucune tentative de refresh si :
    // - ce n'est pas une erreur 401 ;
    // - la requête a déjà été rejouée ;
    // - l'erreur provient d'une route auth ;
    // - Axios ne fournit pas de requête initiale.
    if (
      status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      isAuthEndpoint(originalRequest.url)
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      // Toutes les requêtes en erreur 401 partagent
      // la même opération de renouvellement JWT.
      if (!refreshPromise) {
        refreshPromise = renewAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      const newAccessToken = await refreshPromise;

      originalRequest.headers.Authorization =
        `Bearer ${newAccessToken}`;

      // Rejoue une seule fois la requête initiale.
      return api(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  }
);

// ============================================================
// 7. EXPORT
// ============================================================

export default api;
