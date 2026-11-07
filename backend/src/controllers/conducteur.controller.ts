import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../config/database';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Seul le module tricycle est concerné. Aucune propriété arbitraire
// (statut, rating, disponible, userId lors d'un PATCH...) n'est autorisée.
const driverData = {
  permis: z.string().trim().min(1).max(2048),
  numeroPermis: z.string().trim().min(3).max(80),
  vehiculeType: z.literal('TRICYCLE'),
  immatriculation: z.string().trim().min(3).max(40).transform(v => v.toUpperCase()),
};

const createSchema = z.object({
  userId: z.string().uuid(),
  permis: driverData.permis,
  numeroPermis: driverData.numeroPermis,
  vehiculeType: driverData.vehiculeType.default('TRICYCLE'),
  immatriculation: driverData.immatriculation,
}).strict();

const updateSchema = z.object({
  permis: driverData.permis.optional(),
  numeroPermis: driverData.numeroPermis.optional(),
  vehiculeType: driverData.vehiculeType.optional(),
  immatriculation: driverData.immatriculation.optional(),
  isVerified: z.boolean().optional(),
}).strict().refine(v => Object.keys(v).length > 0, 'Aucune modification fournie');

// Jamais de mot de passe, OTP ou token dans les réponses.
const DRIVER_INCLUDE = {
  user: {
    select: {
      id: true, nom: true, prenom: true,
      email: true, telephone: true, photo: true,
      isBlocked: true,
    },
  },
  tricycle: {
    select: {
      id: true, modele: true, immatriculation: true, status: true,
    },
  },
} as const;

function requireAdmin(req: Request, res: Response): boolean {
  if (!req.user) {
    res.status(401).json({ error: 'Non authentifié' });
    return false;
  }
  if (req.user.isBlocked || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Accès réservé à un administrateur actif' });
    return false;
  }
  return true;
}

function validId(req: Request, res: Response): string | null {
  const id = req.params.id;
  if (typeof id !== 'string' || !uuidPattern.test(id)) {
    res.status(400).json({ error: 'Identifiant du conducteur invalide' });
    return null;
  }
  return id;
}

function sendDatabaseError(res: Response, error: unknown, action: string): void {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Utilisateur, permis ou immatriculation déjà enregistré' });
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Conducteur introuvable' });
      return;
    }
    if (error.code === 'P2003' || error.code === 'P2034') {
      res.status(409).json({ error: 'Opération conflictuelle : actualisez et réessayez' });
      return;
    }
  }
  console.error(`[ConducteurController.${action}]`, error);
  res.status(500).json({ error: 'Erreur interne du serveur' });
}

export class ConducteurController {
  /** GET /api/conducteurs — administration uniquement */
  async getConducteurs(req: Request, res: Response): Promise<void> {
    if (!requireAdmin(req, res)) return;
    try {
      const conducteurs = await prisma.conducteur.findMany({
        include: DRIVER_INCLUDE,
        orderBy: { createdAt: 'desc' },
      });
      res.status(200).json({ conducteurs });
    } catch (error: unknown) {
      sendDatabaseError(res, error, 'getConducteurs');
    }
  }

  /** GET /api/conducteurs/:id — administration uniquement */
  async getConducteurById(req: Request, res: Response): Promise<void> {
    if (!requireAdmin(req, res)) return;
    const id = validId(req, res);
    if (!id) return;
    try {
      const conducteur = await prisma.conducteur.findUnique({
        where: { id }, include: DRIVER_INCLUDE,
      });
      if (!conducteur) {
        res.status(404).json({ error: 'Conducteur non trouvé' });
        return;
      }
      res.status(200).json({ conducteur });
    } catch (error: unknown) {
      sendDatabaseError(res, error, 'getConducteurById');
    }
  }

  /** POST /api/conducteurs — créer un profil encore non validé et hors ligne */
  async createConducteur(req: Request, res: Response): Promise<void> {
    if (!requireAdmin(req, res)) return;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Données du conducteur invalides', details: parsed.error.flatten() });
      return;
    }

    try {
      const { userId, permis, numeroPermis, vehiculeType, immatriculation } = parsed.data;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, isBlocked: true },
      });
      if (!user) {
        res.status(404).json({ error: 'Utilisateur non trouvé' });
        return;
      }
      if (user.role !== 'CONDUCTEUR' || user.isBlocked) {
        res.status(403).json({ error: 'Utilisateur bloqué ou ne possédant pas le rôle CONDUCTEUR' });
        return;
      }

      const conducteur = await prisma.conducteur.create({
        data: {
          userId, permis, numeroPermis, vehiculeType, immatriculation,
          statut: 'HORS_LIGNE',
          disponible: false,
          isAvailable: false,
          isVerified: false,
        },
        include: DRIVER_INCLUDE,
      });
      res.status(201).json({ conducteur });
    } catch (error: unknown) {
      sendDatabaseError(res, error, 'createConducteur');
    }
  }

  /** PATCH /api/conducteurs/:id — modification administrative contrôlée */
  async updateConducteur(req: Request, res: Response): Promise<void> {
    if (!requireAdmin(req, res)) return;
    const id = validId(req, res);
    if (!id) return;

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Modification invalide', details: parsed.error.flatten() });
      return;
    }

    try {
      const result = await prisma.$transaction(async tx => {
        const current = await tx.conducteur.findUnique({
          where: { id },
          include: { tricycle: { select: { id: true, status: true } } },
        });
        if (!current) return { code: 404, error: 'Conducteur non trouvé' } as const;

        const { immatriculation, isVerified } = parsed.data;
        const plateChanged = immatriculation !== undefined && immatriculation !== current.immatriculation;
        const verificationChanged = isVerified !== undefined;

        if (plateChanged || verificationChanged) {
          const active = await tx.course.count({
            where: { conducteurId: id, statut: { in: ['ACCEPTEE', 'EN_COURS'] } },
          });
          if (active > 0 || current.tricycle?.status === 'EN_COURSE') {
            return {
              code: 409,
              error: 'Impossible de modifier le véhicule ou la validation pendant une course active',
            } as const;
          }
        }

        const data: Prisma.ConducteurUpdateInput = {
          ...(parsed.data.permis !== undefined ? { permis: parsed.data.permis } : {}),
          ...(parsed.data.numeroPermis !== undefined ? { numeroPermis: parsed.data.numeroPermis } : {}),
          ...(parsed.data.vehiculeType !== undefined ? { vehiculeType: parsed.data.vehiculeType } : {}),
          ...(immatriculation !== undefined ? { immatriculation } : {}),
        };

        // L'approbation administrative ne rend pas automatiquement disponible.
        if (verificationChanged) {
          data.isVerified = isVerified;
          data.statut = 'HORS_LIGNE';
          data.disponible = false;
          data.isAvailable = false;
        }

        await tx.conducteur.update({ where: { id }, data });

        // Synchroniser la plaque avec le tricycle déjà rattaché, s'il existe.
        if (current.tricycle && plateChanged) {
          await tx.tricycle.update({
            where: { id: current.tricycle.id },
            data: { immatriculation },
          });
        }
        if (current.tricycle && verificationChanged && current.tricycle.status !== 'MAINTENANCE') {
          await tx.tricycle.update({
            where: { id: current.tricycle.id },
            data: { status: 'HORS_LIGNE', derniereActivite: new Date() },
          });
        }

        const conducteur = await tx.conducteur.findUniqueOrThrow({
          where: { id }, include: DRIVER_INCLUDE,
        });
        return { code: 200, conducteur } as const;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      if ('error' in result) {
        res.status(result.code).json({ error: result.error });
        return;
      }
      res.status(200).json({ conducteur: result.conducteur });
    } catch (error: unknown) {
      sendDatabaseError(res, error, 'updateConducteur');
    }
  }

  /** DELETE /api/conducteurs/:id — autorisé uniquement sans historique lié */
  async deleteConducteur(req: Request, res: Response): Promise<void> {
    if (!requireAdmin(req, res)) return;
    const id = validId(req, res);
    if (!id) return;

    try {
      const result = await prisma.$transaction(async tx => {
        const current = await tx.conducteur.findUnique({
          where: { id },
          include: { tricycle: { select: { id: true } } },
        });
        if (!current) return { code: 404, error: 'Conducteur non trouvé' } as const;

        const [coursesCount, transactionsCount] = await Promise.all([
          tx.course.count({ where: { conducteurId: id } }),
          tx.transaction.count({ where: { conducteurId: id } }),
        ]);
        if (coursesCount > 0 || transactionsCount > 0 || current.tricycle) {
          return {
            code: 409,
            error: 'Suppression refusée : courses, transactions ou tricycle associé. Désactivez le profil à la place.',
          } as const;
        }

        await tx.conducteur.delete({ where: { id } });
        return { code: 200 } as const;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      if ('error' in result) {
        res.status(result.code).json({ error: result.error });
        return;
      }
      res.status(200).json({ message: 'Conducteur supprimé avec succès' });
    } catch (error: unknown) {
      sendDatabaseError(res, error, 'deleteConducteur');
    }
  }
}
