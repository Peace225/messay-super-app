import { PaiementRepository } from '../repositories/paiement.repository';
import { CreatePaiementInput } from '../validators/paiement.validator';

export class PaiementService {
  /**
   * Initialiser un paiement pour une course ou un produit BTP
   */
  async initializePayment(userId: string, data: CreatePaiementInput) {
    // 1. Enregistrer la transaction "EN_ATTENTE" dans notre BDD
    const paiement = await PaiementRepository.create({
      userId,
      montant: data.montant,
      moyen: data.moyen,
      typeTransaction: data.typeTransaction,
      referenceId: data.referenceId, // ID de la course ou de la commande
      statut: 'EN_ATTENTE',
    });

    // 2. Logique spécifique selon le moyen de paiement
    if (data.moyen === 'WAVE' || data.moyen === 'ORANGE_MONEY') {
      // TODO: Appeler l'API de l'agrégateur (ex: CinetPay ou Bizao)
      return { 
        paiementId: paiement.id, 
        paymentUrl: "https://api.wave.com/checkout/...", // URL de redirection
        message: "Redirection vers l'opérateur mobile" 
      };
    }

    if (data.moyen === 'CARTE_BANCAIRE') {
      // TODO: Créer un PaymentIntent Stripe
      return { 
        clientSecret: "pi_3N...", 
        paiementId: paiement.id 
      };
    }

    return paiement;
  }

  /**
   * Webhook : Méthode appelée par l'opérateur pour confirmer le succès
   */
  async confirmPayment(paiementId: string, externalTransactionId: string) {
    return await PaiementRepository.updateStatus(
      paiementId, 
      'REUSSI', 
      externalTransactionId
    );
  }
}