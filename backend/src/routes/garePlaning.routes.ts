/**
 * MESSAY PRO — Planification locale des gares (transport interurbain).
 * IMPORTANT : monter APRÈS companyDashboardGaresRouter : ce dernier vérifie
 * Supabase Auth et enrichit req.messay à partir des affectations SQL actives.
 * Monter AVANT messayCompanyDashboardErrorHandler et le 404.
 * Aucune permission déduite d'un rôle ou d'un identifiant transmis par React.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const url = String(process.env.SUPABASE_URL || '').trim();
const configuredKeys = [process.env.SUPABASE_SECRET_KEY, process.env.SERVICE_ROLE_KEY,
  process.env.SUPABASE_SERVICE_ROLE_KEY];
function isServerKey(value: string) {
  if (value.startsWith('sb_secret_')) return true;
  if (value.startsWith('sb_publishable_')) return false;
  try {
    const split = value.split('.');
    return split.length === 3 && JSON.parse(Buffer.from(split[1], 'base64url').toString('utf8')).role === 'service_role';
  } catch { return false; }
}
// Retenir une clé serveur valide même si une variable prioritaire contient
// par erreur une clé publique. Ne jamais utiliser sb_publishable_ ici.
const key = configuredKeys.map(v => String(v || '').trim()).find(isServerKey) || '';
if (!url || !key) {
  throw new Error('MESSAY Planning : SUPABASE_URL et clé service_role serveur obligatoires.');
}
const db = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
export const garePlanningRouter = Router();

const isUuid = (v: unknown): v is string => typeof v === 'string' &&
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const isHour = (v: unknown): v is string => typeof v === 'string' &&
  /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(v);
const nonempty = (v: unknown) => typeof v === 'string' ? v.trim() : '';
const moneyOk = (v: unknown): v is number => typeof v === 'number' &&
  Number.isSafeInteger(v) && v >= 100 && v <= 1_000_000;

type Role = 'DIRECTION' | 'CHEF_GARE' | 'AGENT_BILLETTERIE' | 'AGENT_CAISSE' |
  'AGENT_EMBARQUEMENT' | 'AGENT_EXPLOITATION';
type Actor = {
  userId: string; company_id: string; role: Role; gare_ids: string[];
  display_name: string;
};
type AuthRequest = Request & { messay?: Actor };
class PlanningError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = 'PlanningError';
  }
}
const fail = (status: number, message: string, code?: string): never => {
  throw new PlanningError(status, message, code);
};
const wrap = (handler: (req: AuthRequest, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    void handler(req as AuthRequest, res).catch(next);
  };
function actor(req: AuthRequest): Actor {
  const data = req.messay;
  if (!data || !isUuid(data.userId) || !isUuid(data.company_id)) {
    return fail(401, 'MESSAY PRO : session compagnie non authentifiée.');
  }
  return data;
}
function director(req: AuthRequest) {
  const a = actor(req);
  if (a.role !== 'DIRECTION') return fail(403, 'MESSAY PRO : décision réservée à la Direction.');
  return a;
}
async function gareScoped(req: AuthRequest): Promise<{ gareId: string; actor: Actor }> {
  const a = actor(req);
  const gareId = String(req.params.gareId || '');
  if (!isUuid(gareId)) return fail(400, 'Identifiant de gare invalide.');
  if (a.role !== 'DIRECTION' && !a.gare_ids.includes(gareId)) {
    return fail(403, 'Cette gare ne vous est pas affectée.');
  }
  const result = await db.from('gares').select('id').eq('id', gareId)
    .eq('company_id', a.company_id).maybeSingle();
  const gare = dataOrFail(result, 'gare autorisée');
  if (!gare) return fail(404, 'Gare introuvable dans votre compagnie.');
  return { gareId, actor: a };
}
type DbError = {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
};
type DbResult<T> = { data: T | null; error: DbError | null };

/** Les détails SQL restent dans les logs du backend, jamais dans la réponse publique. */
function logDatabaseError(action: string, error: DbError, context?: Record<string, unknown>): void {
  console.error(`[MESSAY/PLANNING] ${action}`, {
    code: error.code ?? 'UNKNOWN',
    message: error.message,
    details: error.details ?? null,
    hint: error.hint ?? null,
    ...context,
  });
}

function dataOrFail<T>(result: DbResult<T>, label: string): T | null {
  if (result.error) {
    logDatabaseError(`lecture ${label}`, result.error);
    if (['42P01', '42703', 'PGRST204', 'PGRST205'].includes(result.error.code || '')) {
      return fail(503, `MESSAY PRO : schéma de planification indisponible (${label}).`, 'PLANNING_SCHEMA');
    }
    if (result.error.code === '42501') {
      return fail(403, 'MESSAY PRO : accès aux données de planification refusé.', 'PLANNING_ACCESS');
    }
    return fail(503, `MESSAY PRO : données momentanément indisponibles (${label}).`, 'PLANNING_READ');
  }
  return result.data;
}

/**
 * Une écriture SQL doit être traitée comme telle : ne jamais la qualifier de
 * « lecture impossible ». Les codes utiles sont exposés de manière contrôlée.
 */
function insertionOrFail<T>(result: DbResult<T>, context: {
  company_id: string;
  gare_id: string;
  type: string;
}): T {
  if (result.error) {
    const e = result.error;
    logDatabaseError('création demande', e, context);
    switch (e.code) {
      case '23505':
        return fail(409, 'Une demande identique existe déjà ou une contrainte d’unicité est violée.', 'PLANNING_DUPLICATE');
      case '23503':
        return fail(409, 'La gare, la destination ou le demandeur référencé n’existe pas dans le registre.', 'PLANNING_REFERENCE');
      case '23514':
        return fail(409, 'La demande ne respecte pas les règles SQL de planification (type, statut ou champs).', 'PLANNING_CONSTRAINT');
      case '23502':
        return fail(503, 'Un champ obligatoire de la table des demandes manque : schéma à vérifier.', 'PLANNING_REQUIRED_COLUMN');
      case '42501':
        return fail(403, 'L’écriture des demandes de cette gare est refusée.', 'PLANNING_ACCESS');
      case '42703':
      case '42P01':
      case 'PGRST204':
      case 'PGRST205':
        return fail(503, 'Le schéma SQL des demandes ne correspond pas au backend déployé.', 'PLANNING_SCHEMA');
      case '22P02':
      case '22001':
      case '22007':
      case '22008':
      case '22023':
        return fail(400, 'Un champ de la demande est incompatible avec le format exigé par PostgreSQL.', 'PLANNING_INVALID_VALUE');
      default:
        return fail(503, 'Enregistrement de la demande impossible. Consultez le code SQL dans les logs backend.', 'PLANNING_INSERT');
    }
  }
  if (result.data === null) {
    return fail(503, 'Enregistrement non confirmé par Supabase ; vérifiez son existence avant de réessayer.', 'PLANNING_UNCONFIRMED');
  }
  return result.data;
}
async function delegated(companyId: string, gareId: string, userId: string): Promise<boolean> {
  const delegation = dataOrFail<{ autorise: boolean }>(await db.from('messay_gare_planning_delegations')
    .select('autorise').eq('company_id', companyId).eq('gare_id', gareId)
    .eq('auth_user_id', userId).maybeSingle(), 'délégation exploitation');
  return delegation?.autorise === true;
}
async function canSchedule(a: Actor, gareId: string): Promise<boolean> {
  if (a.role === 'CHEF_GARE') return true;
  return a.role === 'AGENT_EXPLOITATION' &&
    await delegated(a.company_id, gareId, a.userId);
}
async function lineScoped(a: Actor, gareId: string, lineId: string) {
  if (!isUuid(lineId)) return fail(400, 'Identifiant de ligne invalide.');
  const row = dataOrFail<{ id: string; gare_depart_id: string | null; gare_arrivee_id: string | null; prix: number; ville: string; publie: boolean }>(await db.from('destinations')
    .select('id,gare_depart_id,gare_arrivee_id,prix,ville,publie')
    .eq('id', lineId).eq('company_id', a.company_id)
    .eq('gare_depart_id', gareId).maybeSingle(), 'ligne de gare');
  if (!row) return fail(404, 'Ligne introuvable dans votre gare.');
  return row;
}
function validHours(input: unknown): string[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 40 ||
      !input.every(isHour)) return fail(400, '1 à 40 horaires HH:MM requis.');
  return [...new Set(input as string[])];
}
function rpcFailure(result: { error: { code?: string; message: string } | null }, action: string): never {
  const e = result.error;
  console.error(`[MESSAY/PLANNING] ${action}`, { code: e?.code, message: e?.message });
  if (e?.code === '23505') return fail(409, 'La ligne ou cet horaire existe déjà, ou la demande est déjà traitée.');
  if (e?.code === '42501') return fail(403, 'Vous n’êtes plus autorisé à effectuer cette action.');
  if (e?.code === '22023') return fail(409, 'Modification refusée : état, horaires ou pièces justificatives à vérifier.');
  if (e?.code === 'PGRST202' || e?.code === '42883') return fail(503, 'Migration SQL du module planification absente.');
  return fail(503, 'Opération temporairement indisponible. Consulter les logs du backend.');
}

// Voir les lignes et demandes de SA gare. La Direction voit sa propre compagnie.
garePlanningRouter.get('/gares/:gareId/planification', wrap(async (req, res) => {
  const { actor: a, gareId } = await gareScoped(req);
  const [stationsResult, routesResult, asksResult] = await Promise.all([
    db.from('gares').select('id,nom,ville').eq('company_id', a.company_id).order('ville').limit(201),
    db.from('destinations').select('id,ville,prix,duree,gare_depart_id,gare_arrivee_id,publie')
      .eq('company_id', a.company_id).eq('gare_depart_id', gareId).eq('publie', true)
      .order('ville').limit(301),
    db.from('messay_gare_planning_demandes')
      .select('id,type,statut,destination_id,gare_arrivee_id,horaire_id,prix_fcfa,duree,horaires,nouvel_horaire,motif,demande_par,cree_le,motif_decision')
      .eq('company_id', a.company_id).eq('gare_id', gareId)
      .order('cree_le', { ascending: false }).limit(100),
  ]);
  const gares = dataOrFail(stationsResult, 'gares du planning') || [];
  const lignes = dataOrFail(routesResult, 'lignes du planning') || [];
  const demandes = dataOrFail(asksResult, 'demandes du planning') || [];
  const ids = lignes.map(l => l.id);
  const horaires = ids.length ? dataOrFail(await db.from('horaires')
    .select('id,destination_id,heure_depart')
    .in('destination_id', ids).order('heure_depart').limit(1001), 'horaires du planning') || [] : [];
  if (gares.length > 200 || lignes.length > 300 || horaires.length > 1000) {
    return fail(409, 'Données trop nombreuses : pagination nécessaire.');
  }
  const stations = new Map(gares.map(g => [g.id, g] as const));
  res.setHeader('Cache-Control', 'private, no-store'); res.vary('Authorization');
  res.json({
    gares,
    gare_id: gareId,
    peut_ajouter_horaire: await canSchedule(a, gareId),
    lignes: lignes.map(l => ({
      ...l,
      depart_nom: stations.get(gareId)?.nom || 'Gare',
      arrivee_nom: l.gare_arrivee_id ? stations.get(l.gare_arrivee_id)?.nom || null : null,
      horaires: horaires.filter(h => h.destination_id === l.id)
        .map(h => ({ id: h.id, heure_depart: String(h.heure_depart).slice(0, 5) })),
    })),
    demandes,
  });
}));

// Lecture globale en temps réel des lignes publiées et horaires du réseau.
garePlanningRouter.get('/planification/reseau', wrap(async (req, res) => {
  const a = director(req);
  const [garesResult, linesResult] = await Promise.all([
    db.from('gares').select('id,nom,ville').eq('company_id', a.company_id).order('nom').limit(201),
    db.from('destinations').select('id,ville,prix,duree,gare_depart_id,gare_arrivee_id')
      .eq('company_id', a.company_id).eq('publie', true).order('ville').limit(501),
  ]);
  const gares = dataOrFail(garesResult, 'gares du réseau') || [];
  const lignes = dataOrFail(linesResult, 'lignes du réseau') || [];
  if (gares.length > 200 || lignes.length > 500) return fail(409, 'Réseau trop grand pour ce chargement.');
  const ids = lignes.map(l => l.id);
  const horaires = ids.length ? dataOrFail(await db.from('horaires')
    .select('id,destination_id,heure_depart')
    .in('destination_id', ids).order('heure_depart').limit(1001), 'horaires du réseau') || [] : [];
  if (horaires.length > 1000) return fail(409, 'Trop d’horaires dans le réseau.');
  const stations = new Map(gares.map(g => [g.id, g] as const));
  res.setHeader('Cache-Control', 'private, no-store'); res.vary('Authorization');
  res.json({ gares, lignes: lignes.map(l => ({ ...l,
    depart_nom: l.gare_depart_id ? stations.get(l.gare_depart_id)?.nom || null : null,
    arrivee_nom: l.gare_arrivee_id ? stations.get(l.gare_arrivee_id)?.nom || null : null,
    horaires: horaires.filter(h => h.destination_id === l.id)
      .map(h => ({ id: h.id, heure_depart: String(h.heure_depart).slice(0, 5) })),
  })) });
}));

// La Direction reçoit toutes les demandes de toutes les gares de sa compagnie.
garePlanningRouter.get('/planification/demandes', wrap(async (req, res) => {
  const a = director(req);
  const requests = dataOrFail(await db.from('messay_gare_planning_demandes')
    .select('id,company_id,gare_id,type,statut,destination_id,gare_arrivee_id,horaire_id,prix_fcfa,duree,horaires,nouvel_horaire,motif,demande_par,cree_le,motif_decision')
    .eq('company_id', a.company_id).neq('statut', 'SOUMIS_CHEF')
    .order('cree_le', { ascending: false }).limit(201), 'demandes Direction') || [];
  if (requests.length > 200) return fail(409, 'Trop de demandes : pagination nécessaire.');
  const gares = dataOrFail(await db.from('gares').select('id,nom,ville')
    .eq('company_id', a.company_id).limit(201), 'gares Direction') || [];
  const noms = new Map(gares.map(g => [g.id, g.nom] as const));
  res.setHeader('Cache-Control', 'private, no-store'); res.vary('Authorization');
  res.json({ demandes: requests.map(r => ({ ...r,
    gare_nom: noms.get(r.gare_id) || 'Gare',
    arrivee_nom: r.gare_arrivee_id ? noms.get(r.gare_arrivee_id) || null : null,
  })) });
}));

// Création d'une nouvelle ligne : proposition; la Direction décidera et publiera.
// Tarif : uniquement le Chef propose une modification à la Direction.
// Un horaire publié peut être proposé à la modification, JAMAIS réécrit ici.
garePlanningRouter.post('/gares/:gareId/planification/demandes', wrap(async (req, res) => {
  const { actor: a, gareId } = await gareScoped(req);
  const type = nonempty(req.body?.type);
  if (a.role !== 'CHEF_GARE' && a.role !== 'AGENT_EXPLOITATION') {
    return fail(403, 'Réservé au chef ou à l’agent d’exploitation.');
  }
  const values: Record<string, unknown> = {
    company_id: a.company_id, gare_id: gareId, demande_par: a.userId, type,
    statut: a.role === 'AGENT_EXPLOITATION' ? 'SOUMIS_CHEF' : 'EN_ATTENTE',
  };
  if (type === 'CREATION_LIGNE') {
    const dest = req.body?.gare_arrivee_id;
    if (!isUuid(dest) || dest === gareId || !moneyOk(req.body?.prix_fcfa) ||
      !/^[0-9]{1,2}h[0-5][0-9]$/.test(nonempty(req.body?.duree))) {
      return fail(400, 'Arrivée, tarif ou durée de ligne invalides.');
    }
    const horaires = validHours(req.body?.horaires);
    const arrivee = dataOrFail(await db.from('gares').select('id')
      .eq('id', dest).eq('company_id', a.company_id).maybeSingle(), 'gare d’arrivée');
    if (!arrivee) return fail(400, 'La gare d’arrivée n’appartient pas à votre compagnie.');
    const existing = dataOrFail(await db.from('destinations').select('id')
      .eq('company_id', a.company_id).eq('gare_depart_id', gareId)
      .eq('gare_arrivee_id', dest).limit(1), 'doublon de ligne') || [];
    if (existing.length) return fail(409, 'Une ligne existe déjà entre ces gares.');
    // Deux soumissions simultanées nécessitent aussi une contrainte SQL,
    // mais cette vérification évite les doublons courants dans le dashboard.
    const pending = dataOrFail(await db.from('messay_gare_planning_demandes')
      .select('id')
      .eq('company_id', a.company_id)
      .eq('gare_id', gareId)
      .eq('gare_arrivee_id', dest)
      .eq('type', 'CREATION_LIGNE')
      .in('statut', ['SOUMIS_CHEF', 'EN_ATTENTE'])
      .limit(1), 'demande de ligne existante') || [];
    if (pending.length > 0) return fail(409, 'Une demande de création de cette ligne est déjà en attente.');
    Object.assign(values, { gare_arrivee_id: dest, prix_fcfa: req.body.prix_fcfa,
      duree: nonempty(req.body.duree), horaires });
  } else if (type === 'CHANGEMENT_TARIF') {
    if (a.role !== 'CHEF_GARE') return fail(403, 'Le tarif est proposé uniquement par le Chef de gare.');
    await lineScoped(a, gareId, req.body?.destination_id);
    if (!moneyOk(req.body?.prix_fcfa)) return fail(400, 'Nouveau tarif invalide.');
    Object.assign(values, { destination_id: req.body.destination_id,
      prix_fcfa: req.body.prix_fcfa });
  } else if (type === 'MODIFICATION_HORAIRE') {
    if (!await canSchedule(a, gareId)) return fail(403, 'Délégation horaire requise.');
    const line = await lineScoped(a, gareId, req.body?.destination_id);
    if (!isUuid(req.body?.horaire_id) || !isHour(req.body?.nouvel_horaire)) {
      return fail(400, 'Horaire existant ou nouvelle heure invalide.');
    }
    const motif = nonempty(req.body?.motif);
    if (motif.length < 8 || motif.length > 1000) {
      return fail(400, 'Justification requise (8 à 1000 caractères).');
    }
    const exists = dataOrFail<{ id: string; heure_depart: string }>(await db.from('horaires').select('id,heure_depart')
      .eq('id', req.body.horaire_id).eq('destination_id', line.id).maybeSingle(), 'horaire de ligne');
    if (!exists) return fail(404, 'Horaire introuvable sur cette ligne.');
    if (String(exists.heure_depart).slice(0, 5) === req.body.nouvel_horaire) {
      return fail(400, 'La nouvelle heure doit être différente.');
    }
    Object.assign(values, { destination_id: line.id, horaire_id: req.body.horaire_id,
      nouvel_horaire: req.body.nouvel_horaire, motif });
  } else {
    return fail(400, 'Type de demande inconnu.');
  }
  // Écriture contrôlée. En cas d'échec, afficher une erreur métier exploitable
  // et journaliser le vrai code SQL côté backend (pas les secrets ni le JWT).
  const insertion = await db.from('messay_gare_planning_demandes')
    .insert(values)
    .select('id,type,statut,cree_le')
    .single();
  const created = insertionOrFail<{
    id: string;
    type: string;
    statut: string;
    cree_le: string;
  }>(insertion, {
    company_id: a.company_id,
    gare_id: gareId,
    type,
  });
  if (!isUuid(created.id) || created.type !== type ||
      !['SOUMIS_CHEF', 'EN_ATTENTE'].includes(created.statut)) {
    return fail(503, 'Réponse de création incohérente ; vérifiez la demande avant de réessayer.', 'PLANNING_RESPONSE');
  }
  res.setHeader('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  res.status(201).json(created);
}));

// Le Chef de gare filtre les propositions de ses agents AVANT la Direction.
// Modification atomique du statut (WHERE SOUMIS_CHEF) ; pas de publication ici.
garePlanningRouter.post('/gares/:gareId/planification/demandes/:demandeId/avis-chef', wrap(async (req, res) => {
  const { actor: a, gareId } = await gareScoped(req);
  if (a.role !== 'CHEF_GARE') return fail(403, 'Avis réservé au Chef de gare.');
  const id = String(req.params.demandeId || '');
  const decision = req.body?.decision;
  const motif = nonempty(req.body?.motif) || null;
  if (!isUuid(id) || (decision !== 'TRANSMETTRE' && decision !== 'REFUSER') ||
    (decision === 'REFUSER' && (!motif || motif.length < 5)) || (motif && motif.length > 1000)) {
    return fail(400, 'Décision du chef ou motif invalide.');
  }
  const result = await db.rpc('messay_gare_planning_avis_chef', {
    p_company_id: a.company_id, p_gare_id: gareId, p_actor: a.userId,
    p_demande_id: id, p_transmettre: decision === 'TRANSMETTRE', p_motif: motif,
  });
  if (result.error) return rpcFailure(result, 'avis du Chef de gare');
  res.setHeader('Cache-Control', 'private, no-store'); res.json(result.data);
}));

// Ajout opérationnel : aucune mise à jour destructive d'un horaire existant.
garePlanningRouter.post('/gares/:gareId/planification/horaires', wrap(async (req, res) => {
  const { actor: a, gareId } = await gareScoped(req);
  if (!await canSchedule(a, gareId)) return fail(403, 'Droit d’ajout horaire non accordé.');
  const lineId = req.body?.destination_id;
  const hour = req.body?.heure_depart;
  if (!isUuid(lineId) || !isHour(hour)) return fail(400, 'Ligne ou heure HH:MM invalide.');
  await lineScoped(a, gareId, lineId);
  const inserted = await db.rpc('messay_gare_planning_ajouter_horaire', {
    p_company_id: a.company_id, p_gare_id: gareId, p_destination_id: lineId,
    p_heure: hour, p_actor: a.userId,
  });
  if (inserted.error) return rpcFailure(inserted, 'ajout horaire');
  if (!isUuid(inserted.data)) return fail(500, 'Identifiant horaire invalide.');
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(201).json({ id: inserted.data, destination_id: lineId, heure_depart: hour });
}));

// Le chef peut donner/reprendre l'autorisation d'ajouter des horaires
// à un AGENT_EXPLOITATION *actif* de sa propre gare.
garePlanningRouter.get('/gares/:gareId/planification/delegations', wrap(async (req, res) => {
  const { actor: a, gareId } = await gareScoped(req);
  if (a.role !== 'CHEF_GARE' && a.role !== 'DIRECTION') return fail(403, 'Réservé au chef ou à la Direction.');
  const [staffRes, delegRes] = await Promise.all([
    db.from('messay_gare_staff').select('auth_user_id,role').eq('company_id', a.company_id)
      .eq('gare_id', gareId).eq('actif', true).eq('role', 'AGENT_EXPLOITATION').limit(101),
    db.from('messay_gare_planning_delegations').select('auth_user_id,autorise')
      .eq('company_id', a.company_id).eq('gare_id', gareId).limit(101),
  ]);
  const staff = dataOrFail(staffRes, 'agents exploitation') || [];
  const delegations = dataOrFail(delegRes, 'délégations') || [];
  const states = new Map(delegations.map(d => [d.auth_user_id, d.autorise] as const));
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ agents: staff.map(s => ({ auth_user_id: s.auth_user_id,
    autorise: states.get(s.auth_user_id) === true })) });
}));
garePlanningRouter.post('/gares/:gareId/planification/delegations', wrap(async (req, res) => {
  const { actor: a, gareId } = await gareScoped(req);
  if (a.role !== 'CHEF_GARE') return fail(403, 'Seul le Chef de gare délègue.');
  const target = req.body?.auth_user_id;
  const enabled = req.body?.autorise;
  if (!isUuid(target) || typeof enabled !== 'boolean' || target === a.userId) {
    return fail(400, 'Agent ou délégation invalide.');
  }
  const result = await db.rpc('messay_gare_planning_deleguer', {
    p_company_id: a.company_id, p_gare_id: gareId, p_actor: a.userId,
    p_agent: target, p_autorise: enabled,
  });
  if (result.error) return rpcFailure(result, 'délégation Agent d’exploitation');
  res.setHeader('Cache-Control', 'private, no-store');
  res.json(result.data);
}));

// Approuver uniquement CREATION_LIGNE / CHANGEMENT_TARIF. Modifications d'horaire
// publiées volontairement bloquées jusqu'au raccordement aux billets datés.
garePlanningRouter.post('/planification/demandes/:id/decision', wrap(async (req, res) => {
  const a = director(req);
  const id = String(req.params.id || '');
  const decision = req.body?.decision;
  const motif = nonempty(req.body?.motif) || null;
  if (!isUuid(id) || (decision !== 'APPROUVER' && decision !== 'REFUSER') ||
      (motif !== null && motif.length > 1000) || (decision === 'REFUSER' && (!motif || motif.length < 5))) {
    return fail(400, 'Décision ou justification invalide.');
  }
  const result = await db.rpc('messay_gare_planning_decider', {
    p_company_id: a.company_id, p_demande_id: id, p_actor: a.userId,
    p_accepter: decision === 'APPROUVER', p_motif: motif,
  });
  if (result.error) return rpcFailure(result, 'décision Direction');
  res.setHeader('Cache-Control', 'private, no-store');
  res.json(result.data);
}));

// Gestion d'erreurs métier propre à ce nouveau routeur.
garePlanningRouter.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(error);
  if (error instanceof PlanningError) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(error.status).json({ message: error.message, code: error.code ?? 'PLANNING_ERROR' });
    return;
  }
  console.error('[MESSAY/PLANNING] Erreur inattendue', error);
  res.status(500).json({ message: 'MESSAY PRO : erreur serveur de planification.' });
});
