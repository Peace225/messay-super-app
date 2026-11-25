import { messayAuth } from '../lib/messaySupabaseAuth';

export type ChauffeurStatut = 'ACTIF' | 'INACTIF';
export interface ChauffeurInterurbain {
  id: string;
  nom: string;
  prenom: string | null;
  telephone: string | null;
  numero_permis: string;
  categorie_permis: string | null;
  date_expiration_permis: string | null;
  statut: ChauffeurStatut;
  created_at: string;
}
export interface ChauffeurInput {
  nom: string;
  prenom: string | null;
  telephone: string | null;
  numero_permis: string;
  categorie_permis: string | null;
  date_expiration_permis: string | null;
  statut: ChauffeurStatut;
}

const endpoint = '/api/company-dashboard/chauffeurs-interurbains';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data, error } = await messayAuth.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Session Supabase expirée. Reconnectez-vous à MESSAY PRO.');
  }
  const root = String(import.meta.env.VITE_API_URL || '')
    .trim().replace(/\/+$/, '').replace(/\/api$/i, '');
  const response = await fetch(`${root}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${data.session.access_token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  const payload: unknown = isJson ? await response.json().catch(() => null) : null;
  if (!response.ok) {
    let msg = `Erreur API MESSAY (${response.status}).`;
    if (payload && typeof payload === 'object') {
      const p = payload as { message?: unknown; error?: unknown };
      if (typeof p.message === 'string') msg = p.message;
      else if (typeof p.error === 'string') msg = p.error;
    }
    if (response.status === 404) msg = 'Route GET/POST /api/company-dashboard/chauffeurs-interurbains absente du serveur. Installez le routeur interurbain fourni.';
    if (response.status === 401) msg = 'Session non reconnue par le backend. Reconnectez-vous.';
    if (response.status === 403) msg = 'Accès réservé à la Direction de cette compagnie.';
    throw new Error(msg);
  }
  if (!isJson) throw new Error('Réponse non JSON : vérifiez VITE_API_URL et le proxy Vite.');
  return payload as T;
}

export const chauffeursInterurbainsApi = {
  list: async (): Promise<ChauffeurInterurbain[]> => {
    const result = await request<{ chauffeurs: ChauffeurInterurbain[] }>(endpoint);
    if (!Array.isArray(result?.chauffeurs)) throw new Error('Réponse chauffeurs invalide.');
    return result.chauffeurs;
  },
  create: (input: ChauffeurInput) => request<ChauffeurInterurbain>(endpoint, {
    method: 'POST', body: JSON.stringify(input),
  }),
  update: (id: string, input: ChauffeurInput) => request<ChauffeurInterurbain>(`${endpoint}/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify(input),
  }),
};
