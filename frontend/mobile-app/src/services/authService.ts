import api from './api';
import { useAuthStore } from '../store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RegisterData {
  nom: string;
  prenom?: string;
  email: string;
  telephone: string;
  password: string;
  role?: 'USER' | 'CONDUCTEUR' | 'CHAUFFEUR';
}

export interface LoginData {
  email: string;
  password: string;
}

/**
 * Service d'authentification
 */
export const authService = {
  /**
   * Inscription
   */
  async register(data: RegisterData) {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  /**
   * Connexion
   */
  async login(data: LoginData) {
    const response = await api.post('/auth/login', data);
    const { user, accessToken, refreshToken } = response.data;

    // Sauvegarder dans le store et AsyncStorage
    useAuthStore.getState().setUser(user);
    await useAuthStore.getState().setTokens(accessToken, refreshToken);
    await AsyncStorage.setItem('user', JSON.stringify(user));

    return response.data;
  },

  /**
   * Vérification OTP
   */
  async verifyOTP(telephone: string, otpCode: string) {
    const response = await api.post('/auth/verify-otp', { telephone, otpCode });
    return response.data;
  },

  /**
   * Obtenir le profil utilisateur
   */
  async getProfile() {
    const response = await api.get('/auth/me');
    return response.data;
  },

  /**
   * Déconnexion
   */
  async logout() {
    await useAuthStore.getState().logout();
  },
};
