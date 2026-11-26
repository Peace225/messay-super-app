/**
 * MESSAY PRO — Flotte et affectations des bus interurbains.
 * Ce routeur doit être monté APRÈS le middleware d'authentification
 * qui établit req.messay à partir d'une identité vérifiée côté serveur.
 * Les affectations ne constituent ni une réservation, ni un paiement.
 */
import 'dotenv/config';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { registerMessayBusSiegesRoutes } from './messayBusSieges.routes';

type Access = {
  userId: string;
  company_id: string;
  role: string;
  gare_ids: string[];
};

type AuthedRequest = Request & { messay?: Access };

type BusRow = {
  id: string;
  company_id: string;
  numero_interne: string;
  immatriculation: string;
  capacite: number;
  marque: string | null;
  modele: string | null;
  statut: string;
};

const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
const supabaseServerKey = [
  process.env.SUPABASE_SECRET_KEY,
  process.env.SERVICE_ROLE_KEY,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
].find((value) => Boolean(value?.trim()))?.trim();

if (!supabaseUrl || !supabaseServerKey) {
  throw new Error('MESSAY/bus : SUPABASE_URL et une clé serveur Supabase sont requis.');
}
if (supabaseServerKey.startsWith('sb_publishable_') ||
    supabaseServerKey.startsWith('eyJ') === false &&
    !supabaseServerKey.startsWith('sb_secret_')) {
  throw new Error('MESSAY/bus : une clé Supabase serveur valide est requise.');
}

const db = createClient(supabaseUrl, supabaseServerKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

export const messayBusRouter = Router();

const UUID_PATTERN = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const allowedRoles = new Set([
  'DIRECTION', 'CHEF_GARE', 'AGENT_BILLETTERIE',
  'AGENT_CAISSE', 'AGENT_EMBARQUEMENT', 'AGENT_EXPLOITATION',
]);

const uuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value);

const str = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const stringLimited = (value: unknown, max: number): string =>
  str(value).slice(0, max);

const isDemoBus = (value: { marque?: string | null; modele?: string | null; numero_interne?: string | null }): boolean => {
  // Défense supplémentaire : les contrôles de production doivent aussi être
  // appliqués dans public.messay_bus_affecter, au sein de la transaction SQL.
  return [value.marque, value.modele, value.numero_interne]
    .some((field) => /(^|[\s_-])(TEST|DEMO|DÉMO|FICTIF|FAKE)([\s_-]|$)/iu.test(field || ''));
};

function todayAbidjan(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Abidjan', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const field = (type: string): string => parts.find((part) => part.type === type)?.value || '';
  return `${field('year')}-${field('month')}-${field('day')}`;
}

function validIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

class HttpError extends Error {
  constructor(public code: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

function guard(req: AuthedRequest): Access {
  // Ne pas accepter de rôle, company_id ou gare_ids provenant du client.
  const access = req.messay;
  if (!access ||
      !uuid(access.company_id) ||
      !uuid(access.userId) ||
      !allowedRoles.has(access.role) ||
      !Array.isArray(access.gare_ids) ||
      !access.gare_ids.every(uuid)) {
    throw new HttpError(401, 'Accès compagnie non confirmé : reconnectez-vous avec un compte autorisé.');
  }
  return access;
}

function requireChefGare(access: Access, gareId: string): void {
  if (!uuid(gareId)) throw new HttpError(400, 'Identifiant de gare invalide.');
  if (access.role !== 'DIRECTION' &&
      !(access.role === 'CHEF_GARE' && access.gare_ids.includes(gareId))) {
    throw new HttpError(403, 'Affectation réservée au Chef de cette gare ou à la Direction.');
  }
}

const wrap = (fn: (req: AuthedRequest, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve().then(() => fn(req as AuthedRequest, res)).catch((error: unknown) => {
      if (error instanceof HttpError) {
        res.status(error.code).json({ message: error.message });
        return;
      }
      const err = error as { code?: string; message?: string; details?: string } | null;
      console.error('[MESSAY/bus]', {
        code: err?.code, message: err?.message, details: err?.details,
      });
      next(new HttpError(503, 'MESSAY : gestion des bus momentanément indisponible.'));
    });
  };

function result<T>(
  value: { data: T | null; error: { code?: string; message?: string } | null },
  action: string,
): T {
  if (value.error) {
    const code = value.error.code;
    const message = value.error.message || '';
    console.error(`[MESSAY/bus] ${action}`, { code, message });
    if (code === '23505') throw new HttpError(409, 'Immatriculation, numéro ou affectation déjà enregistré.');
    if (code === '42501') throw new HttpError(403, 'Autorisation refusée.');
    if (code === '22023' || code === '23514' || code === '23503') {
      // N'expose pas les détails SQL internes au client.
      const errors: Record<string, string> = {
        BUS_INDISPONIBLE: 'Ce bus n’est plus disponible.',
        BUS_DEJA_AFFECTE_A_CETTE_HEURE: 'Ce bus possède déjà une affectation à cette heure.',
        DATE_DEPART_INVALIDE: 'La date de départ est invalide.',
        GARE_INVALIDE: 'La gare sélectionnée est invalide.',
        LIGNE_NON_PUBLIEE_OU_MAUVAIS_DEPART: 'La ligne n’est pas publiée pour cette gare.',
        HORAIRE_HORS_LIGNE: 'L’horaire ne correspond pas à cette ligne.',
      };
      const known = Object.keys(errors).find((key) => message.includes(key));
      throw new HttpError(400, known ? errors[known] : 'Les données de cette opération sont invalides.');
    }
    throw new HttpError(503, 'Erreur SQL de la gestion des bus.');
  }
  return value.data as T;
}

// GET /vehicules : lecture limitée à la compagnie et aux gares autorisées.
messayBusRouter.get('/vehicules', wrap(async (req, res) => {
  const access = guard(req);
  if (access.role !== 'DIRECTION' && access.gare_ids.length === 0) {
    throw new HttpError(403, 'Aucune gare affectée.');
  }

  const [vehiclesRes, gareRes] = await Promise.all([
    db.from('messay_bus_vehicules')
      .select('id,numero_interne,immatriculation,capacite,marque,modele,statut,cree_le')
      .eq('company_id', access.company_id)
      .order('numero_interne')
      .limit(500),
    access.role === 'DIRECTION'
      ? db.from('gares').select('id,nom,ville')
          .eq('company_id', access.company_id).order('nom')
      : db.from('gares').select('id,nom,ville')
          .eq('company_id', access.company_id)
          .in('id', access.gare_ids).order('nom'),
  ]);

  const vehicules = result(vehiclesRes, 'liste des véhicules') || [];
  const gares = result(gareRes, 'gares accessibles') || [];

  let query = db.from('messay_bus_affectations')
    .select('id,gare_id,destination_id,horaire_id,date_depart,bus_id,numero_bus_snapshot,immatriculation_snapshot,capacite_snapshot,statut,cree_le')
    .eq('company_id', access.company_id)
    .order('date_depart', { ascending: false })
    .limit(150);

  if (access.role !== 'DIRECTION') {
    query = query.in('gare_id', access.gare_ids);
  }

  const affectations = result(await query, 'affectations') || [];
  res.setHeader('Cache-Control', 'no-store');
  res.json({ role: access.role, gares, vehicules, affectations });
}));

// POST /vehicules : seul le rôle DIRECTION enregistre les véhicules.
messayBusRouter.post('/vehicules', wrap(async (req, res) => {
  const access = guard(req);
  if (access.role !== 'DIRECTION') {
    throw new HttpError(403, 'Seule la Direction enregistre les bus.');
  }

  const numero_interne = str(req.body?.numero_interne).toUpperCase();
  const immatriculation = str(req.body?.immatriculation).toUpperCase();
  const capacite = Number(req.body?.capacite);
  const marque = stringLimited(req.body?.marque, 80) || null;
  const modele = stringLimited(req.body?.modele, 80) || null;

  if (!numero_interne || numero_interne.length > 40 ||
      immatriculation.length < 3 || immatriculation.length > 32 ||
      !Number.isInteger(capacite) || capacite < 1 || capacite > 120) {
    throw new HttpError(400, 'Numéro interne, immatriculation ou capacité invalide.');
  }
  if (isDemoBus({ numero_interne, marque, modele })) {
    throw new HttpError(400, 'Les véhicules de démonstration doivent être enregistrés hors de la production.');
  }

  const id = result(await db.rpc('messay_bus_enregistrer', {
    p_company_id: access.company_id,
    p_numero_interne: numero_interne,
    p_immatriculation: immatriculation,
    p_capacite: capacite,
    p_actor: access.userId,
    p_marque: marque,
    p_modele: modele,
  }), 'enregistrement véhicule');

  res.setHeader('Cache-Control', 'no-store');
  res.status(201).json({ id });
}));

// POST /gares/:gareId/departs-bus : affectation réelle, pas une vente de billet.
messayBusRouter.post('/gares/:gareId/departs-bus', wrap(async (req, res) => {
  const access = guard(req);
  const gareId = typeof req.params.gareId === 'string' ? req.params.gareId : '';
  requireChefGare(access, gareId);

  const { destination_id, horaire_id, date_depart, bus_id } = req.body || {};
  if (!uuid(destination_id) || !uuid(horaire_id) || !uuid(bus_id) || !validIsoDate(date_depart)) {
    throw new HttpError(400, 'Date, véhicule, ligne ou horaire invalide.');
  }
  if (date_depart < todayAbidjan()) {
    throw new HttpError(400, 'Impossible de programmer un départ à une date passée.');
  }

  // Pré-contrôles de cohérence et d'UX. La fonction PostgreSQL reste
  // l'autorité transactionnelle pour autorisations et contraintes concurrentes.
  const [gareResponse, lineResponse, hourResponse, busResponse] = await Promise.all([
    db.from('gares').select('id').eq('id', gareId)
      .eq('company_id', access.company_id).maybeSingle(),
    db.from('destinations').select('id').eq('id', destination_id)
      .eq('company_id', access.company_id).eq('gare_depart_id', gareId)
      .eq('publie', true).maybeSingle(),
    db.from('horaires').select('id,heure_depart').eq('id', horaire_id)
      .eq('destination_id', destination_id).maybeSingle(),
    db.from('messay_bus_vehicules')
      .select('id,company_id,numero_interne,immatriculation,capacite,marque,modele,statut')
      .eq('id', bus_id).eq('company_id', access.company_id).maybeSingle(),
  ]);

  const gare = result(gareResponse, 'contrôle gare');
  const line = result(lineResponse, 'contrôle ligne');
  const hour = result(hourResponse, 'contrôle horaire');
  const bus = result(busResponse, 'contrôle véhicule') as BusRow | null;

  if (!gare) throw new HttpError(400, 'Gare introuvable ou extérieure à votre compagnie.');
  if (!line) throw new HttpError(400, 'Ligne non publiée ou non rattachée à cette gare.');
  if (!hour) throw new HttpError(400, 'Horaire non publié pour cette ligne.');
  if (!bus || bus.statut !== 'DISPONIBLE') {
    throw new HttpError(409, 'Le bus est indisponible ou n’appartient pas à cette compagnie.');
  }
  if (!Number.isInteger(bus.capacite) || bus.capacite < 1 || bus.capacite > 120) {
    throw new HttpError(400, 'La capacité du bus est invalide.');
  }
  if (isDemoBus(bus)) {
    throw new HttpError(403, 'Véhicule de démonstration : affectation commerciale interdite.');
  }

  // Ne pas dupliquer ici la logique de collision : seul un contrôle atomique
  // dans messay_bus_affecter peut garantir l'absence de double affectation.
  const id = result(await db.rpc('messay_bus_affecter', {
    p_company_id: access.company_id,
    p_gare_id: gareId,
    p_destination_id: destination_id,
    p_horaire_id: horaire_id,
    p_date_depart: date_depart,
    p_bus_id: bus_id,
    p_actor: access.userId,
  }), 'affectation du bus');

  res.setHeader('Cache-Control', 'no-store');
  res.status(201).json({ id });
}));

// Une seule inscription des routes de sièges.
registerMessayBusSiegesRoutes({
  router: messayBusRouter,
  db,
  guard,
  wrap,
  HttpError,
  uuid,
});
