import { z } from 'zod';

export const createPaiementSchema = z.object({
  montant: z.number().positive(),
  moyen: z.enum(['CARTE_BANCAIRE', 'ORANGE_MONEY', 'MTN_MOMO', 'WAVE', 'ESPECES']),
  typeTransaction: z.enum(['COURSE', 'TICKET_TRANSPORT', 'BILLET_EVENT', 'COMMANDE_BTP', 'RECHARGE']),
  referenceId: z.string().uuid('ID de référence invalide (UUID requis)'),
});

export type CreatePaiementInput = z.infer<typeof createPaiementSchema>;