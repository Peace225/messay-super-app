import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { revokePushDeviceOnLogout } from '../services/pushDeviceApi';

// Conserve les rôles historiques pour ne pas casser les dashboards / écrans conducteurs.
export type UserRole = 'USER' | 'CLIENT' | 'CONDUCTEUR' | 'CHAUFFEUR' | 'ADMIN';

export interface AuthUser {
  id: string;
  nom: string;
  prenom?: string | null;
  email?: string | null;
  telephone: string;
  role: UserRole;
  photo?: string | null;
  isVerified: boolean;
  isBlocked?: boolean;
  moyenPaiement?: unknown;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  initialScreen: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setSession: (session: AuthSession) => Promise<void>;
  setUser: (user: AuthUser) => Promise<void>;
  updateUser: (data: Partial<AuthUser>) => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  loadAuthData: () => Promise<void>;
  clearInitialScreen: () => void;
}

const KEYS = ['accessToken', 'refreshToken', 'user'] as const;

const getInitialScreen = (role: UserRole): string => {
  if (role === 'CONDUCTEUR') return 'screens/ConducteurCoursesScreen';
  if (role === 'CHAUFFEUR') return 'screens/ChauffeurLivraisonsScreen';
  return '(tabs)';
};

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false;
  const user = value as Partial<AuthUser>;
  return (
    typeof user.id === 'string' && user.id.length > 0 &&
    typeof user.nom === 'string' && user.nom.length > 0 &&
    typeof user.telephone === 'string' && user.telephone.length > 0 &&
    ['USER', 'CLIENT', 'CONDUCTEUR', 'CHAUFFEUR', 'ADMIN'].includes(String(user.role)) &&
    typeof user.isVerified === 'boolean'
  );
}

const EMPTY_AUTH = {
  user: null,
  accessToken: null,
  refreshToken: null,
  initialScreen: null,
  isAuthenticated: false,
  isLoading: false,
} as const;

export const useAuthStore = create<AuthState>((set, get) => ({
  ...EMPTY_AUTH,
  isLoading: true,

  setSession: async ({ user, accessToken, refreshToken }) => {
    if (!isAuthUser(user) || !accessToken?.trim() || !refreshToken?.trim()) {
      throw new Error('Session MESSAY incomplète ou invalide.');
    }
    await AsyncStorage.multiSet([
      ['accessToken', accessToken],
      ['refreshToken', refreshToken],
      ['user', JSON.stringify(user)],
    ]);
    set({
      user,
      accessToken,
      refreshToken,
      initialScreen: getInitialScreen(user.role),
      isAuthenticated: true,
      isLoading: false,
    });
  },

  setUser: async (user) => {
    if (!isAuthUser(user)) throw new Error('Profil utilisateur invalide.');
    await AsyncStorage.setItem('user', JSON.stringify(user));
    set({
      user,
      initialScreen: getInitialScreen(user.role),
      isAuthenticated: Boolean(get().accessToken),
      isLoading: false,
    });
  },

  updateUser: async (data) => {
    const currentUser = get().user;
    if (!currentUser) return;
    const updatedUser = { ...currentUser, ...data };
    if (!isAuthUser(updatedUser)) throw new Error('Mise à jour du profil invalide.');
    await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    set({ user: updatedUser, initialScreen: getInitialScreen(updatedUser.role) });
  },

  setTokens: async (accessToken, refreshToken) => {
    if (!accessToken?.trim() || !refreshToken?.trim()) {
      throw new Error('Tokens MESSAY manquants.');
    }
    await AsyncStorage.multiSet([
      ['accessToken', accessToken],
      ['refreshToken', refreshToken],
    ]);
    set({
      accessToken,
      refreshToken,
      isAuthenticated: Boolean(get().user),
      isLoading: false,
    });
  },

  logout: async () => {
    const token = get().accessToken;
    if (token) {
      try {
        await revokePushDeviceOnLogout(token);
      } catch (error) {
        // Une connexion indisponible ne doit pas empêcher la déconnexion.
        console.warn('[MESSAY/PUSH] Révocation différée nécessaire :',
          error instanceof Error ? error.message : 'Erreur réseau');
      }
    }
    try {
      await AsyncStorage.multiRemove([...KEYS]);
    } finally {
      set(EMPTY_AUTH);
    }
  },

  loadAuthData: async () => {
    try {
      const results = await AsyncStorage.multiGet([...KEYS]);
      const values = Object.fromEntries(results) as Record<string, string | null>;
      const { accessToken, refreshToken, user: userJson } = values;
      if (!accessToken || !userJson) {
        set(EMPTY_AUTH);
        return;
      }
      const user: unknown = JSON.parse(userJson);
      if (!isAuthUser(user)) {
        await AsyncStorage.multiRemove([...KEYS]);
        set(EMPTY_AUTH);
        return;
      }
      set({
        user,
        accessToken,
        refreshToken: refreshToken ?? null,
        initialScreen: getInitialScreen(user.role),
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('[MESSAY AUTH] Restauration impossible', error);
      set(EMPTY_AUTH);
    }
  },

  clearInitialScreen: () => set({ initialScreen: null }),
}));
