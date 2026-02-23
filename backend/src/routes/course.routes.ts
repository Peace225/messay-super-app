import { Router } from 'express';
import { CourseController } from '../controllers/course.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const courseController = new CourseController();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

/**
 * @swagger
 * /api/courses:
 *   post:
 *     summary: Créer une demande de course
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - departLatitude
 *               - departLongitude
 *               - departAdresse
 *               - destinationLatitude
 *               - destinationLongitude
 *               - destinationAdresse
 *             properties:
 *               departLatitude:
 *                 type: number
 *                 example: 5.3599517
 *               departLongitude:
 *                 type: number
 *                 example: -4.0082563
 *               departAdresse:
 *                 type: string
 *                 example: 'Cocody, Angré'
 *               destinationLatitude:
 *                 type: number
 *                 example: 5.3247
 *               destinationLongitude:
 *                 type: number
 *                 example: -4.0127
 *               destinationAdresse:
 *                 type: string
 *                 example: 'Plateau, Centre-ville'
 *               partageTrajet:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Course créée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 course:
 *                   $ref: '#/components/schemas/Course'
 *                 conducteursDisponibles:
 *                   type: integer
 *                 message:
 *                   type: string
 *       400:
 *         description: Erreur de validation
 *       401:
 *         description: Non authentifié
 */
router.post('/', (req, res) => courseController.createCourse(req, res));

/**
 * @swagger
 * /api/courses:
 *   get:
 *     summary: Obtenir l'historique des courses de l'utilisateur
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des courses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 courses:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Course'
 *       401:
 *         description: Non authentifié
 */
router.get('/', (req, res) => courseController.getUserCourses(req, res));

/**
 * @swagger
 * /api/courses/nearby-drivers:
 *   get:
 *     summary: Trouver les conducteurs disponibles à proximité
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *         description: Latitude de la position
 *         example: 5.3599517
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *         description: Longitude de la position
 *         example: -4.0082563
 *       - in: query
 *         name: rayon
 *         schema:
 *           type: number
 *           default: 5
 *         description: Rayon de recherche en kilomètres
 *     responses:
 *       200:
 *         description: Liste des conducteurs à proximité
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 drivers:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Non authentifié
 */
router.get('/nearby-drivers', (req, res) => courseController.findNearbyDrivers(req, res));

/**
 * @swagger
 * /api/courses/weekly-stats:
 *   get:
 *     summary: Obtenir les statistiques hebdomadaires
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques hebdomadaires
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   courses:
 *                     type: number
 *                   revenue:
 *                     type: number
 *       401:
 *         description: Non authentifié
 */
router.get('/weekly-stats', (req, res) => courseController.getWeeklyStats(req, res));

/**
 * @swagger
 * /api/courses/{id}:
 *   get:
 *     summary: Obtenir les détails d'une course
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la course
 *     responses:
 *       200:
 *         description: Détails de la course
 *       401:
 *         description: Non authentifié
 *       404:
 *         description: Course non trouvée
 */
router.get('/:id', (req, res) => courseController.getCourseById(req, res));

/**
 * @swagger
 * /api/courses/{id}/accept:
 *   post:
 *     summary: Accepter une course (conducteur)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - conducteurId
 *             properties:
 *               conducteurId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Course acceptée
 *       400:
 *         description: Erreur
 *       401:
 *         description: Non authentifié
 */
router.post('/:id/accept', (req, res) => courseController.acceptCourse(req, res));

/**
 * @swagger
 * /api/courses/{id}/start:
 *   post:
 *     summary: Démarrer une course
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - conducteurId
 *             properties:
 *               conducteurId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Course démarrée
 *       400:
 *         description: Erreur
 *       401:
 *         description: Non authentifié
 */
router.post('/:id/start', (req, res) => courseController.startCourse(req, res));

/**
 * @swagger
 * /api/courses/{id}/complete:
 *   post:
 *     summary: Terminer une course
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - conducteurId
 *             properties:
 *               conducteurId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Course terminée
 *       400:
 *         description: Erreur
 *       401:
 *         description: Non authentifié
 */
router.post('/:id/complete', (req, res) => courseController.completeCourse(req, res));

/**
 * @swagger
 * /api/courses/{id}/rate:
 *   post:
 *     summary: Noter une course
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - noteConducteur
 *             properties:
 *               noteConducteur:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *               commentaire:
 *                 type: string
 *                 example: 'Excellent service'
 *     responses:
 *       200:
 *         description: Course notée
 *       400:
 *         description: Erreur de validation
 *       401:
 *         description: Non authentifié
 */
router.post('/:id/rate', (req, res) => courseController.rateCourse(req, res));

export default router;
