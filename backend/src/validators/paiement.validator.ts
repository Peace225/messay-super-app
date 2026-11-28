import { z } from 'zod';

/**
 * Validation de forme uniquement.
 * Le montant, la référence métier, le droit de réserver et la disponibilité
 * doivent être recalculés/vérifiés côté serveur avant tout encaissement.
 * POST /api/paiements reste désactivé tant que ce flux n'est pas raccordé.
 */
export const createPaiementSchema = z.object({
  // FCFA / XOF : pas de centimes ni de montants infinis.
  montant: z.number().int().positive().max(2_147_483_647),
  moyen: z.enum([
    'CARTE_BANCAIRE',
    'ORANGE_MONEY',
    'MTN_MOMO',
    'WAVE',
    'MOOV_MONEY',
    'ESPECES',
  ]),
  typeTransaction: z.enum([
    'COURSE',
    'TICKET_TRANSPORT',
    'BILLET_EVENT',
    'COMMANDE_BTP',
    'RECHARGE',
  ]),
  referenceId: z.string().uuid('ID de référence invalide (UUID requis)'),
}).strict();

export type CreatePaiementInput = z.infer<typeof createPaiementSchema>;
