
import { Router, Request, Response, NextFunction } from 'express';
import { CourseController } from '../controllers/course.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createCourseSchema,
  rateCourseSchema,
} from '../validators/course.validator';

const router = Router();
const controller = new CourseController();

// ============================================================
// 1. SÉCURITÉ GLOBALE
// ============================================================

router.use(authenticate);

// Bloquer les utilisateurs désactivés
router.use((req: Request, res: Response, next: NextFunction): void => {
  if (req.user?.isBlocked) {
    res.status(403).json({
      error: 'Votre compte est bloqué',
    });
    return;
  }

  next();
});

// Vérifier que l'identifiant est un UUID valide
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.param(
  'id',
  (req: Request, res: Response, next: NextFunction, id: string): void => {
    if (!UUID_PATTERN.test(id)) {
      res.status(400).json({
        error: 'Identifiant de course invalide',
      });
      return;
    }

    next();
  }
);

// ============================================================
// 2. ROUTES SPÉCIFIQUES
// ============================================================

// Historique du conducteur connecté
router.get(
  '/mine/conducteur',
  authorize('CONDUCTEUR'),
  controller.getConducteurCourses
);

// Ancienne route BTP conservée pour compatibilité.
// Le contrôleur corrigé renvoie 501.
router.get(
  '/mine/chauffeur',
  authorize('CHAUFFEUR'),
  controller.getChauffeurLivraisons
);

// Radar : courses en attente disponibles
router.get(
  '/disponibles',
  authorize('CONDUCTEUR'),
  controller.getAvailableCourses
);

// Conducteurs disponibles à proximité
router.get(
  '/nearby-drivers',
  authorize('USER', 'ADMIN'),
  controller.findNearbyDrivers
);

// Statistiques conducteur et administrateur
router.get(
  '/weekly-stats',
  authorize('CONDUCTEUR', 'ADMIN'),
  controller.getWeeklyStats
);

// ============================================================
// 3. HISTORIQUE ET CRÉATION DE COURSE
// ============================================================

// Historique personnel
router.get(
  '/',
  controller.getUserCourses
);

// Nouvelle commande de course
router.post(
  '/',
  authorize('USER'),
  validate(createCourseSchema),
  controller.createCourse
);

// ============================================================
// 4. DÉTAILS ET ACTIONS SUR LES COURSES
// ============================================================

// Consulter une course autorisée
router.get(
  '/:id',
  controller.getCourseById
);

// Noter un conducteur après une course
router.post(
  '/:id/rate',
  authorize('USER'),
  validate(rateCourseSchema),
  controller.rateCourse
);

// Accepter une course
router.patch(
  '/:id/accepter',
  authorize('CONDUCTEUR'),
  controller.accepterCourse
);

// Démarrer une course
router.patch(
  '/:id/demarrer',
  authorize('CONDUCTEUR'),
  controller.demarrerCourse
);

// Terminer une course
router.patch(
  '/:id/terminer',
  authorize('CONDUCTEUR'),
  controller.terminerCourse
);

export default router;
