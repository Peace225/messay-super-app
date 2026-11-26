
import api from './api';

export type CourseStatus =
  | 'EN_ATTENTE'
  | 'ACCEPTEE'
  | 'EN_COURS'
  | 'TERMINEE'
  | 'ANNULEE';

export interface CreateCourseData {
  departLatitude: number;
  departLongitude: number;
  departAdresse: string;
  destinationLatitude: number;
  destinationLongitude: number;
  destinationAdresse: string;
  partageTrajet?: boolean;
}

export interface Course {
  id: string;
  userId: string;
  conducteurId: string | null;
  departLatitude: number;
  departLongitude: number;
  departAdresse: string;
  destinationLatitude: number;
  destinationLongitude: number;
  destinationAdresse: string;
  prix: number;
  prixFinal: number | null;
  distance: number;
  dureeEstimee: number;
  duree: number | null;
  statut: CourseStatus;
  createdAt: string;
  heureDebut: string | null;
  heureFin: string | null;
  noteConducteur: number | null;
  commentaire: string | null;
  user?: {
    id?: string;
    nom: string;
    prenom: string | null;
    telephone?: string;
    photo?: string | null;
  };
  conducteur?: {
    id: string;
    rating: number;
    user: {
      nom: string;
      prenom: string | null;
      telephone: string;
      photo: string | null;
    };
    tricycle?: {
      modele: string;
      immatriculation: string;
    } | null;
  } | null;
}

export interface NearbyDriver {
  id: string;
  rating: number;
  vehiculeType: string;
  positionLatitude: number;
  positionLongitude: number;
  distanceKm: number;
  user: {
    nom: string;
    prenom: string | null;
    photo: string | null;
  };
  tricycle: { modele: string } | null;
}

export interface WeeklyStats {
  totalRevenus: number;
  totalCourses: number;
  totalUsers?: number;
  activeConducteurs?: number;
}

export interface CourseActionResponse {
  message: string;
  course: Course;
}

function coursePath(courseId: string): string {
  if (typeof courseId !== 'string' || !courseId.trim()) {
    throw new Error('Identifiant de course obligatoire');
  }

  return `/courses/${encodeURIComponent(courseId.trim())}`;
}

/**
 * MESSAY - Service de gestion des courses
 * Authentification JWT gérée par api.ts.
 * Permissions et transitions validées par le backend.
 */
export const courseService = {

  // 1. Créer une course
  async createCourse(data: CreateCourseData): Promise<Course> {
    const response = await api.post<Course>('/courses', data);
    return response.data;
  },

  // 2. Historique client
  async getUserCourses(): Promise<Course[]> {
    const response = await api.get<Course[]>('/courses');
    return response.data;
  },

  // 3. Détail d'une course
  async getCourseById(courseId: string): Promise<Course> {
    const response = await api.get<Course>(coursePath(courseId));
    return response.data;
  },

  // 4. Conducteurs proches
  async findNearbyDrivers(
    latitude: number,
    longitude: number,
    rayon: number = 5
  ): Promise<NearbyDriver[]> {
    const response = await api.get<NearbyDriver[]>(
      '/courses/nearby-drivers',
      {
        params: {
          lat: latitude,
          lng: longitude,
          rayon,
        },
      }
    );

    return response.data;
  },

  // 5. Radar : courses disponibles
  async getAvailableCourses(): Promise<Course[]> {
    const response = await api.get<Course[]>('/courses/disponibles');
    return response.data;
  },

  // 6. Courses du conducteur connecté
  async getConducteurCourses(): Promise<Course[]> {
    const response = await api.get<Course[]>(
      '/courses/mine/conducteur'
    );

    return response.data;
  },

  // 7. Statistiques hebdomadaires
  async getWeeklyStats(): Promise<WeeklyStats> {
    const response = await api.get<WeeklyStats>(
      '/courses/weekly-stats'
    );

    return response.data;
  },

  // 8. Accepter une course
  async acceptCourse(
    courseId: string
  ): Promise<CourseActionResponse> {
    const response = await api.patch<CourseActionResponse>(
      `${coursePath(courseId)}/accepter`
    );

    return response.data;
  },

  // 9. Démarrer une course
  async startCourse(
    courseId: string
  ): Promise<CourseActionResponse> {
    const response = await api.patch<CourseActionResponse>(
      `${coursePath(courseId)}/demarrer`
    );

    return response.data;
  },

  // 10. Terminer une course
  async completeCourse(
    courseId: string
  ): Promise<CourseActionResponse> {
    const response = await api.patch<CourseActionResponse>(
      `${coursePath(courseId)}/terminer`
    );

    return response.data;
  },

  // 11. Noter le conducteur
  async rateCourse(
    courseId: string,
    noteConducteur: number,
    commentaire?: string
  ): Promise<CourseActionResponse> {
    const response = await api.post<CourseActionResponse>(
      `${coursePath(courseId)}/rate`,
      {
        noteConducteur,
        ...(commentaire !== undefined ? { commentaire } : {}),
      }
    );

    return response.data;
  },
};
