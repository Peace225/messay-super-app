import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';
import { Platform } from 'react-native';

// 🌐 L'IP de ton PC sur le réseau Wi-Fi (Corrigée avec la bonne IP : 192.168.1.20)
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.20:5000/api';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// 🔒 INTERCEPTEUR : Ajout du Token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    let state = useAuthStore.getState();
    
    // 1. Si le store dit qu'il charge, on l'attend
    if (state.isLoading) {
      await new Promise(resolve => setTimeout(resolve, 500));
      state = useAuthStore.getState(); 
    }

    let token = state.accessToken;

    // 🚩 2. LA SÉCURITÉ ANTI-401 : Si le token est toujours vide, on lui laisse 
    // une toute dernière chance de se réveiller (très utile sur les vieux téléphones Android)
    if (!token) {
      await new Promise(resolve => setTimeout(resolve, 300));
      token = useAuthStore.getState().accessToken;
    }

    // On évite d'afficher le warning jaune pour le Login et le Register (c'est normal de ne pas avoir de token)
    const isAuthRoute = config.url?.includes('/auth/login') || config.url?.includes('/auth/register');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (!isAuthRoute && __DEV__) {
      console.warn(`[API WARN] Aucun token pour : ${config.url}`);
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// 🔄 INTERCEPTEUR : Gestion des erreurs et Refresh Automatique
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 1. Log détaillé pour le debug
    if (__DEV__) {
      const status = error.response ? error.response.status : 'ERREUR_RESEAU';
      const method = originalRequest.method?.toUpperCase();
      const url = originalRequest.url;
      console.log(`[API ERROR] ${method} ${url} | Status: ${status}`);
      
      if (status === 'ERREUR_RESEAU') {
        console.error("🚩 Ton iPhone ne voit pas le serveur. Vérifie l'IP et le Pare-feu !");
      }
    }

    // 2. LOGIQUE DE REFRESH (Si 401 Unauthorized et pas déjà un retry)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { refreshToken, setTokens, logout } = useAuthStore.getState();
        
        if (!refreshToken) throw new Error('Refresh token manquant');

        // On utilise axios vierge pour éviter une boucle infinie avec l'intercepteur
        const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;
        
        // 💾 Mise à jour du store
        await setTokens(newAccessToken, newRefreshToken || refreshToken);
        
        // 🚀 On relance la requête
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);

      } catch (refreshError) {
        console.log("[AUTH] Échec critique du refresh -> Déconnexion.");
        await useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    // 3. GESTION DU 404 (L'alerte Rouge)
    if (error.response?.status === 404 && __DEV__) {
      if (originalRequest.url?.includes('/auth/refresh')) {
         console.error("🚩 ALERTE : Ton backend n'a pas la route '/api/auth/refresh' ! Ajoute-la dans 'auth.routes.ts' de ton serveur.");
      } else {
         console.error(`🚩 La route ${originalRequest.url} n'existe pas sur le serveur Backend !`);
      }
    }

    return Promise.reject(error);
  }
);

export default api;