/**
 * MESSAY PRO — consultation des bus affectés et de l'inventaire provisoire V1.
 * L'authentification vient du compte Supabase courant. Aucune opération d'écriture.
 * Les informations de sièges V1 ne prouvent PAS une disponibilité à la vente.
 */
import { messayAuth } from '../lib/messaySupabaseAuth';

export type MessayBusAffectation = {
  id: string;
  gare_id: string;
  destination_id: string;
  horaire_id: string;
  date_depart: string;
  bus_id: string;
  numero_bus_snapshot: string | null;
  immatriculation_snapshot: string | null;
  capacite_snapshot: number;
  statut: string;
};

export type MessaySiege = {
  numero: number;
  // Vente réellement autorisée par le serveur, jamais déduite du registre V1.
  disponible: boolean;
  // Uniquement un renseignement technique : peut être faux côté billets legacy.
  libre_dans_registre_v1: boolean;
};

export type MessayPlacesV1 = {
  affectation_id: string;
  date_depart: string;
  capacite: number;
  places_libres_registre_v1: number;
  places: MessaySiege[];
  statut_depart: string;
  paiement_actif: boolean;
  billet_emis: boolean;
  vente_autorisee: boolean;
  disponibilite_confirmee: boolean;
  inventaire_legacy_non_reconcilie: boolean;
  avertissement: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown): string => typeof value === 'string' ? value : '';

function backendRoot(): string {
  // Configurer VITE_MESSAY_API_URL avec l'origine du backend si Vite n'a pas de proxy /api.
  // Les clés VITE_ sont publiques : n'y placer JAMAIS de clé Supabase service_role.
  const raw = String(
    import.meta.env.VITE_MESSAY_API_URL ||
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_BACKEND_URL || ''
  ).trim().replace(/\/+$/, '');
  return raw.replace(/\/api(?:\/company-dashboard)?$/, '');
}

async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const { data, error } = await messayAuth.auth.getSession();
  if (error) throw new Error('Impossible de vérifier la session : reconnectez-vous.');
  const token = data.session?.access_token;
  if (!token) throw new Error('Session expirée : reconnectez-vous à MESSAY PRO.');

  const res = await fetch(`${backendRoot()}/api/company-dashboard${path}`, {
    method: 'GET',
    signal,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  let body: unknown = null;
  try { body = await res.json(); } catch { /* Réponse HTML/serveur indisponible. */ }
  if (!res.ok) {
    const detail = isRecord(body) ? (body.message ?? body.error) : null;
    const readable = typeof detail === 'string' && detail.length <= 250
      ? detail : `Erreur HTTP ${res.status} lors du chargement.`;
    throw new Error(readable);
  }
  return body;
}

/** GET /api/company-dashboard/vehicules : affectations visibles pour l'agent. */
export async function getMessayBusAffectations(signal?: AbortSignal): Promise<{
  affectations: MessayBusAffectation[];
  listePotentiellementTronquee: boolean;
}> {
  const body = await getJson('/vehicules', signal);
  if (!isRecord(body) || !Array.isArray(body.affectations)) {
    throw new Error('Le serveur a retourné une liste de départs invalide.');
  }
  const rows: MessayBusAffectation[] = [];
  for (const item of body.affectations) {
    if (!isRecord(item) || typeof item.id !== 'string' ||
        typeof item.gare_id !== 'string' || typeof item.date_depart !== 'string') {
      throw new Error('Une affectation de bus possède un format invalide.');
    }
    rows.push({
      id: item.id,
      gare_id: item.gare_id,
      destination_id: asString(item.destination_id),
      horaire_id: asString(item.horaire_id),
      date_depart: item.date_depart,
      bus_id: asString(item.bus_id),
      numero_bus_snapshot: typeof item.numero_bus_snapshot === 'string' ? item.numero_bus_snapshot : null,
      immatriculation_snapshot: typeof item.immatriculation_snapshot === 'string' ? item.immatriculation_snapshot : null,
      capacite_snapshot: Number(item.capacite_snapshot),
      statut: asString(item.statut),
    });
  }
  // Le serveur limite les affectations à 150. Ne pas prétendre que la liste est exhaustive.
  return { affectations: rows, listePotentiellementTronquee: rows.length >= 150 };
}

/** GET /api/company-dashboard/departs-bus/:id/places (lecture seule). */
export async function getMessayPlacesV1(
  affectationId: string, signal?: AbortSignal,
): Promise<MessayPlacesV1> {
  if (!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(affectationId)) {
    throw new Error('Identifiant du départ invalide.');
  }
  const body = await getJson(`/departs-bus/${encodeURIComponent(affectationId)}/places`, signal);
  if (!isRecord(body) || body.affectation_id !== affectationId ||
      !Array.isArray(body.places)) {
    throw new Error('Inventaire des sièges incomplet ou invalide.');
  }
  const capacite = Number(body.capacite);
  const placesLibres = Number(body.places_libres_registre_v1);
  if (!Number.isInteger(capacite) || capacite < 1 || capacite > 120 ||
      body.places.length !== capacite || !Number.isInteger(placesLibres) ||
      placesLibres < 0 || placesLibres > capacite) {
    throw new Error('Capacité ou inventaire incohérent renvoyé par le serveur.');
  }
  const places: MessaySiege[] = [];
  const numeros = new Set<number>();
  // L'API retourne deux notions distinctes : libre dans le registre
  // et disponible à la vente. Ne jamais les confondre.
  const venteAutorisee = body.vente_autorisee === true;
  const disponibiliteConfirmee = body.disponibilite_confirmee === true;
  const inventaireLegacy = body.inventaire_legacy_non_reconcilie !== false;
  if (venteAutorisee && (!disponibiliteConfirmee || inventaireLegacy)) {
    throw new Error('Le serveur annonce une vente sans disponibilité certifiée.');
  }
  for (const raw of body.places) {
    if (!isRecord(raw)) throw new Error('Format des sièges invalide.');
    const numero = Number(raw.numero);
    if (!Number.isInteger(numero) || numero < 1 || numero > capacite ||
        numeros.has(numero) || typeof raw.disponible !== 'boolean' ||
        typeof raw.libre_dans_registre_v1 !== 'boolean') {
      throw new Error('Inventaire des sièges incohérent.');
    }
    if (raw.disponible === true && (!venteAutorisee || !disponibiliteConfirmee || inventaireLegacy)) {
      throw new Error('Le serveur annonce un siège vendable sans autorisation.');
    }
    numeros.add(numero);
    places.push({
      numero,
      disponible: raw.disponible,
      libre_dans_registre_v1: raw.libre_dans_registre_v1,
    });
  }
  if (places.filter(p => p.libre_dans_registre_v1).length !== placesLibres) {
    throw new Error('Comptage du registre technique incohérent.');
  }
  return {
    affectation_id: affectationId,
    date_depart: asString(body.date_depart),
    capacite,
    places_libres_registre_v1: placesLibres,
    places: places.sort((a, b) => a.numero - b.numero),
    statut_depart: asString(body.statut_depart),
    paiement_actif: body.paiement_actif === true,
    billet_emis: body.billet_emis === true,
    vente_autorisee: venteAutorisee,
    disponibilite_confirmee: disponibiliteConfirmee,
    inventaire_legacy_non_reconcilie: body.inventaire_legacy_non_reconcilie !== false,
    avertissement: asString(body.avertissement),
  };
}

/** Billet payé et émis : le numéro physique n'est jamais déduit du hold. */
export type BilletSiegeCompagnie = Readonly<{
  billet_id: string;
  passager_nom: string;
  siege_numero: number | null;
  statut_attribution: 'EN_ATTENTE' | 'ATTRIBUE';
  prix_xof: number;
}>;

export type DepartBilletsAttribution = Readonly<{
  affectation_id: string;
  capacite: number;
  historique_rapproche: boolean;
  attribution_autorisee: boolean;
  avertissement: string | null;
  billets: BilletSiegeCompagnie[];
}>;

const UUID_SIEGE = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export async function getBilletsAttribution(
  affectationId: string, signal?: AbortSignal,
): Promise<DepartBilletsAttribution> {
  if (!UUID_SIEGE.test(affectationId)) throw new Error('Identifiant de départ invalide.');
  const value = await getJson(`/departs-bus/${encodeURIComponent(affectationId)}/billets-attribution`, signal);
  if (!isRecord(value) || value.affectation_id !== affectationId ||
      typeof value.capacite !== 'number' || !Number.isInteger(value.capacite) ||
      value.capacite < 1 || value.capacite > 120 || !Array.isArray(value.billets) ||
      value.billets.length > value.capacite ||
      typeof value.historique_rapproche !== 'boolean' ||
      typeof value.attribution_autorisee !== 'boolean') {
    throw new Error('Contrat de billets invalides.');
  }
  const ids = new Set<string>();
  const numeros = new Set<number>();
  const billets: BilletSiegeCompagnie[] = [];
  for (const raw of value.billets) {
    if (!isRecord(raw) || !UUID_SIEGE.test(String(raw.billet_id)) || ids.has(String(raw.billet_id)) ||
        typeof raw.passager_nom !== 'string' || !raw.passager_nom.trim() ||
        typeof raw.prix_xof !== 'number' || !Number.isSafeInteger(raw.prix_xof) ||
        (raw.statut_attribution !== 'EN_ATTENTE' && raw.statut_attribution !== 'ATTRIBUE') ||
        (raw.siege_numero !== null &&
          (typeof raw.siege_numero !== 'number' || !Number.isInteger(raw.siege_numero) ||
            raw.siege_numero < 1 || raw.siege_numero > value.capacite || numeros.has(raw.siege_numero))) ||
        (raw.statut_attribution === 'ATTRIBUE') !== (raw.siege_numero !== null)) {
      throw new Error('Billet ou siège incohérent.');
    }
    ids.add(String(raw.billet_id));
    if (typeof raw.siege_numero === 'number') numeros.add(raw.siege_numero);
    billets.push({
      billet_id: String(raw.billet_id), passager_nom: raw.passager_nom.trim(),
      prix_xof: raw.prix_xof, siege_numero: raw.siege_numero as number | null,
      statut_attribution: raw.statut_attribution,
    });
  }
  return {
    affectation_id: affectationId, capacite: value.capacite,
    historique_rapproche: value.historique_rapproche,
    attribution_autorisee: value.historique_rapproche && value.attribution_autorisee,
    avertissement: typeof value.avertissement === 'string' ? value.avertissement : null,
    billets,
  };
}

/** Écriture atomique par l'API compagnie, jamais par un accès Supabase direct navigateur. */
export async function attribuerSiegeCompagnie(
  affectationId: string, billetId: string, siegeNumero: number,
): Promise<{ billet_id: string; siege_numero: number; resultat: string }> {
  if (!UUID_SIEGE.test(affectationId) || !UUID_SIEGE.test(billetId) ||
      !Number.isInteger(siegeNumero) || siegeNumero < 1 || siegeNumero > 120) {
    throw new Error('Attribution invalide.');
  }
  const { data, error } = await messayAuth.auth.getSession();
  if (error || !data.session?.access_token) throw new Error('Session expirée : reconnectez-vous.');
  const res = await fetch(`${backendRoot()}/api/company-dashboard/departs-bus/${encodeURIComponent(affectationId)}/attribuer-siege`, {
    method: 'POST', cache: 'no-store',
    headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ billet_id: billetId, siege_numero: siegeNumero }),
  });
  let body: unknown = null;
  try { body = await res.json(); } catch { /* réponse invalide */ }
  if (!res.ok) {
    const message = isRecord(body) ? (body.message ?? body.error) : null;
    throw new Error(typeof message === 'string' && message.length < 250 ? message : `Attribution refusée (${res.status}).`);
  }
  if (!isRecord(body) || body.billet_id !== billetId || body.siege_numero !== siegeNumero ||
      (body.resultat !== 'ATTRIBUE' && body.resultat !== 'DEJA_ATTRIBUE')) {
    throw new Error('Réponse du serveur invalide : vérifiez le statut avant toute reprise.');
  }
  return { billet_id: billetId, siege_numero: siegeNumero, resultat: body.resultat };
}
