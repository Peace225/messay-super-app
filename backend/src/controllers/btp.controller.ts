import { Request, Response } from 'express';
import prisma from '../config/database';

/**
 * Contrôleur pour la gestion des commandes BTP/Carrière
 */
export class BTPController {
  /**
   * POST /api/btp/commandes
   * Créer une nouvelle commande BTP
   */
  async createCommande(req: Request, res: Response): Promise<void> {
    try {
      const {
        typeMateriau,
        quantite,
        unite,
        typeCamion,
        adresseLivraison,
        latitudeLivraison,
        longitudeLivraison,
        dateLivraison,
        heurePreferee,
        prix,
      } = req.body;

      const userId = req.user!.id;

      const commande = await prisma.commandeBTP.create({
        data: {
          userId,
          typeMateriau,
          quantite: parseFloat(quantite),
          unite,
          typeCamion,
          adresseLivraison,
          latitudeLivraison: parseFloat(latitudeLivraison),
          longitudeLivraison: parseFloat(longitudeLivraison),
          dateLivraison: new Date(dateLivraison),
          heurePreferee,
          prix: parseFloat(prix),
          statut: 'EN_ATTENTE',
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

      res.status(201).json({ commande });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/btp/commandes
   * Obtenir l'historique des commandes de l'utilisateur
   */
  async getCommandesUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const commandes = await prisma.commandeBTP.findMany({
        where: { userId },
        include: {
          chauffeur: {
            include: {
              user: {
                select: {
                  nom: true,
                  prenom: true,
                  telephone: true,
                },
              },
            },
          },
          camion: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.status(200).json({ commandes });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/btp/commandes/:id
   * Obtenir les détails d'une commande
   */
  async getCommandeById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const commande = await prisma.commandeBTP.findFirst({
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
          chauffeur: {
            include: {
              user: {
                select: {
                  nom: true,
                  prenom: true,
                  telephone: true,
                },
              },
            },
          },
          camion: true,
        },
      });

      if (!commande) {
        res.status(404).json({ error: 'Commande non trouvée' });
        return;
      }

      res.status(200).json({ commande });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * PATCH /api/btp/commandes/:id/annuler
   * Annuler une commande
   */
  async annulerCommande(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const commande = await prisma.commandeBTP.findFirst({
        where: {
          id,
          userId,
        },
      });

      if (!commande) {
        res.status(404).json({ error: 'Commande non trouvée' });
        return;
      }

      if (commande.statut === 'LIVREE' || commande.statut === 'ANNULEE') {
        res.status(400).json({ error: 'Cette commande ne peut pas être annulée' });
        return;
      }

      const commandeUpdated = await prisma.commandeBTP.update({
        where: { id },
        data: { statut: 'ANNULEE' },
      });

      res.status(200).json({ commande: commandeUpdated });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
