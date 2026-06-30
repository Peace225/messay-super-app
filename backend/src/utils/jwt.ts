import jwt, { Secret } from 'jsonwebtoken';

const JWT_SECRET = (process.env.JWT_SECRET || 'votre_secret_jwt_changez_moi') as Secret;
const JWT_REFRESH_SECRET = (process.env.JWT_REFRESH_SECRET || 'votre_refresh_secret') as Secret;
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '24h') as any;
const JWT_REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any;

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Génère un access token JWT
 */
export const generateAccessToken = (payload: TokenPayload): string => {
  // On utilise "as any" pour l'expiration pour éviter les conflits de types avec la bibliothèque 'ms'
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Génère un refresh token JWT
 */
export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
};

/**
 * Vérifie et décode un access token
 */
export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
};

/**
 * Vérifie et décode un refresh token
 */
export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
};