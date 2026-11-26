/**
 * Service de gestion des gares MESSAY PRO.
 * Les permissions et le company_id sont vérifiés uniquement par le backend.
 * Toutes les requêtes utilisent le jeton de la session Supabase Auth courante.
 */
import { messayAuth } from '../lib/messaySupabaseAuth';

export interface Gare {
  id: string;
  company_id: string;
  nom: string;
  ville: string;
  adresse: string | null;
  chef_nom: string | null;
  chef_tel: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string;
}
export type ResponsableRole = 'ADJOINT' | 'BILLETTERIE' | 'EMBARQUEMENT' | 'EXPLOITATION' | 'CAISSE';
export interface GareResponsable {
  id: string;
  gare_id: string;
  nom: string;
  fonction: ResponsableRole;
  telephone: string | null;
  email: string | null;
  actif: boolean;
}
export interface HoraireGare {
  id: string;
  heure_depart: string;
}
export interface LigneGare {
  id: string;
  gare_depart_id: string | null;
  gare_arrivee_id: string | null;
  gare_depart_nom: string | null;
  gare_arrivee_nom: string | null;
  ville_depart: string | null;
  ville_arrivee: string;
  prix: number | null;
  duree: string | null;
  horaires: HoraireGare[];
  // Colonnes historiques : indicatives, PAS des places d'un départ daté.
  quota?: number | null;
  billets_vendus?: number | null;
}
/** Rapport serveur : seulement les ventes réellement confirmées, attribuées à cette gare. */
export interface GareVenteResponsable {
  responsable_id: string | null;
  nom: string;
  fonction: string;
  billets_payes: number;
  montant_fcfa: number;
}
export interface GareCloture {
  id: string;
  date: string;
  declare_par: string;
  montant_especes_declare_fcfa: number;
  montant_especes_attendu_fcfa: number;
  ecart_fcfa: number;
  statut: 'soumise' | 'validee' | 'rejetee' | string;
}
export interface RapportGare {
  du: string;
  au: string;
  billets_payes: number;
  montant_brut_fcfa: number;
  commission_messay_fcfa: number;
  part_compagnie_fcfa: number;
  remboursements_fcfa: number;
  ventes_par_responsable: GareVenteResponsable[];
  clotures: GareCloture[];
}
export interface DeclarationCloture {
  date: string;
  montant_especes_declare_fcfa: number;
  notes: string | null;
}
export interface GareOverview {
  responsables: GareResponsable[];
  departs: LigneGare[];
  arrivees: LigneGare[];
}
export type GareInput = {
  nom: string;
  ville: string;
  adresse: string;
  chef_nom: string | null;
  chef_tel: string | null;
  latitude: number | null;
  longitude: number | null;
};
export type ResponsableInput = {
  nom: string;
  fonction: ResponsableRole;
  telephone: string | null;
  email: string | null;
};
export type LigneInput = {
  gare_depart_id: string;
  gare_arrivee_id: string;
  prix: number;
  duree: string;
  horaires: string[];
};
/** Adresse relative (proxy Vite /api) ou URL absolue du backend. */
const endpoint = (path: string): string => {
  const root = String(import.meta.env.VITE_API_URL || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '');
  return `${root}${path}`;
};

/**
 * Client partagé avec la page de connexion :
 * src/lib/messaySupabaseAuth.ts exporte `messayAuth`.
 * Aucune deuxième instance Supabase et aucune clé serveur côté navigateur.
 */
/** Erreur typée : le composant React peut distinguer 401, 403 et 409. */
export class GaresApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'GaresApiError';
    this.status = status;
  }
}

async function getAccessToken(): Promise<string> {
  let token: string | undefined;

  try {
    const { data, error } = await messayAuth.auth.getSession();
    if (error) {
      throw new GaresApiError(
        'Session Supabase indisponible. Reconnectez-vous à MESSAY PRO.',
        401,
      );
    }
    token = data.session?.access_token;
  } catch (error) {
    if (error instanceof GaresApiError) throw error;
    throw new GaresApiError(
      'Impossible de récupérer la session Supabase Auth.',
      401,
    );
  }

  if (!token) {
    throw new GaresApiError(
      'Aucune session Supabase Auth active. Connectez-vous à MESSAY PRO avant d’ouvrir les gares.',
      401,
    );
  }

  return token;
}

/**
 * Une seule couche de transport pour toutes les routes du Dashboard Compagnie.
 * Le backend, et non le navigateur, attribue les rôles et le company_id.
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);

  if (typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(endpoint(path), {
      ...options,
      // Le serveur des gares utilise le Bearer Supabase, pas les cookies cross-origin.
      credentials: 'same-origin',
      headers,
    });
  } catch (error) {
    // Ne pas transformer une annulation volontaire (React / AbortController)
    // en erreur de connexion.
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new GaresApiError(
      'Connexion au serveur MESSAY impossible. Vérifiez le backend (port 5000) et le proxy Vite.',
    );
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    let message = `Erreur serveur (${response.status}).`;

    if (contentType.toLowerCase().includes('application/json')) {
      try {
        const data = (await response.json()) as { message?: unknown; error?: unknown };
        if (typeof data.message === 'string' && data.message.trim()) {
          message = data.message.trim();
        } else if (typeof data.error === 'string' && data.error.trim()) {
          message = data.error.trim();
        }
      } catch {
        // Corps non JSON ou malformé : conserver le message de statut.
      }
    }

    switch (response.status) {
      case 401:
        throw new GaresApiError(
          'Session Supabase refusée par MESSAY. Reconnectez-vous avec le compte Supabase Auth autorisé.',
          401,
        );
      case 403:
        throw new GaresApiError(
          message === 'Erreur serveur (403).'
            ? 'Votre compte ne dispose pas d’un accès actif à cette compagnie ou cette gare.'
            : message,
          403,
        );
      case 404:
        throw new GaresApiError(`Route introuvable : ${path}`, 404);
      case 409:
        throw new GaresApiError(message, 409);
      case 501:
        throw new GaresApiError(
          message === 'Erreur serveur (501).'
            ? 'Cette fonctionnalité n’est pas encore implémentée côté backend.'
            : message,
          501,
        );
      default:
        throw new GaresApiError(message, response.status);
    }
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new GaresApiError(
      'Réponse non JSON : vérifiez VITE_API_URL et le proxy Vite.',
      response.status,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new GaresApiError('Le backend a renvoyé un JSON invalide.', response.status);
  }
}

export const garesManagementApi = {
  // Le serveur dérive company_id de la session, et ne retourne que SES gares.
  list: async (): Promise<Gare[]> => {
    const data = await request<Gare[] | { gares: Gare[] }>('/api/company-dashboard/gares');
    const gares = Array.isArray(data) ? data : data?.gares;
    if (!Array.isArray(gares)) {
      throw new GaresApiError('Format de la liste des gares inattendu.');
    }
    return gares;
  },
  overview: (gareId: string) =>
    request<GareOverview>(`/api/company-dashboard/gares/${encodeURIComponent(gareId)}/overview`),
  create: (data: GareInput) => request<Gare>('/api/company-dashboard/gares', {
    method: 'POST', body: JSON.stringify(data),
  }),
  update: (gareId: string, data: GareInput) =>
    request<Gare>(`/api/company-dashboard/gares/${encodeURIComponent(gareId)}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),
  addResponsable: (gareId: string, data: ResponsableInput) =>
    request<GareResponsable>(`/api/company-dashboard/gares/${encodeURIComponent(gareId)}/responsables`, {
      method: 'POST', body: JSON.stringify(data),
    }),
  removeResponsable: (gareId: string, responsableId: string) =>
    request<void>(`/api/company-dashboard/gares/${encodeURIComponent(gareId)}/responsables/${encodeURIComponent(responsableId)}`, {
      method: 'DELETE',
    }),
  rapport: (gareId: string, du: string, au: string) =>
    request<RapportGare>(`/api/company-dashboard/gares/${encodeURIComponent(gareId)}/rapport?du=${encodeURIComponent(du)}&au=${encodeURIComponent(au)}`),
  declarerCloture: (gareId: string, data: DeclarationCloture) =>
    request<GareCloture>(`/api/company-dashboard/gares/${encodeURIComponent(gareId)}/clotures`, {
      method: 'POST', body: JSON.stringify(data),
    }),
  createLigne: (data: LigneInput) => request<LigneGare>('/api/company-dashboard/lignes', {
    method: 'POST', body: JSON.stringify(data),
  }),
};
// HIERARCHIE: toutes les autorisations doivent etre recalculees par le serveur.
export type GareAccessRole = 'DIRECTION' | 'CHEF_GARE' | 'AGENT_BILLETTERIE' | 'AGENT_CAISSE' | 'AGENT_EMBARQUEMENT' | 'AGENT_EXPLOITATION';
export interface GareAccessContext {
  role: GareAccessRole;
  company_id: string;
  gare_ids: string[];
  display_name: string;
}
/** Agent ayant un accès MESSAY PRO actif à une gare (distinct du compte Auth). */
export interface GareStaffAgent {
  id: string;
  gare_id: string;
  auth_user_id: string;
  role: Exclude<GareAccessRole, 'DIRECTION' | 'CHEF_GARE'>;
  actif: boolean;
  nom: string | null;
  email: string | null;
  created_at: string;
}
export interface GareInvitation {
  id: string;
  gare_id: string;
  nom: string;
  email: string;
  role: Exclude<GareAccessRole, 'DIRECTION'>;
  statut: 'en_attente' | 'acceptee' | 'expiree' | 'revoquee';
  created_at: string;
}
export interface GareTransaction {
  id: string;
  occurred_at: string;
  reference_billet: string | null;
  agent_nom: string | null;
  canal: 'MOBILE' | 'GUICHET' | string;
  mode_paiement: string;
  statut: string;
  montant_fcfa: number;
  commission_messay_fcfa: number | null;
  part_compagnie_fcfa: number | null;
}
export interface GareTransactionPage {
  transactions: GareTransaction[];
  next_cursor: string | null;
}
export type ReportStatus = 'SOUMIS_CHEF' | 'RETOURNE_AGENT' | 'VALIDE_CHEF' | 'SOUMIS_DIRECTION' | 'RETOURNE_CHEF' | 'VALIDE_DIRECTION';
export interface GareRapportHierarchique {
  id: string;
  gare_id: string;
  type: 'AGENT' | 'CHEF_GARE';
  auteur_nom: string;
  date_rapport: string;
  billets_declares: number;
  especes_declarees_fcfa: number;
  observation: string | null;
  statut: ReportStatus;
  created_at: string;
}
export interface RapportHierarchiqueInput {
  date_rapport: string;
  especes_declarees_fcfa: number;
  observation: string | null;
}
export interface GareRapportList { rapports: GareRapportHierarchique[] }
export const garesHierarchyApi = {
  access: () => request<GareAccessContext>('/api/company-dashboard/me/access'),
  // L'activation est publique au regard du rôle compagnie, mais requiert Supabase Auth.
  // Elle utilise le routeur distinct messayInvitationActivationRouter côté Express.
  activateInvitation: (invitationId: string) =>
    request<unknown>('/api/company-dashboard/invitations/activate', {
      method: 'POST',
      body: JSON.stringify({ invitation_id: invitationId }),
    }),
  invitations: (gareId: string) => request<{ invitations: GareInvitation[] }>(`/api/company-dashboard/gares/${encodeURIComponent(gareId)}/invitations`),
  agents: (gareId: string) =>
    request<{ agents: GareStaffAgent[] }>(`/api/company-dashboard/gares/${encodeURIComponent(gareId)}/agents`),
  removeAgentAccess: (gareId: string, staffId: string) =>
    request<{ success: boolean; message: string }>(
      `/api/company-dashboard/gares/${encodeURIComponent(gareId)}/agents/${encodeURIComponent(staffId)}/deactivate`,
      { method: 'PATCH' }
    ),
  cancelInvitation: (gareId: string, invitationId: string) =>
    request<{ success: boolean; message: string }>(
      `/api/company-dashboard/gares/${encodeURIComponent(gareId)}/invitations/${encodeURIComponent(invitationId)}/revoke`,
      { method: 'PATCH' }
    ),

  invite: (gareId: string, body: { nom: string; email: string; role: Exclude<GareAccessRole, 'DIRECTION'> }) =>
    request<GareInvitation>(`/api/company-dashboard/gares/${encodeURIComponent(gareId)}/invitations`, {method: 'POST', body: JSON.stringify(body)}),
  transactions: (gareId: string, from: string, to: string, cursor: string | null = null) => {
    const qp = new URLSearchParams({ du: from, au: to, limit: '50' });
    if (cursor) qp.set('cursor', cursor);
    return request<GareTransactionPage>(`/api/company-dashboard/gares/${encodeURIComponent(gareId)}/transactions?${qp.toString()}`);
  },
  reports: (gareId: string, from: string, to: string) => {
    const qp = new URLSearchParams({du: from, au: to});
    return request<GareRapportList>(`/api/company-dashboard/gares/${encodeURIComponent(gareId)}/hierarchy-reports?${qp.toString()}`);
  },
  submitReport: (gareId: string, input: RapportHierarchiqueInput) =>
    request<GareRapportHierarchique>(`/api/company-dashboard/gares/${encodeURIComponent(gareId)}/hierarchy-reports`, { method: 'POST', body: JSON.stringify(input) }),
  reviewReport: (gareId: string, reportId: string, decision: 'APPROUVER' | 'RETOURNER', motif: string | null) =>
    request<GareRapportHierarchique>(`/api/company-dashboard/gares/${encodeURIComponent(gareId)}/hierarchy-reports/${encodeURIComponent(reportId)}/review`, { method: 'POST', body: JSON.stringify({ decision, motif }) }),
};
export interface DirectionTransaction extends GareTransaction { gare_nom: string; gare_id: string }
export interface DirectionTransactionPage {
  transactions: DirectionTransaction[];
  next_cursor: string | null;
}
export interface DirectionPendingReport extends GareRapportHierarchique { gare_nom: string }
export interface DirectionPendingReportList { rapports: DirectionPendingReport[] }
export const garesDirectionApi = {
  allTransactions: (from: string, to: string, cursor: string | null = null) => {
    const qs = new URLSearchParams({du: from, au: to, limit: '50'});
    if (cursor) qs.set('cursor', cursor);
    return request<DirectionTransactionPage>(`/api/company-dashboard/transactions?${qs}`);
  },
  pendingReports: () => request<DirectionPendingReportList>('/api/company-dashboard/hierarchy-reports/pending'),
};
