import { z } from 'zod';

export const createCourseSchema = z.object({
  departLatitude: z.number().min(-90).max(90),
  departLongitude: z.number().min(-180).max(180),
  departAdresse: z.string().min(1),
  destinationLatitude: z.number().min(-90).max(90),
  destinationLongitude: z.number().min(-180).max(180),
  destinationAdresse: z.string().min(1),
  partageTrajet: z.boolean().optional(),
});

export const updateCourseStatusSchema = z.object({
  statut: z.enum(['ACCEPTEE', 'EN_COURS', 'TERMINEE', 'ANNULEE']),
  positionLiveLatitude: z.number().optional(),
  positionLiveLongitude: z.number().optional(),
});

export const rateCourseSchema = z.object({
  noteConducteur: z.number().min(1).max(5),
  commentaire: z.string().optional(),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseStatusInput = z.infer<typeof updateCourseStatusSchema>;
export type RateCourseInput = z.infer<typeof rateCourseSchema>;
