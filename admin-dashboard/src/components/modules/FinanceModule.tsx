import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Download,
  RefreshCw,
  FileText,
  AlertCircle,
} from 'lucide-react';
import api from '../../services/api';

type Montant = number | string | null | undefined;

type FinanceStats = {
  revenuTotal?: Montant;
  revenuJour?: Montant;
  benefice?: Montant;
  depenses?: Montant;
  note?: string | null;
};

type FinanceTransaction = {
  id: string;
  type: string; // Valeurs backend : ENTREE | SORTIE
  montant: number | string;
  createdAt: string;
  motif?: string | null;
  libelle?: string | null;
  reference?: string | null;
  conducteur?: {
    user?: { nom?: string | null; prenom?: string | null } | null;
  } | null;
};

function montantNumber(value: Montant): number | null {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

const formatMontant = (value: Montant): string => {
  const amount = montantNumber(value);
  return amount === null
    ? 'Non disponible'
    : `${amount.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} FCFA`;
};

const formatDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date non disponible'
    : date.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
};

function transactionLabel(transaction: FinanceTransaction): string {
  return (
    transaction.motif?.trim() ||
    transaction.libelle?.trim() ||
    transaction.reference?.trim() ||
    `Transaction ${transaction.id.slice(0, 8)}`
  );
}

function csvCell(value: string | number | null | undefined): string {
  const raw = String(value ?? '').replace(/[\r\n]+/g, ' ');
  // Empêche l'interprétation de textes provenant du serveur comme formules Excel.
  const safe = typeof value === 'string' && /^\s*[=+\-@]/.test(raw)
    ? `'${raw}`
    : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
}

function saveCsv(filename: string, rows: Array<Array<string | number | null | undefined>>): void {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function transactionRows(transactions: FinanceTransaction[]) {
  return [
    ['ID', 'Date', 'Type', 'Motif / Référence', 'Montant (FCFA)', 'Conducteur'],
    ...transactions.map((transaction) => [
      transaction.id,
      formatDate(transaction.createdAt),
      transaction.type === 'ENTREE' ? 'Entrée' : transaction.type === 'SORTIE' ? 'Sortie' : transaction.type,
      transactionLabel(transaction),
      montantNumber(transaction.montant) ?? '',
      [transaction.conducteur?.user?.prenom, transaction.conducteur?.user?.nom]
        .filter(Boolean)
        .join(' '),
    ]),
  ];
}

function loadErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 401) return 'Session expirée. Reconnectez-vous avec un compte administrateur.';
    if (status === 403) return 'Votre compte ne dispose pas des droits financiers administrateur.';
    if (!error.response) return 'Impossible de contacter le serveur MESSAY. Vérifiez l’API et votre connexion.';
  }
  return 'Impossible de charger les données financières. Réessayez.';
}

export const FinanceModule = () => {
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const currentRequest = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    currentRequest.current?.abort();
    const controller = new AbortController();
    currentRequest.current = controller;
    setLoading(true);
    setError(null);

    try {
      const [statsResponse, transactionsResponse] = await Promise.all([
        api.get<FinanceStats>('/finance/stats', { signal: controller.signal }),
        api.get<FinanceTransaction[]>('/finance/transactions', {
          params: { limit: 100 },
          signal: controller.signal,
        }),
      ]);

      if (controller.signal.aborted) return;
      if (!statsResponse.data || !Array.isArray(transactionsResponse.data)) {
        throw new Error('Format de réponse API inattendu');
      }

      setStats(statsResponse.data);
      setTransactions(transactionsResponse.data);
      setLastUpdated(new Date());
    } catch (caught: unknown) {
      if (!controller.signal.aborted) setError(loadErrorMessage(caught));
    } finally {
      if (currentRequest.current === controller && !controller.signal.aborted) {
        setLoading(false);
        currentRequest.current = null;
      }
    }
  }, []);

  useEffect(() => {
    void load();
    return () => currentRequest.current?.abort();
  }, [load]);

  const exportData = () => {
    if (!stats) return;
    saveCsv(`messay-transactions-${new Date().toISOString().slice(0, 10)}.csv`, transactionRows(transactions));
  };

  const generateReport = () => {
    if (!stats) return;
    const rows: Array<Array<string | number | null | undefined>> = [
      ['MESSAY — Rapport financier (export local, non certifié)'],
      ['Généré le', new Date().toLocaleString('fr-FR')],
      ['Source', 'API /finance/stats et 100 dernières transactions maximum'],
      [],
      ['Indicateur', 'Montant (FCFA)'],
      ['Revenu total', montantNumber(stats.revenuTotal) ?? 'Non disponible'],
      ["Revenu aujourd'hui", montantNumber(stats.revenuJour) ?? 'Non disponible'],
      ['Dépenses', montantNumber(stats.depenses) ?? 'Non disponible'],
      ['Bénéfice', montantNumber(stats.benefice) ?? 'Non disponible'],
      ...(stats.note ? [['Note du serveur', stats.note]] : []),
      [],
      ...transactionRows(transactions),
    ];
    saveCsv(`messay-rapport-financier-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const cards = [
    { label: 'Revenu total', value: stats?.revenuTotal, icon: Wallet, color: 'text-green-600' },
    { label: "Aujourd'hui", value: stats?.revenuJour, icon: TrendingUp, color: 'text-blue-600' },
    { label: 'Bénéfice', value: stats?.benefice, icon: Wallet, color: 'text-emerald-600' },
    { label: 'Dépenses', value: stats?.depenses, icon: TrendingDown, color: 'text-red-600' },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900">Finance Admin</h1>
          <p className="text-sm text-gray-500 mt-1">
            Données réelles du backend MESSAY, réservées aux administrateurs.
          </p>
          {lastUpdated && (
            <p className="text-xs text-gray-400 mt-1">
              Dernière actualisation : {lastUpdated.toLocaleString('fr-FR')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="px-4 py-2 border border-gray-200 bg-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>
          <button
            type="button"
            onClick={exportData}
            disabled={!stats || loading}
            className="px-4 py-2 bg-gray-900 text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
          >
            <Download size={16} /> Exporter CSV
          </button>
          <button
            type="button"
            onClick={generateReport}
            disabled={!stats || loading}
            className="px-4 py-2 bg-orange-600 text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
          >
            <FileText size={16} /> Rapport CSV
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}{stats ? ' Les dernières données chargées restent affichées.' : ''}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white p-5 md:p-6 rounded-2xl border border-gray-100 shadow-sm">
            <Icon className={`${color} mb-3`} size={24} />
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-xl md:text-2xl font-black text-gray-900 mt-1">
              {loading && !stats ? 'Chargement…' : formatMontant(value)}
            </p>
          </div>
        ))}
      </div>

      {stats?.note && (
        <p className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-900">
          {stats.note}
        </p>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 md:p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-gray-900">
            Dernières transactions ({transactions.length} sur 100 maximum)
          </h2>
          <span className="text-xs text-gray-500">Montants en FCFA</span>
        </div>
        <div className="max-h-[520px] overflow-auto">
          {transactions.length === 0 ? (
            <p className="p-8 text-sm text-center text-gray-500">
              {loading ? 'Chargement des transactions…' : error ? 'Transactions indisponibles.' : 'Aucune transaction enregistrée.'}
            </p>
          ) : (
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="p-4">Transaction</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Type</th>
                  <th className="p-4 text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((transaction) => {
                  const entree = transaction.type === 'ENTREE';
                  const sortie = transaction.type === 'SORTIE';
                  return (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <p className="font-semibold text-gray-900">{transactionLabel(transaction)}</p>
                        <p className="text-xs text-gray-400 font-mono">{transaction.id.slice(0, 12)}</p>
                      </td>
                      <td className="p-4 text-gray-600">{formatDate(transaction.createdAt)}</td>
                      <td className="p-4 text-gray-600">{entree ? 'Entrée' : sortie ? 'Sortie' : transaction.type}</td>
                      <td className={`p-4 text-right font-bold ${entree ? 'text-green-700' : sortie ? 'text-red-700' : 'text-gray-900'}`}>
                        {entree ? '+' : sortie ? '−' : ''}{formatMontant(transaction.montant)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinanceModule;
