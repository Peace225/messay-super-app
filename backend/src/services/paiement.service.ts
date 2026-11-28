import type { PaiementRepository } from '../repositories/paiement.repository';
import type { CreatePaiementInput } from '../validators/paiement.validator';

/**
 * Aucun paiement ne peut être initialisé tant que les contrôles suivants
 * ne sont pas opérationnels côté serveur :
 * - réservation du départ et des places de manière atomique ;
 * - calcul du montant à partir de la ligne, jamais depuis l'application ;
 * - création d'une session auprès du vrai prestataire ;
 * - confirmation authentifiée (webhook et vérification fournisseur) ;
 * - émission du billet uniquement après encaissement confirmé.
 */
export class PaiementIndisponibleError extends Error {
  readonly status = 503;
  readonly statusCode = 503;
  readonly code = 'PAIEMENT_PRESTATAIRE_NON_CONNECTE';

  constructor(message = 'Le paiement en ligne MESSAY n’est pas encore activé.') {
    super(message);
    this.name = 'PaiementIndisponibleError';
  }
}

/** Contrat conservé pour les contrôleurs qui lisent le résultat de l'initialisation. */
export type InitialisationPaiementResult = {
  paiementId: string;
  paymentUrl?: string;
  clientSecret?: string;
  message?: string;
};

/** Le type existant de mise à jour reste compatible avec les contrôleurs. */
type ConfirmationPaiementResult = Awaited<
  ReturnType<typeof PaiementRepository.updateStatus>
>;

export class PaiementService {
  /**
   * Initialisation désactivée tant que le parcours de paiement réel n'est
   * pas raccordé. Ne crée ni transaction en attente, ni URL fictive.
   */
  async initializePayment(
    _userId: string,
    _data: CreatePaiementInput,
  ): Promise<InitialisationPaiementResult> {
    throw new PaiementIndisponibleError(
      'Paiement indisponible : réservation, tarif et prestataire non encore validés côté serveur.',
    );
  }

  /**
   * Aucune entrée publique ne doit pouvoir confirmer un paiement en se
   * contentant d'un ID transmis par un client ou un webhook non vérifié.
   * La future confirmation sera un processus serveur idempotent, après
   * authentification de la notification et relecture du statut prestataire.
   */
  async confirmPayment(
    _paiementId: string,
    _externalTransactionId: string,
  ): Promise<ConfirmationPaiementResult> {
    throw new PaiementIndisponibleError(
      'Confirmation refusée : aucune preuve de paiement vérifiée auprès du prestataire.',
    );
  }
}
