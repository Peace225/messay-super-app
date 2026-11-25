import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownCircle, CheckCircle2, ClipboardCheck, FileText, Loader2, Mail,
  RefreshCw, ShieldCheck, UserPlus, Wallet, XCircle } from 'lucide-react';
import { garesHierarchyApi, type Gare, type GareAccessContext, type GareAccessRole,
  type GareInvitation, type GareTransaction, type GareRapportHierarchique } from '../services/garesManagementApi';
type Tab = 'transactions' | 'rapports' | 'acces';

interface Props {
  gare: Gare;
  access: GareAccessContext;
  du: string;
  au: string;
  initialTab?: Tab;
}
const cls = 'w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-orange-400';
const roles: Array<{ value: Exclude<GareAccessRole, 'DIRECTION'>; label: string }> = [
  {value:'CHEF_GARE', label:'Chef de gare'},
  {value:'AGENT_BILLETTERIE', label:'Agent billetterie'},
  {value:'AGENT_CAISSE', label:'Agent caisse / trésorerie'},
  {value:'AGENT_EMBARQUEMENT', label:'Agent embarquement'},
  {value:'AGENT_EXPLOITATION', label:'Agent exploitation'},
];
const cash = (amount: number | null) => typeof amount === 'number' && Number.isFinite(amount) ? `${amount.toLocaleString('fr-FR')} FCFA` : '—';
const msg = (error: unknown) => error instanceof Error ? error.message : 'Erreur inconnue';
const fmtDate = (raw: string) => {
  const date = raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('fr-FR') : '—';
};
const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function GareHierarchie({ gare, access, du, au, initialTab = 'transactions' }: Props) {
  const isDirector = access.role === 'DIRECTION';
  const isChief = access.role === 'CHEF_GARE';
  const canInvite = isDirector || isChief;
  const [tab, setTab] = useState<Tab>(() =>
    initialTab === 'acces' && !canInvite ? 'transactions' : initialTab
  );
  const [from, setFrom] = useState(du);
  const [to, setTo] = useState(au);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [transactions, setTransactions] = useState<GareTransaction[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [reports, setReports] = useState<GareRapportHierarchique[]>([]);
  const [invitations, setInvitations] = useState<GareInvitation[]>([]);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<GareAccessRole, 'DIRECTION'>>('AGENT_BILLETTERIE');
  const [dateReport, setDateReport] = useState(() => localDate(new Date()));
  const [cashDeclared, setCashDeclared] = useState('');
  const [observation, setObservation] = useState('');
  const seq = useRef(0);
  const allowedRoles = roles.filter(role => isDirector || role.value !== 'CHEF_GARE');
  const tabs: Array<{id: Tab; label: string; Icon: LucideIcon}> = [
    {id: 'transactions', label: 'Transactions', Icon: Wallet},
    {id: 'rapports', label: 'Rapports hiérarchiques', Icon: ClipboardCheck},
    ...(canInvite ? [{id: 'acces' as const, label: 'Accès et invitations', Icon: UserPlus}] : []),
  ];
  useEffect(() => {
    setTab(initialTab === 'acces' && !canInvite ? 'transactions' : initialTab);
  }, [initialTab, canInvite]);

  useEffect(() => {
    setFrom(du);
    setTo(au);
  }, [du, au]);

  const load = useCallback(async (append = false, selectedCursor: string | null = null) => {
    const request = ++seq.current;
    setError(''); setBusy(true);
    try {
      if (tab !== 'acces' && (
        !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
        from > to
      )) {
        throw new Error('Période invalide : vérifiez les dates du et au.');
      }
      if (tab === 'transactions') {
        const payload = await garesHierarchyApi.transactions(gare.id, from, to, append ? selectedCursor : null);
        if (!payload || !Array.isArray(payload.transactions)) throw new Error('Réponse des transactions invalide.');
        if (request !== seq.current) return;
        setTransactions(prev => append ? [...prev, ...payload.transactions.filter(next => !prev.some(old => old.id === next.id))] : payload.transactions);
        setCursor(payload.next_cursor || null);
      } else if (tab === 'rapports') {
        const payload = await garesHierarchyApi.reports(gare.id, from, to);
        if (!payload || !Array.isArray(payload.rapports)) throw new Error('Réponse des rapports invalide.');
        if (request !== seq.current) return;
        setReports(payload.rapports);
      } else if (canInvite) {
        const payload = await garesHierarchyApi.invitations(gare.id);
        if (!payload || !Array.isArray(payload.invitations)) throw new Error('Réponse des invitations invalide.');
        if (request !== seq.current) return;
        setInvitations(payload.invitations);
      }
    } catch (e) { if (request === seq.current) setError(msg(e)); }
    finally { if (request === seq.current) setBusy(false); }
  }, [tab, gare.id, from, to, canInvite]);
  useEffect(() => {
    setTransactions([]); setCursor(null); setReports([]); setInvitations([]); setSuccess('');
    void load();
    return () => { seq.current += 1; };
  }, [load]);
  const sendInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canInvite || busy) return;
    if (inviteName.trim().length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      setError('Nom complet et adresse email valide requis.'); return;
    }
    if (!allowedRoles.some(role => role.value === inviteRole)) { setError('Ce rôle ne peut pas être attribué depuis votre compte.'); return; }
    setBusy(true); setError(''); setSuccess('');
    try {
      await garesHierarchyApi.invite(gare.id, { nom: inviteName.trim(), email: inviteEmail.trim().toLowerCase(), role: inviteRole });
      setInviteName(''); setInviteEmail('');
      setSuccess('Invitation enregistrée. Le compte devra accepter son invitation avant de pouvoir accéder à la gare.');
      const payload = await garesHierarchyApi.invitations(gare.id);
      setInvitations(payload.invitations);
    } catch (e) { setError(msg(e)); }
    finally { setBusy(false); }
  };
  const sendReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isDirector || busy) return;
    const amount = Number(cashDeclared);
    if (!cashDeclared.trim() || !Number.isSafeInteger(amount) || amount < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(dateReport) || dateReport > localDate(new Date())) {
      setError('Date ou montant des espèces invalide.'); return;
    }
    setBusy(true); setError(''); setSuccess('');
    try {
      await garesHierarchyApi.submitReport(gare.id, { date_rapport: dateReport, especes_declarees_fcfa: amount, observation: observation.trim() || null });
      setCashDeclared(''); setObservation('');
      setSuccess(isChief ? 'Synthèse transmise à la direction.' : 'Rapport transmis au chef de gare.');
      const payload = await garesHierarchyApi.reports(gare.id, from, to);
      setReports(payload.rapports);
    } catch (e) { setError(msg(e)); }
    finally { setBusy(false); }
  };
  const review = async (report: GareRapportHierarchique, decision: 'APPROUVER'|'RETOURNER') => {
    if (busy) return;
    const canReview =
      (isDirector && report.type === 'CHEF_GARE' && report.statut === 'SOUMIS_DIRECTION') ||
      (isChief && report.type === 'AGENT' && report.statut === 'SOUMIS_CHEF');
    if (!canReview) return;
    const motif = decision === 'RETOURNER' ? window.prompt('Motif du retour (obligatoire) :') : null;
    if (decision === 'RETOURNER' && !motif?.trim()) return;
    if (decision === 'APPROUVER' && !window.confirm('Approuver ce rapport ? Cette opération sera auditée.')) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      await garesHierarchyApi.reviewReport(gare.id, report.id, decision, motif?.trim() || null);
      const payload = await garesHierarchyApi.reports(gare.id, from, to);
      setReports(payload.rapports);
      setSuccess(decision === 'APPROUVER' ? 'Rapport validé.' : 'Rapport retourné avec motif.');
    } catch (e) { setError(msg(e)); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Suivi hiérarchique · {gare.nom}</p>
        <h4 className="mt-1 font-black text-slate-900">Transactions et contrôle interne</h4>
        <p className="text-xs text-slate-500">Les données proviennent uniquement du serveur de votre compagnie. Les transactions sont visibles sans attendre les rapports.</p>
      </div>
      <button type="button" disabled={busy} onClick={() => void load()} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
        {busy ? <Loader2 size={15} className="animate-spin"/> : <RefreshCw size={15}/>} Actualiser
      </button>
    </div>
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Gestion de la gare">
      {tabs.map(({id,label,Icon}) =>
        <button type="button" role="tab" aria-selected={tab === id} key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold ${tab === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}><Icon size={15}/>{label}</button>
      )}
    </div>
    {tab !== 'acces' && <div className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
      <label className="text-xs font-semibold text-slate-600">Période du<input className={cls} type="date" max={to} value={from} onChange={e => setFrom(e.target.value)}/></label>
      <label className="text-xs font-semibold text-slate-600">Au<input className={cls} type="date" min={from} max={localDate(new Date())} value={to} onChange={e => setTo(e.target.value)}/></label>
    </div>}
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error} — Vérifiez l'API sécurisée de votre Dashboard.</p>}
    {success && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">{success}</p>}
    {tab === 'transactions' && <div className="space-y-3">
      <p className="text-xs text-slate-500">Du {from} au {to} · ventes mobiles et guichet, paiements confirmés ou autres statuts réellement enregistrés.</p>
      <div className="overflow-x-auto rounded-2xl border border-slate-100">
        <table className="w-full min-w-[770px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>
          <th className="p-3">Date</th><th className="p-3">Billet</th><th className="p-3">Canal / Agent</th><th className="p-3">Paiement</th><th className="p-3">Statut</th><th className="p-3 text-right">Montant</th>
        </tr></thead><tbody>{transactions.map(t => <tr key={t.id} className="border-t border-slate-100">
          <td className="p-3">{fmtDate(t.occurred_at)}</td><td className="p-3 font-semibold">{t.reference_billet || '—'}</td>
          <td className="p-3">{t.canal}{t.agent_nom ? ` · ${t.agent_nom}` : ''}</td><td className="p-3">{t.mode_paiement}</td><td className="p-3">{t.statut}</td><td className="p-3 text-right font-black">{cash(t.montant_fcfa)}</td>
        </tr>)}</tbody></table>
      </div>
      {!busy && !error && transactions.length === 0 && <p className="text-sm text-slate-500">Aucune transaction renvoyée pour cette période.</p>}
      {cursor && <button type="button" disabled={busy} onClick={() => void load(true, cursor)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-50">Charger les transactions suivantes</button>}
    </div>}
    {tab === 'rapports' && <div className="space-y-4">
      {!isDirector && <form onSubmit={event => void sendReport(event)} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <h5 className="font-black text-slate-900">{isChief ? 'Transmettre le rapport du chef à la direction' : 'Transmettre mon rapport au chef de gare'}</h5>
        <p className="mb-4 mt-1 text-xs text-slate-500">Le serveur associe votre identité au rapport et recalcule les ventes enregistrées. Une déclaration ne crée pas de paiement.</p>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-600">Date du rapport<input className={cls} type="date" required value={dateReport} max={localDate(new Date())} onChange={e => setDateReport(e.target.value)}/></label>
          <label className="text-xs font-bold text-slate-600">Espèces déclarées en FCFA<input className={cls} type="number" min="0" step="1" required value={cashDeclared} onChange={e => setCashDeclared(e.target.value)}/></label></div>
        <label className="mt-3 block text-xs font-bold text-slate-600">Observations<textarea className={cls} rows={2} value={observation} onChange={e => setObservation(e.target.value)} placeholder="Justification, anomalies, remises…"/></label>
        <button type="submit" disabled={busy} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><FileText size={15}/> Soumettre le rapport</button>
      </form>}
      {reports.length === 0 && !busy && !error && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Aucun rapport remonté pour cette période.</p>}
      {reports.map(r => {
        const canReview = (isDirector && r.type === 'CHEF_GARE' && r.statut === 'SOUMIS_DIRECTION') || (isChief && r.type === 'AGENT' && r.statut === 'SOUMIS_CHEF');
        return <div key={r.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center">
          <div><p className="text-sm font-black text-slate-900">{r.auteur_nom} <span className="ml-2 rounded-lg bg-orange-50 px-2 py-1 text-[10px] text-orange-600">{r.type}</span></p>
            <p className="mt-1 text-xs text-slate-500">{r.date_rapport} · {r.statut} · Espèces : {cash(r.especes_declarees_fcfa)}</p>
            {r.observation && <p className="mt-2 text-xs text-slate-600">{r.observation}</p>}
          </div>{canReview && <div className="flex shrink-0 gap-2"><button disabled={busy} onClick={() => void review(r,'RETOURNER')} className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 disabled:opacity-50"><XCircle size={14}/> Retourner</button><button disabled={busy} onClick={() => void review(r,'APPROUVER')} className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-50"><CheckCircle2 size={14}/> Valider</button></div>}
        </div>;
      })}
      <p className="text-xs text-slate-500"><ArrowDownCircle size={14} className="inline"/> Agent → Chef de gare → Direction. Les montants restent rapprochés des vraies transactions ; l'approbation n'ajoute pas de crédit au portefeuille.</p>
    </div>}
    {tab === 'acces' && canInvite && <div className="space-y-4">
      <form onSubmit={event => void sendInvite(event)} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <h5 className="font-black text-slate-900">Inviter un membre de la gare</h5>
        <p className="mt-1 text-xs text-slate-500">{isDirector ? 'La direction peut nommer un chef ou des agents.' : 'Le chef de gare peut inviter les agents de sa gare, jamais un autre chef.'} L'invitation ne crée pas de session active immédiatement.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3"><label className="text-xs font-bold text-slate-600">Nom complet<input className={cls} required minLength={3} value={inviteName} onChange={e => setInviteName(e.target.value)}/></label>
          <label className="text-xs font-bold text-slate-600">Email professionnel<input className={cls} type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}/></label>
          <label className="text-xs font-bold text-slate-600">Fonction<select className={cls} value={inviteRole} onChange={e => setInviteRole(e.target.value as Exclude<GareAccessRole,'DIRECTION'>)}>{allowedRoles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label></div>
        <button type="submit" disabled={busy} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Mail size={15}/> Envoyer l'invitation</button>
      </form>
      {!busy && !error && invitations.length === 0 && <p className="text-sm text-slate-500">Aucune invitation renvoyée par le serveur.</p>}
      {invitations.map(inv => <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 p-3 text-xs"><div><span className="font-bold">{inv.nom}</span> · {inv.role}<p className="mt-1 text-slate-500">{inv.email}</p></div><span className="rounded-full bg-slate-50 px-2 py-1 text-slate-600">{inv.statut}</span></div>)}
      <p className="text-xs text-slate-500"><ShieldCheck size={14} className="inline"/> Le serveur doit vérifier l'appartenance à la compagnie, le rôle et la gare à chaque lecture et écriture.</p>
    </div>}
  </div>;
}
