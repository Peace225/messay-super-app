/**
 * MESSAY PRO — Activation sécurisée d'une invitation de gare.
 * Installer dans company-dashboard/src/pages/InvitationPage.tsx
 * Route PUBLIQUE : /invitation, hors de RequireCompanyAccess.
 *
 * - Identité : le client Supabase Auth partagé avec Login.
 * - Droits métier : exclusivement le backend /invitations/activate.
 * - Un lien Supabase expiré n'autorise jamais à activer avec une ancienne session.
 * - Un nouveau lien OTP n'est demandé que pour un utilisateur Auth existant.
 */
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { messayAuth } from '../lib/messaySupabaseAuth';
import { garesHierarchyApi } from '../services/garesManagementApi';

const UUID_PATTERN = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Messages MESSAY PRO : ne pas exposer le fournisseur d'identité à l'utilisateur. */
function getErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : '';
  const code = (error && typeof error === 'object' && 'code' in error)
    ? String(error.code ?? '') : '';

  const wait = raw.match(/(?:after|in)\s+(\d+)\s+seconds?/i);
  if (wait) {
    return `MESSAY PRO : veuillez patienter ${wait[1]} secondes avant de demander un autre lien.`;
  }
  if (/rate.?limit|too many requests|over_email_send_rate_limit|over_request_rate_limit/i.test(raw + code)) {
    return 'MESSAY PRO : trop de demandes de connexion. Veuillez réessayer plus tard.';
  }
  if (/otp_expired|expired|invalid token|token has expired/i.test(raw + code)) {
    return 'MESSAY PRO : ce lien de connexion est expiré ou a déjà été utilisé. Demandez un nouveau lien.';
  }
  if (/invalid login credentials/i.test(raw + code)) {
    return 'MESSAY PRO : la connexion a échoué. Vérifiez les informations du compte.';
  }
  if (/failed to fetch|networkerror|network request failed/i.test(raw + code)) {
    return 'MESSAY PRO : connexion indisponible. Vérifiez Internet et réessayez.';
  }
  // Les messages métier du backend (gare, rôle, invitation) sont conservés.
  if (raw && !/supabase|auth (api|error)|postgrest/i.test(raw)) return raw;
  return 'MESSAY PRO : impossible de terminer cette opération pour le moment.';
}

function getCooldownSeconds(error: unknown): number {
  const raw = error instanceof Error ? error.message : '';
  const match = raw.match(/(?:after|in)\s+(\d+)\s+seconds?/i);
  return match ? Math.min(3600, Number(match[1])) : 0;
}

/** Un lien invalide ne doit pas être accepté avec une ancienne session locale. */
function getAuthLinkIssue(search: string, fragment: string): 'expired' | 'invalid' | null {
  const hash = new URLSearchParams(fragment.replace(/^#/, ''));
  const query = new URLSearchParams(search);
  const code = hash.get('error_code') || query.get('error_code') || '';
  const error = hash.get('error') || query.get('error') || '';
  if (code === 'otp_expired') return 'expired';
  if (code || error) return 'invalid';
  return null;
}

export default function InvitationPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const invitationId = useMemo(
    () => new URLSearchParams(location.search).get('invitation_id')?.trim() ?? '',
    [location.search],
  );
  const authLinkIssue = useMemo(
    () => getAuthLinkIssue(location.search, location.hash),
    [location.search, location.hash],
  );
  const validInvitationId = UUID_PATTERN.test(invitationId);

  const [ready, setReady] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  // L'email est saisi par l'invité, jamais déduit d'une session de direction.
  const [recipientEmail, setRecipientEmail] = useState('');
  const [activated, setActivated] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const normalizedRecipient = recipientEmail.trim().toLowerCase();
  const validRecipient = EMAIL_PATTERN.test(normalizedRecipient) && normalizedRecipient.length <= 254;
  const sessionMatchesRecipient =
    Boolean(connectedEmail) &&
    validRecipient &&
    connectedEmail?.trim().toLowerCase() === normalizedRecipient;
  const wrongSession = Boolean(connectedEmail) && validRecipient && !sessionMatchesRecipient;

  useEffect(() => {
    if (!cooldownUntil) return;
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  useEffect(() => {
    let mounted = true;

    // detectSessionInUrl: true est configuré dans messaySupabaseAuth.ts.
    void messayAuth.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (!mounted) return;
        if (sessionError) {
          setError('MESSAY PRO : impossible de vérifier votre session. Ouvrez le dernier lien reçu par e-mail.');
        }
        setConnectedEmail(data.session?.user.email ?? null);
        setReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setError('MESSAY PRO : service de connexion indisponible. Réessayez.');
        setReady(true);
      });

    const { data: { subscription } } = messayAuth.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        setConnectedEmail(session?.user.email ?? null);
        if (!session) setActivated(false);
        setReady(true);
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function changeAccount() {
    setWorking(true);
    setError('');
    setNotice('');
    try {
      const { error: signOutError } = await messayAuth.auth.signOut();
      if (signOutError) throw signOutError;
      setConnectedEmail(null);
      setActivated(false);
      setNotice('Session fermée. Vous pouvez demander un lien au compte invité.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWorking(false);
    }
  }

  async function requestNewLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!validInvitationId) {
      setError('Identifiant d’invitation absent ou invalide. Demandez un nouveau lien à la direction.');
      return;
    }
    if (!validRecipient) {
      setError('Saisissez l’adresse email qui a reçu l’invitation.');
      return;
    }
    if (wrongSession) {
      setError('Un autre utilisateur est connecté. Cliquez sur « Changer de compte » avant de continuer.');
      return;
    }
    if (working || secondsLeft > 0) return;

    setWorking(true);
    try {
      const redirectTo = `${window.location.origin}/invitation?invitation_id=${encodeURIComponent(invitationId)}`;
      const { error: otpError } = await messayAuth.auth.signInWithOtp({
        email: normalizedRecipient,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: redirectTo,
        },
      });
      if (otpError) throw otpError;

      setCooldownUntil(Date.now() + 60_000);
      setSecondsLeft(60);
      setNotice(
        'Si cette adresse correspond au compte invité, un lien de connexion a été demandé. ' +
        'Ouvrez uniquement le dernier message reçu sur cet appareil.',
      );
    } catch (err) {
      const cooldown = getCooldownSeconds(err);
      if (cooldown > 0) {
        setCooldownUntil(Date.now() + cooldown * 1000);
        setSecondsLeft(cooldown);
      }
      setError(getErrorMessage(err));
    } finally {
      setWorking(false);
    }
  }

  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!validInvitationId) {
      setError('Lien d’invitation invalide ou incomplet.');
      return;
    }
    if (authLinkIssue) {
      setError('MESSAY PRO : ce lien de connexion est invalide ou expiré. Demandez un nouveau lien.');
      return;
    }
    if (!sessionMatchesRecipient) {
      setError('Le compte connecté doit correspondre exactement à l’email du destinataire invité.');
      return;
    }
    if (working) return;

    setWorking(true);
    try {
      // Vérification serveur de l'identité Supabase, pas seulement getSession().
      const { data, error: userError } = await messayAuth.auth.getUser();
      if (userError) throw userError;
      if (!data.user?.email || data.user.email.trim().toLowerCase() !== normalizedRecipient) {
        throw new Error('La session active ne correspond pas au destinataire de l’invitation.');
      }

      // Le backend valide auth_user_id, email, expiration, compagnie, gare,
      // rôle et unicité du chef; ne jamais attribuer de droits côté React.
      await garesHierarchyApi.activateInvitation(invitationId);
      setActivated(true);
      setNotice('Invitation activée. Choisissez maintenant un mot de passe privé.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWorking(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!activated || working) return;

    if (password.length < 12 || password.length > 128) {
      setError('Le mot de passe doit contenir entre 12 et 128 caractères.');
      return;
    }
    if (password !== confirmation) {
      setError('La confirmation ne correspond pas au mot de passe.');
      return;
    }

    setWorking(true);
    try {
      // Vérifier le rôle AVANT de changer le mot de passe, sans le déduire du formulaire.
      const access = await garesHierarchyApi.access();
      const allowedRoles = [
        'CHEF_GARE', 'AGENT_BILLETTERIE', 'AGENT_CAISSE',
        'AGENT_EMBARQUEMENT', 'AGENT_EXPLOITATION',
      ];
      if (!allowedRoles.includes(access.role) || !Array.isArray(access.gare_ids) || access.gare_ids.length === 0) {
        throw new Error('MESSAY PRO : votre accès à la gare n’a pas encore été confirmé.');
      }
      const { error: passwordError } = await messayAuth.auth.updateUser({ password });
      if (passwordError) throw passwordError;
      setPassword('');
      setConfirmation('');
      navigate(access.role === 'CHEF_GARE' ? '/chef-gare' : '/agent', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F6FA] px-4 py-10 text-[#101A34]">
      <div className="mx-auto w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-lg sm:p-10">
        <header className="mb-8 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-600 text-xl font-bold text-white">M</span>
          <div>
            <p className="text-xl font-extrabold">MESSAY <span className="text-orange-600">PRO</span></p>
            <p className="text-xs uppercase tracking-widest text-slate-500">Transport interurbain</p>
          </div>
        </header>

        <h1 className="text-2xl font-bold">Activation d’une invitation</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Activez votre accès personnel à votre gare. Les autorisations sont vérifiées par MESSAY PRO.
        </p>

        {!validInvitationId && (
          <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Lien d’invitation absent ou incomplet. Demandez un nouveau lien à la direction.
          </div>
        )}

        {validInvitationId && authLinkIssue && (
          <div role="alert" className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-bold">
              {authLinkIssue === 'expired' ? 'Lien de connexion expiré ou déjà utilisé' : 'Lien de connexion invalide'}
            </p>
            <p className="mt-1">
              L’invitation métier peut être encore en attente. Ce lien ne peut plus authentifier son destinataire.
              Demandez un nouveau lien, sans recréer votre compte ni la gare.
            </p>
          </div>
        )}

        {validInvitationId && !ready && (
          <p className="mt-6 text-sm text-slate-600">Vérification sécurisée de votre connexion…</p>
        )}

        {validInvitationId && ready && (
          <>
            <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm">
              <p className="font-semibold">Compte actuellement connecté</p>
              <p className="mt-1 break-words text-slate-600">
                {connectedEmail || 'Aucun compte connecté pour le moment'}
              </p>
              {connectedEmail && !activated && (
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void changeAccount()}
                  className="mt-3 font-semibold text-orange-700 underline disabled:opacity-50"
                >
                  Ce n’est pas le destinataire ? Changer de compte
                </button>
              )}
            </div>

            {error && (
              <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {error}
              </div>
            )}
            {notice && (
              <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                {notice}
              </div>
            )}

            {!activated && (
              <>
                <form onSubmit={(event) => void requestNewLink(event)} className="mt-6 space-y-3">
                  <label htmlFor="invited-email" className="block text-sm font-semibold">
                    Email du destinataire de l’invitation
                  </label>
                  <input
                    id="invited-email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    required
                    value={recipientEmail}
                    onChange={(event) => setRecipientEmail(event.target.value)}
                    placeholder="agent@compagnie.ci"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-orange-500 focus:outline-none"
                  />
                  {wrongSession && (
                    <p className="text-sm font-semibold text-amber-800">
                      Le compte actuellement connecté est différent. Déconnectez-le avant de poursuivre.
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={working || !validRecipient || wrongSession || secondsLeft > 0}
                    className="w-full rounded-xl border border-orange-500 px-5 py-3 text-sm font-bold text-orange-700 hover:bg-orange-50 disabled:opacity-50"
                  >
                    {working ? 'Envoi en cours…' : secondsLeft > 0 ? `Réessayer dans ${secondsLeft} s` : 'Recevoir un nouveau lien de connexion'}
                  </button>
                  <p className="text-xs text-slate-500">
                    Utilisez l’adresse du compte déjà invité. MESSAY PRO ne crée aucun nouveau compte à cette étape.
                  </p>
                </form>

                <form onSubmit={(event) => void activate(event)} className="mt-6 space-y-3">
                  <p className="text-sm text-slate-600">
                    Après avoir ouvert le nouveau lien reçu par email, confirmez l’adresse du destinataire ci-dessus.
                    Seul ce compte pourra accepter l’invitation.
                  </p>
                  <button
                    type="submit"
                    disabled={working || Boolean(authLinkIssue) || !sessionMatchesRecipient}
                    className="w-full rounded-xl bg-orange-600 px-5 py-3 font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {working ? 'Vérification…' : 'Accepter l’invitation'}
                  </button>
                </form>
              </>
            )}

            {activated && (
              <form onSubmit={(event) => void savePassword(event)} className="mt-6 space-y-4">
                <label className="block text-sm font-semibold">
                  Nouveau mot de passe
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal focus:border-orange-500 focus:outline-none"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Confirmer le mot de passe
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal focus:border-orange-500 focus:outline-none"
                  />
                </label>
                <button
                  type="submit"
                  disabled={working}
                  className="w-full rounded-xl bg-orange-600 px-5 py-3 font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {working ? 'Enregistrement…' : 'Définir mon mot de passe et accéder à ma gare'}
                </button>
              </form>
            )}
          </>
        )}

        <p className="mt-8 border-t border-slate-100 pt-5 text-center text-sm">
          <Link to="/login" className="font-semibold text-orange-700 hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </main>
  );
}
