import { z } from 'zod';

export const buyBilletSchema = z.object({
  eventId: z.string().uuid(),
  quantite: z.number().int().min(1, 'Minimum 1 billet'),
  prixTotal: z.number().positive(),
});

export type BuyBilletInput = z.infer<typeof buyBilletSchema>;