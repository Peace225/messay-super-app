import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import {
  otpRequestLimiter,
  otpVerifyLimiter,
} from '../middleware/otpRateLimit';

const router = Router();
const authController = new AuthController();

/**
 * MESSAY — Authentification
 * - Passagers : téléphone + OTP, sans mot de passe.
 * - Conducteurs / administrateurs : connexion existante préservée.
 * - Création de conducteurs : administration uniquement.
 */

// L'ancienne inscription publique contournerait la preuve de possession
// du téléphone. Désactivée par défaut ; autorisation explicite uniquement
// durant une transition contrôlée. NE PAS activer en production.
router.post('/register', (req, res) => {
  if (process.env.ALLOW_LEGACY_REGISTER !== 'true') {
    res.status(410).json({
      error: 'Inscription classique indisponible. Utilisez la vérification SMS.',
    });
    return;
  }
  return authController.register(req, res);
});

// Connexion historique des conducteurs et administrateurs.
router.post('/login', (req, res) => authController.login(req, res));

// Ancienne route : conservée pour les clients existants.
router.post('/verify-otp', otpVerifyLimiter, (req, res) =>
  authController.verifyOTP(req, res)
);

// Demande de code : limitation IP + limitation par numéro dans AuthService.
router.post('/otp/request', otpRequestLimiter, (req, res) =>
  authController.requestPassengerOTP(req, res)
);

// Vérification : limitation IP + compteur d'essais atomique dans PostgreSQL.
router.post('/otp/verify', otpVerifyLimiter, (req, res) =>
  authController.verifyPassengerOTP(req, res)
);

// Session et profil.
router.get('/me', authenticate, (req, res) =>
  authController.getProfile(req, res)
);
router.post('/refresh', (req, res) =>
  authController.refreshToken(req, res)
);

export default router;
