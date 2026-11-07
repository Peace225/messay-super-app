import 'dotenv/config';
import { randomUUID } from 'crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

// ============================================================
// MESSAY - AUTHENTIFICATION JWT
// ============================================================

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  telephone?: string;
  nonce?: string;
}

type TokenKind = 'access' | 'refresh';

export interface VerifiedTokenPayload extends TokenPayload {
  tokenType: TokenKind;
  iat?: number;
  exp?: number;
  jti?: string;
}

// ============================================================
// 1. CONFIGURATION DES SECRETS
// ============================================================

function requiredSecret(
  name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET'
): string {
  const secret = process.env[name];

  if (!secret || secret.trim().length < 32) {
    throw new Error(
      `${name} doit contenir au moins 32 caractères aléatoires`
    );
  }

  return secret;
}

const JWT_SECRET = requiredSecret('JWT_SECRET');

const JWT_REFRESH_SECRET = requiredSecret(
  'JWT_REFRESH_SECRET'
);

if (JWT_SECRET === JWT_REFRESH_SECRET) {
  throw new Error(
    'JWT_SECRET et JWT_REFRESH_SECRET doivent être différents'
  );
}

const ISSUER = process.env.JWT_ISSUER?.trim() || 'messay-api';

const AUDIENCE = process.env.JWT_AUDIENCE?.trim() || 'messay-app';

// ============================================================
// 2. CONFIGURATION DES EXPIRATIONS
// ============================================================

function durationSeconds(
  value: string | undefined,
  fallback: string,
  variableName: string
): number {
  const input = (value ?? fallback).trim();

  const match = /^([1-9]\d*)(s|m|h|d|w)$/i.exec(input);

  if (!match) {
    throw new Error(
      `${variableName} doit avoir un format tel que 15m, 24h, 7d ou 1w`
    );
  }

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
  };

  const seconds =
    Number(match[1]) *
    multipliers[match[2].toLowerCase()];

  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new Error(`${variableName} est hors limites`);
  }

  return seconds;
}

const ACCESS_TTL = durationSeconds(
  process.env.JWT_EXPIRES_IN,
  '15m',
  'JWT_EXPIRES_IN'
);

const REFRESH_TTL = durationSeconds(
  process.env.JWT_REFRESH_EXPIRES_IN,
  '7d',
  'JWT_REFRESH_EXPIRES_IN'
);

// ============================================================
// 3. VALIDATION DU PAYLOAD
// ============================================================

function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === 'string' &&
    Object.values(UserRole).includes(value as UserRole)
  );
}

function validPayload(payload: TokenPayload): void {
  if (
    typeof payload.userId !== 'string' ||
    !payload.userId.trim() ||
    typeof payload.email !== 'string' ||
    !payload.email.trim() ||
    !isUserRole(payload.role)
  ) {
    throw new Error('Données utilisateur invalides pour le JWT');
  }
}

// ============================================================
// 4. GÉNÉRATION DES TOKENS
// ============================================================

function issueToken(
  payload: TokenPayload,
  tokenType: TokenKind
): string {
  validPayload(payload);

  const claims = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,

    ...(payload.telephone
      ? { telephone: payload.telephone }
      : {}),

    ...(tokenType === 'refresh' && payload.nonce
      ? { nonce: payload.nonce }
      : {}),

    tokenType,
  };

  const options: SignOptions = {
    algorithm: 'HS256',

    expiresIn:
      tokenType === 'access'
        ? ACCESS_TTL
        : REFRESH_TTL,

    issuer: ISSUER,
    audience: AUDIENCE,

    ...(tokenType === 'refresh'
      ? { jwtid: randomUUID() }
      : {}),
  };

  return jwt.sign(
    claims,
    tokenType === 'access'
      ? JWT_SECRET
      : JWT_REFRESH_SECRET,
    options
  );
}

// ============================================================
// 5. VÉRIFICATION DES TOKENS
// ============================================================

function verifyToken(
  token: string,
  tokenType: TokenKind
): VerifiedTokenPayload {
  if (typeof token !== 'string' || !token.trim()) {
    throw new jwt.JsonWebTokenError('Token manquant');
  }

  const decoded = jwt.verify(
    token,
    tokenType === 'access'
      ? JWT_SECRET
      : JWT_REFRESH_SECRET,
    {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    }
  );

  if (
    typeof decoded === 'string' ||
    typeof decoded.userId !== 'string' ||
    !decoded.userId.trim() ||
    typeof decoded.email !== 'string' ||
    !decoded.email.trim() ||
    !isUserRole(decoded.role) ||
    decoded.tokenType !== tokenType
  ) {
    throw new jwt.JsonWebTokenError(
      'Payload JWT invalide'
    );
  }

  return {
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role,
    tokenType,

    ...(typeof decoded.telephone === 'string'
      ? { telephone: decoded.telephone }
      : {}),

    ...(typeof decoded.nonce === 'string'
      ? { nonce: decoded.nonce }
      : {}),

    ...(typeof decoded.iat === 'number'
      ? { iat: decoded.iat }
      : {}),

    ...(typeof decoded.exp === 'number'
      ? { exp: decoded.exp }
      : {}),

    ...(typeof decoded.jti === 'string'
      ? { jti: decoded.jti }
      : {}),
  };
}

// ============================================================
// 6. FONCTIONS PUBLIQUES
// ============================================================

export const generateAccessToken = (
  payload: TokenPayload
): string => issueToken(payload, 'access');

export const generateRefreshToken = (
  payload: TokenPayload
): string => issueToken(payload, 'refresh');

export const verifyAccessToken = (
  token: string
): VerifiedTokenPayload => verifyToken(token, 'access');

export const verifyRefreshToken = (
  token: string
): VerifiedTokenPayload => verifyToken(token, 'refresh');

// ============================================================
// FIN - MESSAY JWT
// ============================================================