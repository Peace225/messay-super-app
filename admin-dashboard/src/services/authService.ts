import axios from 'axios';
import api from './api';
import { useAuthStore, type AdminUser } from '../store/authStore';

export interface LoginData {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  user: AdminUser;
  accessToken: string;
  refreshToken: string;
}

function isAdminLoginResponse(value: unknown): value is AdminLoginResponse {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Partial<AdminLoginResponse>;
  return (
    !!result.user &&
    typeof result.user.id === 'string' &&
    result.user.role === 'ADMIN' &&
    typeof result.accessToken === 'string' &&
    result.accessToken.length > 0 &&
    typeof result.refreshToken === 'string' &&
    result.refreshToken.length > 0
  );
}

export const authService = {
  async login(data: LoginData): Promise<AdminLoginResponse> {
    try {
      const response = await api.post<unknown>('/auth/login', {
        email: data.email.trim().toLowerCase(),
        password: data.password,
      });
      const result = response.data;

      if (
        typeof result === 'object' && result !== null &&
        'user' in result &&
        typeof result.user === 'object' && result.user !== null &&
        'role' in result.user && result.user.role !== 'ADMIN'
      ) {
        throw new Error('Accès refusé : ce compte n’est pas administrateur.');
      }

      if (!isAdminLoginResponse(result)) {
        throw new Error('Réponse de connexion ADMIN incomplète.');
      }

      // L'intercepteur Axios et le store utilisent exactement ces deux clés.
      localStorage.setItem('accessToken', result.accessToken);
      localStorage.setItem('refreshToken', result.refreshToken);
      return result;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data as
          | { error?: string; message?: string }
          | undefined;
        if (error.response?.status === 401) {
          throw new Error('Adresse e-mail ou mot de passe incorrect.');
        }
        if (error.response?.status === 403) {
          throw new Error('Accès refusé au Dashboard Administrateur.');
        }
        throw new Error(
          data?.error || data?.message ||
            (error.response
              ? 'Connexion MESSAY impossible.'
              : 'Serveur API MESSAY inaccessible.'),
        );
      }
      throw error;
    }
  },

  logout(): void {
    // Une seule source de vérité : purge les tokens ET l'état Zustand.
    useAuthStore.getState().logout();
  },

  isAuthenticated(): boolean {
    const state = useAuthStore.getState();
    return (
      state.hasHydrated &&
      state.isAuthenticated &&
      state.user?.role === 'ADMIN' &&
      typeof window !== 'undefined' &&
      Boolean(localStorage.getItem('accessToken')) &&
      Boolean(localStorage.getItem('refreshToken'))
    );
  },
};
