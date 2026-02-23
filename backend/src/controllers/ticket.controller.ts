import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateQRCode } from '../utils/qrcode';

/**
 * Contrôleur pour la gestion des tickets de transport
 */
export class TicketController {
  /**
   * POST /api/tickets
   * Réserver un ticket
   */
  async createTicket(req: Request, res: Response): Promise<void> {
    try {
      const {
        compagnie,
        depart,
        destination,
        dateDepart,
        heureDepart,
        siege,
        prix,
      } = req.body;

      const userId = req.user!.id;

      // Générer un QR code unique
      const qrCode = await generateQRCode(`TICKET-${Date.now()}-${userId}`);

      const ticket = await prisma.ticket.create({
        data: {
          userId,
          compagnie,
          depart,
          destination,
          dateDepart: new Date(dateDepart),
          heureDepart,
          siege,
          prix: parseFloat(prix),
          qrCode,
          statut: 'RESERVE',
        },
        include: {
          user: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              email: true,
              telephone: true,
            },
          },
        },
      });

      res.status(201).json({ ticket });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/tickets
   * Obtenir l'historique des tickets de l'utilisateur
   */
  async getUserTickets(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const tickets = await prisma.ticket.findMany({
        where: { userId },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.status(200).json({ tickets });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/tickets/:id
   * Obtenir les détails d'un ticket
   */
  async getTicketById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const ticket = await prisma.ticket.findFirst({
        where: {
          id,
          userId,
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
   * PATCH /api/tickets/:id/annuler
   * Annuler un ticket
   */
  async annulerTicket(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const ticket = await prisma.ticket.findFirst({
        where: {
          id,
          userId,
        },
      });

      if (!ticket) {
        res.status(404).json({ error: 'Ticket non trouvé' });
        return;
      }

      if (ticket.statut === 'UTILISE' || ticket.statut === 'ANNULE') {
        res.status(400).json({ error: 'Ce ticket ne peut pas être annulé' });
        return;
      }

      const ticketUpdated = await prisma.ticket.update({
        where: { id },
        data: { statut: 'ANNULE' },
      });

      res.status(200).json({ ticket: ticketUpdated });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
