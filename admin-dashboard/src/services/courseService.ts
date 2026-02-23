import api from './api';

/**
 * Service pour la gestion des courses
 */
export const courseService = {
  /**
   * Obtenir toutes les courses
   */
  async getCourses() {
    try {
      const response = await api.get('/courses');
      return response.data.courses || [];
    } catch (error) {
      console.error('Erreur lors de la récupération des courses:', error);
      return [];
    }
  },

  /**
   * Obtenir une course par ID
   */
  async getCourseById(id: string) {
    const response = await api.get(`/courses/${id}`);
    return response.data.course;
  },

  /**
   * Mettre à jour le statut d'une course
   */
  async updateCourseStatus(id: string, statut: string) {
    const response = await api.patch(`/courses/${id}/status`, { statut });
    return response.data;
  },
};
