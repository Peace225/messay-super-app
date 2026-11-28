import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Shield } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import logoMessay from '../assets/logo.png';

/**
 * MESSAY — connexion au Dashboard Administrateur.
 *
 * Contrat backend : POST /api/auth/login retourne
 * { user, accessToken, refreshToken }.
 * Les contrôles de rôle côté serveur restent indispensables.
 */
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && user?.role === 'ADMIN') {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, user?.role, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setError('');
    setLoading(true);

    try {
      const response = await authService.login({
        email: email.trim().toLowerCase(),
        password,
      });

      const admin = response.user;
      if (!admin || admin.role !== 'ADMIN') {
        throw new Error('Accès réservé aux administrateurs MESSAY.');
      }

      if (
        typeof response.accessToken !== 'string' ||
        !response.accessToken.trim() ||
        typeof response.refreshToken !== 'string' ||
        !response.refreshToken.trim()
      ) {
        throw new Error('Réponse de connexion incomplète : jetons JWT absents.');
      }

      // Clés attendues par les modules Socket.IO du Dashboard MESSAY.
      // Vérifier qu'elles sont identiques à celles utilisées dans services/api.ts
      // et store/authStore.ts avant le déploiement.
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('refreshToken', response.refreshToken);

      // Conserve la signature existante du store : login(user).
      await Promise.resolve(login(admin));
      navigate('/', { replace: true });
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const apiError = err.response?.data as
          | { error?: string; message?: string }
          | undefined;

        if (err.response?.status === 401) {
          setError('Adresse e-mail ou mot de passe incorrect.');
        } else if (err.response?.status === 403) {
          setError('Ce compte ne dispose pas des autorisations nécessaires.');
        } else {
          setError(
            apiError?.error ||
              apiError?.message ||
              (err.response
                ? 'La connexion administrateur a échoué.'
                : 'Serveur inaccessible. Vérifie le backend MESSAY.'),
          );
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Une erreur inattendue est survenue.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050507] relative overflow-hidden flex items-center justify-center p-4">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.08] via-transparent to-violet-500/[0.05]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-orange-500/10 rounded-full blur-[120px]" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="flex flex-col items-center mb-10">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-orange-500 blur-3xl opacity-25 rounded-full" />
            <img
              src={logoMessay}
              alt="MESSAY"
              className="relative h-20 w-auto object-contain drop-shadow-2xl"
            />
          </div>
          <h1 className="text-[28px] font-black tracking-tight text-white">
            MESSAY<span className="text-orange-500">.</span>
          </h1>
          <p className="text-white/40 text-[13px] mt-1">
            Admin Console • Abidjan
          </p>
        </div>

        <div className="relative overflow-hidden rounded-[32px] bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] shadow-2xl">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
          <div className="p-8">
            <div className="mb-8">
              <h2 className="text-[22px] font-bold text-white">
                Connexion sécurisée
              </h2>
              <p className="text-white/40 text-[13px] mt-1">
                Accédez à votre tableau de bord
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 p-3 flex gap-3"
              >
                <Shield size={16} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-[13px] text-red-300">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="admin-email"
                  className="block text-[11px] font-bold text-white/50 uppercase tracking-widest mb-2"
                >
                  Email
                </label>
                <div className="relative group">
                  <Mail
                    aria-hidden="true"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-orange-400"
                    size={18}
                  />
                  <input
                    id="admin-email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="admin@messay.ci"
                    className="w-full h-12 pl-11 pr-4 bg-white/[0.03] border border-white/10 rounded-2xl text-white placeholder-white/25 outline-none focus:border-orange-500/50 focus:bg-white/[0.05]"
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="block text-[11px] font-bold text-white/50 uppercase tracking-widest mb-2"
                >
                  Mot de passe
                </label>
                <div className="relative group">
                  <Lock
                    aria-hidden="true"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-orange-400"
                    size={18}
                  />
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-12 bg-white/[0.03] border border-white/10 rounded-2xl text-white placeholder-white/25 outline-none focus:border-orange-500/50 focus:bg-white/[0.05]"
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 mt-2 bg-white text-black font-bold rounded-2xl hover:bg-orange-500 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    <span>Connexion...</span>
                  </>
                ) : (
                  <>
                    <span>Se connecter</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
