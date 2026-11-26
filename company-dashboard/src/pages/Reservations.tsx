/**
 * MESSAY PRO — Registre de billetterie vérifié côté serveur.
 *
 * Source : /api/company-dashboard/transactions (direction) ou
 *          /api/company-dashboard/gares/:gareId/transactions (autres rôles).
 * Les endpoints existants exposent des TRANSACTIONS, pas des réservations
 * complètes : aucun passager, QR, siège, reçu ou statut d'embarquement n'est
 * inventé. Les opérations d'embarquement attendront une API métier sécurisée.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Banknote, Building2, CalendarDays, ChevronRight,
  CircleAlert, Clock3, FileCheck2, ListChecks, Loader2, MapPin,
  Receipt, RefreshCw, Search, ShieldCheck, TicketCheck, Undo2, Wallet,
} from 'lucide-react';
import {
  garesDirectionApi,
  garesHierarchyApi,
  garesManagementApi,
  type DirectionTransaction,
  type Gare,
  type GareAccessContext,
  type GareTransaction,
  type GareTransactionPage,
} from '../services/garesManagementApi';

type TransactionVue = GareTransaction & {
  gare_id: string;
  gare_nom: string;
};

type TransactionPage = GareTransactionPage | {
  transactions: DirectionTransaction[];
  next_cursor: string | null;
};

const inputClass = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100';

function localDate(value: Date): string {
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Une erreur est survenue.';
}

function money(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${Math.round(value).toLocaleString('fr-FR')} FCFA`
    : '—';
}

function formattedDate(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Date indisponible';
}

function statusLabel(status: string): string {
  const value = status.toUpperCase();
  if (value === 'PAYE') return 'Vente confirmée';
  if (value === 'REMBOURSE') return 'Remboursement';
  return status || 'Statut inconnu';
}

function decorateTransactions(rows: GareTransaction[], station: Gare | null): TransactionVue[] {
  return rows.map((row) => {
    // Ces deux champs existent déjà dans le JSON réel du backend, mais
    // GareTransaction ne les déclare pas forcément dans ses types actuels.
    const extended = row as GareTransaction & Partial<Pick<DirectionTransaction, 'gare_id' | 'gare_nom'>>;
    return {
      ...row,
      gare_id: extended.gare_id || station?.id || '',
      gare_nom: extended.gare_nom || station?.nom || 'Gare non renseignée',
    };
  });
}

function CsvExport({ rows }: { rows: TransactionVue[] }) {
  const exportCsv = () => {
    const safeCell = (value: string | number | null | undefined): string => {
      const text = String(value ?? '');
      const protectedText = /^\s*[=+@\-]/.test(text) ? `'${text}` : text;
      return `"${protectedText.replace(/"/g, '""')}"`;
    };
    const values: Array<Array<string | number | null | undefined>> = [
      ['Date', 'Référence billet', 'Gare', 'Agent', 'Canal', 'Mode de paiement', 'Statut', 'Montant FCFA', 'Commission MESSAY FCFA', 'Part compagnie FCFA'],
      ...rows.map((t) => [
        t.occurred_at, t.reference_billet, t.gare_nom, t.agent_nom,
        t.canal, t.mode_paiement, t.statut, t.montant_fcfa,
        t.commission_messay_fcfa, t.part_compagnie_fcfa,
      ]),
    ];
    const csv = '\uFEFF' + values.map((row) => row.map(safeCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `messay-transactions-${localDate(new Date())}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <button
      type="button"
      disabled={rows.length === 0}
      onClick={exportCsv}
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <FileCheck2 size={15} /> Exporter les lignes affichées
    </button>
  );
}

export default function Reservations() {
  const [access, setAccess] = useState<GareAccessContext | null>(null);
  const [gares, setGares] = useState<Gare[]>([]);
  const [gareId, setGareId] = useState('all');
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [accessError, setAccessError] = useState('');

  const [from, setFrom] = useState(() => localDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [to, setTo] = useState(() => localDate(new Date()));
  const [transactions, setTransactions] = useState<TransactionVue[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingAccess(true);
      setAccessError('');
      try {
        const [rights, stations] = await Promise.all([
          garesHierarchyApi.access(),
          garesManagementApi.list(),
        ]);
        if (!rights?.company_id || !Array.isArray(rights.gare_ids)) {
          throw new Error('Droits compagnie incomplets : reconnectez-vous.');
        }
        const scoped = stations.filter((g) =>
          g.company_id === rights.company_id &&
          (rights.role === 'DIRECTION' || rights.gare_ids.includes(g.id)),
        );
        if (!active) return;
        setAccess(rights);
        setGares(scoped);
        setGareId(rights.role === 'DIRECTION' ? 'all' : (scoped[0]?.id || 'none'));
      } catch (caught) {
        if (active) {
          setAccess(null);
          setGares([]);
          setTransactions([]);
          setAccessError(getErrorMessage(caught));
        }
      } finally {
        if (active) setLoadingAccess(false);
      }
    })();
    return () => { active = false; requestSeq.current += 1; };
  }, []);

  const loadTransactions = useCallback(async (append = false, cursor: string | null = null) => {
    if (!access) return;
    const request = ++requestSeq.current;
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setTransactions([]);
      setSelectedId(null);
      setNextCursor(null);
    }
    setError('');

    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
        throw new Error('Veuillez choisir une période valide.');
      }
      if (gareId === 'none' || (gareId === 'all' && access.role !== 'DIRECTION')) {
        throw new Error('Aucune gare autorisée n’est affectée à votre compte.');
      }
      const chosenStation = gares.find((g) => g.id === gareId) || null;
      if (gareId !== 'all' && !chosenStation) {
        throw new Error('Cette gare n’est pas dans le périmètre de votre compte.');
      }

      const response: TransactionPage = gareId === 'all'
        ? await garesDirectionApi.allTransactions(from, to, append ? cursor : null)
        : await garesHierarchyApi.transactions(gareId, from, to, append ? cursor : null);

      if (!response || !Array.isArray(response.transactions)) {
        throw new Error('Le serveur a retourné une liste de transactions invalide.');
      }
      if (request !== requestSeq.current) return;

      const incoming = decorateTransactions(response.transactions, chosenStation);
      setTransactions((previous) => {
        if (!append) return incoming;
        const ids = new Set(previous.map((row) => row.id));
        return [...previous, ...incoming.filter((row) => !ids.has(row.id))];
      });
      setNextCursor(response.next_cursor || null);
      if (!append) setSelectedId(incoming[0]?.id || null);
    } catch (caught) {
      if (request === requestSeq.current) setError(getErrorMessage(caught));
    } finally {
      if (request === requestSeq.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [access, from, to, gareId, gares]);

  useEffect(() => {
    if (access) void loadTransactions();
    return () => { requestSeq.current += 1; };
  }, [access, loadTransactions]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('fr');
    return transactions.filter((t) => {
      if (statusFilter !== 'all' && t.statut.toUpperCase() !== statusFilter) return false;
      if (!term) return true;
      return [t.reference_billet, t.agent_nom, t.gare_nom, t.canal, t.mode_paiement, t.statut]
        .some((item) => String(item || '').toLocaleLowerCase('fr').includes(term));
    });
  }, [transactions, search, statusFilter]);

  const selected = useMemo(
    () => transactions.find((row) => row.id === selectedId) || null,
    [transactions, selectedId],
  );
  const sales = transactions.filter((t) => t.statut.toUpperCase() === 'PAYE');
  const refunds = transactions.filter((t) => t.statut.toUpperCase() === 'REMBOURSE');
  const netAmount = transactions.reduce((total, t) => total + (Number.isFinite(t.montant_fcfa) ? t.montant_fcfa : 0), 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <header className="rounded-[24px] border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-orange-600">
              <TicketCheck size={15} /> MESSAY PRO · Billetterie interurbaine
            </div>
            <h1 className="text-2xl font-black text-slate-900">Billets et transactions</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Registre des ventes et remboursements réellement enregistrés par la compagnie.
              Les transactions mobiles et au guichet sont distinguées par le serveur.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadTransactions()}
            disabled={!access || loading || loadingMore}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-orange-500 px-4 text-xs font-extrabold text-white transition hover:bg-orange-600 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
        </div>
        {access && (
          <p className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-500">
            <ShieldCheck size={15} className="text-emerald-600" />
            Accès vérifié : {access.display_name || access.role} · {access.role.replace(/_/g, ' ')}
          </p>
        )}
      </header>

      {accessError && (
        <div role="alert" className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <CircleAlert size={19} className="shrink-0" />
          <div><strong>Impossible de charger vos accès.</strong><p className="mt-1">{accessError}</p></div>
        </div>
      )}

      <section aria-label="Indicateurs des opérations chargées" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {([
          { label: 'Opérations chargées', value: transactions.length.toLocaleString('fr-FR'), icon: Receipt },
          { label: 'Ventes enregistrées', value: sales.length.toLocaleString('fr-FR'), icon: TicketCheck },
          { label: 'Remboursements', value: refunds.length.toLocaleString('fr-FR'), icon: Undo2 },
          { label: 'Montant net chargé', value: money(netAmount), icon: Wallet },
        ] as const).map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-[20px] border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-extrabold text-slate-500">{label}</p>
              <span className="rounded-xl bg-orange-50 p-2.5 text-orange-600"><Icon size={20}/></span>
            </div>
            <p className="mt-3 text-2xl font-black tabular-nums text-slate-900">{loadingAccess || loading ? '—' : value}</p>
          </div>
        ))}
      </section>
      <p className="text-xs text-slate-500">
        <CircleAlert size={13} className="mr-1 inline" />
        Ces chiffres concernent uniquement les lignes chargées pour la période sélectionnée.
        {nextCursor ? ' D’autres pages sont disponibles : ces totaux sont partiels.' : ''}
        Ils ne constituent ni un solde de portefeuille ni un rapport comptable consolidé.
      </p>

      <section className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="text-xs font-bold text-slate-600">
            <span className="mb-1.5 flex items-center gap-1"><CalendarDays size={14}/> Du</span>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          </label>
          <label className="text-xs font-bold text-slate-600">
            <span className="mb-1.5 flex items-center gap-1"><CalendarDays size={14}/> Au</span>
            <input type="date" value={to} min={from} max={localDate(new Date())} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </label>
          <label className="text-xs font-bold text-slate-600">
            <span className="mb-1.5 flex items-center gap-1"><MapPin size={14}/> Gare</span>
            <select
              value={gareId}
              disabled={!access || loadingAccess}
              onChange={(e) => setGareId(e.target.value)}
              className={inputClass}
            >
              {access?.role === 'DIRECTION' && <option value="all">Toutes les gares</option>}
              {gares.length === 0 && <option value="none">Aucune gare affectée</option>}
              {gares.map((g) => <option key={g.id} value={g.id}>{g.nom} · {g.ville}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            <span className="mb-1.5 block">Type d’opération</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass}>
              <option value="all">Tous les statuts</option>
              <option value="PAYE">Ventes payées</option>
              <option value="REMBOURSE">Remboursements</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            <span className="mb-1.5 flex items-center gap-1"><Search size={14}/> Rechercher</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Référence, agent, gare…"
              className={inputClass}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">{filtered.length} affichée(s) sur {transactions.length} ligne(s) chargée(s)</p>
          <CsvExport rows={filtered}/>
        </div>
      </section>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <CircleAlert size={19} className="shrink-0" /><p>{error}</p>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <section className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-sm lg:col-span-7">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-5">
            <h2 className="text-sm font-black text-slate-900">Registre des opérations</h2>
            <ListChecks size={18} className="text-orange-500" />
          </div>
          <div className="max-h-[650px] divide-y divide-slate-100 overflow-y-auto">
            {loadingAccess || loading ? (
              <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
                <Loader2 size={19} className="animate-spin" /> Chargement des transactions…
              </div>
            ) : filtered.length === 0 ? (
              <p className="p-12 text-center text-sm text-slate-500">
                {error ? 'Données momentanément indisponibles.' : 'Aucune transaction pour les filtres sélectionnés.'}
              </p>
            ) : filtered.map((t) => {
              const refund = t.statut.toUpperCase() === 'REMBOURSE';
              return (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  aria-pressed={selectedId === t.id}
                  className={`flex w-full items-start gap-4 p-4 text-left transition hover:bg-orange-50/40 ${selectedId === t.id ? 'border-l-4 border-orange-500 bg-orange-50/60' : ''}`}
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${refund ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {refund ? <Undo2 size={21}/> : <TicketCheck size={21}/>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="truncate text-sm font-black text-slate-900">{t.reference_billet || 'Transaction sans référence de billet'}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${refund ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
                        {statusLabel(t.statut)}
                      </span>
                    </span>
                    <span className="mt-2 flex items-center gap-1 text-xs text-slate-600"><Building2 size={13}/>{t.gare_nom}</span>
                    <span className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span>{t.canal} · {t.mode_paiement} · {formattedDate(t.occurred_at)}</span>
                      <strong className="text-slate-900">{money(t.montant_fcfa)}</strong>
                    </span>
                  </span>
                  <ChevronRight size={16} className="mt-3 shrink-0 text-slate-300"/>
                </button>
              );
            })}
          </div>
          {nextCursor && !loading && (
            <div className="border-t border-slate-100 p-4 text-center">
              <button
                type="button"
                onClick={() => void loadTransactions(true, nextCursor)}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {loadingMore && <Loader2 size={15} className="animate-spin"/>}
                Charger 50 opérations supplémentaires
              </button>
            </div>
          )}
        </section>

        <aside className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-sm lg:sticky lg:top-6 lg:col-span-5">
          {selected ? (
            <>
              <div className="bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white">
                <p className="text-[10px] font-black uppercase tracking-wider text-orange-300">Transaction vérifiée par le backend</p>
                <h2 className="mt-2 break-all text-xl font-black">{selected.reference_billet || selected.id}</h2>
                <p className="mt-2 text-xs text-slate-300">{selected.gare_nom}</p>
                <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
                  <span className="text-xs text-slate-300">Montant de l'opération</span>
                  <strong className="text-lg text-orange-300">{money(selected.montant_fcfa)}</strong>
                </div>
              </div>
              <div className="space-y-3 p-6">
                <h3 className="mb-3 text-sm font-black text-slate-900">Détails enregistrés</h3>
                {([
                  ['Date', formattedDate(selected.occurred_at), Clock3],
                  ['Gare', selected.gare_nom, MapPin],
                  ['Canal', selected.canal, ArrowRight],
                  ['Paiement', selected.mode_paiement, Banknote],
                  ['Statut', statusLabel(selected.statut), ShieldCheck],
                  ['Agent', selected.agent_nom || 'Non attribué', Building2],
                  ['Commission MESSAY', money(selected.commission_messay_fcfa), Wallet],
                  ['Part compagnie', money(selected.part_compagnie_fcfa), Receipt],
                ] as const).map(([label, value, Icon]) => (
                  <div key={label} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 text-xs">
                    <span className="inline-flex items-center gap-2 text-slate-500"><Icon size={14}/>{label}</span>
                    <strong className="text-right text-slate-800">{value}</strong>
                  </div>
                ))}
                <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
                  <p className="font-black">QR code et contrôle d'embarquement indisponibles sur ce registre</p>
                  <p className="mt-1">L'API actuelle renvoie les transactions, mais pas le QR signé, le nom du passager, le siège ou la chronologie du trajet. Aucun billet ne sera marqué « embarqué » sans vérification et confirmation par le serveur.</p>
                </div>
                <Link to="/gares" className="inline-flex items-center gap-2 text-xs font-extrabold text-orange-600 hover:underline">
                  <Building2 size={15}/> Accéder à la gestion des gares <ArrowRight size={14}/>
                </Link>
              </div>
            </>
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
              <Receipt size={36} className="text-orange-200"/>
              <h2 className="mt-3 font-black text-slate-800">Détails de transaction</h2>
              <p className="mt-2 text-sm text-slate-500">Sélectionnez une opération dans la liste.</p>
            </div>
          )}
        </aside>
      </div>

      <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
        <ShieldCheck size={16} className="mt-0.5 shrink-0"/>
        Les accès compagnie et gare sont vérifiés par Express. La liste n'est pas une liste complète des réservations : les achats non payés, sièges, passagers, QR et changements d'étape de trajet doivent venir d'une API de réservation distincte et sécurisée.
      </p>
    </div>
  );
}
