import prisma from '../config/database';
import { Paiement, Prisma, PaiementStatus } from '@prisma/client';

export const PaiementRepository = {
  /**
   * Créer une transaction en attente
   */
  async create(data: Prisma.PaiementUncheckedCreateInput): Promise<Paiement> {
    return await prisma.paiement.create({ data });
  },

  /**
   * Mettre à jour le statut après confirmation de l'opérateur (Stripe, Wave, etc.)
   */
  async updateStatus(id: string, statut: PaiementStatus, transactionId?: string): Promise<Paiement> {
    return await prisma.paiement.update({
      where: { id },
      data: { 
        statut, 
        transactionId: transactionId || undefined 
      },
    });
  },

  /**
   * Historique des paiements d'un utilisateur
   */
  async findByUserId(userId: string): Promise<Paiement[]> {
    return await prisma.paiement.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
};