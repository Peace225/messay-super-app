
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface AdminUser {
  id: string;
  nom: string;
  prenom?: string | null;
  email: string | null;
  telephone?: string | null;
  role: string;
}

interface AuthState {
  user: AdminUser | null;
  accessToken: string | null;

  isAuthenticated: boolean;
  hasHydrated: boolean;

  login: (user: AdminUser) => void;
  logout: () => void;
  finishHydration: () => void;
  getAccessToken: () => string | null;
}

const STORAGE_KEY = 'messay-auth-storage';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Lecture sécurisée des jetons existants.
 * Les jetons continuent d'être gérés par le service API.
 */
function readStoredTokens(): StoredTokens | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const accessToken = window.localStorage
      .getItem(ACCESS_TOKEN_KEY)
      ?.trim();

    const refreshToken = window.localStorage
      .getItem(REFRESH_TOKEN_KEY)
      ?.trim();

    if (!accessToken || !refreshToken) {
      return null;
    }

    return {
      accessToken,
      refreshToken,
    };
  } catch {
    return null;
  }
}

/**
 * Vérification locale de l'identité administrative.
 * Le serveur doit impérativement vérifier le JWT
 * et le rôle Prisma ADMIN pour chaque requête.
 */
function isAdminUser(user: AdminUser | null): user is AdminUser {
  return Boolean(
    user &&
    typeof user.id === 'string' &&
    user.id.length > 0 &&
    user.role === 'ADMIN'
  );
}

/**
 * Supprimer uniquement les informations
 * d'authentification MESSAY Admin.
 */
function clearStoredSession(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.localStorage.removeItem('user');
  } catch {
    console.warn(
      'MESSAY : nettoyage du stockage local impossible.'
    );
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,

      isAuthenticated: false,
      hasHydrated: false,

      /**
       * Connexion après authentification réussie
       * auprès du backend MESSAY.
       *
       * Le service de login doit enregistrer les jetons
       * avant d'appeler cette fonction.
       */
      login: (user: AdminUser) => {
        if (!isAdminUser(user)) {
          throw new Error(
            'Accès réservé aux administrateurs MESSAY.'
          );
        }

        const tokens = readStoredTokens();

        if (!tokens) {
          throw new Error(
            'Connexion incomplète : jetons JWT absents.'
          );
        }

        set({
          user,
          accessToken: tokens.accessToken,
          isAuthenticated: true,
          hasHydrated: true,
        });
      },

      /**
       * Déconnexion locale.
       */
      logout: () => {
        clearStoredSession();

        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          hasHydrated: true,
        });

        // Supprimer également l'ancien état persistant.
        try {
          useAuthStore.persist.clearStorage();
        } catch {
          console.warn(
            'MESSAY : nettoyage de la session persistante impossible.'
          );
        }
      },

      /**
       * Retourne le jeton courant.
       * Le service API peut renouveler le JWT sans devoir
       * réécrire le store Zustand.
       */
      getAccessToken: () => {
        const state = get();

        if (
          !state.isAuthenticated ||
          !isAdminUser(state.user)
        ) {
          return null;
        }

        return readStoredTokens()?.accessToken ?? null;
      },

      /**
       * Restauration après rechargement du navigateur.
       */
      finishHydration: () => {
        const savedUser = get().user;
        const tokens = readStoredTokens();

        const validLocalSession =
          isAdminUser(savedUser) && tokens !== null;

        set({
          user: validLocalSession ? savedUser : null,
          accessToken:
            validLocalSession ? tokens.accessToken : null,
          isAuthenticated: validLocalSession,
          hasHydrated: true,
        });
      },
    }),
    {
      name: STORAGE_KEY,

      storage: createJSONStorage(() => localStorage),

      /**
       * Ne jamais persister isAuthenticated,
       * hasHydrated ni une seconde copie des JWT.
       */
      partialize: (state) => ({
        user: state.user,
      }),

      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error(
            'MESSAY : restauration de session impossible.',
            error
          );
        }

        state?.finishHydration();
      },
    }
  )
);


/**
 * D10.3 — Synchronisation centralisée des sessions.
 *
 * Les JWT restent gérés par le service API.
 * Zustand conserve seulement le token courant en mémoire.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('messay:tokens-refreshed', () => {
    const state = useAuthStore.getState();
    const tokens = readStoredTokens();

    if (
      state.isAuthenticated &&
      isAdminUser(state.user) &&
      tokens
    ) {
      useAuthStore.setState({
        accessToken: tokens.accessToken,
      });
    }
  });

  window.addEventListener('messay:session-expired', () => {
    // L'événement est envoyé uniquement après un rejet
    // explicite du refresh token de cette session.
    useAuthStore.getState().logout();
  });
}
