/**
 * MESSAY PRO — Client API du Dashboard Compagnie.
 *
 * Une seule session Supabase Auth (messayAuth). Le backend vérifie les rôles
 * et détermine company_id. Aucun secret serveur dans le navigateur.
 *
 * IMPORTANT : ventes, sièges libres et occupation ne sont pas déductibles
 * des horaires généraux ni de la capacité d'un bus.
 */
import { messayAuth } from './messaySupabaseAuth';

export interface CompanyProfile {
  id: string;
  name: string;
  telephone: string | null;
  logo_url: string | null;
  gare_name: string | null;
  gare_address: string | null;
  ville_siege?: string | null;
  siege_address?: string | null;
  approval_status?: 'draft' | 'pending' | 'approved' | 'rejected';
}

export type SeatStatus = 'available' | 'held' | 'sold' | 'blocked';

export interface SeatInfo {
  number: number;
  status: SeatStatus;
}

export interface DepartureOccupancy {
  id: string;
  company_id: string;
  departure_at: string;
  from_station: string;
  to_station: string;
  vehicle_registration: string;
  driver_name: string | null;
  capacity: number;
  sold: number;
  held: number;
  blocked: number;
  seats: SeatInfo[];
}

export interface OccupancyResponse {
  departures: DepartureOccupancy[];
}

/** Depart DÉJÀ affecté à un bus : lecture seule, aucune disponibilité garantie. */
export interface AssignedBusDeparture {
  id: string;
  company_id: string;
  gare_id: string;
  destination_id: string;
  horaire_id: string;
  date_depart: string; // YYYY-MM-DD (heure locale Côte d'Ivoire)
  heure_depart: string; // HH:mm
  statut: string;
  numero_bus_snapshot: string | null;
  capacite_snapshot: number;
}

export interface UpcomingAssignedDepartures {
  departures: AssignedBusDeparture[];
  complete: boolean; // false si certains jours n'ont pas répondu
}

export interface CompanyAccess {
  role: string;
  company_id: string;
  gare_ids: string[];
  display_name: string;
}

/** Compatible avec TypeScript `erasableSyntaxOnly: true`. */
export class CompanyDashboardApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'CompanyDashboardApiError';
    this.status = status;
  }
}

/** URL relative pour le proxy Vite ou URL absolue configurée. */
const endpoint = (path: string): string => {
  const root = String(import.meta.env.VITE_API_URL || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '');

  return `${root}${path}`;
};

/** Récupère le JWT de la session Supabase Auth déjà utilisée pour les gares. */
async function accessToken(): Promise<string> {
  let token: string | undefined;

  try {
    const { data, error } = await messayAuth.auth.getSession();
    if (error) {
      throw new CompanyDashboardApiError(
        'Session Supabase indisponible. Reconnectez-vous à MESSAY PRO.',
        401,
      );
    }
    token = data.session?.access_token;
  } catch (error) {
    if (error instanceof CompanyDashboardApiError) throw error;
    throw new CompanyDashboardApiError(
      'Impossible de récupérer la session Supabase Auth.',
      401,
    );
  }

  if (!token) {
    throw new CompanyDashboardApiError(
      'Aucune session Supabase active. Reconnectez-vous à MESSAY PRO.',
      401,
    );
  }

  return token;
}

/** Les contrôles d'appartenance et de permissions sont exécutés côté backend. */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(endpoint(path), {
      ...init,
      headers,
      cache: 'no-store',
    });
  } catch {
    throw new CompanyDashboardApiError(
      'Connexion au backend MESSAY impossible. Vérifiez le serveur et le proxy Vite.',
    );
  }

  if (response.status === 401) {
    throw new CompanyDashboardApiError('Session refusée par le backend MESSAY.', 401);
  }
  if (response.status === 403) {
    throw new CompanyDashboardApiError('Accès refusé à cette compagnie.', 403);
  }
  if (response.status === 404) {
    throw new CompanyDashboardApiError(
      `Endpoint non implémenté dans le backend : ${path.split('?')[0]}`,
      404,
    );
  }
  if (!response.ok) {
    throw new CompanyDashboardApiError(
      `Erreur du backend MESSAY (${response.status}).`,
      response.status,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new CompanyDashboardApiError(
      'Réponse JSON invalide ou vide renvoyée par le backend MESSAY.',
      response.status,
    );
  }
}

/** Route existante : l'identifiant compagnie est issu du JWT validé côté API. */
async function getAccess(): Promise<CompanyAccess> {
  const access = await request<CompanyAccess>('/api/company-dashboard/me/access');

  if (!access || typeof access.company_id !== 'string' || !access.company_id.trim()) {
    throw new CompanyDashboardApiError('Accès compagnie non reconnu par le serveur.', 403);
  }

  return access;
}

/**
 * Route /api/company-dashboard/me non identifiée dans le backend actuel.
 * Lecture minimale et en lecture seule de la compagnie identifiée par /me/access.
 * La RLS Supabase doit autoriser cette lecture. Les champs absents ne sont pas
 * inventés (en particulier le statut d'approbation).
 */
async function getProfile(): Promise<CompanyProfile> {
  const { company_id } = await getAccess();
  const { data, error } = await messayAuth
    .from('companies')
    .select('id,name,logo_url')
    .eq('id', company_id)
    .maybeSingle();

  if (error) {
    throw new CompanyDashboardApiError(
      'Profil compagnie inaccessible via Supabase. Vérifiez la table et les règles RLS de lecture.',
      403,
    );
  }

  if (!data || typeof data.name !== 'string' || !data.name.trim()) {
    throw new CompanyDashboardApiError(
      'Fiche de la compagnie introuvable ou non accessible.',
      404,
    );
  }

  return {
    id: String(data.id),
    name: data.name,
    logo_url: typeof data.logo_url === 'string' ? data.logo_url : null,
    telephone: null,
    gare_name: null,
    gare_address: null,
    ville_siege: null,
    siege_address: null,
    // approval_status volontairement absent : valeur non vérifiée.
  };
}

/**
 * Sept dates successives dans le fuseau d'exploitation de MESSAY (Abidjan).
 * On ne convertit pas les horaires récurrents en départs fictifs.
 */
function nextSevenAbidjanDates(): string[] {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Abidjan', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
  const year = get('year');
  const month = get('month');
  const day = get('day');
  return Array.from({ length: 7 }, (_, index) =>
    new Date(Date.UTC(year, month - 1, day + index, 12)).toISOString().slice(0, 10),
  );
}

function isAssignedDeparture(value: unknown): value is AssignedBusDeparture {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const dep = value as Record<string, unknown>;
  return typeof dep.id === 'string' && dep.id.length > 0 &&
    typeof dep.company_id === 'string' && typeof dep.statut === 'string' &&
    typeof dep.gare_id === 'string' && typeof dep.destination_id === 'string' &&
    typeof dep.date_depart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dep.date_depart) &&
    typeof dep.heure_depart === 'string' && /^\d{2}:\d{2}$/.test(dep.heure_depart) &&
    typeof dep.numero_bus_snapshot !== 'undefined' &&
    (dep.numero_bus_snapshot === null || typeof dep.numero_bus_snapshot === 'string') &&
    typeof dep.capacite_snapshot === 'number' && Number.isFinite(dep.capacite_snapshot);
}

/**
 * GET /api/tickets/departs-programmes?companyId=...&date=...
 * Route du catalogue daté : uniquement les affectations de bus enregistrées.
 * L'identifiant de compagnie vient de /me/access, jamais d'un champ utilisateur.
 * Aucun siège vendu/libre n'est déduit de ces résultats.
 */
async function getUpcomingAssignedDepartures(): Promise<UpcomingAssignedDepartures> {
  const { company_id } = await getAccess();
  const days = nextSevenAbidjanDates();
  const results = await Promise.allSettled(days.map(async date => {
    const body = await request<{ departs?: unknown }>(
      `/api/tickets/departs-programmes?companyId=${encodeURIComponent(company_id)}&date=${encodeURIComponent(date)}`,
    );
    if (!body || !Array.isArray(body.departs) || !body.departs.every(isAssignedDeparture)) {
      throw new CompanyDashboardApiError('Réponse du catalogue des départs non conforme.');
    }
    return body.departs as AssignedBusDeparture[];
  }));

  const fulfilled = results.filter(
    (result): result is PromiseFulfilledResult<AssignedBusDeparture[]> => result.status === 'fulfilled',
  );
  if (fulfilled.length === 0) {
    const first = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    throw first?.reason instanceof Error
      ? first.reason
      : new CompanyDashboardApiError('Catalogue des départs indisponible.');
  }
  const unique = new Map<string, AssignedBusDeparture>();
  for (const result of fulfilled) {
    for (const dep of result.value) {
      if (dep.company_id === company_id && dep.statut.toUpperCase().startsWith('PROGRAMM')) {
        unique.set(dep.id, dep);
      }
    }
  }
  return { departures: [...unique.values()], complete: fulfilled.length === days.length };
}

export const companyDashboardApi = {
  getAccess,
  getProfile,
  getUpcomingAssignedDepartures,

  /** Nécessite une route PATCH authentifiée à implémenter côté backend. */
  updateProfile: (data: { telephone: string }) =>
    request<CompanyProfile>('/api/company-dashboard/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /**
   * Route non identifiée dans le backend actuel. En cas de 404, on remonte
   * l'erreur : ne pas renvoyer [] (ce serait une fausse occupation nulle).
   */
  getOccupancy: (from: string, to: string) =>
    request<OccupancyResponse>(
      `/api/company-dashboard/departures/occupancy?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
};
