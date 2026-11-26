/**
 * MESSAY PRO — chauffeurs de bus interurbains (distincts des conducteurs tricycle).
 *
 * Corrections TypeScript : client Supabase typé sur les trois tables utilisées.
 * Les champs ci-dessous correspondent aux colonnes interrogées et à la migration
 * 20261105_messay_chauffeurs_interurbains.sql. Pour un typage global complet,
 * générer ultérieurement database.types.ts depuis le projet Supabase.
 *
 * Montage : app.use('/api/company-dashboard', messayChauffeursInterurbainsRouter)
 * avant le gestionnaire d'erreurs de ce groupe de routes.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type ChauffeurStatut = 'ACTIF' | 'INACTIF';

type ChauffeurRow = {
  id: string;
  company_id: string;
  nom: string;
  prenom: string | null;
  telephone: string | null;
  numero_permis: string;
  categorie_permis: string | null;
  date_expiration_permis: string | null;
  statut: ChauffeurStatut;
  created_at: string;
  updated_at: string;
};

type ChauffeurInsert = {
  company_id: string;
  nom: string;
  numero_permis: string;
  prenom?: string | null;
  telephone?: string | null;
  categorie_permis?: string | null;
  date_expiration_permis?: string | null;
  statut?: ChauffeurStatut;
};

type ChauffeurUpdate = Partial<Omit<ChauffeurRow, 'id' | 'company_id' | 'created_at'>>;

type DirectionAccessRow = {
  company_id: string;
  auth_user_id: string;
  actif: boolean;
  role: string;
};

type GareStaffRow = {
  company_id: string;
  auth_user_id: string;
  actif: boolean;
};

type ChauffeursDatabase = {
  public: {
    Tables: {
      messay_company_access: {
        Row: DirectionAccessRow;
        Insert: DirectionAccessRow;
        Update: Partial<DirectionAccessRow>;
        Relationships: [];
      };
      messay_gare_staff: {
        Row: GareStaffRow;
        Insert: GareStaffRow;
        Update: Partial<GareStaffRow>;
        Relationships: [];
      };
      messay_chauffeurs_interurbains: {
        Row: ChauffeurRow;
        Insert: ChauffeurInsert;
        Update: ChauffeurUpdate;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export const messayChauffeursInterurbainsRouter = Router();

class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const reject = (status: number, message: string): never => {
  throw new ApiError(status, message);
};

// Évite de bloquer le démarrage de tout MESSAY si les variables sont absentes.
// La clé privilégiée reste uniquement sur le serveur, jamais dans le frontend.
let databaseClient: SupabaseClient<ChauffeursDatabase> | null = null;
function getDatabase(): SupabaseClient<ChauffeursDatabase> {
  if (databaseClient) return databaseClient;

  const url = process.env.SUPABASE_URL?.trim();
  const secret = (
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  )?.trim();
  if (!url || !secret) {
    return reject(503, 'Configuration Supabase du backend manquante pour les chauffeurs interurbains.');
  }

  databaseClient = createClient<ChauffeursDatabase>(url, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  return databaseClient;
}

const uuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const nullable = (value: unknown, limit: number): string | null => {
  const trimmed = text(value);
  if (trimmed.length > limit) return reject(400, 'Champ texte trop long.');
  return trimmed || null;
};

const fields =
  'id,nom,prenom,telephone,numero_permis,categorie_permis,date_expiration_permis,statut,created_at';

async function directionCompany(req: Request): Promise<string> {
  const db = getDatabase();
  const token = /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '')?.[1];
  if (!token) return reject(401, 'Connexion Supabase Auth requise.');

  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user?.id) return reject(401, 'Session invalide ou expirée.');

  const [directionResponse, staffResponse] = await Promise.all([
    db.from('messay_company_access')
      .select('company_id,role')
      .eq('auth_user_id', auth.user.id)
      .eq('actif', true),
    db.from('messay_gare_staff')
      .select('company_id')
      .eq('auth_user_id', auth.user.id)
      .eq('actif', true),
  ]);

  if (directionResponse.error || staffResponse.error) {
    console.error(
      '[MESSAY/chauffeurs] vérification des autorisations',
      directionResponse.error?.code,
      staffResponse.error?.code
    );
    return reject(503, 'Vérification des accès momentanément indisponible.');
  }

  // Supabase sait désormais que ces résultats ont un company_id/role.
  const directions = directionResponse.data ?? [];
  const staff = staffResponse.data ?? [];
  const companies = new Set(
    [...directions, ...staff].map((row) => row.company_id)
  );

  if (!companies.size) return reject(403, 'Aucun accès à une compagnie.');
  if (companies.size !== 1) {
    return reject(409, 'Plusieurs compagnies : un contexte serveur explicite est requis.');
  }

  const company = [...companies][0];
  if (!uuid(company)) return reject(503, 'Identifiant compagnie invalide en base.');
  if (!directions.some((row) => row.company_id === company && row.role === 'DIRECTION')) {
    return reject(403, 'Gestion des chauffeurs réservée à la Direction.');
  }
  return company;
}

type ChauffeurPayload = {
  nom: string;
  prenom: string | null;
  telephone: string | null;
  numero_permis: string;
  categorie_permis: string | null;
  date_expiration_permis: string | null;
  statut: ChauffeurStatut;
};

function parseBody(raw: unknown): ChauffeurPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return reject(400, 'Corps JSON invalide.');
  }
  const body = raw as Record<string, unknown>;
  const nom = text(body.nom);
  const numero_permis = text(body.numero_permis);
  if (nom.length < 2 || nom.length > 160) {
    return reject(400, 'Nom invalide (2 à 160 caractères).');
  }
  if (numero_permis.length < 3 || numero_permis.length > 80) {
    return reject(400, 'Numéro de permis invalide (3 à 80 caractères).');
  }

  const prenom = nullable(body.prenom, 160);
  const telephone = nullable(body.telephone, 25);
  if (telephone && !/^\+?[0-9 ()-]{7,25}$/.test(telephone)) {
    return reject(400, 'Téléphone invalide.');
  }
  const categorie_permis = nullable(body.categorie_permis, 24);
  const date_expiration_permis = nullable(body.date_expiration_permis, 10);
  if (date_expiration_permis) {
    const date = new Date(`${date_expiration_permis}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date_expiration_permis) ||
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== date_expiration_permis
    ) {
      return reject(400, 'Date d’expiration invalide.');
    }
  }
  const statut =
    body.statut === 'INACTIF' ? 'INACTIF' :
    body.statut === 'ACTIF' ? 'ACTIF' : null;
  if (!statut) return reject(400, 'Statut ACTIF ou INACTIF requis.');

  return {
    nom,
    prenom,
    telephone,
    numero_permis,
    categorie_permis,
    date_expiration_permis,
    statut,
  };
}

function databaseFailure(error: { code?: string; message?: string } | null): never {
  console.error('[MESSAY/chauffeurs] erreur SQL', error?.code, error?.message);
  if (error?.code === '23505') {
    return reject(409, 'Ce numéro de permis existe déjà pour la compagnie.');
  }
  if (error?.code === '42P01' || error?.code === 'PGRST205') {
    return reject(503, 'Table messay_chauffeurs_interurbains absente : appliquez la migration SQL.');
  }
  return reject(503, 'Registre des chauffeurs momentanément indisponible.');
}

const wrap = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    void fn(req, res).catch(next);
  };

messayChauffeursInterurbainsRouter.get(
  '/chauffeurs-interurbains',
  wrap(async (req, res) => {
    const company_id = await directionCompany(req);
    const db = getDatabase();
    const { data, error } = await db.from('messay_chauffeurs_interurbains')
      .select(fields).eq('company_id', company_id).order('nom').limit(500);
    if (error) databaseFailure(error);
    res.status(200).json({ chauffeurs: data ?? [] });
  })
);

messayChauffeursInterurbainsRouter.post(
  '/chauffeurs-interurbains',
  wrap(async (req, res) => {
    const company_id = await directionCompany(req);
    const db = getDatabase();
    const input = parseBody(req.body);
    const { data, error } = await db.from('messay_chauffeurs_interurbains')
      .insert({ ...input, company_id }).select(fields).single();
    if (error) databaseFailure(error);
    res.status(201).json(data);
  })
);

messayChauffeursInterurbainsRouter.patch(
  '/chauffeurs-interurbains/:id',
  wrap(async (req, res) => {
    const company_id = await directionCompany(req);
    const db = getDatabase();
    const id = req.params.id;
    if (typeof id !== 'string' || !uuid(id)) {
      return reject(400, 'Identifiant de chauffeur invalide.');
    }
    const input = parseBody(req.body);
    const { data, error } = await db.from('messay_chauffeurs_interurbains')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('company_id', company_id)
      .eq('id', id)
      .select(fields)
      .maybeSingle();
    if (error) databaseFailure(error);
    if (!data) return reject(404, 'Chauffeur introuvable pour votre compagnie.');
    res.status(200).json(data);
  })
);

messayChauffeursInterurbainsRouter.use(
  (error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (error instanceof ApiError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    next(error);
  }
);
