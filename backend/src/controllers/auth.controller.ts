
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { AuthService, AuthError } from '../services/auth.service';
import {
  registerSchema,
  loginSchema,
  verifyOTPSchema,
  refreshTokenSchema,
} from '../validators/auth.validator';

/**
 * MESSAY - Contrôleur d'authentification
 * Compatible avec AuthService sécurisé et Express.Request typé
 * dans src/types/express.d.ts.
 */
const authService = new AuthService();

/** Conserve le format { error } attendu par React Native et les dashboards. */
function sendAuthError(
  res: Response,
  error: unknown,
  action: string
): void {
  // Erreurs de saisie : 400, avec détails utiles pour les formulaires.
  if (error instanceof ZodError) {
    res.status(400).json({
      error: error.issues[0]?.message ?? 'Données invalides',
      errors: error.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
      })),
    });
    return;
  }

  // Erreurs métier prévisibles : 401, 403, 409, 501, etc.
  if (error instanceof AuthError) {
    const statusCode =
      Number.isInteger(error.statusCode) &&
      error.statusCode >= 400 &&
      error.statusCode <= 599
        ? error.statusCode
        : 400;

    res.status(statusCode).json({ error: error.message });
    return;
  }

  // Ne jamais transmettre les détails d'une panne interne au client.
  console.error(`[AUTH/${action}] Erreur inattendue`, error);
  res.status(500).json({
    error: "Le service d'authentification est temporairement indisponible",
  });
}

export class AuthController {
  /** POST /api/auth/register — inscription client uniquement. */
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const data = registerSchema.parse(req.body);
      const result = await authService.register(data);
      res.status(201).json(result);
    } catch (error: unknown) {
      sendAuthError(res, error, 'REGISTER');
    }
  };

  /** POST /api/auth/login — téléphone ou email + mot de passe. */
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const data = loginSchema.parse(req.body);
      const result = await authService.login(data);
      res.status(200).json(result);
    } catch (error: unknown) {
      // Aucun numéro, email ni mot de passe n'est écrit dans les logs.
      sendAuthError(res, error, 'LOGIN');
    }
  };

  /** POST /api/auth/verify-otp — retourne 501 tant que le SMS n'est pas intégré. */
  verifyOTP = async (req: Request, res: Response): Promise<void> => {
    try {
      const data = verifyOTPSchema.parse(req.body);
      const result = await authService.verifyOTP(data.telephone, data.otpCode);
      res.status(200).json(result);
    } catch (error: unknown) {
      sendAuthError(res, error, 'VERIFY_OTP');
    }
  };

  /** GET /api/auth/me — doit être protégé par authenticate dans auth.routes.ts. */
  getProfile = async (req: Request, res: Response): Promise<void> => {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: 'Authentification requise' });
      return;
    }

    // Liste blanche : ne pas renvoyer password, otpCode, otpExpiry, deviceToken
    // ou refreshToken, même si un ancien middleware charge le User complet.
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

  /** POST /api/auth/refresh — vérification puis rotation du refresh token. */
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
