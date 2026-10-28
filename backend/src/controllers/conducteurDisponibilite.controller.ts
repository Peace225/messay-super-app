import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';

const STATUT_DISPONIBLE = 'DISPONIBLE';
const STATUT_HORS_LIGNE = 'HORS_LIGNE';
const STATUT_EN_COURSE = 'EN_COURSE';

type ProfilConducteur = {
  id: string;
  statut: string;
  disponible: boolean;
  isAvailable: boolean;
  isVerified: boolean;
  rating: number;
};

/** Réponse stable pour le service React Native. Aucun champ sensible. */
function formatDisponibilite(conducteur: ProfilConducteur) {
  return {
    conducteurId: conducteur.id,
    statut: conducteur.statut,
    disponible: conducteur.disponible,
    isAvailable: conducteur.isAvailable,
    isVerified: conducteur.isVerified,
    isOnline:
      conducteur.isVerified &&
      conducteur.statut === STATUT_DISPONIBLE &&
      conducteur.disponible &&
      conducteur.isAvailable,
    rating: conducteur.rating,
  };
}

function authenticatedUserId(req: Request, res: Response): string | null {
  const id = req.user?.id;
  if (typeof id !== 'string' || !id) {
    res.status(401).json({ error: 'Non authentifié' });
    return null;
  }
  return id;
}

/** GET /api/conducteurs/me/disponibilite */
export async function getMyAvailability(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;

  try {
    const conducteur = await prisma.conducteur.findUnique({
      where: { userId },
      include: {
        user: { select: { role: true, isBlocked: true } },
      },
    });

    if (
      !conducteur ||
      conducteur.user.role !== 'CONDUCTEUR' ||
      conducteur.user.isBlocked
    ) {
      res.status(403).json({ error: 'Profil conducteur indisponible' });
      return;
    }

    res.status(200).json(formatDisponibilite(conducteur));
  } catch (error) {
    console.error('[Conducteur] Erreur récupération disponibilité:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

/** PATCH /api/conducteurs/me/disponibilite — body: { disponible: boolean } */
export async function setMyAvailability(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;

  const disponible: unknown = req.body?.disponible;
  if (typeof disponible !== 'boolean') {
    res.status(400).json({ error: 'Le champ disponible doit être un booléen' });
    return;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const conducteur = await tx.conducteur.findUnique({
        where: { userId },
        include: {
          user: { select: { role: true, isBlocked: true } },
          tricycle: { select: { status: true } },
        },
      });

      if (
        !conducteur ||
        conducteur.user.role !== 'CONDUCTEUR' ||
        conducteur.user.isBlocked
      ) {
        return { status: 403, error: 'Profil conducteur indisponible' } as const;
      }

      if (disponible && !conducteur.isVerified) {
        return {
          status: 403,
          error: 'Votre profil doit être validé par un administrateur',
        } as const;
      }

      if (conducteur.statut === STATUT_EN_COURSE) {
        return {
          status: 409,
          error: 'Impossible de modifier votre disponibilité pendant une course',
        } as const;
      }

      if (
        disponible &&
        (conducteur.tricycle?.status === 'MAINTENANCE' ||
          conducteur.tricycle?.status === 'EN_COURSE')
      ) {
        return {
          status: 409,
          error: 'Votre tricycle est indisponible',
        } as const;
      }

      const coursesActives = await tx.course.count({
        where: {
          conducteurId: conducteur.id,
          statut: { in: ['ACCEPTEE', 'EN_COURS'] },
        },
      });

      if (coursesActives > 0) {
        return {
          status: 409,
          error: 'Terminez votre course active avant de changer de disponibilité',
        } as const;
      }

      // Mise à jour conditionnelle : ne pas écraser une acceptation de course
      // effectuée au même moment sur le compte du conducteur.
      const updated = await tx.conducteur.updateMany({
        where: {
          id: conducteur.id,
          statut: conducteur.statut,
          disponible: conducteur.disponible,
          isAvailable: conducteur.isAvailable,
        },
        data: {
          statut: disponible ? STATUT_DISPONIBLE : STATUT_HORS_LIGNE,
          disponible,
          isAvailable: disponible,
        },
      });

      if (updated.count !== 1) {
        return {
          status: 409,
          error: 'Disponibilité modifiée simultanément, veuillez réessayer',
        } as const;
      }

      // Mettre à jour le tricycle associé sans toucher aux véhicules en maintenance.
      await tx.tricycle.updateMany({
        where: {
          conducteurId: conducteur.id,
          status: { notIn: ['MAINTENANCE', 'EN_COURSE'] },
        },
        data: {
          status: disponible ? 'DISPONIBLE' : 'HORS_LIGNE',
          derniereActivite: new Date(),
        },
      });

      const finalConducteur = await tx.conducteur.findUniqueOrThrow({
        where: { id: conducteur.id },
      });

      return {
        status: 200,
        data: formatDisponibilite(finalConducteur),
      } as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.status(200).json(result.data);
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      res.status(409).json({ error: 'Conflit de mise à jour, veuillez réessayer' });
      return;
    }
    console.error('[Conducteur] Erreur modification disponibilité:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}
