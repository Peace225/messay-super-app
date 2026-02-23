import { Router } from 'express';
import { TicketController } from '../controllers/ticket.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const ticketController = new TicketController();

/**
 * @swagger
 * /api/tickets:
 *   post:
 *     summary: Réserver un ticket de transport
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - compagnie
 *               - depart
 *               - destination
 *               - dateDepart
 *               - heureDepart
 *               - siege
 *               - prix
 *             properties:
 *               compagnie:
 *                 type: string
 *                 enum: [UTBS, BTA, RVS]
 *               depart:
 *                 type: string
 *               destination:
 *                 type: string
 *               dateDepart:
 *                 type: string
 *                 format: date-time
 *               heureDepart:
 *                 type: string
 *               siege:
 *                 type: string
 *               prix:
 *                 type: number
 *     responses:
 *       201:
 *         description: Ticket réservé avec succès
 *       401:
 *         description: Non autorisé
 */
router.post('/', authenticate, ticketController.createTicket);

/**
 * @swagger
 * /api/tickets:
 *   get:
 *     summary: Obtenir l'historique des tickets de l'utilisateur
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des tickets
 *       401:
 *         description: Non autorisé
 */
router.get('/', authenticate, ticketController.getUserTickets);

/**
 * @swagger
 * /api/tickets/{id}:
 *   get:
 *     summary: Obtenir les détails d'un ticket
 *     tags: [Tickets]
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
 *       404:
 *         description: Ticket non trouvé
 */
router.get('/:id', authenticate, ticketController.getTicketById);

/**
 * @swagger
 * /api/tickets/{id}/annuler:
 *   patch:
 *     summary: Annuler un ticket
 *     tags: [Tickets]
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
 *         description: Ticket annulé
 *       400:
 *         description: Ticket ne peut pas être annulé
 *       404:
 *         description: Ticket non trouvé
 */
router.patch('/:id/annuler', authenticate, ticketController.annulerTicket);

export default router;
