import type { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { AuthService, AuthError } from '../services/auth.service';
import {
  registerSchema,
  loginSchema,
  verifyOTPSchema,
  refreshTokenSchema,
} from '../validators/auth.validator';

const authService = new AuthService();

// Le téléphone est normalisé et validé avant tout appel au service SMS
// ou accès aux défis OTP PostgreSQL.
const telephoneCI = z.string().trim().regex(
  /^\+2250[157]\d{8}$/,
  'Numéro mobile ivoirien invalide (format +225 suivi de 10 chiffres)',
);

const requestPassengerOTPSchema = z.object({
  telephone: telephoneCI,
}).strict();

const verifyPassengerOTPSchema = z.object({
  telephone: telephoneCI,
  code: z.string().regex(/^\d{6}$/, 'Le code doit contenir 6 chiffres'),
  nom: z.string().trim().min(2, 'Nom complet requis').max(100),
}).strict();

function sendAuthError(res: Response, error: unknown, action: string): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: error.issues[0]?.message ?? 'Données invalides',
      errors: error.issues.map(issue => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
      })),
    });
    return;
  }

  if (error instanceof AuthError) {
    const statusCode =
      Number.isInteger(error.statusCode) &&
      error.statusCode >= 400 && error.statusCode <= 599
        ? error.statusCode
        : 400;
    res.status(statusCode).json({ error: error.message });
    return;
  }

  console.error(`[AUTH/${action}] Erreur inattendue`, error);
  res.status(500).json({
    error: "Le service d'authentification est temporairement indisponible",
  });
}

export class AuthController {
  /** Compatibilité historique (désactivée publiquement par auth.routes.ts). */
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const data = registerSchema.parse(req.body);
      const result = await authService.register(data);
      res.status(201).json(result);
    } catch (error: unknown) {
      sendAuthError(res, error, 'REGISTER');
    }
  };

  /** Connexion existante : conducteurs et administrateurs notamment. */
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const data = loginSchema.parse(req.body);
      const result = await authService.login(data);
      res.status(200).json(result);
    } catch (error: unknown) {
      sendAuthError(res, error, 'LOGIN');
    }
  };

  /** Route historique : conserve son comportement sans OTP fictif. */
  verifyOTP = async (req: Request, res: Response): Promise<void> => {
    try {
      const data = verifyOTPSchema.parse(req.body);
      const result = await authService.verifyOTP(data.telephone, data.otpCode);
      res.status(200).json(result);
    } catch (error: unknown) {
      sendAuthError(res, error, 'VERIFY_OTP');
    }
  };

  /** POST /api/auth/otp/request — crée le défi puis demande l'envoi SMS. */
  requestPassengerOTP = async (req: Request, res: Response): Promise<void> => {
    try {
      const { telephone } = requestPassengerOTPSchema.parse(req.body);
      const result = await authService.requestPassengerOTP(telephone);
      res.status(200).json(result);
    } catch (error: unknown) {
      sendAuthError(res, error, 'OTP_REQUEST');
    }
  };

  /** POST /api/auth/otp/verify — vérifie l'OTP et ouvre une session USER. */
  verifyPassengerOTP = async (req: Request, res: Response): Promise<void> => {
    try {
      const data = verifyPassengerOTPSchema.parse(req.body);
      const result = await authService.verifyPassengerOTP(data);
      res.status(200).json(result);
    } catch (error: unknown) {
      sendAuthError(res, error, 'OTP_VERIFY');
    }
  };

  /** Route protégée par le middleware authenticate. */
  getProfile = async (req: Request, res: Response): Promise<void> => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentification requise' });
      return;
    }
    res.status(200).json({
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        telephone: user.telephone,
        role: user.role,
        photo: user.photo,
        moyenPaiement: user.moyenPaiement,
        isVerified: user.isVerified,
        isBlocked: user.isBlocked,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  };

  /** Rotation des refresh tokens existants, inchangée. */
  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = refreshTokenSchema.parse(req.body);
      const result = await authService.refreshToken(refreshToken);
      res.status(200).json(result);
    } catch (error: unknown) {
      sendAuthError(res, error, 'REFRESH');
    }
  };
}
