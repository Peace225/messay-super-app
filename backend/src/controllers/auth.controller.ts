import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { registerSchema, loginSchema, verifyOTPSchema } from '../validators/auth.validator';

interface AuthenticatedRequest extends Request {
  user?: any;
}

const authService = new AuthService();

export class AuthController {

  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = registerSchema.parse(req.body);
      const result = await authService.register(validatedData);
      res.status(201).json(result);
    } catch (error: any) {
      console.error("❌ Erreur Register:", error.message);
      const message = error.errors? error.errors[0].message : error.message;
      res.status(400).json({ error: message });
    }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const identifiant = req.body.email || req.body.telephone;
    console.log("📨 [BACKEND] Tentative de login pour:", identifiant);

    try {
      const validatedData = loginSchema.parse(req.body);
      const result = await authService.login(validatedData);
      console.log("✅ [BACKEND] Login réussi pour:", identifiant);
      res.status(200).json(result);
    } catch (error: any) {
      console.error("❌ [BACKEND] Erreur Login:", error.message);
      const message = error.errors? error.errors[0].message : (error.message || "Identifiants invalides");
      res.status(401).json({ error: message });
    }
  };

  verifyOTP = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = verifyOTPSchema.parse(req.body);
      const result = await authService.verifyOTP(
        validatedData.telephone,
        validatedData.otpCode
      );
      res.status(200).json(result);
    } catch (error: any) {
      const message = error.errors? error.errors[0].message : error.message;
      res.status(400).json({ error: message });
    }
  };

  getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      res.status(200).json({ user: req.user });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        res.status(400).json({ error: "Refresh token manquant." });
        return;
      }
      const result = await authService.refreshToken(refreshToken);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(401).json({ error: error.message || "Session expirée." });
    }
  };
}