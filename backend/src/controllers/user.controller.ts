import { Request, Response } from 'express';
import prisma from '../config/database';

/**
 * Contrôleur pour la gestion des utilisateurs
 */
export class UserController {
  /**
   * GET /api/users
   * Obtenir tous les utilisateurs
   */
  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          nom: true,
          prenom: true,
          email: true,
          telephone: true,
          role: true,
          photo: true,
          isVerified: true,
          isBlocked: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.status(200).json({ users });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/users/:id
   * Obtenir un utilisateur par ID
   */
  async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          nom: true,
          prenom: true,
          email: true,
          telephone: true,
          role: true,
          photo: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        res.status(404).json({ error: 'Utilisateur non trouvé' });
        return;
      }

      res.status(200).json({ user });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * PATCH /api/users/:id/toggle-status
   * Bloquer/Débloquer un utilisateur
   */
  async toggleUserStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Récupérer l'utilisateur actuel
      const user = await prisma.user.findUnique({
        where: { id },
        select: { isBlocked: true },
      });

      if (!user) {
        res.status(404).json({ error: 'Utilisateur non trouvé' });
        return;
      }

      // Inverser le statut
      const updatedUser = await prisma.user.update({
        where: { id },
        data: { isBlocked: !user.isBlocked },
        select: {
          id: true,
          nom: true,
          prenom: true,
          email: true,
          isBlocked: true,
        },
      });

      res.status(200).json({
        message: updatedUser.isBlocked ? 'Utilisateur bloqué' : 'Utilisateur débloqué',
        user: updatedUser,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
