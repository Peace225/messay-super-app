import { Router } from 'express';
import { SupportController } from '../controllers/support.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const supportController = new SupportController();

/**
 * @swagger
 * /api/support/tickets:
 *   post:
 *     summary: Créer un ticket de support
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               typeDemande:
 *                 type: string
 *               sujet:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Ticket créé
 */
router.post('/tickets', authenticate, supportController.createTicket);

/**
 * @swagger
 * /api/support/tickets:
 *   get:
 *     summary: Obtenir mes tickets
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des tickets
 */
router.get('/tickets', authenticate, supportController.getMyTickets);

/**
 * @swagger
 * /api/support/tickets/all:
 *   get:
 *     summary: Obtenir tous les tickets (admin)
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste de tous les tickets
 */
router.get('/tickets/all', authenticate, supportController.getAllTickets);

/**
 * @swagger
 * /api/support/tickets/{id}:
 *   get:
 *     summary: Obtenir les détails d'un ticket
 *     tags: [Support]
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
 *         description: Détails du ticket
 */
router.get('/tickets/:id', authenticate, supportController.getTicketById);

/**
 * @swagger
 * /api/support/tickets/{id}/messages:
 *   post:
 *     summary: Ajouter un message à un ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Message ajouté
 */
router.post('/tickets/:id/messages', authenticate, supportController.addMessage);

/**
 * @swagger
 * /api/support/tickets/{id}/close:
 *   patch:
 *     summary: Fermer un ticket
 *     tags: [Support]
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
 *         description: Ticket fermé
 */
router.patch('/tickets/:id/close', authenticate, supportController.closeTicket);

export default router;
