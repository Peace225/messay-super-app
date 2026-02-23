import { Request, Response } from 'express';
import prisma from '../config/database';

/**
 * Contrôleur de gestion du support
 */
export class SupportController {
  /**
   * POST /api/support/tickets - Créer un ticket de support
   */
  async createTicket(req: Request, res: Response): Promise<void> {
    try {
      const { typeDemande, sujet, description } = req.body;
      const userId = req.userId!;

      const ticket = await prisma.supportTicket.create({
        data: {
          userId,
          typeDemande,
          sujet,
          description,
          statut: 'OUVERT',
        },
        include: {
          user: {
            select: {
              nom: true,
              prenom: true,
              email: true,
              telephone: true,
            },
          },
        },
      });

      // Créer une notification pour l'admin
      await prisma.notification.create({
        data: {
          userId: userId,
          titre: 'Nouveau ticket de support',
          message: `Ticket #${ticket.id.substring(0, 8)} créé: ${sujet}`,
          type: 'SUPPORT',
        },
      });

      res.status(201).json({ ticket });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/support/tickets - Obtenir mes tickets
   */
  async getMyTickets(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId!;

      const tickets = await prisma.supportTicket.findMany({
        where: { userId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({ tickets });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/support/tickets/:id - Obtenir les détails d'un ticket
   */
  async getTicketById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.userId!;

      const ticket = await prisma.supportTicket.findFirst({
        where: { id, userId },
        include: {
          user: {
            select: {
              nom: true,
              prenom: true,
              email: true,
              telephone: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!ticket) {
        res.status(404).json({ error: 'Ticket non trouvé' });
        return;
      }

      res.status(200).json({ ticket });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/support/tickets/:id/messages - Ajouter un message
   */
  async addMessage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { message } = req.body;
      const userId = req.userId!;

      // Vérifier que le ticket existe et appartient à l'utilisateur
      const ticket = await prisma.supportTicket.findFirst({
        where: { id, userId },
      });

      if (!ticket) {
        res.status(404).json({ error: 'Ticket non trouvé' });
        return;
      }

      const newMessage = await prisma.supportMessage.create({
        data: {
          ticketId: id,
          message,
          isFromUser: true,
        },
      });

      // Mettre à jour le ticket
      await prisma.supportTicket.update({
        where: { id },
        data: { updatedAt: new Date() },
      });

      res.status(201).json({ message: newMessage });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * PATCH /api/support/tickets/:id/close - Fermer un ticket
   */
  async closeTicket(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.userId!;

      const ticket = await prisma.supportTicket.findFirst({
        where: { id, userId },
      });

      if (!ticket) {
        res.status(404).json({ error: 'Ticket non trouvé' });
        return;
      }

      const updatedTicket = await prisma.supportTicket.update({
        where: { id },
        data: { statut: 'FERME' },
      });

      res.status(200).json({ ticket: updatedTicket });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/support/tickets/all - Obtenir tous les tickets (admin)
   */
  async getAllTickets(req: Request, res: Response): Promise<void> {
    try {
      // Vérifier que l'utilisateur est admin
      if (req.userRole !== 'ADMIN') {
        res.status(403).json({ error: 'Accès refusé' });
        return;
      }

      const tickets = await prisma.supportTicket.findMany({
        include: {
          user: {
            select: {
              nom: true,
              prenom: true,
              email: true,
              telephone: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({ tickets });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
