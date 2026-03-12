import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

/**
 * Middleware universel de validation pour MESSAY Super App.
 * @param schema Le schéma Zod à valider contre req.body
 */
export const validate = (schema: AnyZodObject) => 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Analyse et valide le corps de la requête
      await schema.parseAsync(req.body);
      
      // Si tout est ok, on passe au controller
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Formate les erreurs Zod pour le frontend
        const errorMessages = error.errors.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));

        return res.status(400).json({
          status: 'error',
          message: 'Données de requête invalides',
          errors: errorMessages,
        });
      }

      // Erreur serveur générique
      return res.status(500).json({
        status: 'error',
        message: 'Erreur interne lors de la validation',
      });
    }
  };