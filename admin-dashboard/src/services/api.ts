import axios, { AxiosInstance } from 'axios';

// 💡 CONSEIL : Utilise 127.0.0.1 au lieu de localhost pour éviter les conflits IPv6 sur Windows
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

/**
 * Instance Axios configurée pour l'API MESSAY
 */
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000, // Réduit à 10s pour détecter plus vite les erreurs réseau
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur de requête : Ajoute le token si présent
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercepteur de réponse : Gestion des erreurs et déconnexion automatique
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 1. Si le serveur ne répond pas (ERR_CONNECTION_REFUSED)
    if (!error.response) {
      console.error("🌐 Erreur Réseau : Le serveur Messay est peut-être éteint.");
      return Promise.reject(error);
    }

    // 2. Gestion du 401 (Non autorisé)
    // 🚩 IMPORTANT : On ne redirige PAS si on est déjà sur la page /login
    if (error.response.status === 401 && !window.location.pathname.includes('/login')) {
      console.warn("🔐 Session expirée ou invalide, redirection...");
      
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      
      // Utilise replace pour éviter de polluer l'historique
      window.location.replace('/login');
    }

    return Promise.reject(error);
  }
);

export default api;