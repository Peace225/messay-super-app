import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { registerSchema, loginSchema, verifyOTPSchema } from '../validators/auth.validator';

const authService = new AuthService();

export class AuthController {
  
  // 🟢 INSCRIPTION : Gère l'enregistrement direct (Téléphone + Pass)
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      // La validation Zod vérifie maintenant le numéro de téléphone
      const validatedData = registerSchema.parse(req.body);
      const result = await authService.register(validatedData);
      
      res.status(201).json(result);
    } catch (error: any) {
      console.error("❌ Erreur Register:", error.message);
      // Extraction du message d'erreur spécifique de Zod si possible
      const message = error.errors ? error.errors[0].message : error.message;
      res.status(400).json({ error: message });
    }
  };

  // 🔵 CONNEXION : Authentification par téléphone OU email
  login = async (req: Request, res: Response): Promise<void> => {
    // 📱 Log dynamique : on affiche l'email ou le téléphone
    const identifiant = req.body.email || req.body.telephone;
    console.log("📨 [BACKEND] Tentative de login pour:", identifiant);

    try {
      // 1. Validation Zod (vérifie la présence du téléphone ou email et du password)
      const validatedData = loginSchema.parse(req.body);
      
      // 2. Appel au service avec les données validées
      const result = await authService.login(validatedData);
      
      console.log("✅ [BACKEND] Login réussi pour:", identifiant);
      
      // 3. Réponse au frontend
      res.status(200).json(result);
    } catch (error: any) {
      console.error("❌ [BACKEND] Erreur Login:", error.message);
      
      const message = error.errors ? error.errors[0].message : (error.message || "Identifiants invalides");
      res.status(401).json({ error: message });
    }
  };

  // 🟡 VÉRIFICATION OTP (Gardé pour la structure, même si désactivé)
  verifyOTP = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = verifyOTPSchema.parse(req.body);
      const result = await authService.verifyOTP(
        validatedData.telephone,
        validatedData.otpCode
      );
      res.status(200).json(result);
    } catch (error: any) {
      const message = error.errors ? error.errors[0].message : error.message;
      res.status(400).json({ error: message });
    }
  };

  // ⚪️ PROFIL : Récupère l'utilisateur connecté via le middleware Auth
  getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json({ user: (req as any).user });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  // 🟠 REFRESH : Renouvelle le token d'accès
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