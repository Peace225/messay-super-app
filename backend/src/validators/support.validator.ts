import { z } from 'zod';

export const createSupportTicketSchema = z.object({
  typeDemande: z.enum(['QUESTION', 'RECLAMATION', 'OBJET_PERDU', 'LITIGE', 'TECHNIQUE', 'AUTRE']),
  sujet: z.string().min(5),
  message: z.string().min(10),
  priorite: z.enum(['BASSE', 'NORMALE', 'HAUTE', 'URGENTE']).optional(),
});

export const addSupportMessageSchema = z.object({
  message: z.string().min(1),
});

export type SupportTicketInput = z.infer<typeof createSupportTicketSchema>;