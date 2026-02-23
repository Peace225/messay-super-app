import { Router } from 'express';
import { BTPController } from '../controllers/btp.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const btpController = new BTPController();

/**
 * @swagger
 * /api/btp/commandes:
 *   post:
 *     summary: Créer une nouvelle commande BTP
 *     tags: [BTP]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - typeMateriau
 *               - quantite
 *               - typeCamion
 *               - adresseLivraison
 *               - latitudeLivraison
 *               - longitudeLivraison
 *               - dateLivraison
 *               - prix
 *             properties:
 *               typeMateriau:
 *                 type: string
 *                 enum: [SABLE, GRAVIER, CIMENT, PIERRE, BETON]
 *               quantite:
 *                 type: number
 *               unite:
 *                 type: string
 *                 default: TONNE
 *               typeCamion:
 *                 type: string
 *                 enum: [BENNE, CITERNE, PLATEAU, MALAXEUR]
 *               adresseLivraison:
 *                 type: string
 *               latitudeLivraison:
 *                 type: number
 *               longitudeLivraison:
 *                 type: number
 *               dateLivraison:
 *                 type: string
 *                 format: date-time
 *               heurePreferee:
 *                 type: string
 *               prix:
 *                 type: number
 *     responses:
 *       201:
 *         description: Commande créée avec succès
 *       401:
 *         description: Non autorisé
 */
router.post('/commandes', authenticate, btpController.createCommande);

/**
 * @swagger
 * /api/btp/commandes:
 *   get:
 *     summary: Obtenir l'historique des commandes de l'utilisateur
 *     tags: [BTP]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des commandes
 *       401:
 *         description: Non autorisé
 */
router.get('/commandes', authenticate, btpController.getCommandesUser);

/**
 * @swagger
 * /api/btp/commandes/{id}:
 *   get:
 *     summary: Obtenir les détails d'une commande
 *     tags: [BTP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Détails de la commande
 *       404:
 *         description: Commande non trouvée
 */
router.get('/commandes/:id', authenticate, btpController.getCommandeById);

/**
 * @swagger
 * /api/btp/commandes/{id}/annuler:
 *   patch:
 *     summary: Annuler une commande
 *     tags: [BTP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Commande annulée
 *       400:
 *         description: Commande ne peut pas être annulée
 *       404:
 *         description: Commande non trouvée
 */
router.patch('/commandes/:id/annuler', authenticate, btpController.annulerCommande);

export default router;
