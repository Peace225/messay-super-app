import { rateLimit } from 'express-rate-limit';

/**
 * MESSAY — protections par adresse IP pour les routes SMS OTP.
 * Les limites par numéro et par code sont appliquees dans AuthService.
 * Le MemoryStore par defaut convient a une seule instance pour les tests ;
 * utiliser Redis/stockage partage en cas de plusieurs instances.
 */
export const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  statusCode: 429,
  message: {
    error: 'Trop de demandes SMS depuis cette connexion. Réessayez dans 15 minutes.',
  },
});

export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  statusCode: 429,
  message: {
    error: 'Trop de vérifications depuis cette connexion. Réessayez plus tard.',
  },
});
