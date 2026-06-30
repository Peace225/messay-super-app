import { z } from 'zod';

/**
 * Schéma d'inscription simplifié
 * On ne demande plus l'email à l'utilisateur, le backend s'en occupe.
 */
export const registerSchema = z.object({
  nom: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  // Le prénom devient optionnel pour accélérer l'inscription
  prenom: z.string().optional(),
  // On valide le format ivoirien strict (+225 suivi de 10 chiffres)
  telephone: z.string().regex(/^\+225\d{10}$/, 'Format requis : +225XXXXXXXXXX'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  role: z.enum(['USER', 'CONDUCTEUR', 'CHAUFFEUR']).optional(),
});

/**
 * Schéma de connexion (Admin et Utilisateurs)
 * Accepte désormais un email (Admin) OU un numéro de téléphone (App Mobile)
 */
export const loginSchema = z.object({
  telephone: z.string().regex(/^\+225\d{10}$/, 'Numéro de téléphone invalide').optional(),
  email: z.string().email("Format d'email invalide").optional(),
  password: z.string().min(1, 'Mot de passe requis'),
}).refine(data => data.telephone || data.email, {
  message: "Veuillez fournir un numéro de téléphone ou un email.",
});

/**
 * Schéma de vérification (si tu décides de réactiver l'OTP plus tard)
 */
export const verifyOTPSchema = z.object({
  telephone: z.string(),
  otpCode: z.string().length(6, 'Le code OTP doit contenir 6 chiffres'),
});

// Génération des types TypeScript à partir des schémas Zod
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyOTPInput = z.infer<typeof verifyOTPSchema>;