import api from './api';

/**
 * Service pour la gestion des utilisateurs
 */
export const userService = {
  /**
   * Obtenir tous les utilisateurs
   */
  async getUsers() {
    try {
      const response = await api.get('/users');
      return response.data.users || [];
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs:', error);
      return [];
    }
  },

  /**
   * Obtenir un utilisateur par ID
   */
  async getUserById(id: string) {
    const response = await api.get(`/users/${id}`);
    return response.data.user;
  },

  /**
   * Bloquer/Débloquer un utilisateur
   */
  async toggleUserStatus(id: string) {
    const response = await api.patch(`/users/${id}/toggle-status`);
    return response.data;
  },

  /**
   * Supprimer un utilisateur
   */
  async deleteUser(id: string) {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },
};
