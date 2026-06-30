import api from './api';

export interface LoginData {
  email: string;
  password: string;
}

/**
 * Service d'authentification pour l'admin MESSAY
 */
export const authService = {
  /**
   * Connexion admin
   */
  async login(data: LoginData) {
    try {
      const response = await api.post('/auth/login', data);
      
      // On extrait les données (attention à bien vérifier la structure de response.data)
      const { user, accessToken, refreshToken } = response.data;

      // 🛑 Sécurité : Vérifier le rôle ADMIN
      if (user.role !== 'ADMIN') {
        throw new Error('Accès refusé. Réservé aux administrateurs.');
      }

      // ✅ Sauvegarde des tokens pour les intercepteurs Axios
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      // On retourne l'objet complet pour le Store
      return { user, accessToken, refreshToken };
      
    } catch (error: any) {
      // On propage l'erreur exacte du backend pour l'afficher sur la LoginPage
      const message = error.response?.data?.message || error.message || "Erreur de connexion";
      throw new Error(message);
    }
  },

  /**
   * Déconnexion
   */
  logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    // Le reste sera nettoyé par le logout du Store Zustand
  },

  /**
   * Vérifier si un token existe toujours
   */
  isAuthenticated() {
    return !!localStorage.getItem('accessToken');
  },
};