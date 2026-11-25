/**
 * MESSAY Mobile — réservation technique d'une place (STAGING UNIQUEMENT).
 * Ne débite pas de compte, ne confirme pas de billet et ne retourne pas de siège.
 * Ne jamais monter cette route sans le contrôle de projet STAGING ci-dessous.
 */
import { Router, type Request, type Response } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { authenticate } from '../middleware/auth';

export const interurbainReservationRouter = Router();

const UUID = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value);

let stagingClient: SupabaseClient | undefined;

/** Bloque toute écriture en production ET sur le projet Supabase de production. */
function getStagingClient(): SupabaseClient | null {
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.MESSAY_MOBILE_HOLDS_ENABLED !== 'true'
  ) {
    return null;
  }

  const url = (process.env.SUPABASE_URL ?? '').trim();
  const stagingRef = (process.env.MESSAY_STAGING_SUPABASE_PROJECT_REF ?? '')
    .trim().toLowerCase();
  const prodRef = (process.env.MESSAY_PRODUCTION_SUPABASE_PROJECT_REF ?? '')
    .trim().toLowerCase();

  if (
    !/^[a-z0-9-]{6,64}$/.test(stagingRef) ||
    !/^[a-z0-9-]{6,64}$/.test(prodRef) ||
    stagingRef === prodRef
  ) {
    return null;
  }

  let hostname: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
    hostname = parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
  if (hostname !== `${stagingRef}.supabase.co`) return null;

  const secret = [
    process.env.SUPABASE_SECRET_KEY,
    process.env.SERVICE_ROLE_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ].find(value => Boolean(value?.trim()))?.trim();
  if (!secret) return null;
  if (!secret.startsWith('sb_secret_')) {
    if (secret.startsWith('sb_publishable_')) return null;
    const parts = secret.split('.');
    if (parts.length !== 3) return null;
    try {
      const payload: unknown = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      );
      if (
        !payload || typeof payload !== 'object' ||
        !('role' in payload) || payload.role !== 'service_role'
      ) return null;
    } catch {
      return null;
    }
  }

  if (!stagingClient) {
    stagingClient = createClient(url, secret, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }
  return stagingClient;
}

/** POST /api/interurbain/mobile/reservations */
interurbainReservationRouter.post(
  '/mobile/reservations',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.vary('Authorization');

    const db = getStagingClient();
    if (!db) {
      res.status(503).json({
        code: 'RESERVATIONS_MOBILE_DESACTIVEES',
        message: 'Réservations mobiles non activées sur un environnement STAGING autorisé.',
      });
      return;
    }

    // L'identité de l'acteur provient du middleware JWT, jamais du body.
    const actorId = req.user?.id;
    if (!isUuid(actorId)) {
      res.status(401).json({ message: 'Identité voyageur non vérifiée.' });
      return;
    }

    const input: unknown = req.body;
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      res.status(400).json({ message: 'Requête de réservation invalide.' });
      return;
    }
    const body = input as Record<string, unknown>;
    const affectationId = body.affectation_id;
    const requestId = body.request_id;
    if (!isUuid(affectationId) || !isUuid(requestId)) {
      res.status(400).json({
        message: 'affectation_id et request_id doivent être des UUID valides.',
      });
      return;
    }

    try {
      const { data, error } = await db.rpc('messay_mobile_bloquer_place', {
        p_affectation_id: affectationId,
        p_actor: actorId,
        p_request_id: requestId,
      });
      if (error) {
        console.error('[MESSAY/STAGING/MOBILE-PLACE]', { code: error.code });
        const statuses: Record<string, number> = {
          P0002: 404,
          P0001: 409,
          '23505': 409,
          '22023': 400,
          '23514': 400,
          '42501': 403,
        };
        res.status(statuses[error.code] ?? 503).json({
          message: statuses[error.code]
            ? 'Départ non disponible, demande invalide ou réservation en conflit.'
            : 'Réservation momentanément indisponible.',
        });
        return;
      }

      const item: unknown = Array.isArray(data) ? data[0] : null;
      if (!item || typeof item !== 'object') {
        res.status(503).json({ message: 'Réservation non confirmée par la base.' });
        return;
      }
      const record = item as Record<string, unknown>;
      if (
        !isUuid(record.reservation_id) ||
        typeof record.expire_le !== 'string' ||
        record.statut !== 'EN_ATTENTE'
      ) {
        res.status(503).json({ message: 'Réponse de réservation invalide.' });
        return;
      }
      res.status(201).json({
        reservation_id: record.reservation_id,
        expire_le: record.expire_le,
        statut: record.statut,
        paiement_actif: false,
        billet_emis: false,
        environnement: 'STAGING',
      });
    } catch (error: unknown) {
      console.error('[MESSAY/STAGING/MOBILE-PLACE/UNEXPECTED]', error);
      res.status(503).json({ message: 'Réservation momentanément indisponible.' });
    }
  },
);
