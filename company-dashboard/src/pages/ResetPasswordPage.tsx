import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
} from 'lucide-react';
import { messayAuth } from '../lib/messaySupabaseAuth';

type Phase = 'verification' | 'pret' | 'invalide' | 'termine';

type RecoveryLink =
  | { type: 'token_hash'; value: string }
  | { type: 'redirection' }
  | { type: 'aucun' };

function lireLienRecuperation(): RecoveryLink {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  const tokenHash = query.get('token_hash');
  if (query.get('type') === 'recovery' && tokenHash) {
    return { type: 'token_hash', value: tokenHash };
  }

  // Lien implicite (fragment #...type=recovery) ou PKCE (?code=...).
  if (
    (hash.get('type') === 'recovery' && hash.has('access_token')) ||
    query.has('code')
  ) {
    return { type: 'redirection' };
  }

  return { type: 'aucun' };
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('verification');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [afficherMotDePasse, setAfficherMotDePasse] = useState(false);
  const [afficherConfirmation, setAfficherConfirmation] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    let actif = true;
    // Écouter l'événement avant de vérifier la session : Supabase peut
    // traiter les jetons de récupération pendant l'initialisation.
    const { data: { subscription } } = messayAuth.auth.onAuthStateChange(
      (event, session) => {
        if (actif && event === 'PASSWORD_RECOVERY' && session) {
          setErreur('');
          setPhase('pret');
        }
      },
    );

    const verifierLien = async () => {
      try {
        const query = new URLSearchParams(window.location.search);
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        if (query.has('error') || hash.has('error')) {
          throw new Error('Ce lien de récupération est invalide ou expiré.');
        }

        const lien = lireLienRecuperation();
        if (lien.type === 'token_hash') {
          const { error } = await messayAuth.auth.verifyOtp({
            token_hash: lien.value,
            type: 'recovery',
          });
          if (error) throw error;
          if (actif) setPhase('pret');
          return;
        }

        // getSession attend l'initialisation du client Supabase,
        // y compris l'échange PKCE automatique lorsqu'il est configuré.
        const { data, error } = await messayAuth.auth.getSession();
        if (error) throw error;
        if (!actif) return;

        if (lien.type === 'redirection' && data.session) {
          setPhase('pret');
        } else {
          // Ne jamais permettre un changement depuis une simple session
          // ordinaire ouverte directement sur /reset-password.
          setPhase((precedent) => precedent === 'pret' ? precedent : 'invalide');
        }
      } catch {
        if (actif) {
          setErreur('Le lien de récupération est invalide ou expiré. Demandez un nouveau lien.');
          setPhase('invalide');
        }
      }
    };

    void verifierLien();
    return () => {
      actif = false;
      subscription.unsubscribe();
    };
  }, []);

  async function changerMotDePasse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (envoi || phase !== 'pret') return;
    setErreur('');

    if (motDePasse.length < 8) {
      setErreur('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (motDePasse !== confirmation) {
      setErreur('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setEnvoi(true);
    try {
      const { data: { session } } = await messayAuth.auth.getSession();
      if (!session) throw new Error('Session de récupération expirée.');

      const { error } = await messayAuth.auth.updateUser({ password: motDePasse });
      if (error) throw error;

      setMotDePasse('');
      setConfirmation('');
      // Retirer les jetons du navigateur après l'utilisation du lien.
      window.history.replaceState({}, document.title, '/reset-password');
      setPhase('termine');
    } catch (cause) {
      setErreur(
        cause instanceof Error ? cause.message : 'Impossible de modifier le mot de passe.',
      );
    } finally {
      setEnvoi(false);
    }
  }

  async function retournerConnexion() {
    // Éviter que la session de récupération redirige automatiquement
    // l'utilisateur vers un tableau de bord sans nouvelle connexion.
    await messayAuth.auth.signOut({ scope: 'local' });
    navigate('/login', { replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-9">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-600 text-white">
            <KeyRound size={24} aria-hidden="true" />
          </div>
          <div>
            <p className="text-xl font-black tracking-tight text-slate-900">
              MESSAY <span className="text-orange-600">PRO</span>
            </p>
            <p className="text-xs font-semibold text-slate-500">Transport interurbain</p>
          </div>
        </div>

        <h1 className="text-2xl font-black text-slate-900">Nouveau mot de passe</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Sécurisez votre accès Direction, Chef de Gare ou Agent Billetterie.
        </p>

        {phase === 'verification' && (
          <div role="status" className="mt-7 flex items-center gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <Loader2 size={19} className="animate-spin" aria-hidden="true" />
            Vérification du lien de récupération…
          </div>
        )}

        {phase === 'invalide' && (
          <div className="mt-7 space-y-4">
            <div role="alert" className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle className="shrink-0" size={20} aria-hidden="true" />
              {erreur || 'Ce lien est invalide ou expiré. Demandez un nouveau lien depuis la page de connexion.'}
            </div>
            <Link
              to="/login"
              className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 font-bold text-white hover:bg-orange-700"
            >
              <ArrowLeft size={18} aria-hidden="true" /> Retour à la connexion
            </Link>
          </div>
        )}

        {phase === 'pret' && (
          <form onSubmit={(event) => void changerMotDePasse(event)} className="mt-7 space-y-5">
            <div>
              <label htmlFor="messay-nouveau-mdp" className="mb-2 block text-sm font-bold text-slate-700">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <LockKeyhole size={18} className="absolute left-4 top-3.5 text-slate-400" aria-hidden="true" />
                <input
                  id="messay-nouveau-mdp"
                  type={afficherMotDePasse ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={motDePasse}
                  onChange={(event) => setMotDePasse(event.target.value)}
                  placeholder="Au moins 8 caractères"
                  className="w-full rounded-xl border border-slate-200 px-11 py-3 text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
                <button
                  type="button"
                  aria-label={afficherMotDePasse ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  onClick={() => setAfficherMotDePasse((actuel) => !actuel)}
                  className="absolute right-3 top-3.5 text-slate-500"
                >
                  {afficherMotDePasse ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="messay-confirmation-mdp" className="mb-2 block text-sm font-bold text-slate-700">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <LockKeyhole size={18} className="absolute left-4 top-3.5 text-slate-400" aria-hidden="true" />
                <input
                  id="messay-confirmation-mdp"
                  type={afficherConfirmation ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder="Répétez le mot de passe"
                  className="w-full rounded-xl border border-slate-200 px-11 py-3 text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
                <button
                  type="button"
                  aria-label={afficherConfirmation ? 'Masquer la confirmation' : 'Afficher la confirmation'}
                  onClick={() => setAfficherConfirmation((actuel) => !actuel)}
                  className="absolute right-3 top-3.5 text-slate-500"
                >
                  {afficherConfirmation ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>

            {erreur && (
              <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <AlertCircle size={18} className="shrink-0" aria-hidden="true" />
                {erreur}
              </div>
            )}

            <button
              type="submit"
              disabled={envoi}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3.5 font-extrabold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {envoi && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
              {envoi ? 'Enregistrement…' : 'Enregistrer le nouveau mot de passe'}
            </button>
          </form>
        )}

        {phase === 'termine' && (
          <div className="mt-7 space-y-4">
            <div role="status" className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <CheckCircle2 size={22} className="shrink-0" aria-hidden="true" />
              Mot de passe modifié avec succès. Vous pouvez vous reconnecter.
            </div>
            <button
              type="button"
              onClick={() => void retournerConnexion()}
              className="w-full rounded-xl bg-orange-600 px-4 py-3 font-bold text-white hover:bg-orange-700"
            >
              Retour à la connexion
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
