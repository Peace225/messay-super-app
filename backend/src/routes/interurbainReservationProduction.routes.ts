/**
 * MESSAY — réservation de capacité interurbaine (PRODUCTION).
 * Cette route réserve une place TECHNIQUE, sans choisir de siège passager,
 * sans appeler GeniusPay et sans émettre de billet.
 *
 * PRÉREQUIS AVANT ACTIVATION :
 * - Fonction public.messay_mobile_bloquer_place(uuid,uuid,uuid) vérifiée en préprod,
 *   transactionnelle/idempotente et présente sur la base de PRODUCTION.
 * - Contraintes SQL uniques sur l'inventaire, la demande et les statuts.
 * - SQL RPC EXECUTE accordé uniquement à service_role.
 * - Identités JWT MESSAY et Supabase rattachées à la MÊME base de production.
 * - MESSAY_PROD_RESERVATIONS_ENABLED=true uniquement après validation.
 */
import { Router, type Request, type Response } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { authenticate } from '../middleware/auth';

export const interurbainReservationProductionRouter = Router();

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const REF = /^[a-z0-9-]{6,64}$/;

function isUuid(input: unknown): input is string {
  return typeof input === 'string' && UUID.test(input);
}

/** Contrôle de forme uniquement. L'authenticité est validée par Supabase. */
function isServerKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return key.length > 40;
  if (key.startsWith('sb_publishable_')) return false;
  if (!key.startsWith('eyJ')) return false;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const claims: unknown = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    );
    return claims !== null && typeof claims === 'object' &&
      !Array.isArray(claims) && 'role' in claims &&
      claims.role === 'service_role';
  } catch {
    return false;
  }
}

/**
 * Les comptes authentifiés par Prisma et les réservations RPC doivent utiliser
 * le MÊME projet Supabase. Refuse les DSN opaques non vérifiables.
 */
function databaseTargetsProject(dsn: string, ref: string): boolean {
  try {
    const url = new URL(dsn);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    const username = decodeURIComponent(url.username);

    if (host === `db.${ref}.supabase.co`) {
      return username === 'postgres' || username === `postgres.${ref}`;
    }
    if (host.endsWith('.pooler.supabase.com')) {
      return username === `postgres.${ref}`;
    }
    return false;
  } catch {
    return false;
  }
}

/** Aucun accès à la base si l'environnement ou ses références sont douteux. */
function getProductionClient(): SupabaseClient | null {
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.MESSAY_PROD_RESERVATIONS_ENABLED !== 'true'
  ) return null;

  const prodRef = (process.env.MESSAY_PRODUCTION_SUPABASE_PROJECT_REF ?? '')
    .trim().toLowerCase();
  const stagingRef = (process.env.MESSAY_STAGING_SUPABASE_PROJECT_REF ?? '')
    .trim().toLowerCase();
  if (!REF.test(prodRef) || !REF.test(stagingRef) || prodRef === stagingRef) {
    return null;
  }

  const rawUrl = (process.env.SUPABASE_URL ?? '').trim();
  let projectUrl: URL;
  try {
    projectUrl = new URL(rawUrl);
  } catch {
    return null;
  }
  if (
    projectUrl.protocol !== 'https:' ||
    projectUrl.hostname.toLowerCase() !== `${prodRef}.supabase.co` ||
    projectUrl.port !== '' ||
    projectUrl.pathname !== '/' ||
    projectUrl.search !== '' ||
    projectUrl.hash !== '' ||
    projectUrl.username !== '' ||
    projectUrl.password !== ''
  ) return null;

  // Le JWT authentifie l'utilisateur depuis Prisma : éviter toute écriture
  // dans un projet distinct de celui qui porte la table User.
  const databaseUrl = process.env.DATABASE_URL ?? '';
  const directUrl = process.env.DIRECT_URL;
  if (
    !databaseTargetsProject(databaseUrl, prodRef) ||
    (directUrl && !databaseTargetsProject(directUrl, prodRef))
  ) return null;

  const keys = [
    process.env.SUPABASE_SECRET_KEY,
    process.env.SERVICE_ROLE_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ].map(value => value?.trim()).filter((value): value is string => !!value);

  // Évite d'utiliser silencieusement une seconde clé lorsque les variables
  // d'environnement sont contradictoires.
  if (keys.length === 0 || new Set(keys).size !== 1) return null;
  const key = keys[0];
  if (!key || !isServerKey(key)) return null;

  return createClient(projectUrl.origin, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

type ReservationRow = {
  reservation_id?: unknown;
  actor_user_id?: unknown;
  affectation_id?: unknown;
  request_id?: unknown;
  expire_le?: unknown;
  statut?: unknown;
};

const postgresHttpCodes: Readonly<Record<string, number>> = {
  P0002: 404, // départ introuvable
  P0001: 409, // indisponible / expiré
  '23505': 409, // demande déjà affectée à une autre réservation
  '23503': 409, // dépendance manquante
  '22023': 400, // argument invalide
  '23514': 400, // contrainte de données
  '42501': 403, // droits insuffisants
};

/** POST /api/interurbain/mobile/reservations */
interurbainReservationProductionRouter.post(
  '/mobile/reservations',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.vary('Authorization');

    // Vérifier l'environnement AVANT tout appel SQL de réservation.
    const db = getProductionClient();
    if (!db) {
      res.status(503).json({
        code: 'RESERVATIONS_PRODUCTION_DESACTIVEES',
        message: 'Réservation interurbaine indisponible.',
      });
      return;
    }

    const actorId: unknown = req.user?.id;
    if (!isUuid(actorId)) {
      res.status(401).json({ code: 'IDENTITE_NON_VERIFIEE' });
      return;
    }
    if (!req.is('application/json')) {
      res.status(415).json({ code: 'CONTENT_TYPE_INVALIDE' });
      return;
    }

    const input: unknown = req.body;
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      res.status(400).json({ code: 'REQUETE_INVALIDE' });
      return;
    }
    const body = input as Record<string, unknown>;
    if (
      Object.keys(body).some(k => !['affectation_id', 'request_id'].includes(k)) ||
      !isUuid(body.affectation_id) ||
      !isUuid(body.request_id)
    ) {
      res.status(400).json({
        code: 'PARAMETRES_INVALIDES',
        message: 'affectation_id et request_id doivent être des UUID.',
      });
      return;
    }

    const affectationId = body.affectation_id;
    const requestId = body.request_id;

    try {
      // Une seule RPC doit gérer la sérialisation, le stock et l'idempotence.
      // La clé privée ne doit jamais être envoyée au téléphone.
      const { data, error } = await db.rpc('messay_mobile_bloquer_place', {
        p_affectation_id: affectationId,
        p_actor: actorId,
        p_request_id: requestId,
      });

      if (error) {
        const pgCode = typeof error.code === 'string' ? error.code : undefined;
        const status = pgCode ? (postgresHttpCodes[pgCode] ?? 503) : 503;
        console.error('[MESSAY/PROD/RESERVATIONS/RPC]', { pgCode: pgCode ?? 'unknown' });
        res.status(status).json({
          code: status === 503 ? 'RESERVATION_INDISPONIBLE' : 'RESERVATION_REFUSEE',
          message: status === 503
            ? 'Réservation momentanément indisponible.'
            : 'Départ indisponible ou réservation en conflit.',
        });
        return;
      }

      const item: unknown = Array.isArray(data)
        ? (data.length === 1 ? data[0] : null)
        : data;
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        res.status(503).json({ code: 'REPONSE_RESERVATION_INVALIDE' });
        return;
      }
      const record = item as ReservationRow;
      const expireMs = typeof record.expire_le === 'string'
        ? Date.parse(record.expire_le)
        : NaN;
      if (
        !isUuid(record.reservation_id) ||
        record.statut !== 'EN_ATTENTE' ||
        !Number.isFinite(expireMs) ||
        expireMs <= Date.now()
      ) {
        res.status(409).json({ code: 'RESERVATION_NON_UTILISABLE' });
        return;
      }

      // Postcondition : la réservation SQL retournée appartient bien à ce JWT,
      // à cette affectation et à cette même demande. Ne jamais retourner un ID
      // non vérifié si la fonction SQL a été modifiée en production.
      const { data: hold, error: lookupError } = await db
        .from('messay_bus_sieges_reservations')
        .select('id, actor_user_id, affectation_id, request_id, expire_le, statut')
        .eq('id', record.reservation_id)
        .maybeSingle();

      if (
        lookupError || !hold ||
        hold.id !== record.reservation_id ||
        !isUuid(hold.actor_user_id) ||
        hold.actor_user_id.toLowerCase() !== actorId.toLowerCase() ||
        !isUuid(hold.affectation_id) ||
        hold.affectation_id.toLowerCase() !== affectationId.toLowerCase() ||
        !isUuid(hold.request_id) ||
        hold.request_id.toLowerCase() !== requestId.toLowerCase() ||
        hold.statut !== 'EN_ATTENTE' ||
        typeof hold.expire_le !== 'string' ||
        !Number.isFinite(Date.parse(hold.expire_le)) ||
        Date.parse(hold.expire_le) <= Date.now()
      ) {
        console.error('[MESSAY/PROD/RESERVATIONS/POSTCONDITION]', {
          code: lookupError?.code ?? 'record_mismatch',
        });
        res.status(503).json({ code: 'RESERVATION_A_VERIFIER' });
        return;
      }

      res.status(201).json({
        reservation_id: record.reservation_id,
        expire_le: hold.expire_le,
        statut: 'EN_ATTENTE',
        siege: null, // Attribution ultérieure par la compagnie
        paiement_actif: false,
        billet_emis: false,
        environnement: 'PRODUCTION',
      });
    } catch (error: unknown) {
      console.error('[MESSAY/PROD/RESERVATIONS/UNEXPECTED]', {
        type: error instanceof Error ? error.name : 'unknown',
      });
      res.status(503).json({ code: 'RESERVATION_INDISPONIBLE' });
    }
  },
);
