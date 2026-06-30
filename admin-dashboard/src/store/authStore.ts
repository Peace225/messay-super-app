import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  id: string;
  nom: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      login: (user) => {
        console.log("🔐 Store : Mise à jour de l'utilisateur", user);
        set({ user, isAuthenticated: true });
      },

      logout: () => {
        console.log("🔓 Store : Déconnexion");
        set({ user: null, isAuthenticated: false });
        localStorage.removeItem('messay-auth-storage'); // Nettoyage propre
      },
    }),
    {
      name: 'messay-auth-storage', // Nom de la clé dans le LocalStorage
      storage: createJSONStorage(() => localStorage),
    }
  )
);