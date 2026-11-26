
import { Router } from 'express';

import { TicketController } from '../controllers/ticket.controller';
import { getInterurbainPlaces } from '../controllers/interurbainPlaces.controller';
import { getDepartsProgrammes } from '../controllers/interurbainDeparts.controller';
import {
  getProgrammesLignes,
  getCompagniesSuggestions,
} from '../controllers/interurbainProgrammes.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const ticketController = new TicketController();

/**
 * =========================================================
 * MESSAY — CATALOGUE INTERURBAIN PUBLIC
 * =========================================================
 *
 * Ces routes doivent être déclarées avant /:id.
 *
 * Consultation uniquement :
 * - Aucun billet créé
 * - Aucun paiement
 * - Aucun siège bloqué
 */

/**
 * @swagger
 * /api/tickets/departs-programmes:
 *   get:
 *     summary: Consulter les départs interurbains confirmés
 *     description: >
 *       Recherche les départs avec un bus réellement
 *       affecté à une compagnie pour une date précise.
 *       Les départs sont consultables sans réservation
 *       ni paiement.
 *     tags: [Tickets]
 *     parameters:
 *       - in: query
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Départs programmés ou liste vide
 *       400:
 *         description: Paramètres invalides
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
 *     description: >
 *       Retourne les lignes publiées avec leurs villes,
 *       gares, tarifs, durées et horaires indicatifs.
 *       Un horaire publié ne garantit pas qu'un bus
 *       soit affecté à la date demandée.
 *     tags: [Tickets]
 *     parameters:
 *       - in: query
 *         name: companyId
 *         required: true
 *         description: UUID de la compagnie
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Lignes et horaires publiés
 *       400:
 *         description: UUID invalide
 *       503:
 *         description: Programmes indisponibles
 */
router.get(
  '/programmes-lignes',
  getProgrammesLignes
);

/**
 * @swagger
 * /api/tickets/compagnies-suggestions:
 *   get:
 *     summary: Suggérer jusqu'à quatre compagnies alternatives
 *     description: >
 *       Recherche d'autres compagnies enregistrées
 *       dans MESSAY disposant de lignes et d'horaires
 *       publiés. Priorité aux compagnies desservant
 *       le même trajet. Sinon, recherche de compagnies
 *       partant de la même ville.
 *       La compagnie sélectionnée est exclue.
 *       Les suggestions ne garantissent pas
 *       un départ confirmé pour une date donnée.
 *     tags: [Tickets]
 *     parameters:
 *       - in: query
 *         name: companyId
 *         required: true
 *         description: UUID de la compagnie actuelle
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: villeDepart
 *         required: true
 *         description: Ville de départ recherchée
 *         schema:
 *           type: string
 *           example: Abidjan
 *       - in: query
 *         name: villeArrivee
 *         required: true
 *         description: Ville d'arrivée recherchée
 *         schema:
 *           type: string
 *           example: Yamoussoukro
 *     responses:
 *       200:
 *         description: Jusqu'à quatre compagnies réelles
 *       400:
 *         description: Paramètres de recherche invalides
 *       503:
 *         description: Suggestions momentanément indisponibles
 */
router.get(
  '/compagnies-suggestions',
  getCompagniesSuggestions
);

/**
 * =========================================================
 * INVENTAIRE INTERURBAIN — AUTHENTIFICATION REQUISE
 * =========================================================
 */

/**
 * @swagger
 * /api/tickets/departs/{affectationId}/places:
 *   get:
 *     summary: Consulter les sièges d'un départ
 *     description: >
 *       Retourne l'inventaire provisoire des sièges
 *       d'un bus réellement affecté.
 *       Les billets historiques ne sont pas encore
 *       totalement rapprochés avec cet inventaire.
 *       Aucune réservation ni vente n'est effectuée.
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: affectationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Inventaire provisoire
 *       400:
 *         description: UUID invalide
 *       401:
 *         description: Connexion requise
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Départ introuvable
 *       503:
 *         description: Inventaire indisponible ou incohérent
 */
router.get(
  '/departs/:affectationId/places',
  authenticate,
  getInterurbainPlaces
);

/**
 * =========================================================
 * GESTION DES BILLETS — AUTHENTIFICATION REQUISE
 * =========================================================
 */

/**
 * @swagger
 * /api/tickets:
 *   post:
 *     summary: Création de billets temporairement suspendue
 *     description: >
 *       Les nouvelles réservations restent suspendues
 *       jusqu'à la réconciliation des billets historiques
 *       et à la synchronisation atomique de l'inventaire
 *       des sièges entre MESSAY Mobile et MESSAY PRO.
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
 *     summary: Consulter les billets de l'utilisateur
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
 *         description: Historique des billets
 *       400:
 *         description: Pagination invalide
 *       401:
 *         description: Connexion requise
 *       503:
 *         description: Service indisponible
 */
router.get(
  '/',
  authenticate,
  ticketController.getUserTickets
);

/**
 * =========================================================
 * ROUTES DYNAMIQUES — À PLACER EN DERNIER
 * =========================================================
 */

/**
 * @swagger
 * /api/tickets/{id}/annuler:
 *   patch:
 *     summary: Annuler un billet non payé
 *     description: >
 *       L'annulation est limitée aux billets réservés
 *       sans paiement associé ou confirmé.
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

export default router;
