/**
 * MESSAY E3.2 - page d'embarquement Dashboard Compagnie.
 * Safe by default: feature flag client; server flag and SQL auth also mandatory.
 * Preview happens on scan. Boarding is NEVER triggered without an explicit click.
 * This page is NOT mounted automatically in App.tsx by the installer.
 */
import { useCallback, useEffect, useState } from 'react';
import MessayQrScanner from '../../components/MessayQrScanner';
import { messayAuth } from '../../lib/messaySupabaseAuth';
import { garesHierarchyApi, type GareAccessContext } from '../../services/garesManagementApi';

type Preview = { billetId: string; passager: string; dateDepart: string; statut: 'PAYE' | 'UTILISE'; validationPossible: boolean };
type ScanResponse = { resultat?: string; code?: string; embarqueLe?: string };

const rawBase = String(import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || '').trim();
const root = rawBase.replace(/\/+$/, '').replace(/\/api\/company-dashboard$/, '').replace(/\/api$/, '');
const apiUrl = (path: string) => `${root}/api/company-dashboard${path}`;

async function postSecure(path: string, data: unknown): Promise<{ status: number; payload: unknown }> {
  const { data: auth, error } = await messayAuth.auth.getSession();
  if (error || !auth.session?.access_token) throw new Error('Session expirée : reconnectez-vous.');
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.session.access_token}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(data),
  });
  let payload: unknown;
  try { payload = await response.json(); } catch { payload = null; }
  return { status: response.status, payload };
}

export default function MessayEmbarquementPage() {
  const [access, setAccess] = useState<GareAccessContext | null>(null);
  const [gareId, setGareId] = useState('');
  const [qrPayload, setQrPayload] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Sélectionnez votre gare, puis scannez le billet.');
  const enabled = import.meta.env.VITE_MESSAY_EMBARQUEMENT_ENABLED === 'true';

  useEffect(() => {
    let active = true;
    void garesHierarchyApi.access().then(result => {
      if (!active) return;
      setAccess(result);
      setGareId(result.gare_ids[0] || '');
    }).catch(() => { if (active) setMessage('Impossible de vérifier vos permissions de gare.'); });
    return () => { active = false; };
  }, []);

  const onScan = useCallback(async (value: string) => {
    setPreview(null); setQrPayload('');
    if (!gareId) { setMessage('Gare non sélectionnée.'); return; }
    setBusy(true);
    try {
      const response = await postSecure('/embarquement/controle', { qrPayload: value, gareId });
      if (response.status !== 200) {
        setMessage(response.status === 401 ? 'Session expirée.' : response.status === 403 ? 'Gare ou rôle interdit.' : 'Billet indisponible ou module désactivé.');
        return;
      }
      const p = response.payload as Partial<Preview> | null;
      if (!p || typeof p.billetId !== 'string' || typeof p.passager !== 'string' ||
          typeof p.dateDepart !== 'string' || (p.statut !== 'PAYE' && p.statut !== 'UTILISE') ||
          typeof p.validationPossible !== 'boolean') {
        setMessage('Réponse de contrôle invalide.'); return;
      }
      setPreview(p as Preview); setQrPayload(value);
      setMessage(p.statut === 'UTILISE' ? 'Billet déjà utilisé.' : 'Billet trouvé : contrôle serveur effectué, pas encore embarqué.');
    } catch { setMessage('Contrôle serveur indisponible. Aucun embarquement enregistré.'); }
    finally { setBusy(false); }
  }, [gareId]);

  async function confirmer() {
    if (!preview || preview.statut !== 'PAYE' || !preview.validationPossible || !qrPayload || !gareId) return;
    if (!window.confirm('Confirmer maintenant l’embarquement de ce passager ? Cette action est définitive.')) return;
    setBusy(true);
    try {
      const response = await postSecure('/embarquement/confirmer', { qrPayload, gareId });
      const payload = response.payload as ScanResponse | null;
      if (response.status === 200 && payload?.resultat === 'EMBARQUEMENT_VALIDE') {
        setPreview({ ...preview, statut: 'UTILISE', validationPossible: false });
        setMessage('Embarquement enregistré et audité. Ce billet ne pourra pas être validé une seconde fois.');
      } else if (response.status === 409 && payload?.code === 'DEJA_UTILISE') {
        setPreview({ ...preview, statut: 'UTILISE', validationPossible: false });
        setMessage('Billet déjà utilisé. Aucun second embarquement créé.');
      } else {
        setMessage('Validation refusée ou indisponible. Vérifiez le billet auprès du responsable.');
      }
    } catch { setMessage('Erreur de connexion. Résultat incertain : re-scanner pour vérifier avant de réessayer.'); }
    finally { setBusy(false); }
  }

  if (!enabled) return <p role="status">Le contrôle d’embarquement MESSAY n’est pas activé sur cet environnement.</p>;
  if (!access || !['DIRECTION','CHEF_GARE','AGENT_EMBARQUEMENT'].includes(access.role)) {
    return <p role="status">Accès en cours de vérification ou rôle non autorisé.</p>;
  }
  return (
    <main className="mx-auto max-w-3xl space-y-5 p-5">
      <h1 className="text-2xl font-bold">Contrôle d’embarquement MESSAY</h1>
      <p>La lecture du QR n’embarque jamais automatiquement un voyageur.</p>
      <label className="block font-semibold" htmlFor="gare-embarquement">Gare de contrôle</label>
      {access.role === 'DIRECTION' ? (
        <input id="gare-embarquement" className="rounded border p-2" placeholder="ID de la gare (UUID)" value={gareId}
          onChange={e => { setGareId(e.target.value); setPreview(null); }} />
      ) : (
        <select id="gare-embarquement" className="rounded border p-2" value={gareId}
          onChange={e => { setGareId(e.target.value); setPreview(null); }}>
          {access.gare_ids.map(id => <option key={id} value={id}>{id}</option>)}
        </select>
      )}
      <MessayQrScanner onScan={onScan} disabled={busy || !gareId} />
      <p role="status" className="rounded bg-slate-100 p-3">{message}</p>
      {preview && <section className="space-y-3 rounded border bg-white p-4">
        <h2 className="font-bold">Billet contrôlé</h2>
        <p>Voyageur : {preview.passager}</p>
        <p>Départ : {preview.dateDepart}</p>
        <p>Statut : {preview.statut === 'PAYE' ? 'Payé — non embarqué' : 'Déjà utilisé'}</p>
        <button type="button" onClick={() => { void confirmer(); }}
          disabled={busy || !preview.validationPossible || preview.statut !== 'PAYE'}
          className="rounded bg-emerald-700 px-4 py-3 font-bold text-white disabled:opacity-40">
          Confirmer l’embarquement
        </button>
      </section>}
    </main>
  );
}
