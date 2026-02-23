import { Router } from 'express';
import { ConducteurController } from '../controllers/conducteur.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const conducteurController = new ConducteurController();

/**
 * @swagger
 * /api/conducteurs:
 *   get:
 *     summary: Obtenir tous les conducteurs
 *     tags: [Conducteurs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des conducteurs
 *       401:
 *         description: Non autorisé
 */
router.get('/', authenticate, conducteurController.getConducteurs);

/**
 * @swagger
 * /api/conducteurs/{id}:
 *   get:
 *     summary: Obtenir un conducteur par ID
 *     tags: [Conducteurs]
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
 *         description: Détails du conducteur
 *       404:
 *         description: Conducteur non trouvé
 */
router.get('/:id', authenticate, conducteurController.getConducteurById);

/**
 * @swagger
 * /api/conducteurs:
 *   post:
 *     summary: Créer un nouveau conducteur
 *     tags: [Conducteurs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               permis:
 *                 type: string
 *               numeroPermis:
 *                 type: string
 *               vehiculeType:
 *                 type: string
 *               immatriculation:
 *                 type: string
 *     responses:
 *       201:
 *         description: Conducteur créé
 *       400:
 *         description: Données invalides
 */
router.post('/', authenticate, conducteurController.createConducteur);

/**
 * @swagger
 * /api/conducteurs/{id}:
 *   patch:
 *     summary: Mettre à jour un conducteur
 *     tags: [Conducteurs]
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
 *               permis:
 *                 type: string
 *               numeroPermis:
 *                 type: string
 *               vehiculeType:
 *                 type: string
 *               immatriculation:
 *                 type: string
 *               statut:
 *                 type: string
 *               isVerified:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Conducteur mis à jour
 */
router.patch('/:id', authenticate, conducteurController.updateConducteur);

/**
 * @swagger
 * /api/conducteurs/{id}:
 *   delete:
 *     summary: Supprimer un conducteur
 *     tags: [Conducteurs]
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
 *         description: Conducteur supprimé
 */
router.delete('/:id', authenticate, conducteurController.deleteConducteur);

export default router;
