
import { Router } from 'express';

import { TicketController } from '../controllers/ticket.controller';
import { getInterurbainPlaces } from '../controllers/interurbainPlaces.controller';
import { getDepartsProgrammes } from '../controllers/interurbainDeparts.controller';
import { getProgrammesLignes } from '../controllers/interurbainProgrammes.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const ticketController = new TicketController();

/**
 * @swagger
 * /api/tickets/departs-programmes:
 *   get:
 *     summary: Consulter les départs interurbains programmés
 *     description: >
 *       Recherche les départs avec un bus affecté
 *       à une compagnie et une date précises.
 *       Retourne le véritable identifiant d'affectation.
 *       Consultation uniquement, sans réservation
 *       ni paiement.
 *     tags: [Tickets]
 *     parameters:
 *       - in: query
 *         name: companyId
 *         required: true
 *         description: Identifiant UUID de la compagnie
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: date
 *         required: true
 *         description: Date du voyage au format YYYY-MM-DD
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Liste des départs programmés
 *       400:
 *         description: Paramètres de recherche invalides
 *       503:
 *         description: Catalogue momentanément indisponible
 */
router.get(
  '/departs-programmes',
  getDepartsProgrammes
);

/**
 * @swagger
 * /api/tickets/programmes-lignes:
 *   get:
 *     summary: Consulter les horaires publiés d'une compagnie
 *     tags: [Tickets]
 *     parameters:
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Programmes de lignes ou liste vide
 *       400:
 *         description: UUID invalide
 *       503:
 *         description: Catalogue indisponible
 */
router.get(
  '/programmes-lignes',
  getProgrammesLignes
);

/**
 * @swagger
 * /api/tickets/departs/{affectationId}/places:
 *   get:
 *     summary: Consulter les sièges d'un départ interurbain
 *     description: >
 *       Retourne le plan provisoire des sièges
 *       d'un bus réellement affecté à un départ.
 *       Les anciens billets mobiles ne sont pas
 *       encore rapprochés avec l'inventaire commun.
 *       Aucune réservation ou vente n'est effectuée.
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affectationId
 *         required: true
 *         description: Identifiant UUID du départ
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Inventaire provisoire des sièges
 *       400:
 *         description: Identifiant de départ invalide
 *       401:
 *         description: Connexion requise
 *       403:
 *         description: Compte utilisateur bloqué
 *       404:
 *         description: Départ introuvable ou non programmé
 *       503:
 *         description: Inventaire indisponible ou incohérent
 */
router.get(
  '/departs/:affectationId/places',
  authenticate,
  getInterurbainPlaces
);

/**
 * @swagger
 * /api/tickets:
 *   post:
 *     summary: Création de billets temporairement suspendue
 *     description: >
 *       Les nouvelles réservations sont suspendues
 *       jusqu'à la synchronisation atomique des sièges
 *       entre MESSAY Mobile et MESSAY PRO.
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       401:
 *         description: Connexion requise
 *       503:
 *         description: Réservation temporairement suspendue
 */
router.post(
  '/',
  authenticate,
  ticketController.createTicket
);

/**
 * @swagger
 * /api/tickets:
 *   get:
 *     summary: Historique des billets de l'utilisateur
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *     responses:
 *       200:
 *         description: Liste des billets
 *       400:
 *         description: Paramètre de pagination invalide
 *       401:
 *         description: Connexion requise
 *       503:
 *         description: Service temporairement indisponible
 */
router.get(
  '/',
  authenticate,
  ticketController.getUserTickets
);

/**
 * @swagger
 * /api/tickets/{id}:
 *   get:
 *     summary: Obtenir les détails d'un billet
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Identifiant du billet
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Détails du billet
 *       400:
 *         description: Identifiant invalide
 *       401:
 *         description: Connexion requise
 *       404:
 *         description: Billet introuvable
 */
router.get(
  '/:id',
  authenticate,
  ticketController.getTicketById
);

/**
 * @swagger
 * /api/tickets/{id}/annuler:
 *   patch:
 *     summary: Annuler un billet non payé
 *     description: >
 *       Annulation réservée aux billets au statut
 *       RESERVE sans paiement confirmé ou associé.
 *       Les billets payés nécessitent une procédure
 *       spécifique de remboursement.
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Billet annulé
 *       400:
 *         description: Identifiant invalide
 *       401:
 *         description: Connexion requise
 *       404:
 *         description: Billet introuvable
 *       409:
 *         description: Annulation impossible
 */
router.patch(
  '/:id/annuler',
  authenticate,
  ticketController.annulerTicket
);

export default router;
