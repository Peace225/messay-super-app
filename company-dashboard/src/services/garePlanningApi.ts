/**
 * MESSAY PRO — Client authentifié de planification interurbaine.
 * Identité et permissions toujours vérifiées côté serveur.
 */
import { messayAuth } from '../lib/messaySupabaseAuth';

export type DemandeType = 'CREATION_LIGNE' | 'CHANGEMENT_TARIF' | 'MODIFICATION_HORAIRE';
export type DemandeStatut = 'SOUMIS_CHEF' | 'EN_ATTENTE' | 'APPROUVEE' | 'REFUSEE';
export interface GarePlanningGare { id: string; nom: string; ville: string }
export interface GarePlanningHoraire { id: string; heure_depart: string }
export interface GarePlanningLigne {
  id: string;
  ville: string;
  prix: number;
  duree: string | null;
  gare_depart_id: string;
  gare_arrivee_id: string | null;
  publie: boolean;
  depart_nom: string | null;
  arrivee_nom: string | null;
  horaires: GarePlanningHoraire[];
}
export interface GarePlanningDemande {
  id: string;
  gare_id?: string;
  gare_nom?: string;
  type: DemandeType;
  statut: DemandeStatut;
  destination_id: string | null;
  gare_arrivee_id: string | null;
  arrivee_nom?: string | null;
  horaire_id: string | null;
  prix_fcfa: number | null;
  duree: string | null;
  horaires: string[];
  nouvel_horaire: string | null;
  motif: string | null;
  demande_par: string;
  cree_le: string;
  motif_decision: string | null;
}
export interface GarePlanningResponse {
  gares: GarePlanningGare[];
  gare_id: string;
  peut_ajouter_horaire: boolean;
  lignes: GarePlanningLigne[];
  demandes: GarePlanningDemande[];
}
export interface PlanningDelegation { auth_user_id: string; autorise: boolean }

const root = String(import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : ''))
  .trim().replace(/\/+$/, '').replace(/\/api$/i, '');
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data, error } = await messayAuth.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Votre session a expiré. Reconnectez-vous à MESSAY PRO.');
  }
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${data.session.access_token}`);
  headers.set('Accept', 'application/json');
  if (options.body) headers.set('Content-Type', 'application/json');
  let response: Response;
  try {
    response = await fetch(`${root}${path}`, {
      ...options, headers, cache: 'no-store', credentials: 'same-origin',
    });
  } catch {
    throw new Error('Backend MESSAY inaccessible. Vérifiez VITE_API_URL et le port 5000.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message || `Erreur MESSAY ${response.status}.`);
  }
  return await response.json() as T;
}
const enc = encodeURIComponent;
const garePath = (gareId: string) => `/api/company-dashboard/gares/${enc(gareId)}/planification`;
export const garePlanningApi = {
  gare: (gareId: string) => request<GarePlanningResponse>(garePath(gareId)),
  reseauDirection: () => request<{ gares: GarePlanningGare[]; lignes: GarePlanningLigne[] }>('/api/company-dashboard/planification/reseau'),
  demandesDirection: () => request<{ demandes: GarePlanningDemande[] }>('/api/company-dashboard/planification/demandes'),
  proposerLigne: (gareId: string, data: {
    gare_arrivee_id: string; prix_fcfa: number; duree: string; horaires: string[];
  }) => request<GarePlanningDemande>(`${garePath(gareId)}/demandes`, {
    method: 'POST', body: JSON.stringify({ type: 'CREATION_LIGNE', ...data }),
  }),
  proposerTarif: (gareId: string, destination_id: string, prix_fcfa: number) =>
    request<GarePlanningDemande>(`${garePath(gareId)}/demandes`, {
      method: 'POST', body: JSON.stringify({ type: 'CHANGEMENT_TARIF', destination_id, prix_fcfa }),
    }),
  proposerHoraire: (gareId: string, data: {
    destination_id: string; horaire_id: string; nouvel_horaire: string; motif: string;
  }) => request<GarePlanningDemande>(`${garePath(gareId)}/demandes`, {
    method: 'POST', body: JSON.stringify({ type: 'MODIFICATION_HORAIRE', ...data }),
  }),
  avisChef: (gareId: string, id: string, decision: 'TRANSMETTRE' | 'REFUSER', motif = '') =>
    request<GarePlanningDemande>(`${garePath(gareId)}/demandes/${enc(id)}/avis-chef`, {
      method: 'POST', body: JSON.stringify({ decision, motif }),
    }),
  ajouterHoraire: (gareId: string, destination_id: string, heure_depart: string) =>
    request<{ id: string; destination_id: string; heure_depart: string }>(`${garePath(gareId)}/horaires`, {
      method: 'POST', body: JSON.stringify({ destination_id, heure_depart }),
    }),
  delegations: (gareId: string) => request<{ agents: PlanningDelegation[] }>(`${garePath(gareId)}/delegations`),
  delegation: (gareId: string, auth_user_id: string, autorise: boolean) =>
    request<PlanningDelegation>(`${garePath(gareId)}/delegations`, {
      method: 'POST', body: JSON.stringify({ auth_user_id, autorise }),
    }),
  decider: (id: string, decision: 'APPROUVER' | 'REFUSER', motif = '') =>
    request<{ demande_id: string; statut: DemandeStatut; ligne_id: string | null }>(
      `/api/company-dashboard/planification/demandes/${enc(id)}/decision`, {
        method: 'POST', body: JSON.stringify({ decision, motif }),
      }),
};
