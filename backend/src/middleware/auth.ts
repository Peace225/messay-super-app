import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@prisma/client';
import { verifyAccessToken } from '../utils/jwt';
import { UserRepository } from '../repositories/user.repository';

// Les propriétés user/userId/userRole sont déclarées dans src/types/express.d.ts.
// Cette interface reste exportée pour compatibilité avec le code existant.
export interface AuthenticatedRequest extends Request {}

/**
 * Authentifie une requête HTTP avec un access token JWT.
 * Le rôle et l'état du compte sont relus en base à chaque requête :
 * on ne fait pas confiance aux rôles présents dans un token ancien.
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Ne jamais accepter un JWT dans l'URL ni dans le corps de la requête.
  const authorization = req.headers.authorization;
  const match = typeof authorization === 'string'
    ? /^Bearer\s+(\S+)$/i.exec(authorization.trim())
    : null;

  if (!match) {
    res.status(401).json({ error: 'Token d’authentification manquant' });
    return;
  }

  let userId: string;
  try {
    const payload = verifyAccessToken(match[1]);
    if (!payload || typeof payload.userId !== 'string' || !payload.userId.trim()) {
      res.status(401).json({ error: 'Token invalide' });
      return;
    }
    userId = payload.userId;
  } catch {
    // JWT expiré, altéré ou signé avec une mauvaise clé.
    res.status(401).json({ error: 'Token invalide ou expiré' });
    return;
  }

  let user;
  try {
    user = await UserRepository.findById(userId);
  } catch (error) {
    console.error('[auth] Erreur de lecture du compte utilisateur', error);
    res.status(503).json({ error: 'Service d’authentification temporairement indisponible' });
    return;
  }

  if (!user) {
    res.status(401).json({ error: 'Session invalide : utilisateur introuvable' });
    return;
  }

  if (user.isBlocked) {
    res.status(403).json({ error: 'Votre compte MESSAY est bloqué' });
    return;
  }

  // Ne jamais mettre le hash de mot de passe, les OTP ou les tokens dans req.user.
  // Cela sécurise également la réponse de GET /api/auth/me.
  req.user = {
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
  };
  req.userId = user.id;
  req.userRole = user.role;

  next();
};

/**
 * Réserve une route aux rôles indiqués.
 * À utiliser APRÈS authenticate (ou router.use(authenticate)).
 */
export const authorize = (...roles: UserRole[]) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user || !req.userId || !req.userRole) {
      res.status(401).json({ error: 'Authentification requise' });
      return;
    }

    if (req.user.isBlocked) {
      res.status(403).json({ error: 'Votre compte MESSAY est bloqué' });
      return;
    }

    if (!roles.includes(req.userRole)) {
      res.status(403).json({ error: 'Accès refusé : permissions insuffisantes' });
      return;
    }

    next();
  };
};
