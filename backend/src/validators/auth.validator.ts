import { z } from 'zod';

export const registerSchema = z.object({
  nom: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  prenom: z.string().optional(),
  email: z.string().email('Email invalide'),
  telephone: z.string().regex(/^\+225\d{10}$/, 'Numéro de téléphone invalide (format: +225XXXXXXXXXX)'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  role: z.enum(['USER', 'CONDUCTEUR', 'CHAUFFEUR']).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export const verifyOTPSchema = z.object({
  telephone: z.string(),
  otpCode: z.string().length(6, 'Le code OTP doit contenir 6 chiffres'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyOTPInput = z.infer<typeof verifyOTPSchema>;
