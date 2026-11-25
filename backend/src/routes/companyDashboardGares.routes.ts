/**
 * MESSAY PRO - routeur Express / Supabase. Compatible avec la migration
 * MESSAY_SQL_SUPABASE_HIERARCHIE_20261102 (STAGING seulement).
 * Monter avec : app.use('/api/company-dashboard', companyDashboardGaresRouter)
 * Ne jamais utiliser SUPABASE_SECRET_KEY côté React.
 */
import 'dotenv/config';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { createClient } from '@supabase/supabase-js';
// Lire les variables définies dans backend/.env (uniquement côté serveur).
// SERVICE_ROLE_KEY est le nom effectivement utilisé dans ce projet.
const supabaseUrl = (process.env.SUPABASE_URL ?? '').trim();
// Ce client utilise uniquement une clef serveur. Ne JAMAIS exposer cette clef au navigateur.
const serverKeyEntries = [
  ['SUPABASE_SECRET_KEY', process.env.SUPABASE_SECRET_KEY],
  ['SERVICE_ROLE_KEY', process.env.SERVICE_ROLE_KEY],
  ['SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY],
] as const;
const serverKeyEntry = serverKeyEntries.find(([, value]) => Boolean(value?.trim()));
const supabaseSecret = serverKeyEntry?.[1]?.trim();
if (!supabaseUrl || !supabaseSecret) {
  throw new Error(
    'Backend MESSAY : configurez SUPABASE_URL et une clef serveur Supabase dans backend/.env'
  );
}
// Les clefs anon/publishable ne permettent pas de lire les habilitations en contournant la RLS.
// Pour une clef JWT historique, le rôle doit être service_role.
function isServerKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  if (key.startsWith('sb_publishable_')) return false;
  const sections = key.split('.');
  if (sections.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(sections[1], 'base64url').toString('utf8'));
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}
if (!isServerKey(supabaseSecret)) {
  throw new Error(
    `La variable ${serverKeyEntry?.[0]} ne contient pas une clef Supabase serveur valide (service_role ou sb_secret_...).`
  );
}
const db = createClient(supabaseUrl, supabaseSecret, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
export const companyDashboardGaresRouter = Router();
const uuid = (s: unknown): s is string => typeof s === 'string' && /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(s);
const nonempty = (s: unknown) => typeof s === 'string' ? s.trim() : '';
const emailOk = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
const phoneOk = (s: string) => /^\+?[1-9]\d{6,14}$/.test(s.replace(/[\s().-]/g, ''));
const validDate = (s: unknown): s is string => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
const plusDay = (d: string) => new Date(Date.parse(`${d}T00:00:00.000Z`) + 86_400_000).toISOString();
const numberOrNull = (x: unknown) => x === null || x === undefined ? null : Number(x);
class HttpError extends Error { constructor(public status: number, message: string) {super(message);} }
const fail = (code: number, message: string): never => {throw new HttpError(code,message);};
type DbResult<T = any> = {
  data: T | null;
  error: { message: string; code?: string; details?: string; hint?: string } | null;
};
const must = <T>(result: DbResult<T>, desc: string): T => {
  if (result.error) {
    // Conserver le détail côté SERVEUR, sans divulguer les clefs ni le jeton de session.
    console.error(`[MESSAY] ${desc}:`, {
      code: result.error.code,
      message: result.error.message,
      details: result.error.details,
      hint: result.error.hint,
    });
    return fail(500, `Erreur base de données : ${desc}`);
  }
  return result.data as T;
};
// Les réponses Supabase de single()/maybeSingle() peuvent être null.
// Valider les lignes avant accès aux propriétés ou utilisation du spread.
function requireDbObject(value: unknown, context: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return fail(500, `Réponse de base de données invalide : ${context}`);
  }
  return value as Record<string, unknown>;
}
function requireDbUuid(value: unknown, context: string): string {
  if (!uuid(value)) return fail(500, `Identifiant de base de données invalide : ${context}`);
  return value;
}
type ReviewableReport = { id: string; type: string; statut: string; auteur_id: string };
function asReviewableReport(value: unknown): ReviewableReport {
  const row = requireDbObject(value, 'rapport à contrôler');
  const id = requireDbUuid(row.id, 'rapport à contrôler');
  const auteur_id = requireDbUuid(row.auteur_id, 'auteur du rapport');
  if (typeof row.type !== 'string' || typeof row.statut !== 'string') {
    return fail(500, 'Données de rapport invalides pour la vérification.');
  }
  return { id, auteur_id, type: row.type, statut: row.statut };
}
type Role = 'DIRECTION'|'CHEF_GARE'|'AGENT_BILLETTERIE'|'AGENT_CAISSE'|'AGENT_EMBARQUEMENT'|'AGENT_EXPLOITATION';
type Access = { userId: string; email: string; company_id: string; role: Role; gare_ids: string[]; display_name: string };
type CompanyGrant = { company_id: string; role: string };
type StaffGrant = { company_id: string; gare_id: string; role: string };
type AuthedRequest = Request & { messay?: Access };
const wrap = (fn: (req: AuthedRequest, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {void fn(req as AuthedRequest, res).catch(next);};
// Vérifier Supabase Auth sur chaque requête, puis obtenir les DROITS dans la base.
// Un JWT « direction » ou un company_id provenant du navigateur ne donne aucun pouvoir.
async function resolveAccess(req: Request): Promise<Access> {
  const bearer = /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '')?.[1];
  if (!bearer) return fail(401,'MESSAY PRO : veuillez vous connecter pour accéder à votre espace.');
  const {data: auth, error: authError} = await db.auth.getUser(bearer);
  if (authError || !auth.user?.id || !auth.user.email) return fail(401,'MESSAY PRO : votre session a expiré. Veuillez vous reconnecter.');
  const userId = auth.user.id;
  const [directors, staff] = await Promise.all([
    db.from('messay_company_access').select('company_id,role').eq('auth_user_id',userId).eq('actif',true).eq('role','DIRECTION'),
    db.from('messay_gare_staff').select('company_id,gare_id,role').eq('auth_user_id',userId).eq('actif',true),
  ]);
  const direction = (must(directors, 'accès direction') || []) as CompanyGrant[];
  const members = (must(staff, 'accès personnel') || []) as StaffGrant[];
  // Une même identité ne doit pas accéder à plusieurs compagnies sans sélection serveur explicite.
  const companyIds = new Set([...direction, ...members].map((a) => String(a.company_id)));
  if (companyIds.size === 0) return fail(403,'Aucun accès compagnie activé pour ce compte.');
  if (companyIds.size !== 1) return fail(409,'Plusieurs compagnies affectées : choisir un compte distinct ou ajouter une sélection d’espace côté serveur.');
  const company_id = [...companyIds][0];
  if (direction.some((d) => d.company_id === company_id && d.role === 'DIRECTION')) {
    return {userId,email:auth.user.email,company_id,role:'DIRECTION',gare_ids:[],display_name: String(auth.user.user_metadata?.full_name || auth.user.email)};
  }
  const roles = new Set(members.map((m) => m.role));
  if (roles.size !== 1) return fail(409,'Plusieurs rôles différents affectés : demandez à la direction de corriger les accès.');
  const staffRole = [...roles][0];
  if (!['CHEF_GARE','AGENT_BILLETTERIE','AGENT_CAISSE','AGENT_EMBARQUEMENT','AGENT_EXPLOITATION'].includes(staffRole)) {
    return fail(403,'Rôle de personnel non autorisé.');
  }
  return {userId,email:auth.user.email,company_id,role:staffRole as Role,
    gare_ids:Array.from(new Set<string>((members as Array<{gare_id:string}>).map(m => String(m.gare_id)))),
    display_name:String(auth.user.user_metadata?.full_name || auth.user.email)};
}
/**
 * Vérifie le JWT Supabase et recharge les droits compagnie en base.
 * À monter dans server.ts APRÈS l'activation des invitations et AVANT
 * les routeurs privés du dashboard compagnie.
 */
const verifiedMessayAccessRequests = new WeakSet<Request>();

export function requireMessayCompanyAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader('Cache-Control', 'private, no-store');
  res.vary('Authorization');

  // Si ce middleware a déjà validé la requête, inutile de refaire
  // un second appel Supabase dans companyDashboardGaresRouter.
  if (verifiedMessayAccessRequests.has(req)) {
    next();
    return;
  }

  void resolveAccess(req)
    .then((access) => {
      (req as AuthedRequest).messay = access;
      verifiedMessayAccessRequests.add(req);
      next();
    })
    .catch(next);
}

// Compatibilité : avec le montage historique, les autres routeurs privés
// sont exécutés après celui-ci. À retirer seulement après avoir monté
// requireMessayCompanyAccess explicitement dans server.ts et validé l'accès.
companyDashboardGaresRouter.use(requireMessayCompanyAccess);
function access(req: AuthedRequest): Access { if (!req.messay) return fail(401,'Session absente.'); return req.messay; }
function director(req: AuthedRequest): Access { const a=access(req); if(a.role!=='DIRECTION') return fail(403,'Accès réservé à la direction.'); return a; }
function manager(req: AuthedRequest): Access { const a=access(req); if(!['DIRECTION','CHEF_GARE'].includes(a.role)) return fail(403,'Accès réservé à la direction ou au chef.'); return a; }
async function scopedGare(req: AuthedRequest, id: string) {
  const a = access(req);
  if (!uuid(id)) return fail(400,'Identifiant de gare invalide.');
  if (a.role !== 'DIRECTION' && !a.gare_ids.includes(id)) return fail(403,'Gare non autorisée.');
  const result = await db.from('gares').select('id,company_id,nom,ville,adresse,chef_nom,chef_tel,latitude,longitude,created_at')
    .eq('id',id).eq('company_id',a.company_id).maybeSingle();
  const gare = must(result,'gare autorisée');
  if (!gare) return fail(404,'Gare introuvable.');
  return gare;
}
const safeBody = (input: any) => {
  const nom = nonempty(input?.nom), ville = nonempty(input?.ville), adresse = nonempty(input?.adresse);
  const chef_nom = nonempty(input?.chef_nom) || null, chef_tel = nonempty(input?.chef_tel) || null;
  const latitude = input?.latitude === null || input?.latitude === '' || input?.latitude === undefined ? null : Number(input.latitude);
  const longitude = input?.longitude === null || input?.longitude === '' || input?.longitude === undefined ? null : Number(input.longitude);
  if (nom.length < 2 || nom.length > 160 || ville.length < 2 || ville.length > 160 || adresse.length < 3 || adresse.length > 350) return fail(400,'Nom, ville ou adresse de gare invalide.');
  if (chef_nom && chef_nom.length > 160) return fail(400,'Nom du chef trop long.');
  if (chef_tel && !phoneOk(chef_tel)) return fail(400,'Téléphone du chef invalide.');
  if ((latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) || (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) return fail(400,'Coordonnées GPS invalides.');
  return {nom,ville,adresse,chef_nom,chef_tel,latitude,longitude};
};
companyDashboardGaresRouter.get('/me/access',wrap(async(req,res)=>{
  const a = access(req);
  res.setHeader('Cache-Control', 'no-store');
  res.json({role:a.role,company_id:a.company_id,gare_ids:a.gare_ids,display_name:a.display_name});
}));
companyDashboardGaresRouter.get('/gares',wrap(async(req,res)=>{
  const a=access(req);
  let q=db.from('gares').select('id,company_id,nom,ville,adresse,chef_nom,chef_tel,latitude,longitude,created_at')
    .eq('company_id',a.company_id).order('nom',{ascending:true});
  if(a.role!=='DIRECTION') {
    if (!a.gare_ids.length) return void res.json([]);
    q=q.in('id',a.gare_ids);
  }
  res.json(must(await q,'liste des gares') || []);
}));
companyDashboardGaresRouter.post('/gares',wrap(async(req,res)=>{
  const a=director(req), input=safeBody(req.body);
  if (!input.chef_nom || !input.chef_tel) return fail(400,'Nom et téléphone du chef de gare obligatoires.');
  const created=must(await db.from('gares').insert({...input,company_id:a.company_id}).select('id,company_id,nom,ville,adresse,chef_nom,chef_tel,latitude,longitude').single(),'création de la gare');
  res.status(201).json(created);
}));
companyDashboardGaresRouter.patch('/gares/:gareId',wrap(async(req,res)=>{
  const a=director(req); const id=String(req.params.gareId||''); await scopedGare(req,id);
  const updated=must(await db.from('gares').update(safeBody(req.body)).eq('id',id).eq('company_id',a.company_id)
    .select('id,company_id,nom,ville,adresse,chef_nom,chef_tel,latitude,longitude').single(),'mise à jour de la gare');
  res.json(updated);
}));
companyDashboardGaresRouter.get('/gares/:gareId/overview',wrap(async(req,res)=>{
  const gare=await scopedGare(req,String(req.params.gareId||'')); const a=access(req);
  const [r,d,ar,g] = await Promise.all([
    db.from('gare_responsables').select('id,gare_id,nom,fonction,telephone,email,actif').eq('gare_id',gare.id).eq('actif',true).order('nom'),
    db.from('destinations').select('id,gare_depart_id,gare_arrivee_id,ville,prix,duree,quota,billets_vendus').eq('company_id',a.company_id).eq('gare_depart_id',gare.id),
    db.from('destinations').select('id,gare_depart_id,gare_arrivee_id,ville,prix,duree,quota,billets_vendus').eq('company_id',a.company_id).eq('gare_arrivee_id',gare.id),
    db.from('gares').select('id,nom,ville').eq('company_id',a.company_id),
  ]);
  const responsables=must(r,'responsables')||[], departs=must(d,'destinations départ')||[], arrivees=must(ar,'destinations arrivée')||[];
  const stations=must(g,'noms des gares')||[];
  const names=new Map<string,{nom:string;ville:string}>(stations.map((s:any):[string,{nom:string;ville:string}]=>[String(s.id),{nom:String(s.nom),ville:String(s.ville)}]));
  const ids=[...new Set([...departs,...arrivees].map((s:any)=>s.id))];
  const hours=ids.length ? must(await db.from('horaires').select('id,destination_id,heure_depart').in('destination_id',ids),'horaires')||[] : [];
  const format=(line:any)=>({id:line.id, gare_depart_id:line.gare_depart_id, gare_arrivee_id:line.gare_arrivee_id,
    gare_depart_nom:names.get(line.gare_depart_id)?.nom||null, gare_arrivee_nom:names.get(line.gare_arrivee_id)?.nom||null,
    ville_depart:names.get(line.gare_depart_id)?.ville||null,ville_arrivee:line.ville||'',
    prix:numberOrNull(line.prix),duree:line.duree||null,quota:line.quota,billets_vendus:line.billets_vendus,
    horaires:hours.filter((h:any)=>h.destination_id===line.id).map((h:any)=>({id:h.id,heure_depart:h.heure_depart}))});
  res.json({responsables,departs:departs.map(format),arrivees:arrivees.map(format)});
}));
companyDashboardGaresRouter.post('/gares/:gareId/responsables',wrap(async(req,res)=>{
  manager(req);const gare=await scopedGare(req,String(req.params.gareId||''));
  const nom=nonempty(req.body?.nom), fonction=nonempty(req.body?.fonction), telephone=nonempty(req.body?.telephone)||null,email=nonempty(req.body?.email)||null;
  if(nom.length<3||nom.length>160||!['ADJOINT','BILLETTERIE','CAISSE','EMBARQUEMENT','EXPLOITATION'].includes(fonction)||telephone&&!phoneOk(telephone)||email&&!emailOk(email)) return fail(400,'Fiche responsable invalide.');
  const row=must(await db.from('gare_responsables').insert({gare_id:gare.id,nom,fonction,telephone,email}).select().single(),'fiche responsable');res.status(201).json(row);
}));
companyDashboardGaresRouter.delete('/gares/:gareId/responsables/:responsableId',wrap(async(req,res)=>{
  manager(req);const gare=await scopedGare(req,String(req.params.gareId||''));
  if(!uuid(req.params.responsableId)) return fail(400,'Responsable invalide.');
  must(await db.from('gare_responsables').update({actif:false}).eq('gare_id',gare.id).eq('id',req.params.responsableId).select('id'),'désactivation responsable');res.status(204).end();
}));
// Invitations de la gare : la DIRECTION peut consulter les nominations de chefs,
// mais un CHEF_GARE ne peut voir que les invitations d'agents de sa gare.
companyDashboardGaresRouter.get('/gares/:gareId/invitations', wrap(async (req, res) => {
  const viewer = manager(req);
  const gare = await scopedGare(req, String(req.params.gareId || ''));
  let query = db
    .from('messay_gare_invitations')
    .select('id,gare_id,nom,email,role,statut,created_at')
    .eq('gare_id', gare.id)
    .eq('company_id', gare.company_id);
  if (viewer.role === 'CHEF_GARE') {
    query = query.in('role', [
      'AGENT_BILLETTERIE',
      'AGENT_CAISSE',
      'AGENT_EMBARQUEMENT',
      'AGENT_EXPLOITATION',
    ]);
  }
  const rows = must(
    await query.order('created_at', { ascending: false }).limit(100),
    'invitations'
  ) || [];
  // Empêche les anciennes réponses de rester visibles après un changement de compte.
  res.setHeader('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  res.json({ invitations: rows });
}));
// MESSAY PRO : les comptes agents activés sont distincts des invitations.
const MESSAY_AGENT_ROLES = [
  'AGENT_BILLETTERIE',
  'AGENT_CAISSE',
  'AGENT_EMBARQUEMENT',
  'AGENT_EXPLOITATION',
] as const;
// Lister uniquement les accès actifs de la gare et de la compagnie du demandeur.
// Les noms affichés proviennent des invitations acceptées ; le compte Auth n'est
// jamais supprimé ni modifié par cette fonctionnalité.
companyDashboardGaresRouter.get('/gares/:gareId/agents', wrap(async (req, res) => {
  manager(req);
  const gare = await scopedGare(req, String(req.params.gareId || ''));
  const staff = must(
    await db.from('messay_gare_staff')
      .select('id,gare_id,auth_user_id,role,actif,created_at')
      .eq('gare_id', gare.id)
      .eq('company_id', gare.company_id)
      .eq('actif', true)
      .in('role', [...MESSAY_AGENT_ROLES])
      .order('created_at', { ascending: false })
      .limit(100),
    'agents actifs de la gare'
  ) || [];
  const authUserIds = [...new Set<string>(
    staff.map((item: { auth_user_id: string }) => String(item.auth_user_id))
  )];
  const accepted = authUserIds.length
    ? must(
        await db.from('messay_gare_invitations')
          .select('invited_auth_user_id,nom,email,role,created_at')
          .eq('gare_id', gare.id)
          .eq('company_id', gare.company_id)
          .eq('statut', 'acceptee')
          .in('role', [...MESSAY_AGENT_ROLES])
          .in('invited_auth_user_id', authUserIds)
          .order('created_at', { ascending: false })
          .limit(200),
        'identités des agents actifs'
      ) || []
    : [];
  const identities = new Map<string, { nom: string | null; email: string | null }>();
  for (const item of accepted) {
    if (!item.invited_auth_user_id) continue;
    const key = `${String(item.invited_auth_user_id)}:${String(item.role)}`;
    if (!identities.has(key)) {
      identities.set(key, {
        nom: typeof item.nom === 'string' ? item.nom : null,
        email: typeof item.email === 'string' ? item.email : null,
      });
    }
  }
  res.setHeader('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  res.json({
    agents: staff.map((item: {
      id: string; gare_id: string; auth_user_id: string;
      role: string; actif: boolean; created_at: string;
    }) => ({
      ...item,
      nom: identities.get(`${item.auth_user_id}:${item.role}`)?.nom ?? null,
      email: identities.get(`${item.auth_user_id}:${item.role}`)?.email ?? null,
    })),
  });
}));
// Annuler une invitation en attente, sans détruire les traces administratives.
// Un chef ne peut révoquer que des invitations d'agents dans sa propre gare.
companyDashboardGaresRouter.patch('/gares/:gareId/invitations/:invitationId/revoke', wrap(async (req, res) => {
  const viewer = manager(req);
  const gare = await scopedGare(req, String(req.params.gareId || ''));
  const invitationId = String(req.params.invitationId || '');
  if (!uuid(invitationId)) return fail(400, 'MESSAY PRO : identifiant d’invitation invalide.');
  let query = db.from('messay_gare_invitations')
    .update({ statut: 'revoquee' })
    .eq('id', invitationId)
    .eq('gare_id', gare.id)
    .eq('company_id', gare.company_id)
    .eq('statut', 'en_attente');
  if (viewer.role === 'CHEF_GARE') {
    query = query.in('role', [...MESSAY_AGENT_ROLES]);
  }
  const changed = must(await query.select('id').maybeSingle(), 'annulation invitation');
  if (!changed) {
    return fail(409, 'MESSAY PRO : cette invitation est déjà traitée ou ne vous est pas accessible.');
  }
  console.info('[MESSAY PRO] Invitation révoquée', {
    actor_user_id: viewer.userId,
    gare_id: gare.id,
    invitation_id: invitationId,
  });
  res.setHeader('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  res.json({ success: true, message: 'MESSAY PRO : invitation annulée.' });
}));
// Désactiver un accès local à une gare, jamais le compte global auth.users.
// Contrôle atomique : role, statut actif, compagnie, gare et ID serveur.
companyDashboardGaresRouter.patch('/gares/:gareId/agents/:staffId/deactivate', wrap(async (req, res) => {
  const viewer = manager(req);
  const gare = await scopedGare(req, String(req.params.gareId || ''));
  const staffId = String(req.params.staffId || '');
  if (!uuid(staffId)) return fail(400, 'MESSAY PRO : identifiant du compte agent invalide.');
  const updated = must(
    await db.from('messay_gare_staff')
      .update({ actif: false })
      .eq('id', staffId)
      .eq('gare_id', gare.id)
      .eq('company_id', gare.company_id)
      .eq('actif', true)
      .in('role', [...MESSAY_AGENT_ROLES])
      .neq('auth_user_id', viewer.userId)
      .select('id,auth_user_id,role')
      .maybeSingle(),
    'désactivation accès agent'
  );
  if (!updated) {
    return fail(409, 'MESSAY PRO : cet accès est déjà désactivé, introuvable ou non autorisé.');
  }
  console.info('[MESSAY PRO] Accès agent désactivé', {
    actor_user_id: viewer.userId,
    staff_id: staffId,
    gare_id: gare.id,
  });
  res.setHeader('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  res.json({ success: true, message: 'MESSAY PRO : accès de l’agent à cette gare retiré.' });
}));
companyDashboardGaresRouter.post('/gares/:gareId/invitations',wrap(async(req,res)=>{
  const a=manager(req);const gare=await scopedGare(req,String(req.params.gareId||''));
  const nom=nonempty(req.body?.nom), email=nonempty(req.body?.email).toLowerCase(), role=nonempty(req.body?.role);
  const roleOk=['CHEF_GARE','AGENT_BILLETTERIE','AGENT_CAISSE','AGENT_EMBARQUEMENT','AGENT_EXPLOITATION'].includes(role);
  if(nom.length<3||nom.length>160||!emailOk(email)||!roleOk) return fail(400,'Nom, email ou rôle invalide.');
  if(a.role==='CHEF_GARE'&&role==='CHEF_GARE') return fail(403,'Le chef ne peut pas inviter un autre chef.');
  if(role==='CHEF_GARE') {
    const row=must(await db.from('messay_gare_staff').select('id').eq('gare_id',gare.id).eq('role','CHEF_GARE').eq('actif',true).limit(1),'chef existant')||[];
    if(row.length) return fail(409,'Un chef actif est déjà affecté à cette gare. Révoquez son accès avant remplacement.');
  }
  // Eviter les doublons encore actifs et fermer les demandes administrativement expirées.
  const old=must(await db.from('messay_gare_invitations').select('id,email,role,expires_at').eq('gare_id',gare.id).eq('statut','en_attente'),'invitations existantes')||[];
  const same=old.filter((x:any)=>String(x.email).toLowerCase()===email);
  if(same.some((x:any)=>new Date(x.expires_at).getTime()>Date.now())) return fail(409,'Une invitation est déjà en attente pour cet email dans cette gare.');
  for(const item of same) must(await db.from('messay_gare_invitations').update({statut:'expiree'}).eq('id',item.id).eq('statut','en_attente').select('id'),'expiration invitation');
  const base = String(process.env.COMPANY_DASHBOARD_URL || '').trim().replace(/\/+$/, '');
  if(!base) return fail(503,'MESSAY PRO : le service d’invitation est momentanément indisponible. Contactez la Direction.');
  if(role==='CHEF_GARE' && old.some((x:any)=>x.role==='CHEF_GARE'&&new Date(x.expires_at).getTime()>Date.now())) return fail(409,'Une invitation chef est déjà en attente dans cette gare.');
  const inserted = requireDbObject(
    must(await db.from('messay_gare_invitations').insert({company_id:a.company_id,gare_id:gare.id,nom,email,role,invited_by:a.userId})
      .select('id,gare_id,nom,email,role,statut,created_at').single(), 'création invitation'),
    'création invitation'
  );
  const insertedId = requireDbUuid(inserted.id, 'invitation créée');
  // Ne jamais inviter depuis React. URL autorisée dans Supabase Auth Redirect URLs.
  const redirectTo=`${base}/invitation?invitation_id=${encodeURIComponent(insertedId)}`;
  const {data:invited,error:inviteError}=await db.auth.admin.inviteUserByEmail(email,{redirectTo,data:{full_name:nom}});
  if (inviteError || !invited.user?.id) {
    // Une tentative en échec ne doit pas laisser une invitation activable.
    const revoked = await db.from('messay_gare_invitations')
      .update({ statut: 'revoquee' })
      .eq('id', insertedId)
      .eq('statut', 'en_attente')
      .select('id');
    if (revoked.error || !revoked.data?.length) {
      console.error('[MESSAY PRO][INVITATIONS] Révocation à vérifier :', {
        invitationId: insertedId,
        code: revoked.error?.code,
        message: revoked.error?.message,
      });
    }
    // Les détails Supabase restent dans le terminal du backend uniquement.
    console.error('[MESSAY PRO][INVITATIONS] Envoi non effectué :', {
      invitationId: insertedId,
      code: inviteError?.code,
      status: inviteError?.status,
      message: inviteError?.message || 'Utilisateur non renvoyé',
    });
    const code = inviteError?.code || '';
    if (code === 'email_exists' || code === 'user_already_exists') {
      return fail(
        409,
        'MESSAY PRO : cette adresse est déjà liée à un compte. ' +
        'L’affectation d’un compte existant nécessite un parcours de confirmation dédié. ' +
        'Veuillez contacter la Direction.'
      );
    }
    if (
      inviteError?.status === 429 ||
      code === 'over_email_send_rate_limit' ||
      code === 'over_request_rate_limit'
    ) {
      return fail(429, 'MESSAY PRO : trop de demandes. Réessayez plus tard.');
    }
    return fail(
      503,
      'MESSAY PRO : nous ne pouvons pas envoyer cette invitation pour le moment. ' +
      'Vérifiez l’adresse e-mail ou contactez la Direction.'
    );
  }
  const recorded=await db.from('messay_gare_invitations').update({invited_auth_user_id:invited.user.id}).eq('id',insertedId).eq('statut','en_attente').select('id').single();
  if(recorded.error) { console.error('[MESSAY] Invitation email envoyée mais affectation à réparer:',insertedId,recorded.error); return fail(500,'Email envoyé, mais la liaison de l’invitation a échoué. Demandez une vérification administrateur, ne recréez pas la gare.'); }
  res.status(201).json(inserted);
}));
/** L'activation ne demande qu'une session Supabase Auth, pas encore de rôle métier.
 * Monter CE routeur avant companyDashboardGaresRouter, comme dans le README.
 */
export const messayInvitationActivationRouter=Router();
messayInvitationActivationRouter.post('/invitations/activate',wrap(async(req,res)=>{
  const token=/^Bearer\s+(.+)$/i.exec(req.get('authorization')||'')?.[1];
  if(!token) return fail(401,'Lien de connexion requis.');
  const {data,error}=await db.auth.getUser(token);
  if(error||!data.user?.id||!data.user.email) return fail(401,'MESSAY PRO : votre session de connexion n’est plus valide. Reconnectez-vous.');
  const invitationId=req.body?.invitation_id;
  if(!uuid(invitationId)) return fail(400,'Identifiant invitation incorrect.');
  const {data:invitation,error:inviteError}=await db.from('messay_gare_invitations')
    .select('id,email,invited_auth_user_id,statut,expires_at').eq('id',invitationId).maybeSingle();
  if(inviteError) return fail(500,'Impossible de vérifier cette invitation.');
  if(!invitation||invitation.invited_auth_user_id!==data.user.id||String(invitation.email).toLowerCase()!==data.user.email.toLowerCase()) return fail(403,'Invitation attribuée à un autre compte.');
  if(invitation.statut!=='en_attente'||new Date(invitation.expires_at).getTime()<=Date.now()) return fail(409,'Invitation non valide ou expirée.');
  const result=await db.rpc('messay_activate_invitation',{p_invitation_id:invitationId,p_auth_user_id:data.user.id});
  if(result.error) {console.error('[MESSAY] Activation:',result.error.message);return fail(409,'Activation refusée (déjà attribué, chef existant ou invitation expirée).');}
  res.json(result.data);
}));
// Données de transactions issues EXCLUSIVEMENT des événements financiers enregistrés.
// Ne mélange pas quotas historiques et places vendues par départ.
function dateRange(req: Request) {
  const from=req.query.du, to=req.query.au;
  if(!validDate(from)||!validDate(to)||from>to) return fail(400,'Période invalide : du et au au format AAAA-MM-JJ.');
  if(Date.parse(`${to}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`)>366*86_400_000) return fail(400,'Période supérieure à 366 jours.');
  return {from,to,upper:plusDay(to)};
}
function page(req: Request) {
  const limitInput = req.query.limit === undefined ? 50 : Number(req.query.limit);
  if (!Number.isSafeInteger(limitInput) || limitInput < 1) return fail(400, 'Limite de pagination invalide.');
  const limit = Math.min(limitInput, 50);
  const cursor=req.query.cursor;
  if (cursor !== undefined && (typeof cursor !== 'string' || !/^\d+$/.test(cursor))) {
    return fail(400, 'Curseur de pagination invalide.');
  }
  const offset = typeof cursor === 'string' ? Number(cursor) : 0;
  if(!Number.isSafeInteger(offset)||offset<0||offset>50000) return fail(400,'Pagination invalide.');
  return {limit,offset};
}
const asTransaction=(r:any,garesMap:Map<string,string>, agentsMap:Map<string,string>)=>({
  id:r.id,occurred_at:r.occurred_at,reference_billet:r.reference_billet,
  agent_nom:r.agent_auth_user_id?agentsMap.get(r.agent_auth_user_id)||`Compte ${String(r.agent_auth_user_id).slice(0,8)}`:null,
  canal:r.canal,mode_paiement:r.mode_paiement,statut:r.type_mouvement==='REMBOURSEMENT'?'REMBOURSE':'PAYE',
  montant_fcfa:r.type_mouvement==='REMBOURSEMENT'?-Number(r.montant_brut_fcfa):Number(r.montant_brut_fcfa),
  commission_messay_fcfa:Number(r.commission_messay_fcfa),part_compagnie_fcfa:Number(r.part_compagnie_fcfa),
  gare_id:r.gare_id,gare_nom:garesMap.get(r.gare_id)||'Gare',
});
async function readTransactions(req: AuthedRequest, gareId: string|null) {
  const a=access(req), {from,upper}=dateRange(req), {limit,offset}=page(req);
  let q=db.from('messay_gare_transactions').select('id,gare_id,occurred_at,reference_billet,agent_auth_user_id,canal,mode_paiement,type_mouvement,montant_brut_fcfa,commission_messay_fcfa,part_compagnie_fcfa')
    .eq('company_id',a.company_id).gte('occurred_at',`${from}T00:00:00Z`).lt('occurred_at',upper)
    .order('occurred_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+limit);
  if(gareId) q=q.eq('gare_id',gareId);
  if(a.role!=='DIRECTION') {
    if(!a.gare_ids.length) return {transactions:[],next_cursor:null};
    q=q.in('gare_id',a.gare_ids);
    // L'agent voit uniquement SES opérations. Le chef voit celles de sa gare.
    if(a.role!=='CHEF_GARE') q=q.eq('agent_auth_user_id',a.userId);
  }
  const rows=must(await q,'transactions')||[];
  const names=must(await db.from('gares').select('id,nom').eq('company_id',a.company_id),'gares transactions')||[];
  const garesMap=new Map<string,string>(names.map((s:any):[string,string]=>[String(s.id),String(s.nom)]));
  const agentsMap=new Map<string,string>(); // Noms vérifiés dans la table d'annuaire si liés par auth_user_id.
  const stationIds=names.map((n:any)=>n.id);
  const agents=stationIds.length ? must(await db.from('gare_responsables').select('auth_user_id,nom').in('gare_id',stationIds).not('auth_user_id','is',null),'agents transactions')||[] : [];
  for(const item of agents) if(item.auth_user_id) agentsMap.set(item.auth_user_id,item.nom);
  return {transactions:rows.slice(0,limit).map((r:any)=>asTransaction(r,garesMap,agentsMap)),next_cursor:rows.length>limit?String(offset+limit):null};
}
companyDashboardGaresRouter.get('/gares/:gareId/transactions',wrap(async(req,res)=>{
  await scopedGare(req,String(req.params.gareId||''));res.json(await readTransactions(req,String(req.params.gareId)));
}));
companyDashboardGaresRouter.get('/transactions',wrap(async(req,res)=>{director(req);res.json(await readTransactions(req,null));}));
companyDashboardGaresRouter.get('/gares/:gareId/hierarchy-reports',wrap(async(req,res)=>{
  const gare=await scopedGare(req,String(req.params.gareId||''));const a=access(req);const {from,to}=dateRange(req);
  let q=db.from('messay_gare_rapports_hierarchie').select('id,gare_id,auteur_id,type,date_rapport,billets_declares,especes_declarees_fcfa,observation,statut,created_at')
    .eq('company_id',a.company_id).eq('gare_id',gare.id).gte('date_rapport',from).lte('date_rapport',to).order('created_at',{ascending:false}).limit(200);
  if(a.role!=='DIRECTION'&&a.role!=='CHEF_GARE') q=q.eq('auteur_id',a.userId);
  const rows=must(await q,'rapports hiérarchiques')||[];
  res.json({rapports:rows.map((r:any)=>({...r,auteur_nom:`Compte ${r.auteur_id.slice(0,8)}`}))});
}));
companyDashboardGaresRouter.post('/gares/:gareId/hierarchy-reports',wrap(async(req,res)=>{
  const gare=await scopedGare(req,String(req.params.gareId||'')),a=access(req);
  if(a.role==='DIRECTION') return fail(403,'La direction valide les rapports mais ne les rédige pas à la place des agents.');
  const date=req.body?.date_rapport, amount=req.body?.especes_declarees_fcfa, observation=nonempty(req.body?.observation)||null;
  if(!validDate(date)||Date.parse(`${date}T00:00:00Z`)>Date.now()||!Number.isSafeInteger(amount)||amount<0||observation&&observation.length>2000) return fail(400,'Date, espèces ou observation invalides.');
  const isChief=a.role==='CHEF_GARE';
  let countQ=db.from('messay_gare_transactions').select('id',{count:'exact',head:true})
    .eq('company_id',a.company_id).eq('gare_id',gare.id).eq('type_mouvement','VENTE')
    .gte('occurred_at',`${date}T00:00:00Z`).lt('occurred_at',plusDay(date));
  if(!isChief) countQ=countQ.eq('agent_auth_user_id',a.userId);
  const tally=await countQ;
  if(tally.error) return fail(500,'Impossible de vérifier le nombre de ventes confirmées.');
  const row = requireDbObject(
    must(await db.from('messay_gare_rapports_hierarchie').insert({
      company_id:a.company_id,gare_id:gare.id,auteur_id:a.userId,type:isChief?'CHEF_GARE':'AGENT',date_rapport:date,
      especes_declarees_fcfa:amount,observation,statut:isChief?'SOUMIS_DIRECTION':'SOUMIS_CHEF',billets_declares:tally.count||0,
    }).select().single(), 'rapport soumis'),
    'rapport soumis'
  );
  res.status(201).json({...row,auteur_nom:a.display_name});
}));
companyDashboardGaresRouter.post('/gares/:gareId/hierarchy-reports/:reportId/review',wrap(async(req,res)=>{
  const gare=await scopedGare(req,String(req.params.gareId||'')),a=access(req);
  const decision=nonempty(req.body?.decision),motif=nonempty(req.body?.motif)||null;
  if(!uuid(req.params.reportId)||!['APPROUVER','RETOURNER'].includes(decision)||decision==='RETOURNER'&&(!motif||motif.length>2000)) return fail(400,'Décision ou motif invalide.');
  const oldData = must(await db.from('messay_gare_rapports_hierarchie')
    .select('id,type,statut,auteur_id').eq('id',req.params.reportId)
    .eq('gare_id',gare.id).eq('company_id',a.company_id).maybeSingle(), 'rapport contrôlé');
  if (oldData === null) return fail(404,'Rapport introuvable.');
  const old = asReviewableReport(oldData);
  const from=a.role==='DIRECTION'&&old.type==='CHEF_GARE'?'SOUMIS_DIRECTION':a.role==='CHEF_GARE'&&old.type==='AGENT'?'SOUMIS_CHEF':null;
  if(!from || old.statut!==from || old.auteur_id===a.userId) return fail(403,'Rapport non contrôlable par ce rôle ou cet état.');
  const to=decision==='APPROUVER'?(a.role==='DIRECTION'?'VALIDE_DIRECTION':'VALIDE_CHEF'):(a.role==='DIRECTION'?'RETOURNE_CHEF':'RETOURNE_AGENT');
  const resultData = must(await db.from('messay_gare_rapports_hierarchie')
    .update({statut:to,review_motif:motif,reviewed_by:a.userId,reviewed_at:new Date().toISOString()})
    .eq('id',old.id).eq('statut',from).eq('company_id',a.company_id)
    .eq('gare_id',gare.id).select().maybeSingle(), 'revue rapport');
  if (resultData === null) return fail(409,'Le rapport a déjà été traité.');
  const result = requireDbObject(resultData, 'revue rapport');
  res.json({...result,auteur_nom:`Compte ${old.auteur_id.slice(0,8)}`});
}));
companyDashboardGaresRouter.get('/hierarchy-reports/pending',wrap(async(req,res)=>{
  const a=director(req);
  const rows=must(await db.from('messay_gare_rapports_hierarchie').select('id,gare_id,auteur_id,type,date_rapport,billets_declares,especes_declarees_fcfa,observation,statut,created_at')
    .eq('company_id',a.company_id).eq('type','CHEF_GARE').eq('statut','SOUMIS_DIRECTION').order('created_at',{ascending:false}).limit(200),'rapports direction')||[];
  const names=must(await db.from('gares').select('id,nom').eq('company_id',a.company_id),'gares direction')||[];
  const map=new Map(names.map((g:any)=>[g.id,g.nom]));
  res.json({rapports:rows.map((r:any)=>({...r,gare_nom:map.get(r.gare_id)||'Gare',auteur_nom:`Compte ${r.auteur_id.slice(0,8)}`}))});
}));
// L'endpoint /rapport et les clôtures demandent le rapprochement comptable des ventes
// (y compris les espèces et remboursements). Ne pas exposer de faux agrégats.
companyDashboardGaresRouter.get('/gares/:gareId/rapport',wrap(async(req,res)=>{
  await scopedGare(req,String(req.params.gareId||''));
  res.status(501).json({message:'Rapport comptable non raccordé au registre de paiements confirmé : fonctionnalité à terminer.'});
}));
companyDashboardGaresRouter.post('/gares/:gareId/clotures',wrap(async(req,res)=>{
  await scopedGare(req,String(req.params.gareId||''));
  res.status(501).json({message:'Clôture de caisse à raccorder à un rapprochement comptable sécurisé.'});
}));
companyDashboardGaresRouter.post('/lignes',wrap(async(req,res)=>{
  director(req);
  res.status(501).json({message:'Création de lignes à implémenter avec transaction destinations + horaires.'});
}));
// A monter une fois APRÈS tous les routes : Express affiche des erreurs utiles.
export function messayCompanyDashboardErrorHandler(err: unknown,_req: Request,res: Response,next: NextFunction) {
  if (res.headersSent) return next(err);
  const error=err instanceof HttpError ? err : null;
  if(!error) console.error('[MESSAY/company-dashboard]',err);
  res.status(error?.status||500).json({message:error?.message||'Erreur interne du serveur MESSAY.'});
}
