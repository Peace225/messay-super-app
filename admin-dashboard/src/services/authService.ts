import api from './api';

export interface LoginData {
  email: string;
  password: string;
}

/**
 * Service d'authentification pour l'admin
 */
export const authService = {
  /**
   * Connexion admin
   */
  async login(data: LoginData) {
    const response = await api.post('/auth/login', data);
    const { user, accessToken, refreshToken } = response.data;

    // Vérifier que c'est un admin
    if (user.role !== 'ADMIN') {
      throw new Error('Accès refusé. Seuls les administrateurs peuvent se connecter.');
    }

    // Sauvegarder les tokens
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));

    return { user, accessToken, refreshToken };
  },

  /**
   * Déconnexion
   */
  logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  },

  /**
   * Obtenir l'utilisateur connecté
   */
  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  /**
   * Vérifier si l'utilisateur est connecté
   */
  isAuthenticated() {
    return !!localStorage.getItem('accessToken');
  },
};
