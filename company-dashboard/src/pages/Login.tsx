import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BusFront,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { messayAuth } from '../lib/messaySupabaseAuth';
import {
  garesHierarchyApi,
  type GareAccessRole,
} from '../services/garesManagementApi';

// Les permissions réelles sont toujours vérifiées par le backend.
const ROLES_AUTORISES = new Set<GareAccessRole>([
  'DIRECTION',
  'CHEF_GARE',
  'AGENT_BILLETTERIE',
  'AGENT_CAISSE',
  'AGENT_EMBARQUEMENT',
  'AGENT_EXPLOITATION',
]);

type Mode = 'connexion' | 'recuperation';

function accueilPourRole(role: GareAccessRole): string {
  if (role === 'DIRECTION') return '/';
  if (role === 'CHEF_GARE') return '/chef-gare';
  return '/agent';
}

function messageErreur(caught: unknown): string {
  if (!(caught instanceof Error)) {
    return 'Opération impossible. Veuillez réessayer.';
  }

  const message = caught.message.trim();
  if (/invalid login credentials/i.test(message)) {
    return 'Email ou mot de passe incorrect.';
  }
  if (/email not confirmed/i.test(message)) {
    return 'Confirmez votre adresse email avant de vous connecter.';
  }
  if (/too many requests|rate limit|over_email_send_rate_limit/i.test(message)) {
    return 'Trop de tentatives. Veuillez réessayer plus tard.';
  }
  return message || 'Opération impossible. Veuillez réessayer.';
}

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('connexion');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);

  useEffect(() => {
    let active = true;
    void messayAuth.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (active) setSessionActive(!sessionError && Boolean(data.session));
      })
      .catch(() => {
        if (active) setSessionActive(false);
      });

    const { data: { subscription } } = messayAuth.auth.onAuthStateChange(
      (_event, session) => {
        if (active) setSessionActive(Boolean(session));
      },
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function verifierAccesEtNaviguer() {
    const { data, error: sessionError } = await messayAuth.auth.getSession();
    if (sessionError || !data.session?.access_token) {
      setSessionActive(false);
      throw new Error('Session absente ou expirée. Reconnectez-vous à MESSAY PRO.');
    }
    setSessionActive(true);

    // Le backend, et non le formulaire, décide du rôle et des gares autorisées.
    const access = await garesHierarchyApi.access();
    if (
      !access ||
      typeof access.company_id !== 'string' ||
      !access.company_id.trim() ||
      !ROLES_AUTORISES.has(access.role) ||
      !Array.isArray(access.gare_ids) ||
      access.gare_ids.some((id) => typeof id !== 'string' || !id.trim()) ||
      (access.role !== 'DIRECTION' && access.gare_ids.length === 0)
    ) {
      throw new Error('Droits compagnie ou gare incomplets. Contactez la Direction MESSAY.');
    }

    navigate(accueilPourRole(access.role), { replace: true });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const emailNormalise = email.trim().toLowerCase();
    if (!emailNormalise || !password) {
      setError('Renseignez votre email professionnel et votre mot de passe.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data, error: authError } = await messayAuth.auth.signInWithPassword({
        email: emailNormalise,
        password,
      });
      if (authError) throw authError;
      if (!data.session?.access_token || !data.user) {
        throw new Error('Supabase n’a pas créé de session. Réessayez.');
      }

      setSessionActive(true);
      setPassword('');
      await verifierAccesEtNaviguer();
    } catch (caught) {
      // Une session peut être valide même si l'accès métier est refusé.
      setError(messageErreur(caught));
    } finally {
      setLoading(false);
    }
  }

  async function handleContinue() {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      await verifierAccesEtNaviguer();
    } catch (caught) {
      setError(messageErreur(caught));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const { error: authError } = await messayAuth.auth.signOut();
      if (authError) throw authError;
      setSessionActive(false);
      setPassword('');
    } catch (caught) {
      setError(messageErreur(caught));
    } finally {
      setLoading(false);
    }
  }

  async function handleRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const emailNormalise = email.trim().toLowerCase();
    if (!emailNormalise) {
      setError('Saisissez l’adresse email du compte à récupérer.');
      return;
    }

    setLoading(true);
    setError('');
    setRecoverySent(false);
    try {
      const { error: resetError } = await messayAuth.auth.resetPasswordForEmail(
        emailNormalise,
        { redirectTo: `${window.location.origin}/reset-password` },
      );
      if (resetError) throw resetError;

      // Même message que l'adresse existe ou non, pour éviter l'énumération.
      setRecoverySent(true);
    } catch (caught) {
      setError(messageErreur(caught));
    } finally {
      setLoading(false);
    }
  }

  function changerMode(nouveauMode: Mode) {
    setMode(nouveauMode);
    setError('');
    setRecoverySent(false);
    setPassword('');
    setShowPassword(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950 p-4">
      <div className="w-full max-w-md rounded-[28px] border border-slate-100 bg-white p-6 shadow-2xl sm:p-9">
        <div className="mb-7 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 text-white">
            <BusFront size={26} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">
              MESSAY PRO
            </h1>
            <p className="text-xs font-semibold text-orange-600">Transport interurbain</p>
          </div>
        </div>

        <h2 className="text-xl font-extrabold text-slate-900">
          {mode === 'connexion' ? 'Connexion à votre espace' : 'Mot de passe oublié ?'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {mode === 'connexion'
            ? 'Direction, chefs de gare et agents autorisés.'
            : 'Recevez un lien sécurisé pour définir un nouveau mot de passe.'}
        </p>

        {mode === 'connexion' && sessionActive && (
          <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <div className="flex items-start gap-2">
              <ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>
                Une session Supabase est active. Vos droits doivent encore être
                confirmés par le serveur.
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleContinue()}
                className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                Vérifier mes accès
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleSignOut()}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-800 disabled:opacity-50"
              >
                <LogOut size={14} aria-hidden="true" /> Se déconnecter
              </button>
            </div>
          </div>
        )}

        {mode === 'connexion' ? (
          <form className="mt-6 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <label className="block text-sm font-bold text-slate-700">
              <span className="mb-2 flex items-center gap-2">
                <Mail size={16} aria-hidden="true" /> Email professionnel
              </span>
              <input
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                type="email"
                autoComplete="username"
                required
                disabled={loading}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nom@compagnie.com"
              />
            </label>

            <div>
              <label htmlFor="messay-login-password" className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                <LockKeyhole size={16} aria-hidden="true" /> Mot de passe
              </label>
              <div className="relative">
                <input
                  id="messay-login-password"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-12 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Votre mot de passe"
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-orange-600 disabled:opacity-50"
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>

            <div className="text-right">
              <button
                type="button"
                disabled={loading}
                onClick={() => changerMode('recuperation')}
                className="text-sm font-bold text-orange-600 hover:underline disabled:opacity-50"
              >
                Mot de passe oublié ?
              </button>
            </div>

            {error && (
              <p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 size={19} className="animate-spin" /> : <LogIn size={19} />}
              {loading ? 'Vérification…' : 'Se connecter'}
            </button>
          </form>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={(event) => void handleRecovery(event)}>
            <label className="block text-sm font-bold text-slate-700">
              <span className="mb-2 flex items-center gap-2">
                <Mail size={16} aria-hidden="true" /> Email du compte
              </span>
              <input
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                type="email"
                autoComplete="email"
                required
                disabled={loading}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nom@compagnie.com"
              />
            </label>

            {recoverySent && (
              <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                Si un compte existe à cette adresse, un lien de récupération lui sera envoyé.
                Vérifiez aussi les courriers indésirables.
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 size={19} className="animate-spin" /> : <KeyRound size={19} />}
              {loading ? 'Envoi…' : 'Recevoir un lien de récupération'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => changerMode('connexion')}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <ArrowLeft size={17} aria-hidden="true" /> Retour à la connexion
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs leading-5 text-slate-500">
          {mode === 'connexion'
            ? 'Votre compte doit être autorisé pour votre compagnie ou votre gare. Les accès sont vérifiés côté serveur.'
            : 'Utilisez l’email associé au compte existant. Aucun nouveau compte n’est créé.'}
        </p>
      </div>
    </main>
  );
}
