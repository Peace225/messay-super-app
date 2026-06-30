import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 💎 MISE À JOUR : Ajout de 'USER' car c'est le rôle par défaut dans Supabase
type UserRole = 'USER' | 'CLIENT' | 'CONDUCTEUR' | 'CHAUFFEUR' | 'ADMIN';

interface User {
  id: string;
  nom: string;
  prenom?: string;
  email: string;
  telephone: string;
  role: UserRole;
  photo?: string;
  isVerified: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  initialScreen: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  setUser: (user: User) => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>; 
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  loadAuthData: () => Promise<void>;
  clearInitialScreen: () => void;
}

// 🛠️ Fonction utilitaire pour éviter la duplication du calcul de l'écran initial
const getInitialScreen = (role: UserRole): string => {
  if (role === 'CONDUCTEUR') return 'screens/ConducteurCoursesScreen';
  if (role === 'CHAUFFEUR') return 'screens/ChauffeurLivraisonsScreen';
  return '(tabs)'; // Par défaut pour USER et CLIENT
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  initialScreen: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: async (user) => {
    try {
      await AsyncStorage.setItem('user', JSON.stringify(user));
      const screen = getInitialScreen(user.role);
      
      set({ 
        user, 
        initialScreen: screen, 
        isAuthenticated: true,
        isLoading: false // On s'assure que le chargement s'arrête ici
      });
    } catch (error) {
      console.error("Erreur sauvegarde user:", error);
    }
  },

  updateUser: async (data) => {
    const currentUser = get().user;
    if (currentUser) {
      const updatedUser = { ...currentUser, ...data };
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      set({ user: updatedUser });
    }
  },

  setTokens: async (accessToken, refreshToken) => {
    try {
      await AsyncStorage.multiSet([
        ['accessToken', accessToken],
        ['refreshToken', refreshToken]
      ]);
      set({ accessToken, refreshToken, isAuthenticated: true });
    } catch (error) {
      console.error("Erreur sauvegarde tokens:", error);
    }
  },

  logout: async () => {
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      initialScreen: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  loadAuthData: async () => {
    try {
      const results = await AsyncStorage.multiGet(['accessToken', 'refreshToken', 'user']);
      const accessToken = results[0][1];
      const refreshToken = results[1][1];
      const userJson = results[2][1];

      if (accessToken && userJson) {
        const user = JSON.parse(userJson) as User;
        const screen = getInitialScreen(user.role);

        set({
          accessToken,
          refreshToken,
          user,
          initialScreen: screen,
          isAuthenticated: true,
          isLoading: false, // ✅ Succès : fin du chargement
        });
      } else {
        set({ isLoading: false }); // ✅ Pas de données : fin du chargement
      }
    } catch (error) {
      console.error('Erreur chargement auth:', error);
      set({ isLoading: false }); // ✅ Erreur : on force la fin du chargement
    }
  },

  clearInitialScreen: () => {
    set({ initialScreen: null });
  },
}));