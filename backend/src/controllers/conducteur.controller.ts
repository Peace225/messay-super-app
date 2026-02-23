import { Request, Response } from 'express';
import prisma from '../config/database';

/**
 * Contrôleur pour la gestion des conducteurs
 */
export class ConducteurController {
  /**
   * GET /api/conducteurs
   * Obtenir tous les conducteurs
   */
  async getConducteurs(req: Request, res: Response): Promise<void> {
    try {
      const conducteurs = await prisma.conducteur.findMany({
        include: {
          user: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              email: true,
              telephone: true,
              photo: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.status(200).json({ conducteurs });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/conducteurs/:id
   * Obtenir un conducteur par ID
   */
  async getConducteurById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const conducteur = await prisma.conducteur.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              email: true,
              telephone: true,
              photo: true,
            },
          },
        },
      });

      if (!conducteur) {
        res.status(404).json({ error: 'Conducteur non trouvé' });
        return;
      }

      res.status(200).json({ conducteur });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/conducteurs
   * Créer un nouveau conducteur
   */
  async createConducteur(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        permis,
        numeroPermis,
        vehiculeType,
        immatriculation,
      } = req.body;

      // Vérifier que l'utilisateur existe et est un conducteur
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        res.status(404).json({ error: 'Utilisateur non trouvé' });
        return;
      }

      if (user.role !== 'CONDUCTEUR') {
        res.status(400).json({ error: 'L\'utilisateur doit avoir le rôle CONDUCTEUR' });
        return;
      }

      // Créer le profil conducteur
      const conducteur = await prisma.conducteur.create({
        data: {
          userId,
          permis,
          numeroPermis,
          vehiculeType,
          immatriculation,
          statut: 'DISPONIBLE',
          note: 5.0,
          nombreCourses: 0,
          isVerified: false,
        },
        include: {
          user: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              email: true,
              telephone: true,
              photo: true,
            },
          },
        },
      });

      res.status(201).json({ conducteur });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * PATCH /api/conducteurs/:id
   * Mettre à jour un conducteur
   */
  async updateConducteur(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        permis,
        numeroPermis,
        vehiculeType,
        immatriculation,
        statut,
        isVerified,
      } = req.body;

      const conducteur = await prisma.conducteur.update({
        where: { id },
        data: {
          ...(permis && { permis }),
          ...(numeroPermis && { numeroPermis }),
          ...(vehiculeType && { vehiculeType }),
          ...(immatriculation && { immatriculation }),
          ...(statut && { statut }),
          ...(isVerified !== undefined && { isVerified }),
        },
        include: {
          user: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              email: true,
              telephone: true,
              photo: true,
            },
          },
        },
      });

      res.status(200).json({ conducteur });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/conducteurs/:id
   * Supprimer un conducteur
   */
  async deleteConducteur(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await prisma.conducteur.delete({
        where: { id },
      });

      res.status(200).json({ message: 'Conducteur supprimé avec succès' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
