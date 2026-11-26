
/**
 * MESSAY SUPER APP
 * Service de consultation des billets interurbains.
 *
 * - Utilise l'API backend authentifiée MESSAY.
 * - Consulte les billets historiques du passager connecté.
 * - Gère l'attribution des sièges par la compagnie.
 * - Ne crée aucune réservation ni transaction financière.
 * - Ne génère aucune preuve de paiement.
 *
 * IMPORTANT :
 * Les billets de public.tickets ne doivent pas être fusionnés
 * avec ceux de public."Ticket" tant que la correspondance
 * entre User.id (JWT MESSAY) et auth.users.id (Supabase)
 * n'est pas vérifiée côté serveur.
 */

import api from './api';

// ============================================
// TYPES
// ============================================

export type StatutAttributionSiege =
  | 'ATTRIBUE'
  | 'HISTORIQUE_NON_RAPPROCHE'
  | 'EN_ATTENTE'
  | 'SANS_OBJET';

export type BilletInterurbain = Readonly<{
  id: string;

  compagnie: string;

  depart: string;
  destination: string;

  dateDepart: string;
  heureDepart: string;

  statut: string;

  prix: number;

  siegeNumero: number | null;
  siegeAffichage: string | null;

  statutAttributionSiege: StatutAttributionSiege;

  affectationId: string | null;

  // Gares réelles fournies par le backend
  gareDepart: string | null;
  gareArrivee: string | null;
}>;

// ============================================
// VALIDATION DES DONNÉES
// ============================================

const isRecord = (
  value: unknown
): value is Record<string, unknown> =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value);

const statutSiege = (
  value: unknown
): value is StatutAttributionSiege =>
  value === 'ATTRIBUE' ||
  value === 'HISTORIQUE_NON_RAPPROCHE' ||
  value === 'EN_ATTENTE' ||
  value === 'SANS_OBJET';

/**
 * Convertit une réponse API en billet typé.
 * Refuse les données obligatoires invalides.
 */
function decodeBillet(row: unknown): BilletInterurbain {
  if (
    !isRecord(row) ||
    typeof row.id !== 'string' ||
    typeof row.depart !== 'string' ||
    typeof row.destination !== 'string' ||
    typeof row.compagnie !== 'string' ||
    typeof row.statut !== 'string' ||
    typeof row.dateDepart !== 'string' ||
    typeof row.heureDepart !== 'string' ||
    typeof row.prix !== 'number' ||
    !Number.isFinite(row.prix) ||
    !statutSiege(row.statutAttributionSiege)
  ) {
    throw new Error(
      'Le serveur a retourné un billet de format invalide.'
    );
  }

  // Vérification du numéro de siège
  if (
    row.siegeNumero !== null &&
    row.siegeNumero !== undefined &&
    (
      typeof row.siegeNumero !== 'number' ||
      !Number.isInteger(row.siegeNumero) ||
      row.siegeNumero < 1 ||
      row.siegeNumero > 120
    )
  ) {
    throw new Error(
      'Le serveur a retourné un numéro de siège invalide.'
    );
  }

  return {
    id: row.id,

    compagnie: row.compagnie,

    depart: row.depart,
    destination: row.destination,

    dateDepart: row.dateDepart,
    heureDepart: row.heureDepart,

    statut: row.statut,

    prix: row.prix,

    siegeNumero:
      typeof row.siegeNumero === 'number'
        ? row.siegeNumero
        : null,

    siegeAffichage:
      typeof row.siegeAffichage === 'string' &&
      row.siegeAffichage.trim()
        ? row.siegeAffichage.trim()
        : null,

    statutAttributionSiege:
      row.statutAttributionSiege,

    affectationId:
      typeof row.affectationId === 'string' &&
      row.affectationId.trim()
        ? row.affectationId.trim()
        : null,

    gareDepart:
      typeof row.gareDepart === 'string' &&
      row.gareDepart.trim()
        ? row.gareDepart.trim()
        : null,

    gareArrivee:
      typeof row.gareArrivee === 'string' &&
      row.gareArrivee.trim()
        ? row.gareArrivee.trim()
        : null,
  };
}

// ============================================
// RÉCUPÉRATION DES BILLETS
// ============================================

/**
 * Récupère les billets interurbains du passager.
 *
 * Le JWT est géré par les intercepteurs
 * du client Axios configuré dans api.ts.
 *
 * La vérification du propriétaire des billets
 * doit être effectuée côté backend.
 */
export async function lireMesBilletsInterurbains(
  limit = 50
): Promise<BilletInterurbain[]> {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new Error(
      'Limite de billets invalide (1 à 100).'
    );
  }

  const response = await api.get<unknown>(
    '/tickets',
    {
      params: { limit },
    }
  );

  const body = response.data;

  if (
    !isRecord(body) ||
    !Array.isArray(body.tickets)
  ) {
    throw new Error(
      'Liste de billets indisponible ou invalide.'
    );
  }

  return body.tickets.map(decodeBillet);
}

// ============================================
// AFFICHAGE DU SIÈGE
// ============================================

/**
 * Retourne le libellé du siège du passager.
 *
 * Règle MESSAY :
 * Le passager ne choisit pas son siège.
 * La compagnie l'attribue après confirmation
 * réelle du paiement.
 */
export function libelleSiegeInterurbain(
  billet: BilletInterurbain
): string {
  switch (billet.statutAttributionSiege) {
    case 'ATTRIBUE':
      return billet.siegeAffichage
        ? `Siège n° ${billet.siegeAffichage}`
        : billet.siegeNumero !== null
          ? `Siège n° ${billet.siegeNumero}`
          : 'Siège attribué';

    case 'HISTORIQUE_NON_RAPPROCHE':
      return billet.siegeAffichage
        ? `Ancien numéro de siège : ${billet.siegeAffichage} (non rapproché)`
        : 'Ancien billet : siège non rapproché';

    case 'EN_ATTENTE':
      return "Siège en attente d'attribution";

    case 'SANS_OBJET':
    default:
      return 'Siège non attribué';
  }
}


/**
 * Détail d'un billet appartenant au passager connecté.
 * L'identité est déterminée exclusivement par le JWT côté backend.
 * Aucun identifiant utilisateur n'est envoyé dans la requête.
 */
export async function lireBilletInterurbainParId(
  ticketId: string,
): Promise<BilletInterurbain> {
  const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

  if (!uuid.test(ticketId)) {
    throw new Error('Identifiant de billet invalide.');
  }

  const response = await api.get<unknown>(
    `/tickets/${ticketId}`,
  );

  if (!isRecord(response.data) ||
      !isRecord(response.data.ticket)) {
    throw new Error('Détail du billet indisponible.');
  }

  const billet = decodeBillet(response.data.ticket);

  if (billet.id.toLowerCase() !== ticketId.toLowerCase()) {
    throw new Error('Référence de billet incohérente.');
  }

  return billet;
}
