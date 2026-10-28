import { Router, Request, Response, NextFunction } from 'express';
import { ConducteurController } from '../controllers/conducteur.controller';
import { authenticate, authorize } from '../middleware/auth';
import {
  getMyAvailability,
  setMyAvailability,
} from '../controllers/conducteurDisponibilite.controller';

const router = Router();
const controller = new ConducteurController();

router.use(authenticate);
router.use((req: Request, res: Response, next: NextFunction): void => {
  if (req.user?.isBlocked) {
    res.status(403).json({ error: 'Votre compte est bloqué' });
    return;
  }
  next();
});

// Conducteur connecté. Toujours AVANT /:id.
router.get('/me/disponibilite', authorize('CONDUCTEUR'), getMyAvailability);
router.patch('/me/disponibilite', authorize('CONDUCTEUR'), setMyAvailability);

// Back-office administratif : ne jamais exposer ces opérations à un simple conducteur.
router.get('/', authorize('ADMIN'), (req, res) => controller.getConducteurs(req, res));
router.get('/:id', authorize('ADMIN'), (req, res) => controller.getConducteurById(req, res));
router.post('/', authorize('ADMIN'), (req, res) => controller.createConducteur(req, res));
router.patch('/:id', authorize('ADMIN'), (req, res) => controller.updateConducteur(req, res));
router.delete('/:id', authorize('ADMIN'), (req, res) => controller.deleteConducteur(req, res));

export default router;
