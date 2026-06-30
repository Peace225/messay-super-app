import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const authController = new AuthController();

// Route d'inscription
router.post('/register', (req, res) => authController.register(req, res));

// Route de connexion
router.post('/login', (req, res) => authController.login(req, res));

// Route de vérification OTP
router.post('/verify-otp', (req, res) => authController.verifyOTP(req, res));

// Route pour récupérer le profil utilisateur (protégée)
router.get('/me', authenticate, (req, res) => authController.getProfile(req, res));

// Route pour rafraîchir le token d'accès
router.post('/refresh', (req, res) => authController.refreshToken(req, res));

export default router;