import { Router, type Request, type Response, type NextFunction } from 'express';
import { CourseController } from '../controllers/course.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createCourseSchema,
  rateCourseSchema,
} from '../validators/course.validator';

const router = Router();
const controller = new CourseController();

// Toutes les routes de courses requièrent une authentification.
router.use(authenticate);
router.use((req: Request, res: Response, next: NextFunction): void => {
  if (req.user?.isBlocked) {
    res.status(403).json({ error: 'Votre compte est bloqué' });
    return;
  }
  next();
});

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.param('id', (req: Request, res: Response, next: NextFunction, id: string): void => {
  if (!UUID_PATTERN.test(id)) {
    res.status(400).json({ error: 'Identifiant de course invalide' });
    return;
  }
  next();
});

// Routes statiques AVANT /:id.
router.get('/mine/conducteur', authorize('CONDUCTEUR'), controller.getConducteurCourses);

// Compatibilité historique : ne pas supprimer avant de vérifier les clients BTP.
router.get('/mine/chauffeur', authorize('CHAUFFEUR'), controller.getChauffeurLivraisons);

router.get('/disponibles', authorize('CONDUCTEUR'), controller.getAvailableCourses);
router.get('/nearby-drivers', authorize('USER', 'ADMIN'), controller.findNearbyDrivers);
router.get('/weekly-stats', authorize('CONDUCTEUR', 'ADMIN'), controller.getWeeklyStats);

router.get('/', controller.getUserCourses);
router.post('/', authorize('USER'), validate(createCourseSchema), controller.createCourse);

router.get('/:id', controller.getCourseById);
router.post('/:id/rate', authorize('USER'), validate(rateCourseSchema), controller.rateCourse);

router.patch('/:id/accepter', authorize('CONDUCTEUR'), controller.accepterCourse);
router.patch('/:id/demarrer', authorize('CONDUCTEUR'), controller.demarrerCourse);
router.patch('/:id/terminer', authorize('CONDUCTEUR'), controller.terminerCourse);

// Requiert CourseController.annulerCourse et CourseService.annulerCourse.
// Ne pas confirmer une annulation avant le statut ANNULEE enregistré côté serveur.
router.patch('/:id/annuler', authorize('USER'), controller.annulerCourse);

export default router;
