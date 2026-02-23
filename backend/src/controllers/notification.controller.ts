import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendPushNotification } from '../utils/notifications';

/**
 * Contrôleur de gestion des notifications
 */
export class NotificationController {
  /**
   * GET /api/notifications - Obtenir mes notifications
   */
  async getNotifications(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId!;

      const notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      res.status(200).json({ notifications });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * PATCH /api/notifications/:id/read - Marquer comme lue
   */
  async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.userId!;

      const notification = await prisma.notification.findFirst({
        where: { id, userId },
      });

      if (!notification) {
        res.status(404).json({ error: 'Notification non trouvée' });
        return;
      }

      const updated = await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });

      res.status(200).json({ notification: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * PATCH /api/notifications/read-all - Marquer toutes comme lues
   */
  async markAllAsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId!;

      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });

      res.status(200).json({ message: 'Toutes les notifications ont été marquées comme lues' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/notifications/:id - Supprimer une notification
   */
  async deleteNotification(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.userId!;

      const notification = await prisma.notification.findFirst({
        where: { id, userId },
      });

      if (!notification) {
        res.status(404).json({ error: 'Notification non trouvée' });
        return;
      }

      await prisma.notification.delete({
        where: { id },
      });

      res.status(200).json({ message: 'Notification supprimée' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/notifications/register-token - Enregistrer le token push
   */
  async registerPushToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;
      const userId = req.userId!;

      // Sauvegarder le token dans la base de données
      // Note: Vous devrez ajouter un champ pushToken dans le modèle User
      await prisma.user.update({
        where: { id: userId },
        data: {
          // pushToken: token, // Décommenter après avoir ajouté le champ
        },
      });

      res.status(200).json({ message: 'Token enregistré' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/notifications/send - Envoyer une notification (admin)
   */
  async sendNotification(req: Request, res: Response): Promise<void> {
    try {
      if (req.userRole !== 'ADMIN') {
        res.status(403).json({ error: 'Accès refusé' });
        return;
      }

      const { userId, titre, message, type } = req.body;

      // Créer la notification dans la base
      const notification = await prisma.notification.create({
        data: {
          userId,
          titre,
          message,
          type: type || 'INFO',
        },
      });

      // Envoyer la push notification
      await sendPushNotification(userId, titre, message);

      res.status(201).json({ notification });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
