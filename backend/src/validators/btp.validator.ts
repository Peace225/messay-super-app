import { z } from 'zod';

export const createCommandeBTPSchema = z.object({
  typeMateriau: z.enum(['SABLE', 'GRAVIER', 'CIMENT', 'PIERRE', 'BETON']),
  quantite: z.number().positive(),
  typeCamion: z.enum(['BENNE', 'CITERNE', 'PLATEAU', 'MALAXEUR']),
  adresseLivraison: z.string().min(5),
  latitudeLivraison: z.number(),
  longitudeLivraison: z.number(),
  dateLivraison: z.string().datetime(), // Format ISO requis
  prix: z.number().positive(),
});

export type CreateCommandeBTPInput = z.infer<typeof createCommandeBTPSchema>;