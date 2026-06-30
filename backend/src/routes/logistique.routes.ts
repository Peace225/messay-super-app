import { Router } from 'express';
import { logistiqueController } from '../controllers/logistique.controller';
// On importe les fonctions telles qu'elles sont nommées dans ton auth.ts
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

/**
 * ROUTES LOGISTIQUE - MESSAY
 */

// 1. On remplace 'protect' par 'authenticate'
// 2. On remplace 'adminOnly' par 'authorize('ADMIN')' (ou le nom exact de ton rôle admin)
router.post(
  '/quick-assign', 
  authenticate, 
  authorize('ADMIN'), 
  logistiqueController.quickAssign
);

// Route pour les stocks : accessible par tout utilisateur authentifié
router.get(
  '/stocks', 
  authenticate, 
  logistiqueController.getStocks
);

export default router;