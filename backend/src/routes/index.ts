import { Router, Request, Response } from 'express';
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

// --- LOGGING DE DEBUG (Optionnel mais recommandé) ---
// Pour voir passer les requêtes dans ton terminal backend
router.use((req, res, next) => {
  console.log(`📡 [API CALL] ${req.method} ${req.originalUrl}`);
  next();
});

// --- ROUTES PRINCIPALES ---
// Rappel : le préfixe '/api' est déjà ajouté dans server.ts
router.use('/auth', authRoutes);
router.use('/courses', courseRoutes); // 🚩 C'est ici que ça se joue pour Moussa
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
 * get:
 * summary: Vérifier l'état de l'API
 * tags: [Santé]
 * responses:
 * 200:
 * description: API opérationnelle
 */
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    message: 'MESSAY API is running',
    timestamp: new Date().toISOString(),
    ip: req.ip // Pratique pour vérifier si ton téléphone tape sur la bonne IP
  });
});

export default router;