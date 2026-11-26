
import api from './api';
import { useAuthStore } from '../store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// MESSAY MOBILE - SERVICE D'AUTHENTIFICATION
// ============================================================

// ============================================================
// 1. TYPES
// ============================================================

export type AuthRole =
  | 'USER'
  | 'CONDUCTEUR'
  | 'CHAUFFEUR';

export interface RegisterData {
  nom: string;
  prenom?: string;
  email: string;
  telephone: string;
  password: string;
  role?: AuthRole;
}

// Connexion possible par téléphone OU par email.
// L'API backend doit accepter le mode utilisé.

export type LoginData =
  | {
      telephone: string;
      password: string;
      email?: never;
    }
  | {
      email: string;
      password: string;
      telephone?: never;
    };

// Réutiliser le type User déjà défini dans Zustand
// plutôt que créer une deuxième interface User.

type AuthUser = NonNullable<
  ReturnType<typeof useAuthStore.getState>['user']
>;

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

// ============================================================
// 2. VALIDATION DE LA RÉPONSE DE CONNEXION
// ============================================================

function isValidAuthResponse(
  data: unknown
): data is AuthResponse {
  if (
    typeof data !== 'object' ||
    data === null
  ) {
    return false;
  }

  const result = data as Partial<AuthResponse>;

  if (
    typeof result.accessToken !== 'string' ||
    !result.accessToken.trim() ||
    typeof result.refreshToken !== 'string' ||
    !result.refreshToken.trim()
  ) {
    return false;
  }

  if (
    typeof result.user !== 'object' ||
    result.user === null ||
    typeof result.user.id !== 'string' ||
    !result.user.id.trim() ||
    typeof result.user.role !== 'string'
  ) {
    return false;
  }

  return true;
}

// ============================================================
// 3. SERVICE D'AUTHENTIFICATION
// ============================================================

export const authService = {
  // ----------------------------------------------------------
  // INSCRIPTION
  // POST /api/auth/register
  // ----------------------------------------------------------

  async register(data: RegisterData) {
    const response = await api.post(
      '/auth/register',
      data
    );

    return response.data;
  },

  // ----------------------------------------------------------
  // CONNEXION
  // POST /api/auth/login
  // ----------------------------------------------------------

  async login(data: LoginData): Promise<AuthResponse> {
    if (
      !data.password ||
      typeof data.password !== 'string'
    ) {
      throw new Error(
        'Le mot de passe est requis.'
      );
    }

    // Envoyer uniquement le moyen de connexion choisi.
    // Ne jamais modifier ou supprimer les espaces
    // du mot de passe.

    let credentials:
      | { telephone: string; password: string }
      | { email: string; password: string };

    if (
      'telephone' in data &&
      typeof data.telephone === 'string'
    ) {
      const telephone = data.telephone.trim();

      if (!telephone) {
        throw new Error(
          'Le numéro de téléphone est requis.'
        );
      }

      credentials = {
        telephone,
        password: data.password,
      };
    } else if (
      'email' in data &&
      typeof data.email === 'string'
    ) {
      const email = data.email.trim().toLowerCase();

      if (!email) {
        throw new Error(
          "L'adresse email est requise."
        );
      }

      credentials = {
        email,
        password: data.password,
      };
    } else {
      throw new Error(
        'Veuillez fournir un téléphone ou un email.'
      );
    }

    // Envoi au backend Render via api.ts.

    const response = await api.post<unknown>(
      '/auth/login',
      credentials
    );

    if (!isValidAuthResponse(response.data)) {
      throw new Error(
        'Réponse de connexion invalide : utilisateur ou tokens manquants.'
      );
    }

    const {
      user,
      accessToken,
      refreshToken,
    } = response.data;

    // --------------------------------------------------------
    // SAUVEGARDE DE LA SESSION
    // --------------------------------------------------------

    // Conserver la clé historique "user"
    // pour compatibilité avec l'application existante.
    // Ne jamais y enregistrer les tokens.

    await AsyncStorage.setItem(
      'user',
      JSON.stringify(user)
    );

    // Le store reste responsable de la session JWT.

    const authStore = useAuthStore.getState();

    await authStore.setTokens(
      accessToken,
      refreshToken
    );

    await authStore.setUser(user);

    if (__DEV__) {
      console.log(
        '[MESSAY AUTH] Connexion réussie'
      );
    }

    return {
      user,
      accessToken,
      refreshToken,
    };
  },

  // ----------------------------------------------------------
  // VÉRIFICATION OTP
  // POST /api/auth/verify-otp
  // ----------------------------------------------------------

  async verifyOTP(
    telephone: string,
    otpCode: string
  ) {
    if (
      !telephone.trim() ||
      !otpCode.trim()
    ) {
      throw new Error(
        'Téléphone et code OTP requis.'
      );
    }

    const response = await api.post(
      '/auth/verify-otp',
      {
        telephone: telephone.trim(),
        otpCode: otpCode.trim(),
      }
    );

    return response.data;
  },

  // ----------------------------------------------------------
  // PROFIL UTILISATEUR
  // GET /api/auth/me
  // ----------------------------------------------------------

  async getProfile() {
    const response = await api.get(
      '/auth/me'
    );

    return response.data;
  },

  // ----------------------------------------------------------
  // DÉCONNEXION
  // ----------------------------------------------------------

  async logout(): Promise<void> {
    try {
      await useAuthStore.getState().logout();
    } finally {
      // Éviter de conserver un ancien profil
      // dans la clé historique AsyncStorage.
      await AsyncStorage.removeItem('user');
    }

    if (__DEV__) {
      console.log(
        '[MESSAY AUTH] Déconnexion locale'
      );
    }
  },
};

export default authService;
