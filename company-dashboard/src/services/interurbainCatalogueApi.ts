/** Catalogue partagé MESSAY — même réponse backend pour Dashboard et mobile. */
export interface CatalogueGare {
  id: string;
  nom: string;
  ville: string;
  adresse: string | null;
}
export interface CatalogueHoraire {
  id: string;
  destination_id: string;
  heure_depart: string;
}
export interface CatalogueDestination {
  id: string;
  ville: string | null;
  prix: number | null;
  duree: string | null;
  gare_depart_id: string | null;
  gare_arrivee_id: string | null;
  horaires: CatalogueHoraire[];
}
export interface CatalogueOffre {
  destination_id: string;
  horaire_id: string;
  gare_depart_id: string;
  gare_arrivee_id: string | null;
  gare_depart_nom: string;
  gare_arrivee_nom: string | null;
  ville_depart: string;
  ville_arrivee: string;
  heure_depart: string;
  prix_fcfa: number | null;
  duree: string | null;
  disponibilite_confirmee: false;
}
export interface InterurbainCatalogue {
  compagnie: { id: string; name: string; is_active: boolean | null };
  gares: CatalogueGare[];
  destinations: CatalogueDestination[];
  offres: CatalogueOffre[];
  date_recherche: string | null;
  tronque: boolean;
  information: string;
}

export async function getInterurbainCatalogue(
  companyId: string,
  gareDepartId?: string,
  date?: string,
  signal?: AbortSignal,
): Promise<InterurbainCatalogue> {
  // Sur localhost:5173, une URL relative /api peut tomber sur Vite (404).
  // En développement, utiliser Express :5000 si aucune API explicite n'est configurée.
  // En production, définir VITE_API_URL si le backend est sur un autre domaine.
  const configuredBase = String(import.meta.env.VITE_API_URL || '').trim();
  const base = (configuredBase || (import.meta.env.DEV ? 'http://localhost:5000' : ''))
    .replace(/\/+$/, '').replace(/\/api$/i, '');
  const search = new URLSearchParams({ company_id: companyId });
  if (gareDepartId) search.set('gare_depart_id', gareDepartId);
  if (date) search.set('date', date);
  let response: Response;
  try {
    response = await fetch(`${base}/api/interurbain/catalogue?${search}`, {
      headers: { Accept: 'application/json' }, cache: 'no-store', signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    throw new Error('MESSAY PRO : le catalogue des trajets est inaccessible. Vérifiez la connexion au serveur.');
  }
  if (!response.ok) {
    // La page HTML 404 de Vite n'est pas une erreur métier "aucun trajet".
    const isJson = (response.headers.get('content-type') || '').includes('application/json');
    if (response.status === 404 && !isJson) {
      throw new Error(
        'MESSAY PRO : route catalogue introuvable. Vérifiez que le backend fonctionne ' +
        'et que GET /api/interurbain/catalogue est monté dans src/server.ts.'
      );
    }
    let message = `MESSAY PRO : erreur du catalogue (${response.status}).`;
    if (isJson) {
      try {
        const error = await response.json() as { message?: string; error?: string };
        message = error.message || error.error || message;
      } catch { /* message lisible déjà fourni */ }
    }
    throw new Error(message);
  }
  const catalogue = await response.json() as InterurbainCatalogue;
  if (!Array.isArray(catalogue.offres) || !Array.isArray(catalogue.gares)) {
    throw new Error('MESSAY PRO : réponse du catalogue invalide.');
  }
  return catalogue;
}
