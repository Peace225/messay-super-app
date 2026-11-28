/// <reference types="vite/client" />
/**
 * MESSAY — modules du tableau de bord administrateur.
 * Périmètre : transport par tricycle et billetterie interurbaine.
 *
 * Sources réelles déjà exposées par le backend :
 * - Socket.IO (JWT ADMIN) : tricycles:get-all -> tricycles:list
 * - Socket.IO (JWT ADMIN) : tickets:get-today -> tickets:list
 * - GET /api/finance/stats et GET /api/finance/transactions
 *
 * L'API de création administrative des conducteurs et la liste exhaustive
 * des utilisateurs connectés ne sont pas documentées ici : aucune donnée
 * fictive et aucune création simulée ne sont proposées.
 */

import { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import { io } from 'socket.io-client';
import {
  AlertCircle,
  Bike,
  BusFront,
  CircleDollarSign,
  Download,
  MapPin,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';

// À configurer dans admin-dashboard/.env.local pour un backend local.
const API_URL = (
  import.meta.env.VITE_API_URL?.trim() || 'https://messay-api.onrender.com/api'
).replace(/\/+$/, '');
const SOCKET_URL = (
  import.meta.env.VITE_SOCKET_URL?.trim() || API_URL.replace(/\/api$/, '')
).replace(/\/+$/, '');

const POLL_MS = 30_000;

type ModuleProps = { accessToken?: string };
type ActionProps = ModuleProps & { onRegisterDriver?: () => void };

type Tricycle = {
  id: string;
  immatriculation: string;
  chauffeur?: string;
  chauffeurTel?: string;
  status: string;
  batterie?: number | null;
  vitesse?: number | null;
  position?: { lat?: number | null; lng?: number | null } | null;
  derniereActivite?: string | null;
  coursesAujourdhui?: number | null;
  modele?: string | null;
};

type Ticket = {
  id: string;
  compagnie: string;
  passager: string;
  telephone?: string;
  trajet: string;
  date: string; // date de DÉPART, pas date d'achat
  heure: string;
  prix: number;
  siege?: string | null;
  paiement?: string | null;
  statut: string;
  gareDepart?: string | null;
  gareArrivee?: string | null;
};

type FinanceStats = {
  revenuTotal: number;
  revenuJour: number;
  depenses: number;
  benefice: number;
  totalCourses: number;
  chauffeursActifs: number;
  flotteActive: number;
  flotteTotal: number;
  maintenance: number;
  ticketsJour: number;
  alertes: number;
  note?: string;
};

type FinanceTransaction = {
  id: string;
  type: string;
  montant: number;
  createdAt?: string;
  motif?: string | null;
  statut?: string;
};

type RemoteState<T> = {
  items: T[];
  connected: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

function tokenFromStorage(provided?: string): string | null {
  if (provided?.trim()) return provided.trim();
  if (typeof window === 'undefined') return null;

  // Compatibilité avec les stockages courants. Préférer le passage explicite
  // de accessToken depuis le store ADMIN si son format est différent.
  const keys = [
    'accessToken', 'token', 'authToken', 'messay-admin-auth',
    'admin-auth-storage', 'auth-storage',
  ];
  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    if (raw.startsWith('eyJ')) return raw;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        const state = obj.state && typeof obj.state === 'object'
          ? (obj.state as Record<string, unknown>) : obj;
        for (const field of ['accessToken', 'token']) {
          const value = state[field];
          if (typeof value === 'string' && value.trim()) return value.trim();
        }
      }
    } catch {
      // Cette clé n'est pas un objet JSON.
    }
  }
  return null;
}

function useAdminSocketList<T>(
  requestEvent: string,
  responseEvent: string,
  providedToken?: string,
): RemoteState<T> {
  const [items, setItems] = useState<T[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshId, setRefreshId] = useState(0);
  const refresh = useCallback(() => setRefreshId(value => value + 1), []);

  useEffect(() => {
    const token = tokenFromStorage(providedToken);
    if (!token) {
      setLoading(false);
      setError('Session administrateur introuvable : connectez-vous ou transmettez accessToken au module.');
      setConnected(false);
      return;
    }

    setLoading(true);
    setError(null);
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      timeout: 12_000,
    });

    const request = () => {
      if (socket.connected) socket.emit(requestEvent);
    };
    const onConnect = () => {
      setConnected(true);
      setError(null);
      socket.emit('join-admin-panel');
      request();
    };
    const onDisconnect = () => setConnected(false);
    const onError = (err: Error) => {
      setConnected(false);
      setLoading(false);
      setError(err.message || 'Connexion Socket.IO impossible.');
    };
    const onList = (payload: unknown) => {
      if (!Array.isArray(payload)) {
        setError('Réponse du serveur inattendue.');
        setLoading(false);
        return;
      }
      setItems(payload as T[]);
      setLoading(false);
      setError(null);
    };
    const onServerError = (payload: { message?: string }) => {
      setError(payload?.message || 'Le serveur a signalé une erreur.');
      setLoading(false);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);
    socket.on(responseEvent, onList);
    socket.on('server:error', onServerError);
    // Les endpoints fournissent des instantanés, pas un flux GPS admin.
    const interval = window.setInterval(request, POLL_MS);

    return () => {
      window.clearInterval(interval);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onError);
      socket.off(responseEvent, onList);
      socket.off('server:error', onServerError);
      socket.disconnect();
    };
  }, [requestEvent, responseEvent, providedToken, refreshId]);

  return { items, connected, loading, error, refresh };
}

function formatAmount(amount: unknown): string {
  return typeof amount === 'number' && Number.isFinite(amount)
    ? `${amount.toLocaleString('fr-FR')} FCFA`
    : '—';
}
function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fr-FR');
}
function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR');
}
function exportCsv(filename: string, columns: string[], rows: unknown[][]): void {
  const escapeCell = (cell: unknown) => {
    const raw = String(cell ?? '');
    // Empêche l'exécution de formules dans les tableurs.
    const safe = /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const content = [columns, ...rows].map(row => row.map(escapeCell).join(';')).join('\r\n');
  const blob = new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const Alert: FC<{ message: string }> = ({ message }) => (
  <div role="alert" className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
    <AlertCircle size={18} className="shrink-0 mt-0.5" />
    <span>{message}</span>
  </div>
);

const Empty: FC<{ label: string }> = ({ label }) => (
  <div className="rounded-xl border border-dashed border-gray-200 p-8 text-sm text-gray-500 text-center">
    {label}
  </div>
);

const Status: FC<{ connected: boolean }> = ({ connected }) => (
  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
    {connected ? 'API connectée' : 'API déconnectée'}
  </span>
);

// ============================================================================
// 1. LOGISTIQUE : TRICYCLES (état réel de la flotte, rafraîchi toutes les 30 s)
// ============================================================================
export const TricyclesModule: FC<ModuleProps> = ({ accessToken }) => {
  const { items, connected, loading, error, refresh } = useAdminSocketList<Tricycle>(
    'tricycles:get-all', 'tricycles:list', accessToken,
  );
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => items.filter(item =>
    `${item.immatriculation} ${item.chauffeur ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  ), [items, search]);
  const disponibles = items.filter(item => item.status === 'DISPONIBLE').length;
  const enMouvement = items.filter(item => typeof item.vitesse === 'number' && item.vitesse > 0).length;

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex gap-2 items-center"><Bike size={22} /> Flotte de tricycles</h2>
          <p className="text-sm text-gray-500">Instantané du backend, actualisation toutes les 30 secondes (100 véhicules maximum).</p>
        </div>
        <div className="flex items-center gap-2"><Status connected={connected} /><button type="button" onClick={refresh} className="px-3 py-2 rounded-xl border text-sm hover:bg-gray-50">Actualiser</button></div>
      </header>
      {error && <Alert message={error} />}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          ['Tricycles chargés', items.length],
          ['Disponibles', disponibles],
          ['Vitesse > 0 km/h', enMouvement],
        ].map(([label, value]) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-black text-gray-900 mt-1">{loading ? '…' : value}</p>
          </div>
        ))}
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <label className="flex gap-2 items-center bg-gray-50 rounded-xl px-3 py-2 max-w-md">
          <Search size={18} className="text-gray-400" />
          <input aria-label="Rechercher un tricycle" value={search} onChange={event => setSearch(event.target.value)} placeholder="Immatriculation ou conducteur" className="bg-transparent outline-none w-full text-sm" />
        </label>
        {loading ? <Empty label="Chargement de la flotte…" /> : filtered.length === 0 ? <Empty label="Aucun tricycle retourné par le backend." /> : (
          <div className="overflow-x-auto mt-4">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500"><tr><th className="p-3">Immatriculation</th><th className="p-3">Conducteur</th><th className="p-3">Statut</th><th className="p-3">Vitesse</th><th className="p-3">Position GPS</th><th className="p-3">Dernière activité</th></tr></thead>
              <tbody className="divide-y divide-gray-100">{filtered.map(item => (
                <tr key={item.id}>
                  <td className="p-3 font-semibold">{item.immatriculation}</td>
                  <td className="p-3">{item.chauffeur || 'Non assigné'}</td>
                  <td className="p-3">{item.status}</td>
                  <td className="p-3">{typeof item.vitesse === 'number' ? `${item.vitesse} km/h` : '—'}</td>
                  <td className="p-3">{typeof item.position?.lat === 'number' && typeof item.position?.lng === 'number'
                    ? <span className="inline-flex gap-1 items-center"><MapPin size={13} /> {item.position.lat.toFixed(4)}, {item.position.lng.toFixed(4)}</span> : '—'}</td>
                  <td className="p-3">{formatDateTime(item.derniereActivite)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500">« En mouvement » est estimé à partir de la dernière vitesse enregistrée. Le serveur ne diffuse pas encore de flux GPS global en direct aux administrateurs.</p>
    </section>
  );
};

// ============================================================================
// 2. LOGISTIQUE : BILLETS INTERURBAINS (reçus du backend)
// ============================================================================
export const BusTicketsModule: FC<ModuleProps> = ({ accessToken }) => {
  const { items, connected, loading, error, refresh } = useAdminSocketList<Ticket>(
    'tickets:get-today', 'tickets:list', accessToken,
  );
  const [company, setCompany] = useState('TOUTES');
  const companies = useMemo(() => Array.from(new Set(items.map(t => t.compagnie).filter(Boolean))).sort(), [items]);
  const filtered = company === 'TOUTES' ? items : items.filter(item => item.compagnie === company);
  const paid = filtered.filter(item => item.statut === 'PAYE');

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><BusFront size={22} /> Billetterie interurbaine</h2>
          <p className="text-sm text-gray-500">Billets enregistrés depuis minuit UTC, limités aux 100 plus récents.</p>
        </div>
        <div className="flex items-center gap-2"><Status connected={connected} /><button type="button" onClick={refresh} className="px-3 py-2 rounded-xl border text-sm hover:bg-gray-50">Actualiser</button></div>
      </header>
      {error && <Alert message={error} />}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          ['Billets chargés', filtered.length],
          ['Billets payés', paid.length],
          ['Montant des billets payés', formatAmount(paid.reduce((sum, ticket) => sum + (Number(ticket.prix) || 0), 0))],
        ].map(([label, value]) => <div key={label} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm"><p className="text-sm text-gray-500">{label}</p><p className="font-black text-xl mt-1">{loading ? '…' : value}</p></div>)}
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap gap-3 justify-between items-center">
          <label className="text-sm">Compagnie :{' '}
            <select aria-label="Filtrer par compagnie" value={company} onChange={e => setCompany(e.target.value)} className="rounded-lg border p-2">
              <option value="TOUTES">Toutes</option>
              {companies.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <button type="button" disabled={filtered.length === 0} onClick={() => exportCsv('messay-billets.csv',
            ['Compagnie', 'Passager', 'Téléphone', 'Trajet', 'Date de départ', 'Heure de départ', 'Siège', 'Prix FCFA', 'Statut', 'Paiement'],
            filtered.map(t => [t.compagnie, t.passager, t.telephone, t.trajet, t.date, t.heure, t.siege, t.prix, t.statut, t.paiement]))}
            className="inline-flex gap-2 items-center border rounded-xl px-3 py-2 text-sm disabled:opacity-40"><Download size={16} /> Export CSV</button>
        </div>
        {loading ? <Empty label="Chargement des billets…" /> : filtered.length === 0 ? <Empty label="Aucun billet disponible pour ce filtre." /> : (
          <div className="overflow-x-auto"><table className="min-w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500"><tr><th className="p-3">Compagnie</th><th className="p-3">Passager</th><th className="p-3">Téléphone</th><th className="p-3">Trajet</th><th className="p-3">Départ</th><th className="p-3">Siège</th><th className="p-3">Prix</th><th className="p-3">Statut</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{filtered.map(t => <tr key={t.id}>
              <td className="p-3 font-semibold">{t.compagnie}</td><td className="p-3">{t.passager || '—'}</td><td className="p-3">{t.telephone || '—'}</td><td className="p-3">{t.trajet}</td>
              <td className="p-3">{formatDate(t.date)} · {t.heure}</td><td className="p-3">{t.siege || '—'}</td><td className="p-3">{formatAmount(Number(t.prix))}</td><td className="p-3">{t.statut}</td>
            </tr>)}</tbody>
          </table></div>
        )}
      </div>
      <p className="text-xs text-gray-500">Le backend fournit la date et l'heure de départ, mais pas encore la date d'achat dans cet événement. Le montant des billets payés n'est pas assimilé aux commissions MESSAY.</p>
    </section>
  );
};

// ============================================================================
// 3. RESSOURCES HUMAINES : CONDUCTEURS AFFECTÉS (pas la liste exhaustive)
// ============================================================================
export const ChauffeursModule: FC<ActionProps> = ({ accessToken, onRegisterDriver }) => {
  const { items, loading, error } = useAdminSocketList<Tricycle>(
    'tricycles:get-all', 'tricycles:list', accessToken,
  );
  const [search, setSearch] = useState('');
  const assigned = useMemo(() => items.filter(t => t.chauffeur && t.chauffeur !== 'Non assigné'), [items]);
  const filtered = assigned.filter(t => `${t.chauffeur} ${t.chauffeurTel ?? ''} ${t.immatriculation}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap justify-between items-center gap-3">
        <div><h2 className="text-xl font-bold flex items-center gap-2"><ShieldCheck size={22} /> Conducteurs affectés</h2><p className="text-sm text-gray-500">Conducteurs associés aux tricycles chargés ; il ne s'agit pas de tous les comptes conducteurs.</p></div>
        {onRegisterDriver && <button type="button" onClick={onRegisterDriver} className="bg-orange-600 text-white rounded-xl px-4 py-2 font-semibold">Enregistrer un conducteur</button>}
      </header>
      {error && <Alert message={error} />}
      <label className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border max-w-md"><Search size={18} /><input aria-label="Rechercher un conducteur" className="outline-none w-full text-sm" placeholder="Nom, numéro, tricycle" value={search} onChange={e => setSearch(e.target.value)} /></label>
      {loading ? <Empty label="Chargement des affectations…" /> : filtered.length === 0 ? <Empty label="Aucun conducteur affecté trouvé." /> : (
        <div className="bg-white rounded-2xl border overflow-x-auto"><table className="min-w-full text-sm text-left"><thead className="bg-gray-50 text-gray-500"><tr><th className="p-3">Conducteur</th><th className="p-3">Téléphone</th><th className="p-3">Tricycle</th><th className="p-3">Statut du véhicule</th></tr></thead><tbody className="divide-y">{filtered.map(t => <tr key={t.id}><td className="p-3 font-semibold">{t.chauffeur}</td><td className="p-3">{t.chauffeurTel || '—'}</td><td className="p-3">{t.immatriculation}</td><td className="p-3">{t.status}</td></tr>)}</tbody></table></div>
      )}
      {!onRegisterDriver && <Alert message="La création d'un conducteur et l'attribution de son identifiant doivent passer par l'API ADMIN sécurisée après contrôle des documents au bureau MESSAY. Branchez l'action onRegisterDriver au formulaire administratif existant ; aucun compte n'est créé localement." />}
    </section>
  );
};

// ============================================================================
// 4. UTILISATEURS : aucune donnée fictive ni statut « en ligne » inventé
// ============================================================================
export const UtilisateursModule: FC = () => (
  <section className="space-y-4">
    <h2 className="text-xl font-bold flex items-center gap-2"><Users size={22} /> Gestion des utilisateurs</h2>
    <Alert message="Ce composant ne connaît pas encore le contrat de l'API ADMIN des utilisateurs. Les exemples de comptes ont été supprimés pour ne pas afficher de faux utilisateurs. Utilisez la page UsersPage existante en attendant son branchement vérifié." />
    <Empty label="Aucune donnée utilisateurs chargée dans ce composant." />
    <p className="text-xs text-gray-500">La liste des utilisateurs inscrits, les sessions actives et les mouvements GPS sont trois données distinctes. Les présences et déplacements nécessitent des endpoints autorisés et un suivi serveur adapté.</p>
  </section>
);

// ============================================================================
// 5. FINANCES : données réelles des endpoints ADMIN connus
// ============================================================================
export const FinanceModule: FC<ModuleProps> = ({ accessToken }) => {
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [filter, setFilter] = useState<'TOUT' | 'ENTREE' | 'SORTIE'>('TOUT');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const token = tokenFromStorage(accessToken);
    if (!token) {
      setLoading(false);
      setError('Session administrateur introuvable : connexion JWT requise.');
      return;
    }
    const abort = new AbortController();
    setLoading(true);
    setError(null);
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    const load = async () => {
      try {
        const [statsResponse, transactionsResponse] = await Promise.all([
          fetch(`${API_URL}/finance/stats`, { headers, signal: abort.signal }),
          fetch(`${API_URL}/finance/transactions?limit=100`, { headers, signal: abort.signal }),
        ]);
        if (!statsResponse.ok || !transactionsResponse.ok) {
          throw new Error(`API finances indisponible (${statsResponse.status} / ${transactionsResponse.status}). Vérifier le JWT ADMIN et l'URL.`);
        }
        const receivedStats: FinanceStats = await statsResponse.json();
        const receivedTransactions: unknown = await transactionsResponse.json();
        if (!cancelled) {
          setStats(receivedStats);
          setTransactions(Array.isArray(receivedTransactions) ? receivedTransactions as FinanceTransaction[] : []);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled && !abort.signal.aborted) {
          setError(caught instanceof Error ? caught.message : 'Chargement des finances impossible.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; abort.abort(); };
  }, [accessToken, reload]);

  const filtered = transactions.filter(t => filter === 'TOUT' || t.type === filter);
  const cards = [
    { label: 'Revenus validés', value: formatAmount(stats?.revenuTotal) },
    { label: 'Dépenses validées', value: formatAmount(stats?.depenses) },
    { label: 'Résultat net calculé', value: formatAmount(stats?.benefice) },
    { label: 'Courses terminées', value: stats?.totalCourses ?? '—' },
  ];
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap justify-between items-center gap-3">
        <div><h2 className="text-xl font-bold flex items-center gap-2"><CircleDollarSign size={22} /> Finances et rapports</h2><p className="text-sm text-gray-500">Transactions validées et statistiques calculées par le backend.</p></div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setReload(n => n + 1)} className="border rounded-xl px-3 py-2 text-sm">Actualiser</button>
          <button type="button" disabled={!transactions.length} onClick={() => exportCsv('messay-transactions.csv', ['ID', 'Type', 'Montant FCFA', 'Date', 'Statut'], transactions.map(t => [t.id, t.type, t.montant, t.createdAt, t.statut]))} className="border rounded-xl px-3 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-40"><Download size={16} /> Export CSV</button>
        </div>
      </header>
      {error && <Alert message={error} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map(card => <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm"><p className="flex gap-2 items-center text-sm text-gray-500"><CircleDollarSign size={16} />{card.label}</p><p className="text-xl font-black text-gray-900 mt-2">{loading ? '…' : card.value}</p></div>)}
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-3"><h3 className="font-bold">Transactions récentes (100 maximum)</h3><label className="text-sm">Flux :{' '}<select aria-label="Filtrer les transactions" value={filter} onChange={e => setFilter(e.target.value as typeof filter)} className="p-2 border rounded-lg"><option value="TOUT">Tous</option><option value="ENTREE">Entrées</option><option value="SORTIE">Sorties</option></select></label></div>
        {loading ? <Empty label="Chargement des transactions…" /> : filtered.length === 0 ? <Empty label="Aucune transaction retournée par le backend." /> : (
          <div className="overflow-x-auto"><table className="min-w-full text-sm text-left"><thead className="bg-gray-50 text-gray-500"><tr><th className="p-3">Référence</th><th className="p-3">Type</th><th className="p-3">Date</th><th className="p-3">Statut</th><th className="p-3 text-right">Montant</th></tr></thead><tbody className="divide-y">{filtered.map(t => <tr key={t.id}><td className="p-3 font-mono">{t.id.slice(0, 12)}</td><td className="p-3">{t.type}</td><td className="p-3">{formatDateTime(t.createdAt)}</td><td className="p-3">{t.statut || '—'}</td><td className={`p-3 text-right font-semibold ${t.type === 'SORTIE' ? 'text-red-700' : 'text-green-700'}`}>{formatAmount(t.montant)}</td></tr>)}</tbody></table></div>
        )}
      </div>
      <p className="text-xs text-gray-500">{stats?.note || 'Les recettes de billetterie ne sont pas nécessairement consolidées avec les transactions financières.'} Les rapports techniques et administratifs nécessitent leurs propres endpoints.</p>
    </section>
  );
};
