import api from './api';

/**
 * Service pour les statistiques du dashboard
 */
export const statsService = {
  /**
   * Obtenir les statistiques générales
   */
  async getStats() {
    try {
      const [usersRes, coursesRes, conducteursRes] = await Promise.all([
        api.get('/users'),
        api.get('/courses'),
        api.get('/conducteurs'),
      ]);

      const users = usersRes.data.users || [];
      const courses = coursesRes.data.courses || [];
      const conducteurs = conducteursRes.data.conducteurs || [];

      // Calculer les revenus totaux
      const totalRevenue = courses.reduce((sum: number, course: any) => {
        return sum + (course.prix || 0);
      }, 0);

      // Compter les conducteurs actifs
      const activeConducteurs = conducteurs.filter((c: any) => c.statut === 'DISPONIBLE').length;

      return {
        totalUsers: users.length,
        totalCourses: courses.length,
        totalRevenue,
        activeConducteurs,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des stats:', error);
      // Retourner des données par défaut en cas d'erreur
      return {
        totalUsers: 0,
        totalCourses: 0,
        totalRevenue: 0,
        activeConducteurs: 0,
      };
    }
  },

  /**
   * Obtenir les données du graphique de la semaine
   */
  async getWeeklyData() {
    try {
      const response = await api.get('/courses/weekly-stats');
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des données hebdomadaires:', error);
      // Retourner des données par défaut
      return [
        { name: 'Lun', courses: 0, revenue: 0 },
        { name: 'Mar', courses: 0, revenue: 0 },
        { name: 'Mer', courses: 0, revenue: 0 },
        { name: 'Jeu', courses: 0, revenue: 0 },
        { name: 'Ven', courses: 0, revenue: 0 },
        { name: 'Sam', courses: 0, revenue: 0 },
        { name: 'Dim', courses: 0, revenue: 0 },
      ];
    }
  },
};
