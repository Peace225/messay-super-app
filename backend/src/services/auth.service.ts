import bcrypt from 'bcrypt';
import prisma from '../config/database';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { RegisterInput, LoginInput } from '../validators/auth.validator';

/**
 * Service d'authentification
 */
export class AuthService {
  /**
   * Inscription d'un nouvel utilisateur
   */
  async register(data: RegisterInput) {
    // Vérifier si l'email existe déjà
    const existingEmail = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingEmail) {
      throw new Error('Cet email est déjà utilisé');
    }

    // Vérifier si le téléphone existe déjà
    const existingPhone = await prisma.user.findUnique({
      where: { telephone: data.telephone },
    });

    if (existingPhone) {
      throw new Error('Ce numéro de téléphone est déjà utilisé');
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Générer un code OTP (simulation)
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        nom: data.nom,
        prenom: data.prenom,
        email: data.email,
        telephone: data.telephone,
        password: hashedPassword,
        role: data.role || 'USER',
        otpCode,
        otpExpiry,
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        role: true,
        isVerified: true,
      },
    });

    // TODO: Envoyer le code OTP par SMS (simulation)
    console.log(`📱 Code OTP pour ${data.telephone}: ${otpCode}`);

    return {
      user,
      message: 'Inscription réussie. Un code OTP a été envoyé à votre téléphone.',
      otpCode: process.env.NODE_ENV === 'development' ? otpCode : undefined,
    };
  }

  /**
   * Connexion d'un utilisateur
   */
  async login(data: LoginInput) {
    // Trouver l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new Error('Email ou mot de passe incorrect');
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid) {
      throw new Error('Email ou mot de passe incorrect');
    }

    // Générer les tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Sauvegarder le refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    return {
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        telephone: user.telephone,
        role: user.role,
        photo: user.photo,
        isVerified: user.isVerified,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Vérification du code OTP
   */
  async verifyOTP(telephone: string, otpCode: string) {
    const user = await prisma.user.findUnique({
      where: { telephone },
    });

    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    if (user.isVerified) {
      throw new Error('Compte déjà vérifié');
    }

    if (!user.otpCode || !user.otpExpiry) {
      throw new Error('Aucun code OTP trouvé');
    }

    if (new Date() > user.otpExpiry) {
      throw new Error('Code OTP expiré');
    }

    if (user.otpCode !== otpCode) {
      throw new Error('Code OTP invalide');
    }

    // Marquer comme vérifié
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        otpCode: null,
        otpExpiry: null,
      },
    });

    return { message: 'Compte vérifié avec succès' };
  }
}
