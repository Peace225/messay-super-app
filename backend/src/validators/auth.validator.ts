
import { z } from 'zod';

// ============================================================
// MESSAY SUPER APP
// VALIDATEURS D'AUTHENTIFICATION
// Backend Express + TypeScript + Prisma
// ============================================================

// ============================================================
// 1. VALIDATION DU NUMÉRO DE TÉLÉPHONE
// ============================================================

/**
 * Format ivoirien :
 * +225 suivi de 10 chiffres
 *
 * Exemple : +2250701234567
 */
export const telephoneSchema = z
  .string()
  .trim()
  .regex(
    /^\+225\d{10}$/,
    'Format requis : +225XXXXXXXXXX'
  );

// ============================================================
// 2. VALIDATION DE L'EMAIL
// ============================================================

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Format d'email invalide");

// ============================================================
// 3. VALIDATION DU MOT DE PASSE
// ============================================================

export const passwordSchema = z
  .string()
  .min(
    6,
    'Le mot de passe doit contenir au moins 6 caractères'
  )
  .max(
    128,
    'Le mot de passe ne doit pas dépasser 128 caractères'
  );

// ============================================================
// 4. INSCRIPTION CLIENT
// POST /api/auth/register
// ============================================================

/**
 * Inscription simplifiée :
 *
 * - Nom obligatoire
 * - Prénom facultatif
 * - Numéro de téléphone obligatoire
 * - Mot de passe obligatoire
 * - Email généré automatiquement par le backend
 * - Rôle USER uniquement
 *
 * Un utilisateur ne peut pas s'attribuer
 * les rôles ADMIN, CONDUCTEUR ou CHAUFFEUR.
 */

export const registerSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(
      2,
      'Le nom doit contenir au moins 2 caractères'
    )
    .max(
      100,
      'Le nom ne doit pas dépasser 100 caractères'
    ),

  prenom: z
    .string()
    .trim()
    .max(
      100,
      'Le prénom ne doit pas dépasser 100 caractères'
    )
    .optional(),

  telephone: telephoneSchema,

  password: passwordSchema,

  role: z
    .literal('USER')
    .optional(),
});

// ============================================================
// 5. CONNEXION UTILISATEUR / ADMINISTRATEUR
// POST /api/auth/login
// ============================================================

/**
 * Connexion MESSAY :
 *
 * Application mobile :
 * - Téléphone + mot de passe
 *
 * Dashboard administrateur :
 * - Email + mot de passe
 *
 * Au moins un identifiant est obligatoire.
 */

export const loginSchema = z
  .object({
    telephone: telephoneSchema.optional(),

    email: emailSchema.optional(),

    password: z
      .string()
      .min(
        1,
        'Le mot de passe est obligatoire'
      ),
  })
  .refine(
    (data) => Boolean(
      data.telephone || data.email
    ),
    {
      message:
        'Veuillez fournir un numéro de téléphone ou un email.',
      path: ['telephone'],
    }
  );

// ============================================================
// 6. VÉRIFICATION OTP
// POST /api/auth/verify-otp
// ============================================================

/**
 * Validation du code OTP.
 *
 * Le code doit contenir exactement
 * 6 chiffres numériques.
 *
 * La validation ne signifie pas
 * que la vérification SMS est activée.
 */

export const verifyOTPSchema = z.object({
  telephone: telephoneSchema,

  otpCode: z
    .string()
    .regex(
      /^\d{6}$/,
      'Le code OTP doit contenir exactement 6 chiffres'
    ),
});

// ============================================================
// 7. RENOUVELLEMENT DU TOKEN JWT
// POST /api/auth/refresh-token
// ============================================================

/**
 * Vérifie que le refresh token est présent.
 *
 * Sa validité cryptographique et son état
 * de révocation sont vérifiés dans AuthService.
 */

export const refreshTokenSchema = z.object({
  refreshToken: z
    .string()
    .trim()
    .min(
      1,
      'Le refresh token est obligatoire'
    ),
});

// ============================================================
// 8. TYPES TYPESCRIPT
// ============================================================

export type RegisterInput = z.infer<
  typeof registerSchema
>;

export type LoginInput = z.infer<
  typeof loginSchema
>;

export type VerifyOTPInput = z.infer<
  typeof verifyOTPSchema
>;

export type RefreshTokenInput = z.infer<
  typeof refreshTokenSchema
>;

// ============================================================
// FIN - MESSAY AUTH VALIDATORS
// ============================================================
