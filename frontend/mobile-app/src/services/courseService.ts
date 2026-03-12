import api from './api';

export interface CreateCourseData {
  departLatitude: number;
  departLongitude: number;
  departAdresse: string;
  destinationLatitude: number;
  destinationLongitude: number;
  destinationAdresse: string;
  partageTrajet?: boolean;
}

/**
 * Service de gestion des courses
 */
export const courseService = {
  /**
   * Créer une demande de course
   */
  async createCourse(data: CreateCourseData) {
    const response = await api.post('/courses', data);
    return response.data;
  },

  /**
   * Obtenir l'historique des courses
   */
  async getUserCourses() {
    const response = await api.get('/courses');
    return response.data;
  },

  /**
   * Obtenir les détails d'une course
   */
  async getCourseById(courseId: string) {
    const response = await api.get(`/courses/${courseId}`);
    return response.data;
  },

  /**
   * Trouver les conducteurs à proximité
   */
  async findNearbyDrivers(latitude: number, longitude: number, rayon: number = 5) {
    const response = await api.get('/courses/nearby-drivers', {
      params: { latitude, longitude, rayon },
    });
    return response.data;
  },

  /**
   * Accepter une course (conducteur)
   */
  async acceptCourse(courseId: string, conducteurId: string) {
    const response = await api.post(`/courses/${courseId}/accept`, { conducteurId });
    return response.data;
  },

  /**
   * Démarrer une course
   */
  async startCourse(courseId: string, conducteurId: string) {
    const response = await api.post(`/courses/${courseId}/start`, { conducteurId });
    return response.data;
  },

  /**
   * Terminer une course
   */
  async completeCourse(courseId: string, conducteurId: string) {
    const response = await api.post(`/courses/${courseId}/complete`, { conducteurId });
    return response.data;
  },

  /**
   * Noter une course
   */
  async rateCourse(courseId: string, noteConducteur: number, commentaire?: string) {
    const response = await api.post(`/courses/${courseId}/rate`, {
      noteConducteur,
      commentaire,
    });
    return response.data;
  },
};
