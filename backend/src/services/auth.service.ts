import bcrypt from 'bcrypt';
import { UserRepository } from '../repositories/user.repository';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { RegisterInput, LoginInput } from '../validators/auth.validator';

export class AuthService {
  /**
   * Inscription Directe (Zéro Friction)
   */
  async register(data: RegisterInput) {
    // 1. On vérifie uniquement le téléphone en utilisant findByTelephone de votre Repository
    const existingUser = await UserRepository.findByTelephone(data.telephone!);
    if (existingUser) throw new Error('Ce numéro de téléphone est déjà utilisé');

    const hashedPassword = await bcrypt.hash(data.password, 10);

    // 🛠️ LOGIQUE SUPABASE : Génération d'un email technique pour satisfaire la contrainte UNIQUE
    const technicalEmail = `${data.telephone!.replace('+', '')}@messay.ci`;

    const user = await UserRepository.create({
      nom: data.nom || `Membre ${data.telephone!.slice(-4)}`,
      prenom: data.prenom || '',
      email: technicalEmail, // Email généré automatiquement
      telephone: data.telephone,
      password: hashedPassword,
      role: data.role || 'USER',
      isVerified: true, // ✅ Activation immédiate (plus d'envoi de code)
    });

    const { password: p, ...userProfile } = user as any;
    return { user: userProfile, message: 'Compte MESSAY créé avec succès' };
  }

  /**
   * Connexion par Téléphone OU Email (Pour l'Admin Dashboard)
   */
  async login(data: LoginInput) {
    const identifiant = data.email || data.telephone;
    console.log(`🔑 Tentative de connexion pour: ${identifiant}`);

    let user: any = null;

    // 2. On cherche par email si c'est fourni, sinon on cherche par téléphone
    if (data.email) {
      // Utilisation directe et propre de votre méthode findByEmail
      user = await UserRepository.findByEmail(data.email);
    } else if (data.telephone) {
      user = await UserRepository.findByTelephone(data.telephone);
    }

    if (!user) throw new Error('Identifiant ou mot de passe incorrect');

    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) throw new Error('Identifiant ou mot de passe incorrect');

    const payload = { userId: user.id, telephone: user.telephone, email: user.email, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    try {
      // Mise à jour de la session sur Supabase
      const updatedUser = await UserRepository.update(user.id, { refreshToken });
      console.log("✅ Session synchronisée sur Supabase");

      const profile = { ...updatedUser } as any;
      delete profile.password;
      delete profile.refreshToken;

      return {
        user: profile,
        accessToken,
        refreshToken,
      };
    } catch (error: any) {
      console.error("💥 Erreur DB:", error.message);
      throw new Error("Erreur technique lors de la création de session.");
    }
  }

  // Ces méthodes restent pour la structure mais ne sont plus appelées par ton nouveau flux
  async verifyOTP(telephone: string, otpCode: string) {
    return { message: "Flux direct activé : vérification non requise" };
  }

  async refreshToken(token: string) {
    // Ta logique habituelle pour renouveler le JWT
    return { accessToken: "..." };
  }
}