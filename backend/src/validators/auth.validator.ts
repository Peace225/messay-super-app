import { z } from 'zod';

/** MESSAY — Validation des requêtes d'authentification. */

// Numéro mobile ivoirien canonique (format E.164).
// Le frontend normalise 07XXXXXXXX -> +22507XXXXXXXX.
export const telephoneSchema = z
  .string()
  .trim()
  .regex(/^\+2250[157]\d{8}$/, 'Numéro mobile ivoirien requis : +2250XXXXXXXXX');

// L'email n'est requis que par les anciens parcours à mot de passe.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Format d'email invalide");

export const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .max(128, 'Le mot de passe ne doit pas dépasser 128 caractères');

const nomSchema = z
  .string()
  .trim()
  .min(2, 'Le nom doit contenir au moins 2 caractères')
  .max(100, 'Le nom ne doit pas dépasser 100 caractères');

export const otpCodeSchema = z
  .string()
  .regex(/^\d{6}$/, 'Le code OTP doit contenir exactement 6 chiffres');

/**
 * POST /api/auth/register — ancien parcours public avec mot de passe.
 * Conservé pour ne pas casser l'AuthService existant.
 * Le backend impose toujours le rôle USER.
 */
export const registerSchema = z.object({
  nom: nomSchema,
  prenom: z.string().trim().max(100).optional(),
  telephone: telephoneSchema,
  password: passwordSchema,
  role: z.literal('USER').optional(),
}).strict();

/** POST /api/auth/login — conducteurs et administrateurs (par mot de passe). */
export const loginSchema = z.object({
  telephone: telephoneSchema.optional(),
  email: emailSchema.optional(),
  password: z.string().min(1, 'Le mot de passe est obligatoire'),
}).refine(
  data => Boolean(data.telephone || data.email),
  { message: 'Veuillez fournir un numéro de téléphone ou un email.', path: ['telephone'] }
);

/** POST /api/auth/verify-otp — ancienne route, nom historique otpCode. */
export const verifyOTPSchema = z.object({
  telephone: telephoneSchema,
  otpCode: otpCodeSchema,
});

/** POST /api/auth/otp/request — demande de SMS, sans mot de passe. */
export const requestPassengerOTPSchema = z.object({
  telephone: telephoneSchema,
}).strict();

/**
 * POST /api/auth/otp/verify — code SMS + nom complet.
 * Ce contrat correspond au nouveau formulaire mobile.
 */
export const verifyPassengerOTPSchema = z.object({
  telephone: telephoneSchema,
  code: otpCodeSchema,
  nom: nomSchema,
}).strict();

/** POST /api/auth/refresh — renouvellement JWT. */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().trim().min(1, 'Le refresh token est obligatoire'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyOTPInput = z.infer<typeof verifyOTPSchema>;
export type RequestPassengerOTPInput = z.infer<typeof requestPassengerOTPSchema>;
export type VerifyPassengerOTPInput = z.infer<typeof verifyPassengerOTPSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
