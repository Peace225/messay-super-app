/**
 * MESSAY PRO — Pages métier selon la fonction de l'agent.
 * Les mouvements financiers viennent de son compte via /transactions.
 * Les départs sont des horaires publiés, pas des voyages confirmés.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CalendarDays, RefreshCw, Wallet } from 'lucide-react';
import { garesHierarchyApi, type GareAccessContext, type GareTransaction } from '../../services/garesManagementApi';
import {
  getInterurbainCatalogue,
  type CatalogueOffre,
} from '../../services/interurbainCatalogueApi';
import { abidjanDate } from './AgentDashboard';

type Mode = 'caisse' | 'embarquement' | 'exploitation';
const config = {
  caisse: {
    role: 'AGENT_CAISSE', title: 'Ma caisse',
    description: 'Mes mouvements financiers réellement enregistrés.',
  },
  embarquement: {
    role: 'AGENT_EMBARQUEMENT', title: 'Contrôle d’embarquement',
    description: 'Horaires publiés et gares de départ. Le contrôle de billets sera activé après raccordement de la vérification des QR.',
  },
  exploitation: {
    role: 'AGENT_EXPLOITATION', title: 'Suivi de l’exploitation',
    description: 'Lignes et horaires communs à l’application mobile et au Dashboard Compagnie.',
  },
} as const;
const money = (v: number) => `${new Intl.NumberFormat('fr-FR').format(v)} F CFA`;

export default function AgentOperationsPage({ mode }: { mode: Mode }) {
  const access = useOutletContext<GareAccessContext>();
  const { title, role, description } = config[mode];
  const [gareId, setGareId] = useState(access.gare_ids[0] || '');
  const [dateDu, setDateDu] = useState(abidjanDate(new Date(Date.now() - 6 * 86_400_000)));
  const [dateAu, setDateAu] = useState(abidjanDate(new Date()));
  const [operations, setOperations] = useState<GareTransaction[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [offers, setOffers] = useState<CatalogueOffre[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const allowed = access.role === role && access.gare_ids.includes(gareId);

  useEffect(() => {
    if (!access.gare_ids.includes(gareId)) setGareId(access.gare_ids[0] || '');
  }, [access.gare_ids, gareId]);

  useEffect(() => {
    let active = true;
    setNotice('');
    setOperations([]);
    setCursor(null);
    setOffers([]);
    if (!allowed) return;
    if (dateDu > dateAu) { setNotice('La période de début doit précéder la date de fin.'); return; }
    setBusy(true);
    const run = mode === 'caisse'
      ? garesHierarchyApi.transactions(gareId, dateDu, dateAu)
        .then(page => { if (active) { setOperations(page.transactions); setCursor(page.next_cursor); } })
      : getInterurbainCatalogue(access.company_id, gareId, dateAu)
        .then(result => { if (active) { setOffers(result.offres); if (result.tronque) setNotice('La liste des horaires est partielle : contactez la Direction.'); } });
    void run.catch((err: unknown) => {
      if (active) setNotice(err instanceof Error ? err.message : 'Données indisponibles.');
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [access.company_id, allowed, gareId, dateDu, dateAu, mode, revision]);

  async function loadNext() {
    if (!allowed || !cursor || busy || mode !== 'caisse') return;
    setBusy(true);
    setNotice('');
    try {
      const page = await garesHierarchyApi.transactions(gareId, dateDu, dateAu, cursor);
      setOperations(curr => [...curr, ...page.transactions]);
      setCursor(page.next_cursor);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Autres opérations indisponibles.');
    } finally { setBusy(false); }
  }

  const { encaissements, remboursements } = useMemo(() => ({
    encaissements: operations.filter(op => op.statut === 'PAYE' && op.montant_fcfa > 0).reduce((sum, op) => sum + op.montant_fcfa, 0),
    remboursements: operations.filter(op => op.statut === 'REMBOURSE').reduce((sum, op) => sum + Math.abs(op.montant_fcfa), 0),
  }), [operations]);

  if (access.role !== role || !access.gare_ids.length) return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">Accès réservé au rôle {role}.</div>
  );

  return <div className="space-y-5 pb-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-orange-600">MESSAY PRO · {role.replaceAll('_', ' ')}</p>
        <h2 className="mt-2 text-2xl font-black text-slate-900">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">{description}</p>
      </div>
      <button type="button" onClick={() => setRevision(r => r + 1)} disabled={busy}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">
        <RefreshCw size={16} className={busy ? 'animate-spin' : ''}/> Actualiser
      </button>
    </div>
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      {access.gare_ids.length > 1 && <label className="text-sm font-semibold">Gare
        <select value={gareId} onChange={e => setGareId(e.target.value)} className="mt-2 block rounded-xl border border-slate-200 p-3">
          {access.gare_ids.map(id => <option value={id} key={id}>{id}</option>)}
        </select>
      </label>}
      {mode === 'caisse' ? <>
        <label className="text-sm font-semibold">Du<input type="date" value={dateDu} onChange={e => setDateDu(e.target.value)} className="mt-2 block rounded-xl border border-slate-200 p-3"/></label>
        <label className="text-sm font-semibold">Au<input type="date" value={dateAu} onChange={e => setDateAu(e.target.value)} className="mt-2 block rounded-xl border border-slate-200 p-3"/></label>
      </> : <p className="inline-flex items-center gap-2 text-sm text-slate-600"><CalendarDays size={16}/> Horaires publiés · {dateAu}</p>}
    </div>
    {notice && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{notice}</p>}
    {mode === 'caisse' ? <>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['Encaissements chargés', money(encaissements)],
          ['Remboursements chargés', money(remboursements)],
          ['Net des lignes chargées', money(encaissements - remboursements)],
        ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
        </div>)}
      </div>
      <p className="flex items-start gap-2 text-xs text-slate-500"><AlertTriangle size={15}/> Montants calculés uniquement sur les mouvements chargés. Aucun solde certifié ni clôture comptable.</p>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <h3 className="flex items-center gap-2 border-b p-5 font-black"><Wallet size={19} className="text-orange-600"/> Mes mouvements</h3>
        {busy && !operations.length ? <p className="p-5 text-slate-500">Chargement…</p> : operations.length === 0 ? <p className="p-5 text-slate-500">Aucune opération chargée pour cette période.</p> :
          <div className="divide-y">{operations.map(op => <article key={op.id} className="flex flex-wrap justify-between gap-3 p-4 text-sm">
            <div><p className="font-bold text-slate-900">{op.reference_billet || 'Mouvement enregistré'}</p>
              <p className="mt-1 text-xs text-slate-500">{new Date(op.occurred_at).toLocaleString('fr-FR',{timeZone:'Africa/Abidjan'})} · {op.mode_paiement}</p></div>
            <span className={`font-black ${op.statut === 'REMBOURSE' ? 'text-red-700' : 'text-emerald-700'}`}>{money(op.montant_fcfa)}</span>
          </article>)}</div>}
        {cursor && <button type="button" onClick={() => void loadNext()} disabled={busy} className="m-4 rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50">Charger d'autres mouvements</button>}
      </section>
    </> : <>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {mode === 'embarquement' ? 'Le scan et la validation des QR restent désactivés tant que le backend ne vérifie pas le billet et son statut.'
          : 'Les horaires sont publiés par la compagnie. Aucun départ en temps réel ni disponibilité de siège ne peut être déduit de cette liste.'}
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <h3 className="border-b p-5 font-black">Horaires et lignes de ma gare ({offers.length})</h3>
        {busy ? <p className="p-5 text-sm text-slate-500">Chargement…</p> : !offers.length ? <p className="p-5 text-sm text-slate-500">Aucun horaire publié pour votre gare.</p>
          : <div className="divide-y">{offers.map(offer => <article key={`${offer.destination_id}:${offer.horaire_id}`} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div><p className="font-bold text-slate-900">{offer.ville_depart} → {offer.ville_arrivee}</p>
              <p className="text-xs text-slate-500">{offer.gare_depart_nom} · {offer.gare_arrivee_nom || 'Arrivée à confirmer'}</p></div>
            <div className="text-right"><p className="font-black text-orange-700">{offer.heure_depart}</p>
              <p className="text-xs text-slate-500">{offer.prix_fcfa == null ? 'Tarif à confirmer' : money(offer.prix_fcfa)}</p></div>
          </article>)}</div>}
      </section>
    </>}
    <Link to="/agent/rapports" className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-black text-white">
      Mes rapports <ArrowRight size={16}/>
    </Link>
  </div>;
}
