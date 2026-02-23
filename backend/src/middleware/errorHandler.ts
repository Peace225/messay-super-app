import { Request, Response, NextFunction } from 'express';

/**
 * Middleware de gestion globale des erreurs
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('❌ Erreur:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Erreur interne du serveur';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * Middleware pour les routes non trouvées
 */
export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({ error: 'Route non trouvée' });
};
