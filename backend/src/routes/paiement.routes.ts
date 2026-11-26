/**
 * MESSAY — Routes de paiement (sécurisation avant encaissement réel).
 *
 * L'activation commerciale nécessite un checkout serveur lié à une réservation
 * atomique, une confirmation prestataire vérifiée et l'émission idempotente
 * du billet. Ce routeur ne confirme aucun paiement et ne crée aucun billet.
 *
 * Les webhooks fournisseurs doivent être montés séparément : ils ne peuvent
 * pas utiliser le JWT du voyageur et nécessitent leur propre vérification.
 */
import { Router, type Request, type RequestHandler, type Response } from 'express';
import { PaiementController } from '../controllers/paiement.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const paiementController = new PaiementController();

const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

/** Évite d'envoyer des informations financières dans un cache partagé. */
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  next();
});

// Authentification obligatoire pour toutes les routes de l'espace client.
router.use(authenticate);

const validateId: RequestHandler = (req, res, next) => {
  const id = req.params.id;
  if (typeof id !== 'string' || !uuidPattern.test(id)) {
    res.status(400).json({
      code: 'PAIEMENT_ID_INVALIDE',
      message: 'Identifiant de paiement invalide.',
    });
    return;
  }
  next();
};

const validateLimit: RequestHandler = (req, res, next) => {
  const limit = req.query.limit;
  if (limit !== undefined &&
      (typeof limit !== 'string' || !/^(?:[1-9]|[1-9][0-9]|100)$/.test(limit))) {
    res.status(400).json({
      code: 'PAIEMENT_LIMIT_INVALIDE',
      message: 'Le paramètre limit doit être un entier entre 1 et 100.',
    });
    return;
  }
  next();
};

/** Capture aussi les rejets async sous Express 4. */
function handled(
  action: (req: Request, res: Response) => unknown | Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve()
      .then(() => action(req, res))
      .catch(next);
  };
}

/**
 * POST /api/paiements
 * Désactivé : une demande mobile ne doit jamais créer une transaction à partir
 * d'un montant ou d'une référence transmis par le client.
 */
router.post('/', (_req, res) => {
  res.status(503).json({
    code: 'PAIEMENT_NON_RACCORDE',
    message: 'Paiement momentanément indisponible. Aucun montant n’a été débité.',
  });
});

/**
 * GET /api/paiements?limit=50
 * Le contrôleur doit filtrer les paiements par l'ID utilisateur authentifié.
 */
router.get('/', validateLimit, handled((req, res) =>
  paiementController.getHistorique(req, res),
));

/**
 * GET /api/paiements/:id/recu
 * Aucun reçu ne peut être émis tant que l'encaissement fournisseur n'est pas
 * vérifié et rapproché avec la réservation MESSAY.
 */
router.get('/:id/recu', validateId, (_req, res) => {
  res.status(501).json({
    code: 'RECU_NON_RACCORDE',
    message: 'Génération du reçu indisponible tant que le paiement réel n’est pas vérifié.',
  });
});

/**
 * POST /api/paiements/:id/verify
 * Compatibilité avec l'API existante : consultation du statut en base uniquement.
 * IMPORTANT : vérifier que PaiementController.verifyPaiement est strictement
 * en lecture seule, sans appel à updateStatus ou confirmPayment.
 */
router.post('/:id/verify', validateId, handled((req, res) =>
  paiementController.verifyPaiement(req, res),
));

/**
 * GET /api/paiements/:id
 * Le contrôleur doit vérifier que ce paiement appartient à l'utilisateur.
 */
router.get('/:id', validateId, handled((req, res) =>
  paiementController.getPaiementById(req, res),
));

export default router;
