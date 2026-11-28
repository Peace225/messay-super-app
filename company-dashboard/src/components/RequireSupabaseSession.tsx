import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { messayAuth } from '../lib/messaySupabaseAuth';

type Props = { children: ReactNode };
type SessionState = 'loading' | 'authenticated' | 'anonymous';

/** Protège les pages sans session. Les rôles restent contrôlés par le backend. */
export default function RequireSupabaseSession({ children }: Props) {
  const [state, setState] = useState<SessionState>('loading');

  useEffect(() => {
    let mounted = true;
    const { data: { subscription } } = messayAuth.auth.onAuthStateChange(
      (_event, session) => {
        if (mounted) setState(session ? 'authenticated' : 'anonymous');
      },
    );

    void messayAuth.auth.getSession()
      .then(({ data, error }) => {
        if (mounted) setState(!error && data.session ? 'authenticated' : 'anonymous');
      })
      .catch(() => { if (mounted) setState('anonymous'); });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm font-semibold text-slate-600">
        Vérification de votre session MESSAY PRO...
      </div>
    );
  }

  if (state === 'anonymous') return <Navigate to="/login" replace />;
  return <>{children}</>;
}
