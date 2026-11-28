/**
 * MESSAY PRO — routes de réservation provisoire des sièges interurbains.
 * Aucun paiement et aucun billet n'est créé par ce module.
 * L'accès est fourni EXCLUSIVEMENT par le routeur compagnie authentifié.
 * Ventes réelles et disponibilité globale toujours désactivées (billets legacy non rapprochés).
 */
import type { Request, RequestHandler, Response, Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

type Access = {
  userId: string;
  company_id: string;
  role: string;
  gare_ids: string[];
};

type AuthedRequest = Request & { messay?: Access };
type RouteAsyncHandler = (req: AuthedRequest, res: Response) => Promise<void>;

type Dependencies = {
  router: Router;
  db: SupabaseClient;
  guard: (req: AuthedRequest) => Access;
  wrap: (fn: RouteAsyncHandler) => RequestHandler;
  HttpError: new (code: number, message: string) => Error;
  uuid: (value: unknown) => value is string;
};

type DepartSieges = {
  id: string;
  company_id: string;
  gare_id: string;
  date_depart: string;
  capacite_snapshot: number;
  statut: string;
};

type ReservationResult = {
  reservation_id: string;
  siege_numero: number;
  expire_le: string;
  statut: string;
};

export function registerMessayBusSiegesRoutes({
  router, db, guard, wrap, HttpError, uuid,
}: Dependencies): void {
  function seatScope(access: Access, depart: DepartSieges): void {
    if (depart.company_id !== access.company_id ||
        (access.role !== 'DIRECTION' && !access.gare_ids.includes(depart.gare_id))) {
      throw new HttpError(404, 'Départ introuvable.');
    }
  }

  async function findScopedDepart(access: Access, id: string): Promise<DepartSieges> {
    if (!uuid(id)) throw new HttpError(400, 'Identifiant de départ invalide.');
    const result = await db.from('messay_bus_affectations')
      .select('id,company_id,gare_id,date_depart,capacite_snapshot,statut')
      .eq('id', id)
      .eq('company_id', access.company_id)
      .maybeSingle();

    if (result.error) {
      console.error('[MESSAY/sieges] lecture départ', { code: result.error.code });
      throw new HttpError(503, 'Départs momentanément indisponibles.');
    }
    if (!result.data) throw new HttpError(404, 'Départ introuvable.');
    const depart = result.data as DepartSieges;
    seatScope(access, depart);
    return depart;
  }

  function seatRpcError(code?: string): Error {
    switch (code) {
      case '23505': return new HttpError(409, 'Ce siège est déjà réservé ou la demande est en conflit.');
      case 'P0002': return new HttpError(404, 'Départ introuvable.');
      case '22023':
      case '23514': return new HttpError(400, 'Réservation invalide.');
      case 'P0001': return new HttpError(409, 'Départ ou réservation non disponible.');
      case '42501': return new HttpError(403, 'Accès refusé.');
      default: return new HttpError(503, 'Service de réservation momentanément indisponible.');
    }
  }

  function requireTestHoldsEnabled(): void {
    if (process.env.NODE_ENV === 'production' ||
        process.env.MESSAY_GUICHET_HOLDS_ENABLED !== 'true') {
      throw new HttpError(503, 'Blocage des sièges désactivé : essais autorisés uniquement hors production.');
    }
  }

  // Lecture d'inventaire partiel : NE PAS annoncer des places réellement vendables.
  router.get('/departs-bus/:affectationId/places', wrap(async (req, res) => {
    const access = guard(req);
    const depart = await findScopedDepart(access, String(req.params.affectationId || ''));
    const capacite = Number(depart.capacite_snapshot);
    if (!Number.isInteger(capacite) || capacite < 1 || capacite > 120) {
      throw new HttpError(503, 'Capacité du bus invalide : vérification administrative requise.');
    }

    // Requêtes séparées : les blocages expirés ne saturent pas la pagination
    // et ne masquent pas des réservations actives plus récentes.
    const nowIso = new Date().toISOString();
    const [confirmed, pending] = await Promise.all([
      db.from('messay_bus_sieges_reservations')
        .select('siege_numero').eq('affectation_id', depart.id)
        .eq('statut', 'CONFIRMEE').limit(capacite + 1),
      db.from('messay_bus_sieges_reservations')
        .select('siege_numero').eq('affectation_id', depart.id)
        .eq('statut', 'EN_ATTENTE').gt('expire_le', nowIso)
        .limit(capacite + 1),
    ]);
    if (confirmed.error || pending.error) {
      console.error('[MESSAY/sieges] lecture inventaire', {
        code: confirmed.error?.code ?? pending.error?.code,
      });
      throw new HttpError(503, 'Inventaire de places indisponible.');
    }

    const rows = [...(confirmed.data || []), ...(pending.data || [])];
    // Si les données sont incohérentes ou tronquées, on ne publie pas un faux total.
    if (rows.length > capacite) {
      throw new HttpError(503, 'Inventaire incohérent : vérification nécessaire.');
    }
    const occupes = new Set<number>();
    for (const entry of rows) {
      const numero = Number(entry.siege_numero);
      if (!Number.isInteger(numero) || numero < 1 || numero > capacite || occupes.has(numero)) {
        throw new HttpError(503, 'Inventaire incohérent : vérification nécessaire.');
      }
      occupes.add(numero);
    }

    const places = Array.from({ length: capacite }, (_, index) => ({
      numero: index + 1,
      disponible: !occupes.has(index + 1),
    }));
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      affectation_id: depart.id,
      date_depart: depart.date_depart,
      capacite,
      places_libres_registre_v1: capacite - occupes.size,
      places,
      statut_depart: depart.statut,
      paiement_actif: false,
      billet_emis: false,
      disponibilite_confirmee: false,
      inventaire_legacy_non_reconcilie: true,
      avertissement: 'Inventaire partiel : anciens billets mobiles non rapprochés. Vente désactivée.',
    });
  }));

  // Réservation TEMPORAIRE (10 min via la fonction SQL) : aucune vente.
  router.post('/departs-bus/:affectationId/reservations', wrap(async (req, res) => {
    const access = guard(req);
    if (access.role !== 'AGENT_BILLETTERIE') {
      throw new HttpError(403, 'Agent de billetterie requis.');
    }
    requireTestHoldsEnabled();
    const depart = await findScopedDepart(access, String(req.params.affectationId || ''));
    const siege = req.body?.siege_numero;
    const requestId = req.body?.request_id;
    if (!Number.isInteger(siege) || siege < 1 || siege > 120 || !uuid(requestId)) {
      throw new HttpError(400, 'siege_numero (entier) et request_id (UUID) requis.');
    }
    const result = await db.rpc('messay_guichet_bloquer_siege', {
      p_affectation_id: depart.id,
      p_company_id: access.company_id,
      p_gare_id: depart.gare_id,
      p_actor: access.userId,
      p_siege_numero: siege,
      p_request_id: requestId,
    });
    if (result.error) {
      console.error('[MESSAY/sieges] blocage', { code: result.error.code });
      throw seatRpcError(result.error.code);
    }
    const payload: unknown = Array.isArray(result.data) ? result.data[0] : null;
    if (!payload || typeof payload !== 'object' ||
        !('reservation_id' in payload) || !uuid(payload.reservation_id)) {
      throw new HttpError(503, 'Réservation non confirmée par la base.');
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({
      reservation: payload as ReservationResult,
      paiement_actif: false,
      billet_emis: false,
    });
  }));

  // Annulation du blocage : la fonction SQL vérifie aussi l'agent créateur.
  router.delete('/departs-bus/:affectationId/reservations/:reservationId', wrap(async (req, res) => {
    const access = guard(req);
    if (access.role !== 'AGENT_BILLETTERIE') {
      throw new HttpError(403, 'Agent de billetterie requis.');
    }
    requireTestHoldsEnabled();
    const depart = await findScopedDepart(access, String(req.params.affectationId || ''));
    const reservationId = String(req.params.reservationId || '');
    if (!uuid(reservationId)) throw new HttpError(400, 'Identifiant de réservation invalide.');

    const result = await db.rpc('messay_guichet_liberer_siege', {
      p_reservation_id: reservationId,
      p_affectation_id: depart.id,
      p_company_id: access.company_id,
      p_gare_id: depart.gare_id,
      p_actor: access.userId,
    });
    if (result.error) {
      console.error('[MESSAY/sieges] libération', { code: result.error.code });
      throw seatRpcError(result.error.code);
    }
    if (result.data !== true) {
      throw new HttpError(404, 'Réservation active introuvable pour cet agent.');
    }
    res.status(204).end();
  }));
}
