import type { User, UserRole } from '@prisma/client';

/** Données utilisateur explicitement autorisées dans req.user et /auth/me. */
type AuthUser = Pick<
  User,
  | 'id'
  | 'nom'
  | 'prenom'
  | 'email'
  | 'telephone'
  | 'role'
  | 'photo'
  | 'moyenPaiement'
  | 'isVerified'
  | 'isBlocked'
  | 'createdAt'
  | 'updatedAt'
>;

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      userId?: string;
      userRole?: UserRole;
    }
  }
}

export {};
