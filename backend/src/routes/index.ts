import { Router } from 'express';
import authRoutes from './auth.routes';
import courseRoutes from './course.routes';
import userRoutes from './user.routes';
import conducteurRoutes from './conducteur.routes';
import paiementRoutes from './paiement.routes';
import supportRoutes from './support.routes';
import notificationRoutes from './notification.routes';
import btpRoutes from './btp.routes';
import ticketRoutes from './ticket.routes';

const router = Router();

// Routes principales
router.use('/auth', authRoutes);
router.use('/courses', courseRoutes);
router.use('/users', userRoutes);
router.use('/conducteurs', conducteurRoutes);
router.use('/paiements', paiementRoutes);
router.use('/support', supportRoutes);
router.use('/notifications', notificationRoutes);
router.use('/btp', btpRoutes);
router.use('/tickets', ticketRoutes);

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Vérifier l'état de l'API
 *     tags: [Santé]
 *     responses:
 *       200:
 *         description: API opérationnelle
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 message:
 *                   type: string
 *                   example: MESSAY API is running
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'MESSAY API is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;
