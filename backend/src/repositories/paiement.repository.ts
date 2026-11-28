import prisma from '../config/database';
import type { Paiement, PaiementStatus, Prisma } from '@prisma/client';

/** Accès aux paiements MESSAY. Ne réalise aucune vérification fournisseur. */
const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function assertUuid(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new Error(`${name} invalide : UUID attendu.`);
  }
}

/**
 * Couche de protection transitoire : aucun appel générique ne peut annoncer
 * un encaissement ou un remboursement sans validation du prestataire.
 * Une confirmation réelle nécessitera un flux serveur distinct, atomique
 * et idempotent, après vérification de la transaction fournisseur.
 */
export const PaiementRepository = {
  async create(data: Prisma.PaiementUncheckedCreateInput): Promise<Paiement> {
    assertUuid(data.userId, 'Utilisateur');
    assertUuid(data.referenceId, 'Référence métier');

    const montant = Number(data.montant);
    if (!Number.isSafeInteger(montant) || montant <= 0) {
      throw new Error('Le montant XOF doit être un entier positif.');
    }
    if (data.statut !== 'EN_ATTENTE') {
      throw new Error('Une nouvelle transaction doit être EN_ATTENTE.');
    }
    if (data.transactionId != null && String(data.transactionId).trim()) {
      throw new Error('Une transaction non vérifiée ne peut pas avoir de référence fournisseur.');
    }

    // Cette méthode reste réservée aux services métier serveur.
    // Ne jamais lui transmettre directement req.body ni un tarif mobile.
    return prisma.paiement.create({ data });
  },

  /**
   * Compatibilité avec les appels existants : seule la transition vers
   * ECHOUE est permise. REUSSI/REMBOURSE doivent passer par un processus
   * financier vérifié, non encore raccordé.
   */
  async updateStatus(
    id: string,
    statut: PaiementStatus,
    transactionId?: string,
  ): Promise<Paiement> {
    assertUuid(id, 'Paiement');
    if (statut !== 'ECHOUE') {
      throw new Error(
        'Modification de paiement refusée : confirmation ou remboursement fournisseur non vérifié.',
      );
    }
    if (transactionId && transactionId.trim()) {
      throw new Error('Référence fournisseur non vérifiée : mise à jour refusée.');
    }

    // Transition conditionnelle atomique : un paiement confirmé, remboursé
    // ou déjà traité ne peut pas être écrasé par une mise à jour tardive.
    const update = await prisma.paiement.updateMany({
      where: { id, statut: 'EN_ATTENTE' },
      data: { statut: 'ECHOUE' },
    });

    const paiement = await prisma.paiement.findUnique({ where: { id } });
    if (!paiement) throw new Error('Paiement introuvable.');
    if (update.count === 0 && paiement.statut !== 'ECHOUE') {
      throw new Error('Transition interdite : le paiement n’est plus EN_ATTENTE.');
    }
    return paiement;
  },

  async findByUserId(userId: string, limit = 50): Promise<Paiement[]> {
    assertUuid(userId, 'Utilisateur');
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new Error('La limite doit être un entier entre 1 et 100.');
    }
    return prisma.paiement.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },
};
