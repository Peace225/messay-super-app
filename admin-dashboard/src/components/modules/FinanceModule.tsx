import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, Download, RefreshCw, FileText } from 'lucide-react';
import api from '../../services/api';

export const FinanceModule = () => {
  const [stats, setStats] = useState<any>({});
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [s, t] = await Promise.all([
      api.get('/finance/stats'),
      api.get('/finance/transactions')
    ]);
    setStats(s.data);
    setTransactions(t.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const exportData = async () => {
    const res = await api.get('/finance/export', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-${Date.now()}.csv`;
    a.click();
  };

  const generateReport = async () => {
    await api.post('/finance/reports/generate', { type: 'FINANCIER' });
    alert('Rapport généré');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between">
        <h1 className="text-3xl font-black">💰 Finance Admin</h1>
        <div className="flex gap-2">
          <button onClick={load} className="px-4 py-2 border rounded-xl font-bold flex items-center gap-2">
            <RefreshCw size={16} className={loading? 'animate-spin' : ''}/> Actualiser
          </button>
          <button onClick={exportData} className="px-4 py-2 bg-black text-white rounded-xl font-bold flex items-center gap-2">
            <Download size={16}/> Exporter
          </button>
          <button onClick={generateReport} className="px-4 py-2 bg-orange-600 text-white rounded-xl font-bold flex items-center gap-2">
            <FileText size={16}/> Générer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Revenu Total', value: stats.revenuTotal, icon: Wallet, color: 'text-green-600' },
          { label: 'Aujourd\'hui', value: stats.revenuJour, icon: TrendingUp, color: 'text-blue-600' },
          { label: 'Bénéfice', value: stats.benefice, icon: Wallet, color: 'text-emerald-600' },
          { label: 'Dépenses', value: stats.depenses, icon: Wallet, color: 'text-red-600' },
        ].map((s, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border">
            <s.icon className={`${s.color} mb-2`} size={24}/>
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-2xl font-black">{s.value?.toLocaleString() || 0} F</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border">
        <div className="p-4 border-b"><h3 className="font-bold">Transactions ({transactions.length})</h3></div>
        <div className="max-h- overflow-auto">
          {transactions.map((t: any) => (
            <div key={t.id} className="flex justify-between p-4 border-b hover:bg-gray-50">
              <div>
                <p className="font-medium">{t.motif}</p>
                <p className="text-xs text-gray-500">{new Date(t.createdAt).toLocaleString('fr-FR')}</p>
              </div>
              <p className={`font-bold ${t.type === 'ENTRÉE'? 'text-green-600' : 'text-red-600'}`}>
                {t.type === 'ENTRÉE'? '+' : '-'}{t.montant?.toLocaleString()} F
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};