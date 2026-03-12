import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: string;
  nom: string;
  prenom?: string;
  email: string;
  telephone: string;
  role: string;
  photo?: string;
  isVerified: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  setUser: (user: User) => Promise<void>;
  // 💎 AJOUT : Permet de modifier juste une partie (ex: juste la photo ou le nom)
  updateUser: (data: Partial<User>) => Promise<void>; 
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  loadAuthData: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: async (user) => {
    await AsyncStorage.setItem('user', JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },

  // ✅ LOGIQUE DE MISE À JOUR ELITE
  updateUser: async (data) => {
    const currentUser = get().user;
    if (currentUser) {
      const updatedUser = { ...currentUser, ...data };
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      set({ user: updatedUser });
    }
  },

  setTokens: async (accessToken, refreshToken) => {
    await AsyncStorage.multiSet([
      ['accessToken', accessToken],
      ['refreshToken', refreshToken]
    ]);
    set({ accessToken, refreshToken, isAuthenticated: true });
  },

  logout: async () => {
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  loadAuthData: async () => {
    try {
      const results = await AsyncStorage.multiGet(['accessToken', 'refreshToken', 'user']);
      const accessToken = results[0][1];
      const refreshToken = results[1][1];
      const userJson = results[2][1];

      if (accessToken && userJson) {
        set({
          accessToken,
          refreshToken,
          user: JSON.parse(userJson),
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Erreur chargement auth:', error);
      set({ isLoading: false });
    }
  },
}));