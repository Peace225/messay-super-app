import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
  Wrench,
} from 'lucide-react';
import api from '../../services/api';

type ReportTab = 'FINANCIER' | 'TECHNIQUE' | 'ADMINISTRATIF';
type Amount = number | string | null | undefined;
type TransactionFilter = 'TOUTES' | 'ENTREE' | 'SORTIE';

type FinanceStats = {
  revenuTotal?: Amount;
  revenuJour?: Amount;
  depenses?: Amount;
  benefice?: Amount;
  note?: string | null;
};

type FinanceTransaction = {
  id: string;
  type?: string;
  montant?: Amount;
  createdAt?: string;
  motif?: string | null;
  libelle?: string | null;
  reference?: string | null;
  conducteur?: {
    user?: { nom?: string | null; prenom?: string | null } | null;
  } | null;
};

const MAX_TRANSACTIONS = 100;

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseStats(raw: unknown): FinanceStats | null {
  const outer = asObject(raw);
  if (!outer) return null;
  const value = asObject(outer.stats) ?? outer;
  const keys = ['revenuTotal', 'revenuJour', 'depenses', 'benefice'];
  if (!keys.some((key) => key in value)) return null;
  return value as FinanceStats;
}

function parseTransactions(raw: unknown): FinanceTransaction[] | null {
  const outer = asObject(raw);
  const nested = asObject(outer?.data);
  const values = Array.isArray(raw)
    ? raw
    : Array.isArray(outer?.transactions)
      ? outer.transactions
      : Array.isArray(outer?.data)
        ? outer.data
        : Array.isArray(nested?.transactions)
          ? nested.transactions
          : null;

  if (!values) return null;
  return values.flatMap((item: unknown) => {
    const value = asObject(item);
    if (!value || (typeof value.id !== 'string' && typeof value.id !== 'number')) return [];
    return [{ ...value, id: String(value.id) } as FinanceTransaction];
  });
}

function numericAmount(value: Amount): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value: Amount): string {
  const number = numericAmount(value);
  return number === null
    ? 'Non disponible'
    : `${number.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} FCFA`;
}

function formatDate(value?: string): string {
  if (!value) return 'Date non disponible';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date non disponible'
    : date.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

function transactionLabel(value: FinanceTransaction): string {
  return value.motif?.trim() || value.libelle?.trim() || value.reference?.trim() || `Transaction ${value.id.slice(0, 8)}`;
}

function normalizeType(type?: string): 'ENTREE' | 'SORTIE' | 'AUTRE' {
  const normalized = (type ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  return normalized === 'ENTREE' ? 'ENTREE' : normalized === 'SORTIE' ? 'SORTIE' : 'AUTRE';
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return 'Session expirée. Reconnectez-vous au dashboard.';
    if (error.response?.status === 403) return 'Accès interdit : droits administrateur nécessaires.';
    if (!error.response) return 'API MESSAY indisponible. Vérifiez le backend et VITE_API_URL.';
  }
  return 'Impossible de récupérer ces informations. Réessayez.';
}

type CsvValue = string | number | null | undefined;

function csvCell(value: CsvValue): string {
  const str = String(value ?? '').replace(/[\r\n\t]+/g, ' ');
  // Bloque les formules de tableur injectées dans les champs provenant de l'API.
  const safe = typeof value === 'string' && /^\s*[=+\-@]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

function downloadCsv(name: string, rows: CsvValue[][]): void {
  const contents = '\uFEFF' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function IconCard({ label, amount, icon: Icon, color }: {
  label: string;
  amount: Amount;
  icon: typeof Wallet;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className={`mb-4 inline-flex rounded-xl p-3 ${color}`}><Icon size={21} /></div>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 break-words text-xl font-black text-gray-900 md:text-2xl">{formatMoney(amount)}</p>
    </div>
  );
}

export default function RapportsPages() {
  const [tab, setTab] = useState<ReportTab>('FINANCIER');
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [transactions, setTransactions] = useState<FinanceTransaction[] | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<TransactionFilter>('TOUTES');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const activeRequest = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setStatsError(null);
    setTransactionsError(null);

    const [statsResult, transactionsResult] = await Promise.all([
      api.get<unknown>('/finance/stats', { signal: controller.signal })
        .then(({ data }) => ({ ok: true as const, data }))
        .catch((error: unknown) => ({ ok: false as const, message: errorMessage(error) })),
      api.get<unknown>('/finance/transactions', {
        params: { limit: MAX_TRANSACTIONS },
        signal: controller.signal,
      })
        .then(({ data }) => ({ ok: true as const, data }))
        .catch((error: unknown) => ({ ok: false as const, message: errorMessage(error) })),
    ]);

    if (controller.signal.aborted) return;

    if (statsResult.ok) {
      const parsed = parseStats(statsResult.data);
      setStats(parsed);
      if (!parsed) setStatsError('Format des statistiques financières non reconnu.');
    } else {
      setStats(null);
      setStatsError("message" in statsResult ? statsResult.message : "Erreur de chargement des statistiques.");
    }

    if (transactionsResult.ok) {
      const parsed = parseTransactions(transactionsResult.data);
      setTransactions(parsed);
      if (!parsed) setTransactionsError('Format de la liste des transactions non reconnu.');
    } else {
      setTransactions(null);
      setTransactionsError("message" in transactionsResult ? transactionsResult.message : "Erreur de chargement des transactions.");
    }

    setUpdatedAt(new Date());
    setLoading(false);
    activeRequest.current = null;
  }, []);

  useEffect(() => {
    void refresh();
    return () => activeRequest.current?.abort();
  }, [refresh]);

  const filtered = useMemo(() => (transactions ?? []).filter((item) => {
    const term = search.trim().toLocaleLowerCase('fr-FR');
    const text = [item.id, transactionLabel(item), item.reference].join(' ').toLocaleLowerCase('fr-FR');
    const date = item.createdAt?.slice(0, 10) ?? '';
    return (!term || text.includes(term))
      && (filter === 'TOUTES' || normalizeType(item.type) === filter)
      && (!dateFrom || date >= dateFrom)
      && (!dateTo || date <= dateTo);
  }), [transactions, search, filter, dateFrom, dateTo]);

  const split = useMemo(() => filtered.reduce((acc, item) => {
    const amount = numericAmount(item.montant);
    if (amount === null) return acc;
    if (normalizeType(item.type) === 'ENTREE') acc.entrees += amount;
    if (normalizeType(item.type) === 'SORTIE') acc.sorties += amount;
    return acc;
  }, { entrees: 0, sorties: 0 }), [filtered]);

  const maxSplit = Math.max(split.entrees, split.sorties, 1);
  const currentDate = new Date().toISOString().slice(0, 10);

  const exportTransactions = () => {
    if (!transactions) return;
    downloadCsv(`messay-transactions-${currentDate}.csv`, [
      ['Identifiant', 'Date', 'Type', 'Libellé', 'Référence', 'Montant FCFA'],
      ...filtered.map((item) => [
        item.id, formatDate(item.createdAt), normalizeType(item.type), transactionLabel(item),
        item.reference ?? '', numericAmount(item.montant) ?? 'Non disponible',
      ]),
    ]);
  };

  const exportReport = () => {
    if (!stats) return;
    downloadCsv(`messay-rapport-financier-${currentDate}.csv`, [
      ['MESSAY — Rapport financier (export local non certifié)'],
      ['Généré le', new Date().toLocaleString('fr-FR')],
      ['Source', '/finance/stats et /finance/transactions (100 dernières au maximum)'],
      ['Filtre de type', filter],
      ['Date de début (transactions)', dateFrom || 'Toutes'],
      ['Date de fin (transactions)', dateTo || 'Toutes'],
      [],
      ['Indicateur API (non filtré par les dates)', 'Montant FCFA'],
      ['Revenu total', numericAmount(stats.revenuTotal) ?? 'Non disponible'],
      ["Revenu aujourd'hui", numericAmount(stats.revenuJour) ?? 'Non disponible'],
      ['Dépenses', numericAmount(stats.depenses) ?? 'Non disponible'],
      ['Bénéfice', numericAmount(stats.benefice) ?? 'Non disponible'],
      [],
      ['Opérations filtrées parmi les dernières transactions récupérées'],
      ['Identifiant', 'Date', 'Type', 'Libellé', 'Montant FCFA'],
      ...(transactions ? filtered.map((item) => [
        item.id, formatDate(item.createdAt), normalizeType(item.type), transactionLabel(item),
        numericAmount(item.montant) ?? 'Non disponible',
      ]) : [['Historique indisponible']]),
    ]);
  };

  const tabs = [
    { id: 'FINANCIER' as const, label: 'Financier', icon: Wallet },
    { id: 'TECHNIQUE' as const, label: 'Technique', icon: Wrench },
    { id: 'ADMINISTRATIF' as const, label: 'Administratif', icon: ShieldCheck },
  ];

  return (
    <main className="min-h-full space-y-6 bg-gray-50 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">MESSAY / Administration</p>
          <h1 className="mt-2 flex items-center gap-3 text-2xl font-black text-gray-900 md:text-3xl">
            <FileText className="text-orange-600" size={28} /> Centre des rapports
          </h1>
          <p className="mt-2 text-sm text-gray-500">Rapports financiers, techniques et administratifs.</p>
          {updatedAt && <p className="mt-1 text-xs text-gray-400">Dernière actualisation : {updatedAt.toLocaleString('fr-FR')}</p>}
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-100 disabled:opacity-50">
          <RefreshCw size={17} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </header>

      <div role="tablist" aria-label="Types de rapports" className="flex flex-wrap gap-2 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${tab === id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>
            <Icon size={17} /> {label}
          </button>
        ))}
      </div>

      {tab !== 'FINANCIER' ? (
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm md:p-10">
          <div className="mb-5 inline-flex rounded-2xl bg-orange-50 p-4 text-orange-600">
            {tab === 'TECHNIQUE' ? <Wrench size={28} /> : <ShieldCheck size={28} />}
          </div>
          <h2 className="text-xl font-black text-gray-900">Rapport {tab === 'TECHNIQUE' ? 'technique' : 'administratif'}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
            Ce rapport n'est pas encore disponible : aucun endpoint de rapports {tab === 'TECHNIQUE' ? 'techniques' : 'administratifs'}
            n'a été confirmé dans l'API MESSAY. Aucune donnée ou statistique fictive n'est affichée.
          </p>
          <div role="status" className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            {tab === 'TECHNIQUE'
              ? 'À intégrer côté backend : incidents, disponibilité API, erreurs, activité GPS et historique des événements.'
              : 'À intégrer côté backend : opérations administrateur, créations de conducteurs, changements de rôle et journal d’audit.'}
          </div>
        </section>
      ) : (
        <div className="space-y-6">
          {(statsError || transactionsError) && (
            <div role="alert" className="space-y-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {statsError && <p><AlertCircle size={15} className="mr-2 inline" />Statistiques : {statsError}</p>}
              {transactionsError && <p><AlertCircle size={15} className="mr-2 inline" />Transactions : {transactionsError}</p>}
            </div>
          )}

          {stats?.note && <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">{stats.note}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <IconCard label="Revenu total" amount={stats?.revenuTotal} icon={Wallet} color="bg-emerald-50 text-emerald-700" />
            <IconCard label="Revenu aujourd'hui" amount={stats?.revenuJour} icon={TrendingUp} color="bg-blue-50 text-blue-700" />
            <IconCard label="Dépenses" amount={stats?.depenses} icon={TrendingDown} color="bg-red-50 text-red-700" />
            <IconCard label="Bénéfice" amount={stats?.benefice} icon={BarChart3} color="bg-orange-50 text-orange-700" />
          </div>
          <p className="text-xs text-gray-500">
            Ces indicateurs proviennent directement de <code>/finance/stats</code>. Les filtres ci-dessous s'appliquent uniquement aux transactions chargées, pas aux indicateurs globaux.
          </p>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-gray-900">Exporter les données</h2>
                <p className="mt-1 text-xs text-gray-500">Exports CSV locaux, non certifiés, à partir des données API accessibles.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={exportTransactions} disabled={!transactions || loading}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold hover:bg-gray-50 disabled:opacity-40">
                  <FileSpreadsheet size={17} /> Transactions CSV
                </button>
                <button type="button" onClick={exportReport} disabled={!stats || loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-40">
                  <Download size={17} /> Rapport financier CSV
                </button>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-5">
              <h2 className="text-lg font-black text-gray-900">Historique des transactions</h2>
              <p className="mt-1 text-xs text-gray-500">
                {transactions ? `${transactions.length} transactions récupérées (limite de requête : ${MAX_TRANSACTIONS})` : 'Historique indisponible'}.
                Les totaux calculés ici ne représentent pas nécessairement l'ensemble de la comptabilité.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <label className="relative md:col-span-1">
                  <Search size={17} className="absolute left-3 top-3 text-gray-400" />
                  <input aria-label="Rechercher une transaction" value={search} onChange={(event) => setSearch(event.target.value)}
                    placeholder="Référence, motif..." className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-orange-400" />
                </label>
                <select aria-label="Filtrer par type" value={filter} onChange={(event) => setFilter(event.target.value as TransactionFilter)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm">
                  <option value="TOUTES">Tous les types</option>
                  <option value="ENTREE">Entrées</option>
                  <option value="SORTIE">Sorties</option>
                </select>
                <label className="relative flex items-center gap-2 rounded-xl border border-gray-200 px-3">
                  <CalendarDays size={16} className="text-gray-400" />
                  <span className="sr-only">Du</span>
                  <input type="date" aria-label="Du" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} className="w-full bg-transparent py-2.5 text-sm outline-none" />
                </label>
                <label className="relative flex items-center gap-2 rounded-xl border border-gray-200 px-3">
                  <CalendarDays size={16} className="text-gray-400" />
                  <span className="sr-only">Au</span>
                  <input type="date" aria-label="Au" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} className="w-full bg-transparent py-2.5 text-sm outline-none" />
                </label>
              </div>
            </div>

            {transactions && filtered.length > 0 && (
              <div className="grid gap-4 border-b border-gray-100 p-5 md:grid-cols-2">
                {[
                  { label: 'Entrées de la sélection', amount: split.entrees, color: 'bg-emerald-500', width: `${(split.entrees / maxSplit) * 100}%` },
                  { label: 'Sorties de la sélection', amount: split.sorties, color: 'bg-red-400', width: `${(split.sorties / maxSplit) * 100}%` },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-gray-600"><span>{item.label}</span><span>{formatMoney(item.amount)}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${item.color}`} style={{ width: item.width }} /></div>
                  </div>
                ))}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr>
                  <th scope="col" className="px-5 py-4">Transaction</th>
                  <th scope="col" className="px-5 py-4">Motif</th>
                  <th scope="col" className="px-5 py-4">Date</th>
                  <th scope="col" className="px-5 py-4">Type</th>
                  <th scope="col" className="px-5 py-4 text-right">Montant</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((item) => {
                    const type = normalizeType(item.type);
                    return <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4 font-mono text-xs font-bold text-gray-700">#{item.id.slice(0, 10)}</td>
                      <td className="px-5 py-4 text-gray-700">{transactionLabel(item)}</td>
                      <td className="px-5 py-4 text-gray-500">{formatDate(item.createdAt)}</td>
                      <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${type === 'ENTREE' ? 'bg-emerald-50 text-emerald-700' : type === 'SORTIE' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{type === 'ENTREE' ? 'Entrée' : type === 'SORTIE' ? 'Sortie' : item.type || 'Autre'}</span></td>
                      <td className={`px-5 py-4 text-right font-black ${type === 'ENTREE' ? 'text-emerald-700' : type === 'SORTIE' ? 'text-red-600' : 'text-gray-700'}`}>{formatMoney(item.montant)}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-100 p-5 text-center text-sm text-gray-500">
              {loading ? 'Chargement en cours…' : transactions === null ? 'Transactions non disponibles.' : filtered.length === 0 ? 'Aucune transaction pour ces filtres.' : `${filtered.length} transaction(s) affichée(s).`}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
