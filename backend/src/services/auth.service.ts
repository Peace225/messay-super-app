import bcrypt from 'bcrypt';
import { UserRepository } from '../repositories/user.repository';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { RegisterInput, LoginInput } from '../validators/auth.validator';

/**
 * Service d'authentification de MESSAY
 */
export class AuthService {
  /**
   * Inscription d'un nouvel utilisateur
   */
  async register(data: RegisterInput) {
    // 1. Vérifier si l'email ou le téléphone existe déjà via le Repository
    const userExists = await UserRepository.exists(data.email, data.telephone);
    
    if (userExists) {
      throw new Error('Cet email ou ce numéro de téléphone est déjà utilisé');
    }

    // 2. Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // 3. Générer l'OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // 4. Créer l'utilisateur via le Repository
    const user = await UserRepository.create({
      nom: data.nom,
      prenom: data.prenom,
      email: data.email,
      telephone: data.telephone,
      password: hashedPassword,
      role: data.role || 'USER',
      otpCode,
      otpExpiry,
    });

    // TODO: Intégrer un service SMS réel (ex: Twilio ou Wave SMS)
    console.log(`📱 Code OTP pour ${data.telephone}: ${otpCode}`);

    // On retire le mot de passe de l'objet retourné
    const { password, otpCode: _, otpExpiry: __, ...userProfile } = user as any;

    return {
      user: userProfile,
      message: 'Inscription réussie. Un code OTP a été envoyé.',
      otpCode: process.env.NODE_ENV === 'development' ? otpCode : undefined,
    };
  }

  /**
   * Connexion d'un utilisateur
   */
  async login(data: LoginInput) {
    // 1. Trouver l'utilisateur via le Repository
    const user = await UserRepository.findByEmail(data.email);

    if (!user) {
      throw new Error('Email ou mot de passe incorrect');
    }

    // 2. Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) {
      throw new Error('Email ou mot de passe incorrect');
    }

    // 3. Générer les tokens (Access + Refresh)
    const payload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // 4. Sauvegarder le refresh token via le Repository
    await UserRepository.update(user.id, { refreshToken });

    const { password, ...userProfile } = user;
    return {
      user: userProfile,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Vérification du code OTP
   */
  async verifyOTP(telephone: string, otpCode: string) {
    const user = await UserRepository.findByTelephone(telephone);

    if (!user) throw new Error('Utilisateur non trouvé');
    if (user.isVerified) throw new Error('Compte déjà vérifié');
    if (!user.otpCode || !user.otpExpiry) throw new Error('Aucun code OTP trouvé');
    if (new Date() > user.otpExpiry) throw new Error('Code OTP expiré');
    if (user.otpCode !== otpCode) throw new Error('Code OTP invalide');

    // Mettre à jour le statut via le Repository
    await UserRepository.update(user.id, {
      isVerified: true,
      otpCode: null,
      otpExpiry: null,
    });

    return { message: 'Compte vérifié avec succès' };
  }
}