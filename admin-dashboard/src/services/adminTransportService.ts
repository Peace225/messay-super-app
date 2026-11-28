import api from './api';

export interface TransportUser {
  id: string;
  nom: string;
  prenom: string | null;
  telephone: string | null;
  email: string | null;
  role: string;
  isVerified: boolean;
  isBlocked: boolean;
  createdAt: string;
}

export interface AdminDriver {
  id: string;
  userId: string;
  isVerified: boolean;
  disponible: boolean;
  isAvailable: boolean;
  statut: string;
  permis: string | null;
  numeroPermis: string | null;
  immatriculation: string | null;
  user: TransportUser;
  tricycle: { id: string; immatriculation: string; modele: string | null; status: string } | null;
}

export interface FleetVehicle {
  id: string;
  immatriculation: string;
  modele: string | null;
  annee: number | null;
  status: string;
  batterie: number | null;
  vitesse: number | null;
  coursesAujourdhui: number | null;
  distanceParcourue: number | null;
  derniereActivite: string | null;
  createdAt: string | null;
  conducteurId: string;
  chauffeur: string | null;
  chauffeurTel: string | null;
  position: { lat: number | null; lng: number | null };
}

export interface AdminCourse {
  id: string;
  statut: string;
  createdAt: string;
  departAdresse: string | null;
  destinationAdresse: string | null;
  prix: number | null;
  prixFinal: number | null;
  distance: number | null;
  dureeEstimee: number | null;
  heureDebut: string | null;
  user: { nom: string; prenom?: string | null; telephone?: string | null } | null;
  conducteur: { user: { nom: string; prenom?: string | null; telephone?: string | null } } | null;
}

export interface DriverRegistration {
  nom: string;
  prenom: string;
  telephone: string;
  email?: string;
  permis: string;
  numeroPermis: string;
  immatriculation: string;
  modele: string;
  annee: number;
}

export interface CreatedDriver {
  conducteur: {
    id: string; userId: string; nom: string; prenom: string;
    telephone: string; email: string | null; isVerified: boolean;
  };
  tricycle: { id: string; immatriculation: string };
  connexion: { identifiant: string; motDePasseTemporaire: string };
  message: string;
}

interface PageResult<T> { items: T[]; total: number; page: number; limit: number }

/** Récupère la liste complète par pages (max 2 000 éléments pour éviter un écran ingérable). */
async function fetchList<T>(segment: string, signal?: AbortSignal): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await api.get<PageResult<T>>(`/admin/transport/${segment}`, {
      params: { page, limit: 100 }, signal,
    });
    if (!res.data || !Array.isArray(res.data.items)) {
      throw new Error(`Réponse du serveur non reconnue : ${segment}`);
    }
    rows.push(...res.data.items);
    if (rows.length >= res.data.total || res.data.items.length < 100) return rows;
  }
  throw new Error(`Limite de 2 000 éléments atteinte pour ${segment} : ajouter la pagination serveur.`);
}

export const adminTransportService = {
  users: (signal?: AbortSignal) => fetchList<TransportUser>('users', signal),
  drivers: (signal?: AbortSignal) => fetchList<AdminDriver>('conducteurs', signal),
  vehicles: (signal?: AbortSignal) => fetchList<FleetVehicle>('tricycles', signal),
  courses: (signal?: AbortSignal) => fetchList<AdminCourse>('courses', signal),
  createDriver: async (payload: DriverRegistration) => {
    const response = await api.post<CreatedDriver>('/admin/transport/conducteurs', payload);
    return response.data;
  },
  verifyDriver: async (id: string, verified: boolean) => {
    await api.patch(`/admin/transport/conducteurs/${encodeURIComponent(id)}/verification`, { verified });
  },
  blockDriver: async (id: string, blocked: boolean) => {
    await api.patch(`/admin/transport/conducteurs/${encodeURIComponent(id)}/block`, { blocked });
  },
  changeVehicleStatus: async (id: string, status: 'DISPONIBLE' | 'MAINTENANCE' | 'HORS_LIGNE') => {
    await api.patch(`/admin/transport/tricycles/${encodeURIComponent(id)}/status`, { status });
  },
};

export function getTransportError(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as {
      response?: { status?: number; data?: { error?: string; message?: string } };
    }).response;
    if (response?.status === 401) return 'HTTP 401 : session absente ou expirée. Se reconnecter en ADMIN.';
    if (response?.status === 403) return 'HTTP 403 : rôle ADMIN requis ou compte bloqué.';
    if (response?.status === 404) return 'HTTP 404 : route /api/admin/transport introuvable. Vérifier le montage Express.';
    if (response?.status === 500) return 'HTTP 500 : erreur backend ou PostgreSQL. Consulter les logs du serveur.';
    if (response?.status && response.status >= 400) {
      return `HTTP ${response.status} : ${response.data?.error || response.data?.message || 'Requête refusée'}`;
    }
  }
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: string }).code;
    if (code === 'ERR_NETWORK' || code === 'ECONNABORTED') {
      return 'Réseau inaccessible : vérifier le backend (5000), VITE_API_URL et les origines CORS.';
    }
  }
  return error instanceof Error ? error.message : 'Erreur inconnue pendant la requête ADMIN';
}
