import { messayAuth } from '../lib/messaySupabaseAuth';
export type Bus = { id: string; numero_interne: string; immatriculation: string;
  capacite: number; marque: string | null; modele: string | null; statut: string; cree_le: string };
export type Gare = { id: string; nom: string; ville: string };
export type BusAffectation = { id: string; gare_id: string; destination_id: string;
  horaire_id: string; date_depart: string; bus_id: string; numero_bus_snapshot: string;
  immatriculation_snapshot: string; capacite_snapshot: number; statut: string; cree_le: string };
export type BusOverview = { role: string; gares: Gare[]; vehicules: Bus[];
  affectations: BusAffectation[] };

const root = String(import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : ''))
  .trim().replace(/\/+$/, '').replace(/\/api$/i, '');
async function call<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = await messayAuth.auth.getSession();
  if (!data.session?.access_token) throw new Error('Reconnectez-vous à MESSAY PRO.');
  const r = await fetch(`${root}${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!r.ok) {
    const error = await r.json().catch(() => ({})) as { message?: string };
    throw new Error(error.message || `Erreur serveur (${r.status})`);
  }
  return await r.json() as T;
}
export const messayBusApi = {
  lister: () => call<BusOverview>('/api/company-dashboard/vehicules'),
  enregistrer: (input: { numero_interne: string; immatriculation: string;
    capacite: number; marque?: string; modele?: string }) =>
    call<{ id: string }>('/api/company-dashboard/vehicules', {
      method: 'POST', body: JSON.stringify(input),
    }),
  affecter: (gareId: string, input: { destination_id: string; horaire_id: string;
    date_depart: string; bus_id: string }) =>
    call<{ id: string }>(`/api/company-dashboard/gares/${encodeURIComponent(gareId)}/departs-bus`, {
      method: 'POST', body: JSON.stringify(input),
    }),
};
