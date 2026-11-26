/**
 * MESSAY PRO — Correction ciblée des gares manquantes d'une ligne historique.
 * La compagnie et le rôle Direction sont validés côté serveur.
 */
import { messayAuth } from '../lib/messaySupabaseAuth';

export type ResultatGaresLigne = {
  id: string;
  gare_depart_id: string | null;
  gare_arrivee_id: string | null;
  updated: boolean;
};

export async function completerGaresLigne(
  ligneId: string,
  payload: { gare_depart_id?: string; gare_arrivee_id?: string },
): Promise<ResultatGaresLigne> {
  const { data, error } = await messayAuth.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Session expirée : reconnectez-vous à MESSAY PRO.');
  }
  const apiRoot = String(import.meta.env.VITE_API_URL || '')
    .trim().replace(/\/+$/, '').replace(/\/api$/i, '');
  let response: Response;
  try {
    response = await fetch(
      `${apiRoot}/api/company-dashboard/planification/lignes/${encodeURIComponent(ligneId)}/gares`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
      },
    );
  } catch {
    throw new Error('Backend MESSAY inaccessible. Vérifiez la connexion réseau.');
  }
  const result: unknown = await response.json().catch(() => null);
  const envelope = result && typeof result === 'object' ? result as Record<string, unknown> : null;
  if (!response.ok) {
    const reason = envelope?.message ?? envelope?.error;
    throw new Error(typeof reason === 'string' && reason ? reason : `Erreur MESSAY ${response.status}`);
  }
  if (!envelope || typeof envelope.id !== 'string') {
    throw new Error('Réponse invalide du service de correction des lignes.');
  }
  return envelope as ResultatGaresLigne;
}
