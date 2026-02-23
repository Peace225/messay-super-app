import { Router } from 'express';
import { PaiementController } from '../controllers/paiement.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const paiementController = new PaiementController();

/**
 * @swagger
 * /api/paiements:
 *   post:
 *     summary: Créer un paiement
 *     tags: [Paiements]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               montant:
 *                 type: number
 *               moyen:
 *                 type: string
 *               courseId:
 *                 type: string
 *               ticketId:
 *                 type: string
 *               commandeBTPId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Paiement créé
 */
router.post('/', authenticate, paiementController.createPaiement);

/**
 * @swagger
 * /api/paiements:
 *   get:
 *     summary: Obtenir l'historique des paiements
 *     tags: [Paiements]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des paiements
 */
router.get('/', authenticate, paiementController.getHistorique);

/**
 * @swagger
 * /api/paiements/{id}:
 *   get:
 *     summary: Obtenir les détails d'un paiement
 *     tags: [Paiements]
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
 *         description: Détails du paiement
 */
router.get('/:id', authenticate, paiementController.getPaiementById);

/**
 * @swagger
 * /api/paiements/{id}/recu:
 *   get:
 *     summary: Télécharger le reçu PDF
 *     tags: [Paiements]
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
 *         description: Reçu PDF
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/:id/recu', authenticate, paiementController.downloadRecu);

/**
 * @swagger
 * /api/paiements/{id}/verify:
 *   post:
 *     summary: Vérifier le statut d'un paiement
 *     tags: [Paiements]
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
 *         description: Statut du paiement
 */
router.post('/:id/verify', authenticate, paiementController.verifyPaiement);

export default router;
