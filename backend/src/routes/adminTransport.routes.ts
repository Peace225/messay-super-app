/**
 * MESSAY / Administration du transport par tricycle.
 * Endpoints réservés à ADMIN, persistance Prisma / PostgreSQL.
 * À monter sous /api/admin/transport, avant notFound.
 * Ne modifie ni les routes OTP ni le rôle public USER.
 */
import { randomBytes } from 'crypto';
import { Router, type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { Prisma, TricycleStatus, UserRole } from '@prisma/client';
import { z } from 'zod';
import prisma from '../config/database';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate, authorize('ADMIN'));

// En complément du JWT, vérifier que le compte admin n'est pas bloqué/révoqué.
router.use(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const identity = req.user as { id?: string; userId?: string } | undefined;
    const id = identity?.userId || identity?.id;
    if (!id) { res.status(401).json({ error: 'Session administrateur invalide' }); return; }
    const admin = await prisma.user.findUnique({ where: { id }, select: { role: true, isBlocked: true } });
    if (!admin || admin.isBlocked || admin.role !== UserRole.ADMIN) {
      res.status(403).json({ error: 'Accès administrateur refusé' }); return;
    }
    next();
  } catch (err) { next(err); }
});

function pageOptions(req: Request) {
  const limitRaw = Number(req.query.limit || 100);
  const pageRaw = Number(req.query.page || 1);
  const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 100;
  const page = Number.isInteger(pageRaw) ? Math.min(Math.max(pageRaw, 1), 10000) : 1;
  return { take: limit, skip: (page - 1) * limit, page, limit };
}
const publicUser = {
  id: true, nom: true, prenom: true, telephone: true, email: true,
  role: true, isVerified: true, isBlocked: true, createdAt: true,
} as const;

const driverRegistration = z.object({
  nom: z.string().trim().min(2).max(100),
  prenom: z.string().trim().min(2).max(100),
  telephone: z.string().trim().regex(/^\+2250[157]\d{8}$/, 'Numéro ivoirien invalide (+22507XXXXXXXX)'),
  email: z.union([z.string().trim().toLowerCase().email(), z.literal('')]).optional(),
  permis: z.string().trim().min(1).max(30).default('B'),
  numeroPermis: z.string().trim().min(3).max(80),
  immatriculation: z.string().trim().min(4).max(30),
  modele: z.string().trim().min(2).max(80),
  annee: z.coerce.number().int().min(1995).max(new Date().getFullYear() + 1),
}).strict();

function handleError(res: Response, err: unknown) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    res.status(409).json({ error: 'Téléphone, e-mail, numéro de permis ou plaque déjà utilisé' });
    return;
  }
  console.error('[admin-transport]', err);
  res.status(500).json({ error: 'Erreur serveur de gestion du transport' });
}

// Liste des vrais passagers : pas de mots de passe ni de refresh tokens.
// Statistiques globales calculées par PostgreSQL (pas de données simulées).
// Le router est déjà protégé par authenticate + authorize('ADMIN').
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [usersTotal, driversTotal, driversPending, vehicleGroups, courseGroups] = await Promise.all([
      prisma.user.count({ where: { role: UserRole.USER } }),
      prisma.conducteur.count(),
      prisma.conducteur.count({ where: { isVerified: false } }),
      prisma.tricycle.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.course.groupBy({ by: ['statut'], _count: { _all: true } }),
    ]);

    const vehicleCounts: Record<string, number> = {};
    for (const row of vehicleGroups) vehicleCounts[String(row.status)] = row._count._all;
    const courseCounts: Record<string, number> = {};
    for (const row of courseGroups) courseCounts[String(row.statut)] = row._count._all;
    const sum = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0);

    const totalVehicles = sum(vehicleCounts);
    const disponible = vehicleCounts['DISPONIBLE'] ?? 0;
    const enCourse = vehicleCounts['EN_COURSE'] ?? 0;
    const maintenance = vehicleCounts['MAINTENANCE'] ?? 0;
    const horsLigne = vehicleCounts['HORS_LIGNE'] ?? 0;

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      generatedAt: new Date().toISOString(),
      users: { total: usersTotal },
      drivers: { total: driversTotal, pendingValidation: driversPending },
      vehicles: {
        total: totalVehicles, disponible, enCourse, maintenance, horsLigne,
        autres: totalVehicles - disponible - enCourse - maintenance - horsLigne,
      },
      courses: {
        total: sum(courseCounts),
        enCours: courseCounts['EN_COURS'] ?? 0,
        terminees: courseCounts['TERMINEE'] ?? 0,
        annulees: courseCounts['ANNULEE'] ?? 0,
      },
    });
  } catch (err) { handleError(res, err); }
});

router.get('/users', async (req: Request, res: Response) => {
  try {
    const p = pageOptions(req);
    const where = { role: UserRole.USER };
    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, select: publicUser, orderBy: { createdAt: 'desc' }, take: p.take, skip: p.skip }),
      prisma.user.count({ where }),
    ]);
    res.json({ items, total, page: p.page, limit: p.limit });
  } catch (err) { handleError(res, err); }
});

router.get('/conducteurs', async (req: Request, res: Response) => {
  try {
    const p = pageOptions(req);
    const [rows, total] = await Promise.all([
      prisma.conducteur.findMany({
        take: p.take, skip: p.skip, orderBy: { id: 'desc' },
        select: {
          id: true, userId: true, isVerified: true, disponible: true, isAvailable: true,
          statut: true, permis: true, numeroPermis: true, immatriculation: true,
          user: { select: publicUser },
          tricycle: { select: { id: true, immatriculation: true, modele: true, status: true } },
        },
      }),
      prisma.conducteur.count(),
    ]);
    res.json({ items: rows, total, page: p.page, limit: p.limit });
  } catch (err) { handleError(res, err); }
});

router.get('/tricycles', async (req: Request, res: Response) => {
  try {
    const p = pageOptions(req);
    const [rows, total] = await Promise.all([
      prisma.tricycle.findMany({
        take: p.take, skip: p.skip, orderBy: { createdAt: 'desc' },
        select: {
          id: true, immatriculation: true, modele: true, annee: true, status: true,
          batterie: true, vitesse: true, latitude: true, longitude: true,
          derniereActivite: true, coursesAujourdhui: true, distanceParcourue: true,
          createdAt: true, conducteurId: true,
          conducteur: { select: { user: { select: { id: true, nom: true, prenom: true, telephone: true } } } },
        },
      }),
      prisma.tricycle.count(),
    ]);
    res.json({ items: rows.map(t => ({
      id: t.id, immatriculation: t.immatriculation, modele: t.modele,
      annee: t.annee, status: t.status, batterie: t.batterie, vitesse: t.vitesse,
      coursesAujourdhui: t.coursesAujourdhui, distanceParcourue: t.distanceParcourue,
      derniereActivite: t.derniereActivite, createdAt: t.createdAt,
      conducteurId: t.conducteurId,
      chauffeur: t.conducteur?.user ? [t.conducteur.user.prenom, t.conducteur.user.nom].filter(Boolean).join(' ') : null,
      chauffeurTel: t.conducteur?.user.telephone ?? null,
      position: { lat: t.latitude, lng: t.longitude },
    })), total, page: p.page, limit: p.limit });
  } catch (err) { handleError(res, err); }
});

// Liste administrateur de toutes les courses, contrairement au GET /courses réservé au compte.
router.get('/courses', async (req: Request, res: Response) => {
  try {
    const p = pageOptions(req);
    const [items, total] = await Promise.all([
      prisma.course.findMany({
        take: p.take, skip: p.skip, orderBy: { id: 'desc' },
        select: {
          id: true, userId: true, conducteurId: true, statut: true, createdAt: true,
          departAdresse: true, destinationAdresse: true, prix: true, prixFinal: true,
          distance: true, dureeEstimee: true, heureDebut: true,
          user: { select: { id: true, nom: true, prenom: true, telephone: true } },
          conducteur: { select: { id: true, user: { select: { nom: true, prenom: true, telephone: true } } } },
        },
      }),
      prisma.course.count(),
    ]);
    res.json({ items, total, page: p.page, limit: p.limit });
  } catch (err) { handleError(res, err); }
});

/**
 * Création atomique : compte CONDUCTEUR + profil + tricycle affecté.
 * Le mot de passe initial aléatoire est retourné UNE SEULE FOIS à l'ADMIN.
 * La vérification documentaire est distincte de la création du compte.
 */
router.post('/conducteurs', async (req: Request, res: Response) => {
  const parsed = driverRegistration.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Formulaire invalide', details: parsed.error.flatten() }); return; }
  const data = parsed.data;
  const immatriculation = data.immatriculation.toUpperCase();
  const temporaryPassword = randomBytes(24).toString('base64url');
  const hash = await bcrypt.hash(temporaryPassword, 12);
  try {
    const result = await prisma.$transaction(async tx => {
      const user = await tx.user.create({
        data: {
          nom: data.nom, prenom: data.prenom, telephone: data.telephone,
          email: data.email || null, password: hash, role: UserRole.CONDUCTEUR,
          isVerified: false,
          conducteurProfile: { create: {
            permis: data.permis, numeroPermis: data.numeroPermis,
            immatriculation, disponible: false, isAvailable: false,
            isVerified: false,
          } },
        },
        include: { conducteurProfile: true },
      });
      const conducteur = user.conducteurProfile;
      if (!conducteur) throw new Error('Profil conducteur non créé');
      const tricycle = await tx.tricycle.create({
        data: {
          conducteurId: conducteur.id, immatriculation,
          modele: data.modele, annee: data.annee,
          status: Object.values(TricycleStatus).find(s => s === 'HORS_LIGNE') || Object.values(TricycleStatus).find(s => s === 'MAINTENANCE') || TricycleStatus.DISPONIBLE,
        },
      });
      return {
        conducteur: {
          id: conducteur.id, userId: user.id,
          nom: user.nom, prenom: user.prenom,
          telephone: user.telephone, email: user.email,
          isVerified: conducteur.isVerified,
        },
        tricycle: { id: tricycle.id, immatriculation: tricycle.immatriculation },
      };
    });
    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({
      ...result,
      connexion: { identifiant: result.conducteur.telephone, motDePasseTemporaire: temporaryPassword },
      message: 'Compte créé. Vérifiez les documents avant d’autoriser les courses.',
    });
  } catch (err) { handleError(res, err); }
});

const uuid = z.string().uuid();
const verifyDriver = z.object({ verified: z.boolean() }).strict();
router.patch('/conducteurs/:id/verification', async (req: Request, res: Response) => {
  if (!uuid.safeParse(req.params.id).success) { res.status(400).json({ error: 'Identifiant invalide' }); return; }
  const parsed = verifyDriver.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'verified doit être un booléen' }); return; }
  try {
    const driver = await prisma.conducteur.findUnique({ where: { id: req.params.id }, select: { userId: true } });
    if (!driver) { res.status(404).json({ error: 'Conducteur introuvable' }); return; }
    if (!parsed.data.verified) {
      const active = await prisma.course.count({ where: { conducteurId: req.params.id, statut: { in: ['ACCEPTEE', 'EN_COURS'] } } });
      if (active) { res.status(409).json({ error: 'Impossible de révoquer un conducteur durant une course active' }); return; }
    }
    await prisma.$transaction([
      prisma.conducteur.update({ where: { id: req.params.id }, data: {
        isVerified: parsed.data.verified,
        ...(!parsed.data.verified ? { disponible: false, isAvailable: false } : {}),
      } }),
      prisma.user.update({ where: { id: driver.userId }, data: { isVerified: parsed.data.verified } }),
    ]);
    res.json({ id: req.params.id, verified: parsed.data.verified });
  } catch (err) { handleError(res, err); }
});

const blockDriver = z.object({ blocked: z.boolean() }).strict();
router.patch('/conducteurs/:id/block', async (req: Request, res: Response) => {
  if (!uuid.safeParse(req.params.id).success) { res.status(400).json({ error: 'Identifiant invalide' }); return; }
  const parsed = blockDriver.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'blocked doit être un booléen' }); return; }
  try {
    const driver = await prisma.conducteur.findUnique({ where: { id: req.params.id }, select: { userId: true } });
    if (!driver) { res.status(404).json({ error: 'Conducteur introuvable' }); return; }
    if (parsed.data.blocked) {
      const active = await prisma.course.count({ where: { conducteurId: req.params.id, statut: { in: ['ACCEPTEE', 'EN_COURS'] } } });
      if (active) { res.status(409).json({ error: 'Course active : clôturez-la avant de suspendre ce compte' }); return; }
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: driver.userId }, data: { isBlocked: parsed.data.blocked, ...(parsed.data.blocked ? { refreshToken: null } : {}) } }),
      ...(parsed.data.blocked ? [prisma.conducteur.update({ where: { id: req.params.id }, data: { disponible: false, isAvailable: false } })] : []),
    ]);
    res.json({ id: req.params.id, blocked: parsed.data.blocked });
  } catch (err) { handleError(res, err); }
});

const changeStatus = z.object({ status: z.enum(['DISPONIBLE', 'MAINTENANCE', 'HORS_LIGNE']) }).strict();
router.patch('/tricycles/:id/status', async (req: Request, res: Response) => {
  if (!uuid.safeParse(req.params.id).success) { res.status(400).json({ error: 'Identifiant invalide' }); return; }
  const parsed = changeStatus.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Statut invalide' }); return; }
  try {
    const vehicle = await prisma.tricycle.findUnique({ where: { id: req.params.id }, select: { conducteurId: true, status: true, conducteur: { select: { isVerified: true, user: { select: { isBlocked: true } } } } } });
    if (!vehicle) { res.status(404).json({ error: 'Tricycle introuvable' }); return; }
    if (vehicle.status === 'EN_COURSE') {
      res.status(409).json({ error: 'Impossible de modifier un tricycle en course' }); return;
    }
    // Un tricycle peut ne pas avoir de conducteur affecté : la relation Prisma est nullable.
    const conducteurId = vehicle.conducteurId;
    const conducteur = vehicle.conducteur;

    // Un véhicule sans conducteur vérifié et actif ne peut pas recevoir de courses.
    if (parsed.data.status === 'DISPONIBLE') {
      if (!conducteurId || !conducteur || !conducteur.isVerified || conducteur.user.isBlocked) {
        res.status(409).json({ error: 'Affectez un conducteur vérifié et non suspendu avant de rendre ce tricycle disponible' });
        return;
      }
    }

    if (!Object.values(TricycleStatus).includes(parsed.data.status as TricycleStatus)) {
      res.status(400).json({ error: 'Statut non défini dans Prisma' });
      return;
    }

    // Avec conducteurId=null, Prisma rechercherait les courses sans conducteur ;
    // cela pourrait bloquer par erreur tous les véhicules non affectés.
    if (conducteurId) {
      const active = await prisma.course.count({
        where: { conducteurId, statut: { in: ['ACCEPTEE', 'EN_COURS'] } },
      });
      if (active > 0) {
        res.status(409).json({ error: 'Une course active empêche le changement de statut' });
        return;
      }
    }

    await prisma.$transaction(async tx => {
      await tx.tricycle.update({
        where: { id: req.params.id },
        data: { status: parsed.data.status as TricycleStatus },
      });
      if (parsed.data.status !== 'DISPONIBLE' && conducteurId) {
        await tx.conducteur.update({
          where: { id: conducteurId },
          data: { disponible: false, isAvailable: false },
        });
      }
    });
    res.json({ id: req.params.id, status: parsed.data.status });
  } catch (err) { handleError(res, err); }
});

export default router;
