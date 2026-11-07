import bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { Prisma, UserRole, type User } from '@prisma/client';
import prisma from '../config/database';
import { UserRepository } from '../repositories/user.repository';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt';
import type { RegisterInput, LoginInput } from '../validators/auth.validator';

/** Erreur métier : permet au contrôleur de renvoyer le bon code HTTP. */
export class AuthError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Les données secrètes du modèle Prisma ne doivent jamais quitter le backend. */
function publicProfile(user: User) {
  return {
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
}

/** Le JWT signé est un secret à forte entropie : stocker seulement son empreinte. */
const hashRefreshToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/** Force un identifiant différent à chaque rotation, même dans la même seconde. */
function createTokens(user: User) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken({
    ...payload,
    nonce: randomUUID(),
  });

  return { accessToken, refreshToken };
}

export class AuthService {
  /**
   * Inscription publique : accès direct au compte client, sans fausse validation
   * du numéro. Les profils conducteurs relèvent d'une procédure dédiée.
   */
  async register(data: RegisterInput) {
    if (data.role && data.role !== 'USER') {
      throw new AuthError('Inscription publique réservée aux clients', 403);
    }

    const telephone = data.telephone.trim();
    if (!/^\+225\d{10}$/.test(telephone)) {
      throw new AuthError('Numéro ivoirien invalide (+225 suivi de 10 chiffres)', 400);
    }

    if (await UserRepository.findByTelephone(telephone)) {
      throw new AuthError('Ce numéro de téléphone est déjà utilisé', 409);
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);
    // Le schéma Prisma impose un email. Cette adresse est technique, non vérifiée.
    const technicalEmail = `${telephone.slice(1)}@messay.ci`;

    try {
      const user = await UserRepository.create({
        nom: data.nom.trim(),
        prenom: data.prenom?.trim() || null,
        email: technicalEmail,
        telephone,
        password: hashedPassword,
        role: UserRole.USER,
        isVerified: false,
        isBlocked: false,
      });

      return {
        user: publicProfile(user),
        message: 'Compte client MESSAY créé. Téléphone non encore vérifié.',
      };
    } catch (error) {
      // Empêche qu'une course à l'inscription retourne une erreur HTTP 500.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AuthError('Téléphone ou email déjà utilisé', 409);
      }
      throw error;
    }
  }

  /** Connexion par téléphone (app mobile) ou email (dashboard). */
  async login(data: LoginInput) {
    const user = data.email
      ? await UserRepository.findByEmail(data.email.trim().toLowerCase())
      : data.telephone
        ? await UserRepository.findByTelephone(data.telephone.trim())
        : null;

    // Même message pour ne pas révéler l'existence d'un compte.
    if (!user || !(await bcrypt.compare(data.password, user.password))) {
      throw new AuthError('Identifiant ou mot de passe incorrect', 401);
    }

    if (user.isBlocked) {
      throw new AuthError('Votre compte MESSAY est bloqué', 403);
    }

    const { accessToken, refreshToken } = createTokens(user);
    const saved = await UserRepository.update(user.id, {
      refreshToken: hashRefreshToken(refreshToken),
    });

    return {
      user: publicProfile(saved),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Rotation du refresh token : signature, compte, révocation et usage unique.
   * Schéma actuel : une seule session persistante par utilisateur.
   */
  async refreshToken(token: string) {
    if (typeof token !== 'string' || !token.trim()) {
      throw new AuthError('Refresh token manquant', 400);
    }

    let userId: string;
    try {
      const decoded = verifyRefreshToken(token);
      if (!decoded || typeof decoded.userId !== 'string') {
        throw new Error('Payload invalide');
      }
      userId = decoded.userId;
    } catch {
      throw new AuthError('Session expirée ou invalide', 401);
    }

    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new AuthError('Session révoquée', 401);
    }
    if (user.isBlocked) {
      throw new AuthError('Votre compte MESSAY est bloqué', 403);
    }

    const tokens = createTokens(user);
    // UPDATE conditionnel atomique : un ancien token ne peut pas être réutilisé.
    const rotated = await prisma.user.updateMany({
      where: {
        id: userId,
        refreshToken: hashRefreshToken(token),
        isBlocked: false,
      },
      data: { refreshToken: hashRefreshToken(tokens.refreshToken) },
    });

    if (rotated.count !== 1) {
      throw new AuthError('Session révoquée ou déjà renouvelée', 401);
    }

    return tokens;
  }

  /** L'ancien endpoint ne doit jamais annoncer une vérification fictive. */
  async verifyOTP(_telephone: string, _otpCode: string) {
    throw new AuthError('Vérification OTP non configurée', 501);
  }
}
