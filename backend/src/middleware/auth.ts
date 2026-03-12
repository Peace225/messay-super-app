import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UserRepository } from '../repositories/user.repository';

/**
 * Middleware d'authentification JWT pour MESSAY
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token manquant ou format invalide (Bearer requis)' });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);

    // RÉFÉRENCEMENT : Utilisation du Repository au lieu de Prisma direct
    const user = await UserRepository.findById(decoded.userId);

    if (!user) {
      res.status(401).json({ error: 'Session invalide : utilisateur non trouvé' });
      return;
    }

    // Attacher les informations à la requête pour les controllers
    req.user = user as any;
    req.userId = user.id;
    req.userRole = user.role;

    next();
  } catch (error) {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
};

/**
 * Middleware de vérification des rôles (Admin, Conducteur, Chauffeur, etc.)
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !req.userRole) {
      res.status(401).json({ error: 'Authentification requise pour vérifier les rôles' });
      return;
    }

    if (!roles.includes(req.userRole)) {
      res.status(403).json({ error: `Accès refusé - Rôle ${req.userRole} non autorisé` });
      return;
    }

    next();
  };
};