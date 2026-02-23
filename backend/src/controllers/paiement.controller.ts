import { Request, Response } from 'express';
import prisma from '../config/database';
import { generatePDF } from '../utils/pdf';

/**
 * Contrôleur de gestion des paiements
 */
export class PaiementController {
  /**
   * POST /api/paiements - Créer un paiement
   */
  async createPaiement(req: Request, res: Response): Promise<void> {
    try {
      const { montant, moyen, courseId, ticketId, commandeBTPId } = req.body;
      const userId = req.userId!;

      // Générer un ID de transaction unique
      const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Créer le paiement
      const paiement = await prisma.paiement.create({
        data: {
          userId,
          montant,
          moyen,
          statut: 'EN_ATTENTE',
          transactionId,
          courseId,
          ticketId,
          commandeBTPId,
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

      // Simuler le traitement du paiement
      setTimeout(async () => {
        await prisma.paiement.update({
          where: { id: paiement.id },
          data: { statut: 'COMPLETE' },
        });
      }, 2000);

      res.status(201).json({
        paiement,
        message: 'Paiement en cours de traitement',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/paiements - Obtenir l'historique des paiements
   */
  async getHistorique(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId!;

      const paiements = await prisma.paiement.findMany({
        where: { userId },
        include: {
          course: {
            select: {
              departAdresse: true,
              destinationAdresse: true,
            },
          },
          ticket: {
            select: {
              compagnie: true,
              depart: true,
              destination: true,
            },
          },
          commandeBTP: {
            select: {
              typeMateriau: true,
              quantite: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({ paiements });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/paiements/:id - Obtenir les détails d'un paiement
   */
  async getPaiementById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.userId!;

      const paiement = await prisma.paiement.findFirst({
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
          course: true,
          ticket: true,
          commandeBTP: true,
        },
      });

      if (!paiement) {
        res.status(404).json({ error: 'Paiement non trouvé' });
        return;
      }

      res.status(200).json({ paiement });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/paiements/:id/recu - Télécharger le reçu PDF
   */
  async downloadRecu(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.userId!;

      const paiement = await prisma.paiement.findFirst({
        where: { id, userId, statut: 'COMPLETE' },
        include: {
          user: {
            select: {
              nom: true,
              prenom: true,
              email: true,
              telephone: true,
            },
          },
          course: true,
          ticket: true,
          commandeBTP: true,
        },
      });

      if (!paiement) {
        res.status(404).json({ error: 'Paiement non trouvé ou non complété' });
        return;
      }

      // Générer le PDF
      const pdfBuffer = await generatePDF(paiement);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=recu-${paiement.transactionId}.pdf`);
      res.send(pdfBuffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/paiements/:id/verify - Vérifier le statut d'un paiement
   */
  async verifyPaiement(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.userId!;

      const paiement = await prisma.paiement.findFirst({
        where: { id, userId },
      });

      if (!paiement) {
        res.status(404).json({ error: 'Paiement non trouvé' });
        return;
      }

      res.status(200).json({
        statut: paiement.statut,
        transactionId: paiement.transactionId,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
