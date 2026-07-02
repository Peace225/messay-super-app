import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';
import { Platform } from 'react-native';

// 🌐 Priorité : ENV > Prod Render > Local Dev
const API_URL = process.env.EXPO_PUBLIC_API_URL || 
  (__DEV__ ? 'http://192.168.1.20:5000/api' : 'https://messay-api.onrender.com/api');

console.log('[API] Base URL:', API_URL);

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000, // Augmenté pour Render (cold start)
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// 🔒 INTERCEPTEUR : Ajout du Token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const state = useAuthStore.getState();
    
    // Attend si le store charge
    if (state.isLoading) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const token = useAuthStore.getState().accessToken;
    const isAuthRoute = config.url?.includes('/auth/login') || 
                       config.url?.includes('/auth/register');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (!isAuthRoute && __DEV__) {
      console.warn(`[API] Pas de token pour: ${config.url}`);
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// 🔄 INTERCEPTEUR : Refresh automatique
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (__DEV__) {
      const status = error.response?.status || 'NETWORK';
      console.log(`[API ERROR] ${originalRequest.method?.toUpperCase()} ${originalRequest.url} | ${status}`);
    }

    // Refresh si 401
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { refreshToken, setTokens, logout } = useAuthStore.getState();
        
        if (!refreshToken) throw new Error('No refresh token');

        const response = await axios.post(`${API_URL}/auth/refresh`, { 
          refreshToken 
        });
        
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;
        
        await setTokens(newAccessToken, newRefreshToken || refreshToken);
        
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);

      } catch (refreshError) {
        console.log("[AUTH] Refresh échoué -> logout");
        await useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    // Erreur réseau (Render cold start)
    if (!error.response && __DEV__) {
      console.error("🚩 Erreur réseau. Vérifie l'URL ou attends 50s (Render free tier)");
    }

    return Promise.reject(error);
  }
);

export default api;