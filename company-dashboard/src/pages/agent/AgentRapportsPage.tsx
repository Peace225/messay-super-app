/** MESSAY PRO — Déclaration et suivi des rapports de l'agent. */
import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';
import { ClipboardCheck, RefreshCw, Send } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import {
  garesHierarchyApi,
  garesManagementApi,
  type Gare,
  type GareAccessContext,
  type GareRapportHierarchique,
} from '../../services/garesManagementApi';
import { abidjanDate } from './AgentDashboard';

const day = 86_400_000;
const asError = (value: unknown) => value instanceof Error ? value.message : 'MESSAY PRO : erreur de traitement.';
const money = (value: number) => `${new Intl.NumberFormat('fr-FR').format(value)} F CFA`;

export default function AgentRapportsPage() {
  const access = useOutletContext<GareAccessContext>();
  const [gareId, setGareId] = useState(access.gare_ids[0] || '');
  const [gares, setGares] = useState<Gare[]>([]);
  const [reports, setReports] = useState<GareRapportHierarchique[]>([]);
  const [date, setDate] = useState(abidjanDate(new Date()));
  const [amount, setAmount] = useState('0');
  const [observation, setObservation] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const allowed = access.role.startsWith('AGENT_') && access.gare_ids.includes(gareId);
  const today = abidjanDate(new Date());
  const firstDay = abidjanDate(new Date(Date.now() - 29 * day));

  useEffect(() => {
    if (access.gare_ids.includes(gareId)) return;
    setGareId(access.gare_ids[0] || '');
  }, [access.gare_ids, gareId]);

  useEffect(() => {
    let active = true;
    if (!allowed) return;
    setLoading(true);
    setError('');
    void Promise.all([
      garesManagementApi.list(),
      garesHierarchyApi.reports(gareId, firstDay, today),
    ]).then(([stations, response]) => {
      if (!active) return;
      setGares(stations.filter(s => access.gare_ids.includes(s.id)));
      setReports(response.rapports);
    }).catch((reason: unknown) => {
      if (active) {
        setReports([]);
        setError(asError(reason));
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gareId, allowed, firstDay, today, revision]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!allowed || saving) return;
    const amountNumber = Number(amount);
    if (!/^(0|[1-9]\d*)$/.test(amount.trim()) || !Number.isSafeInteger(amountNumber)) {
      setError('MESSAY PRO : renseignez un montant entier positif ou zéro.');
      return;
    }
    if (!date || date > today) {
      setError('MESSAY PRO : la date du rapport ne peut pas être dans le futur.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await garesHierarchyApi.submitReport(gareId, {
        date_rapport: date,
        especes_declarees_fcfa: amountNumber,
        observation: observation.trim() || null,
      });
      setNotice('MESSAY PRO : rapport transmis au Chef de gare.');
      setAmount('0');
      setObservation('');
      setRevision(value => value + 1);
    } catch (reason) {
      setError(asError(reason));
    } finally { setSaving(false); }
  }

  if (!access.role.startsWith('AGENT_') || !access.gare_ids.length) return <p role="alert" className="p-5 text-red-700">Accès non autorisé.</p>;

  return <div className="space-y-5 pb-8">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-orange-600">MESSAY PRO · ESPACE AGENT</p>
        <h2 className="mt-2 text-2xl font-black text-slate-900">Mes rapports de gare</h2>
        <p className="mt-2 text-sm text-slate-500">Déclarez vos espèces et suivez les validations par votre Chef de gare.</p>
      </div>
      <button type="button" onClick={() => setRevision(v => v + 1)} disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw size={16}/> Actualiser</button>
    </div>

    {access.gare_ids.length > 1 && <label className="block text-sm font-bold text-slate-700">Gare
      <select value={gareId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setGareId(event.target.value)} className="mt-2 block w-full max-w-md rounded-xl border border-slate-200 bg-white p-3">
        {access.gare_ids.map(id => <option key={id} value={id}>{gares.find(s => s.id === id)?.nom || id}</option>)}
      </select>
    </label>}
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}

    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-2"><Send size={20} className="text-orange-600"/><h3 className="font-black text-slate-900">Soumettre un rapport</h3></div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">Date du rapport
            <input type="date" required value={date} max={today} onChange={(e: ChangeEvent<HTMLInputElement>) => setDate(e.target.value)} className="mt-2 block w-full rounded-xl border border-slate-200 p-3"/>
          </label>
          <label className="block text-sm font-semibold text-slate-700">Espèces déclarées (F CFA)
            <input type="number" inputMode="numeric" required min="0" step="1" value={amount} onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)} className="mt-2 block w-full rounded-xl border border-slate-200 p-3"/>
          </label>
          <label className="block text-sm font-semibold text-slate-700">Observations (facultatif)
            <textarea maxLength={2000} rows={4} value={observation} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setObservation(e.target.value)} placeholder="Précisions sur le service…" className="mt-2 block w-full rounded-xl border border-slate-200 p-3"/>
          </label>
          <p className="text-xs leading-5 text-slate-500">Le nombre de billets déclarés est calculé par le serveur à partir des ventes enregistrées. Le montant d’espèces est une déclaration, pas un solde certifié.</p>
          <button type="submit" disabled={!allowed || saving} className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-black text-white hover:bg-orange-700 disabled:opacity-50">
            <Send size={16}/>{saving ? 'Transmission…' : 'Transmettre au Chef de gare'}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2"><ClipboardCheck size={20} className="text-orange-600"/><h3 className="font-black text-slate-900">Historique de mes rapports</h3></div>
        <p className="mb-4 text-xs text-slate-500">Rapports chargés du {firstDay} au {today} · maximum 200 lignes.</p>
        {loading ? <p className="text-sm text-slate-500">Chargement…</p>
        : reports.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Aucun rapport pour cette période.</p>
        : <div className="max-h-[600px] space-y-3 overflow-y-auto">
          {reports.map(report => <article key={report.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-slate-900">{report.date_rapport}</strong>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${report.statut === 'RETOURNE_AGENT' ? 'bg-red-100 text-red-700' : report.statut === 'VALIDE_CHEF' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>{report.statut.replaceAll('_', ' ')}</span>
            </div>
            <p className="mt-2 text-xs text-slate-600">{report.billets_declares} billet(s) · {money(report.especes_declarees_fcfa)} d'espèces déclarées</p>
            {report.observation && <p className="mt-2 text-sm text-slate-600">{report.observation}</p>}
          </article>)}
        </div>}
      </section>
    </div>
  </div>;
}
