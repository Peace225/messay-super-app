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

  /**
   * PUT /api/users/:id
   * Mettre à jour un utilisateur
   */
  async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { nom, prenom, email, telephone, currentPassword, newPassword } = req.body;

      // Vérifier que l'utilisateur existe
      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        res.status(404).json({ error: 'Utilisateur non trouvé' });
        return;
      }

      // Vérifier que l'utilisateur ne modifie que son propre profil (sauf admin)
      if (req.userId !== id && req.userRole !== 'ADMIN') {
        res.status(403).json({ error: 'Non autorisé' });
        return;
      }

      const updateData: any = {
        nom,
        prenom,
        email,
        telephone,
      };

      // Si changement de mot de passe demandé
      if (newPassword) {
        if (!currentPassword) {
          res.status(400).json({ error: 'Mot de passe actuel requis' });
          return;
        }

        // Vérifier le mot de passe actuel
        const bcrypt = require('bcryptjs');
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        
        if (!isPasswordValid) {
          res.status(400).json({ error: 'Mot de passe actuel incorrect' });
          return;
        }

        // Hasher le nouveau mot de passe
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        updateData.password = hashedPassword;
      }

      // Mettre à jour l'utilisateur
      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
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

      res.status(200).json({
        message: 'Profil mis à jour avec succès',
        user: updatedUser,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/users/:id
   * Supprimer un utilisateur
   */
  async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Vérifier que l'utilisateur existe
      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        res.status(404).json({ error: 'Utilisateur non trouvé' });
        return;
      }

      // Vérifier que l'utilisateur ne supprime que son propre compte (sauf admin)
      if (req.userId !== id && req.userRole !== 'ADMIN') {
        res.status(403).json({ error: 'Non autorisé' });
        return;
      }

      // Supprimer l'utilisateur
      await prisma.user.delete({
        where: { id },
      });

      res.status(200).json({
        message: 'Compte supprimé avec succès',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
