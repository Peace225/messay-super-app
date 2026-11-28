import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { messayAuth } from '../lib/messaySupabaseAuth';
import { garesHierarchyApi } from '../services/garesManagementApi';

/** Supabase doit rediriger vers /invitation?invitation_id=UUID après l'email. */
export default function InvitationMessay() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const invitationId = new URLSearchParams(window.location.search).get('invitation_id');
  useEffect(() => {
    let mounted = true;
    void messayAuth.auth.getSession().then(({data}) => { if (mounted) setReady(!!data.session); });
    const {data:{subscription}} = messayAuth.auth.onAuthStateChange((_event, session) => {
      if (mounted) setReady(!!session);
    });
    return () => {mounted = false; subscription.unsubscribe();};
  }, []);
  const activate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!invitationId || !ready || loading) return;
    if (password.length < 12) {setError('Utilisez au moins 12 caractères pour votre mot de passe.'); return;}
    setLoading(true);setError('');
    try {
      const result = await messayAuth.auth.updateUser({password});
      if (result.error) throw result.error;
      await garesHierarchyApi.activateInvitation(invitationId);
      navigate('/gares', {replace:true});
    } catch (err) {setError(err instanceof Error ? err.message : 'Activation impossible.');}
    finally {setLoading(false);}
  };
  return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4"><form onSubmit={activate} className="w-full max-w-md space-y-4 rounded-3xl bg-white p-8 shadow-xl">
    <h1 className="text-2xl font-black text-slate-900">Activer votre accès MESSAY</h1>
    {!invitationId && <p role="alert" className="text-red-600">Lien d'invitation incomplet. Demandez un nouvel email.</p>}
    {!ready && <p className="text-sm text-amber-700">Ouvrez le lien de votre email d'invitation pour vérifier votre identité Supabase Auth.</p>}
    <label className="block text-sm font-semibold">Votre mot de passe personnel<input type="password" autoComplete="new-password" required minLength={12} value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3"/></label>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <button disabled={!invitationId || !ready || loading} className="w-full rounded-xl bg-orange-500 p-3 font-bold text-white disabled:opacity-50">{loading?'Activation…':'Activer mon compte'}</button>
  </form></div>;
}
