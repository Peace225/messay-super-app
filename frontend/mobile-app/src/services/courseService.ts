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
    throw new Error('Identifiant de course obligatoire.');
  }
  return `/courses/${encodeURIComponent(courseId.trim())}`;
}

function assertCoordinate(value: number, min: number, max: number, label: string): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} invalide.`);
  }
}

function validateNewCourse(data: CreateCourseData): void {
  assertCoordinate(data.departLatitude, -90, 90, 'Latitude de départ');
  assertCoordinate(data.departLongitude, -180, 180, 'Longitude de départ');
  assertCoordinate(data.destinationLatitude, -90, 90, 'Latitude de destination');
  assertCoordinate(data.destinationLongitude, -180, 180, 'Longitude de destination');
  if (!data.departAdresse?.trim() || !data.destinationAdresse?.trim()) {
    throw new Error('Les adresses de départ et de destination sont obligatoires.');
  }
}

function isCourse(value: unknown): value is Course {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Course>;
  return typeof candidate.id === 'string' && candidate.id.trim().length > 0 &&
    typeof candidate.statut === 'string' &&
    ['EN_ATTENTE', 'ACCEPTEE', 'EN_COURS', 'TERMINEE', 'ANNULEE'].includes(candidate.statut);
}

function assertCourse(value: unknown, context: string): Course {
  if (!isCourse(value)) {
    throw new Error(`Réponse serveur invalide (${context}) : identifiant ou statut de course absent.`);
  }
  return value;
}

function assertAction(
  value: CourseActionResponse,
  expectedStatus: CourseStatus,
  context: string,
  expectedId: string,
): CourseActionResponse {
  if (!value || typeof value !== 'object') {
    throw new Error(`Réponse serveur invalide (${context}).`);
  }
  const course = assertCourse(value.course, context);
  if (course.id !== expectedId || course.statut !== expectedStatus) {
    throw new Error(`Le serveur n'a pas confirmé ${context}. Actualisez vos courses avant de réessayer.`);
  }
  return value;
}

/**
 * MESSAY — Courses réelles. Le client ne simule aucune réservation ni transition.
 * api.ts assure la transmission du JWT et la configuration de l'URL du serveur.
 * Les autorisations, verrouillages concurrents et transitions restent à contrôler côté backend.
 */
export const courseService = {
  async createCourse(data: CreateCourseData): Promise<Course> {
    validateNewCourse(data);
    const response = await api.post<Course>('/courses', data);
    return assertCourse(response.data, 'création');
  },

  async getUserCourses(): Promise<Course[]> {
    const response = await api.get<Course[]>('/courses');
    if (!Array.isArray(response.data)) throw new Error('Liste des courses invalide.');
    return response.data;
  },

  async getCourseById(courseId: string): Promise<Course> {
    const response = await api.get<Course>(coursePath(courseId));
    const course = assertCourse(response.data, 'consultation');
    if (course.id !== courseId.trim()) throw new Error('Identifiant de course incohérent.');
    return course;
  },

  async findNearbyDrivers(latitude: number, longitude: number, rayon = 5): Promise<NearbyDriver[]> {
    assertCoordinate(latitude, -90, 90, 'Latitude');
    assertCoordinate(longitude, -180, 180, 'Longitude');
    if (!Number.isFinite(rayon) || rayon <= 0 || rayon > 100) {
      throw new Error('Rayon de recherche invalide.');
    }
    const response = await api.get<NearbyDriver[]>('/courses/nearby-drivers', {
      params: { lat: latitude, lng: longitude, rayon },
    });
    if (!Array.isArray(response.data)) throw new Error('Liste des conducteurs invalide.');
    return response.data;
  },

  async getAvailableCourses(): Promise<Course[]> {
    const response = await api.get<Course[]>('/courses/disponibles');
    if (!Array.isArray(response.data)) throw new Error('Liste des courses disponibles invalide.');
    return response.data;
  },

  async getConducteurCourses(): Promise<Course[]> {
    const response = await api.get<Course[]>('/courses/mine/conducteur');
    if (!Array.isArray(response.data)) throw new Error('Liste des courses du conducteur invalide.');
    return response.data;
  },

  async getWeeklyStats(): Promise<WeeklyStats> {
    const response = await api.get<WeeklyStats>('/courses/weekly-stats');
    return response.data;
  },

  async acceptCourse(courseId: string): Promise<CourseActionResponse> {
    const id = courseId.trim();
    const response = await api.patch<CourseActionResponse>(`${coursePath(id)}/accepter`);
    return assertAction(response.data, 'ACCEPTEE', 'l’acceptation', id);
  },

  async startCourse(courseId: string): Promise<CourseActionResponse> {
    const id = courseId.trim();
    const response = await api.patch<CourseActionResponse>(`${coursePath(id)}/demarrer`);
    return assertAction(response.data, 'EN_COURS', 'le démarrage', id);
  },

  async completeCourse(courseId: string): Promise<CourseActionResponse> {
    const id = courseId.trim();
    const response = await api.patch<CourseActionResponse>(`${coursePath(id)}/terminer`);
    return assertAction(response.data, 'TERMINEE', 'la fin de course', id);
  },

  /**
   * Nécessite une route backend PATCH /courses/:id/annuler.
   * Ne prétend jamais avoir annulé une course si le statut n'est pas ANNULEE.
   */
  async cancelCourse(courseId: string): Promise<CourseActionResponse> {
    const id = courseId.trim();
    const response = await api.patch<CourseActionResponse>(`${coursePath(id)}/annuler`);
    return assertAction(response.data, 'ANNULEE', 'l’annulation', id);
  },

  async rateCourse(courseId: string, noteConducteur: number, commentaire?: string): Promise<CourseActionResponse> {
    if (!Number.isInteger(noteConducteur) || noteConducteur < 1 || noteConducteur > 5) {
      throw new Error('La note doit être un entier compris entre 1 et 5.');
    }
    const response = await api.post<CourseActionResponse>(`${coursePath(courseId)}/rate`, {
      noteConducteur,
      ...(commentaire !== undefined ? { commentaire: commentaire.trim() } : {}),
    });
    if (!response.data || !isCourse(response.data.course)) {
      throw new Error('Le serveur n’a pas confirmé la notation.');
    }
    return response.data;
  },
};
