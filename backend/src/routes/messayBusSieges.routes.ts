/**
 * MESSAY PRO — inventaire partiel et blocages de sièges pour le guichet.
 *
 * IMPORTANT : aucun paiement, aucune vente et aucun billet ne sont créés ici.
 * Ce module doit être enregistré UNIQUEMENT dans le routeur compagnie protégé.
 * Les écritures sont strictement limitées à un projet Supabase de développement
 * distinct du projet de production et explicitement autorisé.
 *
 * Le passager ne sélectionne pas son siège : les RPC guichet manipulées ici
 * sont distinctes du blocage de capacité mobile messay_mobile_bloquer_place.
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
  statut: 'EN_ATTENTE';
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function noCache(res: Response): void {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.vary('Authorization');
}

export function registerMessayBusSiegesRoutes({
  router, db, guard, wrap, HttpError, uuid,
}: Dependencies): void {
  function seatScope(access: Access, depart: DepartSieges): void {
    if (!uuid(access.userId) || !uuid(access.company_id) ||
        depart.company_id !== access.company_id ||
        (access.role !== 'DIRECTION' &&
          (!Array.isArray(access.gare_ids) || !access.gare_ids.includes(depart.gare_id)))) {
      // 404 pour ne pas révéler les départs d'autres compagnies ou gares.
      throw new HttpError(404, 'Départ introuvable.');
    }
  }

  async function findScopedDepart(access: Access, id: string): Promise<DepartSieges> {
    if (!uuid(id)) throw new HttpError(400, 'Identifiant de départ invalide.');
    if (!uuid(access.company_id) || !uuid(access.userId)) {
      throw new HttpError(403, 'Accès compagnie invalide.');
    }

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
    if (!uuid(depart.id) || !uuid(depart.company_id) || !uuid(depart.gare_id) ||
        typeof depart.date_depart !== 'string' || typeof depart.statut !== 'string') {
      throw new HttpError(503, 'Données du départ invalides.');
    }
    seatScope(access, depart);
    return depart;
  }

  function seatRpcError(code?: string): Error {
    switch (code) {
      case '23505': return new HttpError(409, 'Siège indisponible ou demande déjà utilisée.');
      case 'P0002': return new HttpError(404, 'Départ ou réservation introuvable.');
      case '22023':
      case '23514': return new HttpError(400, 'Paramètres de réservation invalides.');
      case 'P0001': return new HttpError(409, 'Départ ou réservation non disponible.');
      case '42501': return new HttpError(403, 'Accès refusé.');
      default: return new HttpError(503, 'Service de réservation momentanément indisponible.');
    }
  }

  /**
   * Fail closed. Le mode développement ne suffit jamais à autoriser une écriture.
   * On vérifie l'URL réellement configurée dans le client Supabase injecté.
   */
  function requireTestHoldsEnabled(): void {
    const devRef = process.env.MESSAY_TEST_SUPABASE_PROJECT_REF?.trim().toLowerCase();
    const prodRef = process.env.MESSAY_PRODUCTION_SUPABASE_PROJECT_REF?.trim().toLowerCase();
    const clientUrl = (db as SupabaseClient & { supabaseUrl?: string }).supabaseUrl;
    const validRef = (ref: string | undefined): ref is string =>
      typeof ref === 'string' && /^[a-z0-9-]{6,64}$/.test(ref);

    let actualHost = '';
    let https = false;
    try {
      const url = new URL(clientUrl ?? '');
      actualHost = url.hostname.toLowerCase();
      https = url.protocol === 'https:';
    } catch {
      // URL absente : écriture refusée.
    }

    if (!(process.env.NODE_ENV === 'development' &&
        process.env.MESSAY_GUICHET_HOLDS_ENABLED === 'true' &&
        validRef(devRef) && validRef(prodRef) && devRef !== prodRef &&
        https && actualHost === `${devRef}.supabase.co`)) {
      throw new HttpError(503,
        'Blocage de sièges désactivé : projet Supabase de test distinct requis.');
    }
  }

  function requireTicketAgent(access: Access): void {
    if (access.role !== 'AGENT_BILLETTERIE' || !uuid(access.userId)) {
      throw new HttpError(403, 'Agent de billetterie requis.');
    }
  }

  function parseReservationResult(data: unknown, expectedSeat: number): ReservationResult {
    if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
      throw new HttpError(503, 'Réponse de réservation invalide.');
    }
    const row = data[0];
    if (!uuid(row.reservation_id) ||
        typeof row.siege_numero !== 'number' || row.siege_numero !== expectedSeat ||
        typeof row.expire_le !== 'string' ||
        !Number.isFinite(Date.parse(row.expire_le)) ||
        Date.parse(row.expire_le) <= Date.now() ||
        row.statut !== 'EN_ATTENTE') {
      throw new HttpError(503, 'Réservation non confirmée par la base.');
    }
    return {
      reservation_id: row.reservation_id,
      siege_numero: row.siege_numero,
      expire_le: row.expire_le,
      statut: 'EN_ATTENTE',
    };
  }

  /**
   * GET : lecture d'un registre PARTIEL. La base peut contenir d'anciens billets
   * non rapprochés ; aucune place ne doit être annoncée comme vendable.
   */
  router.get('/departs-bus/:affectationId/places', wrap(async (req, res) => {
    noCache(res);
    const access = guard(req);
    const depart = await findScopedDepart(access, String(req.params.affectationId ?? ''));
    const capacite = Number(depart.capacite_snapshot);
    if (!Number.isInteger(capacite) || capacite < 1 || capacite > 120) {
      throw new HttpError(503, 'Capacité du bus invalide.');
    }

    const nowIso = new Date().toISOString();
    const [confirmed, pending] = await Promise.all([
      db.from('messay_bus_sieges_reservations')
        .select('siege_numero', { count: 'exact' })
        .eq('affectation_id', depart.id)
        .eq('statut', 'CONFIRMEE')
        .limit(capacite + 1),
      db.from('messay_bus_sieges_reservations')
        .select('siege_numero', { count: 'exact' })
        .eq('affectation_id', depart.id)
        .eq('statut', 'EN_ATTENTE')
        .gt('expire_le', nowIso)
        .limit(capacite + 1),
    ]);

    if (confirmed.error || pending.error) {
      console.error('[MESSAY/sieges] lecture inventaire', {
        code: confirmed.error?.code ?? pending.error?.code,
      });
      throw new HttpError(503, 'Inventaire de places indisponible.');
    }

    // Un plafond de lignes PostgREST peut tronquer silencieusement les résultats.
    // Un count exact différent du nombre de lignes impose un refus (fail closed).
    if (!confirmed.data || !pending.data ||
        confirmed.count === null || pending.count === null ||
        confirmed.count !== confirmed.data.length ||
        pending.count !== pending.data.length ||
        confirmed.count + pending.count > capacite) {
      throw new HttpError(503, 'Inventaire incomplet ou incohérent.');
    }

    const occupes = new Set<number>();
    for (const row of [...confirmed.data, ...pending.data]) {
      const numero = row.siege_numero;
      if (typeof numero !== 'number' || !Number.isInteger(numero) ||
          numero < 1 || numero > capacite || occupes.has(numero)) {
        throw new HttpError(503, 'Inventaire incohérent : vérification nécessaire.');
      }
      occupes.add(numero);
    }

    const places = Array.from({ length: capacite }, (_, index) => ({
      numero: index + 1,
      // Ne jamais présenter le registre partiel comme une disponibilité vendable.
      disponible: false,
      libre_dans_registre_v1: !occupes.has(index + 1),
    }));

    res.status(200).json({
      affectation_id: depart.id,
      date_depart: depart.date_depart,
      capacite,
      places_libres_registre_v1: capacite - occupes.size,
      places,
      statut_depart: depart.statut,
      paiement_actif: false,
      billet_emis: false,
      vente_autorisee: false,
      disponibilite_confirmee: false,
      inventaire_legacy_non_reconcilie: true,
      avertissement: 'Registre partiel : billets historiques non rapprochés. Vente désactivée.',
    });
  }));

  /**
   * POST : blocage de 10 minutes pour un agent de guichet en base de TEST.
   * La RPC doit assurer elle-même les verrous, l'idempotence et l'isolation.
   */
  router.post('/departs-bus/:affectationId/reservations', wrap(async (req, res) => {
    noCache(res);
    const access = guard(req);
    requireTicketAgent(access);
    requireTestHoldsEnabled();
    const depart = await findScopedDepart(access, String(req.params.affectationId ?? ''));

    const body: unknown = req.body;
    if (!isRecord(body)) throw new HttpError(400, 'Corps JSON invalide.');
    const siege = body.siege_numero;
    const requestId = body.request_id;
    const capacite = Number(depart.capacite_snapshot);
    if (!Number.isInteger(capacite) || capacite < 1 || capacite > 120) {
      throw new HttpError(503, 'Capacité du bus invalide.');
    }
    if (typeof siege !== 'number' || !Number.isInteger(siege) ||
        siege < 1 || siege > capacite || !uuid(requestId)) {
      throw new HttpError(400, 'siege_numero valide et request_id UUID requis.');
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

    const reservation = parseReservationResult(result.data, siege);
    res.status(201).json({
      reservation,
      paiement_actif: false,
      billet_emis: false,
    });
  }));

  /** DELETE : libération de la réservation temporaire créée par l'agent. */
  router.delete('/departs-bus/:affectationId/reservations/:reservationId', wrap(async (req, res) => {
    noCache(res);
    const access = guard(req);
    requireTicketAgent(access);
    requireTestHoldsEnabled();
    const depart = await findScopedDepart(access, String(req.params.affectationId ?? ''));
    const reservationId = String(req.params.reservationId ?? '');
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


  /** Attribution commerciale séparée du hold technique (aucun lien avec la vente au guichet V1). */
  function requireAttributionRole(access: Access): void {
    if (!['DIRECTION', 'CHEF_GARE', 'AGENT_BILLETTERIE'].includes(access.role)) {
      throw new HttpError(403, 'Attribution réservée à la compagnie et à ses agents habilités.');
    }
  }

  /** Activation explicite par environnement ET par projet de données. */
  function requireAttributionFeature(flag: 'MESSAY_SEATS_READ_ENABLED' | 'MESSAY_SEATS_WRITE_ENABLED'): void {
    const ref = (process.env.MESSAY_SEATS_SUPABASE_PROJECT_REF ?? '').trim().toLowerCase();
    const url = (db as SupabaseClient & { supabaseUrl?: string }).supabaseUrl;
    const expected = `https://${ref}.supabase.co`;
    let databaseMatches = false;
    try {
      const database = new URL(process.env.DATABASE_URL ?? '');
      const host = database.hostname.toLowerCase();
      const login = decodeURIComponent(database.username);
      databaseMatches = (database.protocol === 'postgres:' || database.protocol === 'postgresql:') &&
        ((host === `db.${ref}.supabase.co` && (login === 'postgres' || login === `postgres.${ref}`)) ||
         (host.endsWith('.pooler.supabase.com') && login === `postgres.${ref}`));
    } catch { /* refus */ }
    if (process.env.NODE_ENV !== 'production' || process.env[flag] !== 'true' ||
        !/^[a-z0-9-]{6,64}$/.test(ref) || url !== expected ||
        (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '') !== expected ||
        !databaseMatches) {
      throw new HttpError(503, 'Attribution des sièges non activée pour ce projet.');
    }
  }

  /** GET : seulement les billets du NOUVEAU moteur réellement émis et confirmés. */
  router.get('/departs-bus/:affectationId/billets-attribution', wrap(async (req, res) => {
    noCache(res);
    const access = guard(req);
    requireAttributionRole(access);
    requireAttributionFeature('MESSAY_SEATS_READ_ENABLED');
    const depart = await findScopedDepart(access, String(req.params.affectationId ?? ''));
    const capacity = Number(depart.capacite_snapshot);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 120) {
      throw new HttpError(503, 'Capacité du départ invalide.');
    }
    const [result, verified] = await Promise.all([
      db.rpc('messay_compagnie_lister_billets_attribution', {
        p_affectation_id: depart.id,
        p_company_id: access.company_id,
        p_gare_id: depart.gare_id,
      }),
      db.from('messay_interurbain_departs_places_verifies')
        .select('affectation_id,company_id,gare_id')
        .eq('affectation_id', depart.id).maybeSingle(),
    ]);
    if (result.error || verified.error || !Array.isArray(result.data) || result.data.length > capacity) {
      console.error('[MESSAY/ATTRIBUTION/LIST]', {
        code: result.error?.code ?? verified.error?.code ?? 'invalid_result',
      });
      throw new HttpError(503, 'Liste de billets indisponible ou incohérente.');
    }
    const billets: Array<{ billet_id: string; passager_nom: string; siege_numero: number | null;
      statut_attribution: 'EN_ATTENTE' | 'ATTRIBUE'; prix_xof: number }> = [];
    const uniqueTickets = new Set<string>();
    const uniqueSeats = new Set<number>();
    for (const raw of result.data as unknown[]) {
      if (!isRecord(raw) || !uuid(raw.billet_id) || uniqueTickets.has(raw.billet_id) ||
          typeof raw.passager_nom !== 'string' || !raw.passager_nom.trim() ||
          typeof raw.prix_xof !== 'number' || !Number.isSafeInteger(raw.prix_xof) ||
          raw.prix_xof < 200 || raw.prix_xof > 2_500_000 ||
          !['EN_ATTENTE', 'ATTRIBUE'].includes(String(raw.statut_attribution)) ||
          (raw.siege_numero !== null && (typeof raw.siege_numero !== 'number' ||
            !Number.isInteger(raw.siege_numero) || raw.siege_numero < 1 ||
            raw.siege_numero > capacity || uniqueSeats.has(raw.siege_numero))) ||
          ((raw.statut_attribution === 'ATTRIBUE') !== (raw.siege_numero !== null))) {
        throw new HttpError(503, 'Données de sièges incohérentes.');
      }
      uniqueTickets.add(raw.billet_id);
      if (typeof raw.siege_numero === 'number') uniqueSeats.add(raw.siege_numero);
      billets.push({
        billet_id: raw.billet_id, passager_nom: raw.passager_nom.trim(),
        siege_numero: raw.siege_numero as number | null,
        statut_attribution: raw.statut_attribution as 'EN_ATTENTE' | 'ATTRIBUE',
        prix_xof: raw.prix_xof,
      });
    }
    const rapproche = verified.data?.affectation_id === depart.id &&
      verified.data?.company_id === access.company_id &&
      verified.data?.gare_id === depart.gare_id;
    res.status(200).json({
      affectation_id: depart.id, capacite: capacity, billets,
      historique_rapproche: rapproche,
      attribution_autorisee: rapproche && process.env.MESSAY_SEATS_WRITE_ENABLED === 'true',
      avertissement: rapproche ? null : 'Billets historiques non rapprochés : attribution bloquée.',
    });
  }));

  /** POST : requête contrôlée, opération atomique assurée par l'unique RPC SQL. */
  router.post('/departs-bus/:affectationId/attribuer-siege', wrap(async (req, res) => {
    noCache(res);
    const access = guard(req);
    requireAttributionRole(access);
    requireAttributionFeature('MESSAY_SEATS_WRITE_ENABLED');
    const depart = await findScopedDepart(access, String(req.params.affectationId ?? ''));
    if (!isRecord(req.body) ||
        Object.keys(req.body).some(k => !['billet_id','siege_numero'].includes(k)) ||
        !uuid(req.body.billet_id) || typeof req.body.siege_numero !== 'number' ||
        !Number.isInteger(req.body.siege_numero) || req.body.siege_numero < 1 ||
        req.body.siege_numero > Number(depart.capacite_snapshot)) {
      throw new HttpError(400, 'billet_id UUID et siege_numero dans la capacité requis.');
    }
    const billetId = req.body.billet_id;
    const numero = req.body.siege_numero;
    const { data, error } = await db.rpc('messay_compagnie_attribuer_siege', {
      p_ticket_id: billetId, p_affectation_id: depart.id,
      p_company_id: access.company_id, p_gare_id: depart.gare_id,
      p_actor: access.userId, p_siege_numero: numero,
    });
    if (error) {
      console.error('[MESSAY/ATTRIBUTION/WRITE]', { code: error.code });
      throw seatRpcError(error.code);
    }
    const value: unknown = Array.isArray(data) ? (data.length === 1 ? data[0] : null) : data;
    if (!isRecord(value) || value.billet_id !== billetId || value.siege_numero !== numero ||
        !['ATTRIBUE','DEJA_ATTRIBUE'].includes(String(value.resultat))) {
      throw new HttpError(503, 'Réponse d’attribution invalide.');
    }
    // Postcondition : confirmation de la ligne réellement enregistrée, sans simuler de succès.
    const row = await db.from('messay_interurbain_sieges_attribues')
      .select('ticket_id,affectation_id,company_id,gare_id,siege_numero')
      .eq('ticket_id', billetId).maybeSingle();
    if (row.error || !row.data || row.data.ticket_id !== billetId ||
        row.data.affectation_id !== depart.id || row.data.company_id !== access.company_id ||
        row.data.gare_id !== depart.gare_id || row.data.siege_numero !== numero) {
      throw new HttpError(503, 'Attribution enregistrée mais confirmation de lecture indisponible.');
    }
    res.status(200).json({ billet_id: billetId, siege_numero: numero, resultat: value.resultat });
  }));

}
