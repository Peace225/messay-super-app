import { Router } from 'express';
import { CourseController } from '../controllers/course.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { 
  createCourseSchema, 
  rateCourseSchema, 
  updateCourseStatusSchema 
} from '../validators';

const router = Router();
const courseController = new CourseController();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

/**
 * @swagger
 * /api/courses:
 * post:
 * summary: Créer une demande de course
 * tags: [Courses]
 * # ... (Swagger doc reste identique)
 */
// AJOUT : Validation du schéma de création
router.post('/', validate(createCourseSchema), (req, res) => courseController.createCourse(req, res));

/**
 * @swagger
 * /api/courses:
 * get:
 * summary: Obtenir l'historique des courses
 * tags: [Courses]
 */
router.get('/', (req, res) => courseController.getUserCourses(req, res));

/**
 * @swagger
 * /api/courses/nearby-drivers:
 * get:
 * summary: Trouver les conducteurs à proximité
 * tags: [Courses]
 */
router.get('/nearby-drivers', (req, res) => courseController.findNearbyDrivers(req, res));

/**
 * @swagger
 * /api/courses/weekly-stats:
 * get:
 * summary: Obtenir les statistiques hebdomadaires
 * tags: [Courses]
 */
router.get('/weekly-stats', (req, res) => courseController.getWeeklyStats(req, res));

/**
 * @swagger
 * /api/courses/{id}:
 * get:
 * summary: Obtenir les détails d'une course
 */
router.get('/:id', (req, res) => courseController.getCourseById(req, res));

/**
 * @swagger
 * /api/courses/{id}/rate:
 * post:
 * summary: Noter une course
 * tags: [Courses]
 */
// AJOUT : Validation de la note (1 à 5) et du commentaire
router.post('/:id/rate', validate(rateCourseSchema), (req, res) => courseController.rateCourse(req, res));

// ============================================
// ROUTES CONDUCTEUR (PATCH pour le respect des standards REST)
// ============================================

router.get('/conducteur/mes-courses', (req, res) => courseController.getConducteurCourses(req, res));

// Utilisation des PATCH car on modifie l'état de la ressource "Course"
router.patch('/:id/accepter', (req, res) => courseController.accepterCourse(req, res));
router.patch('/:id/demarrer', (req, res) => courseController.demarrerCourse(req, res));
router.patch('/:id/terminer', (req, res) => courseController.terminerCourse(req, res));

export default router;