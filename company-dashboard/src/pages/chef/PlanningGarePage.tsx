/**
 * MESSAY PRO — Gestion des départs : motion design progressif.
 * Aucun changement d'API : les droits et les données restent contrôlés côté backend.
 * Animation 100 % CSS : aucune nouvelle dépendance.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, ArrowUpRight, BusFront, CalendarClock,
  CheckCircle2, ChevronRight, ClipboardCheck, Clock3, Compass,
  MapPin, Plus, RefreshCcw, Route, Send, ShieldCheck, Sparkles, Users,
  Wallet,
} from 'lucide-react';
import {
  garesHierarchyApi,
  type GareAccessContext,
  type GareStaffAgent,
} from '../../services/garesManagementApi';
import {
  garePlanningApi,
  type GarePlanningDemande,
  type GarePlanningLigne,
  type GarePlanningResponse,
  type PlanningDelegation,
} from '../../services/garePlanningApi';

import ChefBusAffectations from './ChefBusAffectations';
import PlanningMensuelBus from './PlanningMensuelBus';

type Panel = 'ligne' | 'tarif' | 'ajout' | 'modification' | 'delegation';

const money = (amount: number) => `${Number(amount).toLocaleString('fr-FR')} FCFA`;
const validHour = (value: string) => /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
const stagger = (index: number): CSSProperties => ({ animationDelay: `${Math.min(index, 12) * 75}ms` });
const inputClass = 'mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-900 outline-none transition duration-200 placeholder:text-slate-400 hover:border-orange-200 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100';
const labelClass = 'block text-sm font-bold text-slate-700';

const requestNames: Record<string, string> = {
  CREATION_LIGNE: 'Nouvelle ligne',
  CHANGEMENT_TARIF: 'Changement de tarif',
  MODIFICATION_HORAIRE: 'Modification d’un horaire publié',
};

const actionTabs: ReadonlyArray<{
  key: Panel;
  title: string;
  description: string;
  icon: typeof Route;
}> = [
  { key: 'ligne', title: 'Nouvelle ligne', description: 'Proposition à valider', icon: Route },
  { key: 'tarif', title: 'Tarification', description: 'Proposer un nouveau prix', icon: Wallet },
  { key: 'ajout', title: 'Ajouter un horaire', description: 'Publier un créneau', icon: Plus },
  { key: 'modification', title: 'Modifier un horaire', description: 'Demander un changement', icon: CalendarClock },
  { key: 'delegation', title: 'Délégations', description: 'Gérer les accès agents', icon: Users },
];

function statusStyle(status: string): string {
  if (status === 'APPROUVE' || status === 'VALIDEE' || status === 'PUBLIE') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  }
  if (status === 'REFUSE' || status === 'REJETE') {
    return 'bg-red-50 text-red-700 ring-red-200';
  }
  return 'bg-amber-50 text-amber-800 ring-amber-200';
}

export default function PlanningGarePage() {
  const access = useOutletContext<GareAccessContext>();
  const isChief = access.role === 'CHEF_GARE';
  const canSubmit = isChief || access.role === 'AGENT_EXPLOITATION';
  const allowedKey = access.gare_ids.join('|');
  const requestSequence = useRef(0);

  const [gareId, setGareId] = useState(() => access.gare_ids[0] || '');
  const [data, setData] = useState<GarePlanningResponse | null>(null);
  const [agents, setAgents] = useState<GareStaffAgent[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);
  const [delegations, setDelegations] = useState<PlanningDelegation[]>([]);
  const [panel, setPanel] = useState<Panel>('ligne');
  const [selectedLine, setSelectedLine] = useState('');
  const [selectedHour, setSelectedHour] = useState('');
  const [arrivalId, setArrivalId] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('3h30');
  const [times, setTimes] = useState('');
  const [time, setTime] = useState('');
  const [newTime, setNewTime] = useState('');
  const [reason, setReason] = useState('');
  const [avisReasons, setAvisReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!gareId || !allowedKey.split('|').includes(gareId)) {
      setLoading(false);
      setData(null);
      return;
    }
    const currentRequest = ++requestSequence.current;
    setLoading(true);
    setError('');
    try {
      const response = await garePlanningApi.gare(gareId);
      if (currentRequest !== requestSequence.current) return;
      setData(response);

      if (isChief) {
        const [staffResult, delegationResult] = await Promise.allSettled([
          garesHierarchyApi.agents(gareId),
          garePlanningApi.delegations(gareId),
        ]);
        if (currentRequest !== requestSequence.current) return;
        setAgents(staffResult.status === 'fulfilled'
          ? staffResult.value.agents.filter((agent) => agent.role === 'AGENT_EXPLOITATION') : []);
        setStaffLoaded(staffResult.status === 'fulfilled');
        setDelegations(delegationResult.status === 'fulfilled' ? delegationResult.value.agents : []);
        if (staffResult.status === 'rejected' || delegationResult.status === 'rejected') {
          setError('Planning chargé, mais certaines données de délégation sont indisponibles. Actualisez pour réessayer.');
        }
      } else {
        setAgents([]);
        setStaffLoaded(false);
        setDelegations([]);
      }
    } catch (cause: unknown) {
      if (currentRequest !== requestSequence.current) return;
      setError(cause instanceof Error ? cause.message : 'Chargement impossible.');
      setData(null);
      setAgents([]);
      setStaffLoaded(false);
      setDelegations([]);
    } finally {
      if (currentRequest === requestSequence.current) setLoading(false);
    }
  }, [gareId, allowedKey, isChief]);

  useEffect(() => {
    void load();
    return () => { requestSequence.current += 1; };
  }, [load]);

  useEffect(() => {
    if (!allowedKey.split('|').includes(gareId)) {
      setGareId(access.gare_ids[0] || '');
    }
  }, [gareId, allowedKey, access.gare_ids]);

  function changeStation(nextId: string) {
    if (!allowedKey.split('|').includes(nextId)) return;
    requestSequence.current += 1;
    setGareId(nextId);
    setData(null);
    setAgents([]);
    setStaffLoaded(false);
    setDelegations([]);
    setSelectedLine('');
    setSelectedHour('');
    setArrivalId('');
    setError('');
    setNotice('');
    setLoading(true);
  }

  const selected: GarePlanningLigne | undefined = data?.lignes.find((line) => line.id === selectedLine);
  const availableHours = selected?.horaires ?? [];
  const canEditSchedules = data?.peut_ajouter_horaire === true;
  const demandes: GarePlanningDemande[] = data?.demandes ?? [];
  const linesCount = data?.lignes.length ?? 0;
  const hoursCount = data?.lignes.reduce((sum, line) => sum + line.horaires.length, 0) ?? 0;
  const pendingCount = demandes.filter((d) => d.statut === 'SOUMIS_CHEF').length;
  const stationName = data?.gares.find((gare) => gare.id === gareId)?.nom ?? 'Votre gare';
  const availableTabs = actionTabs.filter((tab) => {
    if (tab.key === 'ligne') return canSubmit;
    if (tab.key === 'tarif' || tab.key === 'delegation') return isChief;
    return canEditSchedules;
  });
  const activePanel = availableTabs.some((tab) => tab.key === panel) ? panel : availableTabs[0]?.key;

  async function exec(action: () => Promise<unknown>, message: string) {
    if (busy || loading || !data) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(message);
      await load();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Opération refusée.');
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !data || busy || loading || !activePanel) return;
    if (activePanel === 'ligne') {
      const proposedPrice = Number(price);
      const list = [...new Set(times.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean))];
      if (!arrivalId || arrivalId === gareId || !Number.isSafeInteger(proposedPrice) ||
        proposedPrice < 100 || proposedPrice > 1_000_000 ||
        !/^[0-9]{1,2}h[0-5][0-9]$/.test(duration) || !list.length ||
        list.length > 40 || !list.every(validHour)) {
        setError('Vérifiez la destination, le tarif, la durée (ex. 3h30) et les horaires au format HH:MM.');
        return;
      }
      await exec(() => garePlanningApi.proposerLigne(gareId, {
        gare_arrivee_id: arrivalId, prix_fcfa: proposedPrice, duree: duration, horaires: list,
      }), isChief ? 'Demande transmise à la Direction.' : 'Demande soumise au Chef de gare pour avis.');
    } else if (activePanel === 'tarif' && isChief) {
      const proposedPrice = Number(price);
      if (!selectedLine || !Number.isSafeInteger(proposedPrice) || proposedPrice < 100 || proposedPrice > 1_000_000) {
        setError('Choisissez une ligne et un tarif valide.');
        return;
      }
      await exec(() => garePlanningApi.proposerTarif(gareId, selectedLine, proposedPrice),
        'Demande tarifaire transmise à la Direction.');
    } else if (activePanel === 'ajout' && canEditSchedules) {
      if (!selectedLine || !validHour(time)) {
        setError('Une ligne et un horaire HH:MM sont requis.');
        return;
      }
      await exec(() => garePlanningApi.ajouterHoraire(gareId, selectedLine, time),
        'Horaire ajouté au catalogue publié. Aucun billet existant n’a été modifié.');
    } else if (activePanel === 'modification' && canEditSchedules) {
      if (!selectedLine || !selectedHour || !validHour(newTime) || reason.trim().length < 8) {
        setError('Choisissez l’horaire, la nouvelle heure et une justification de 8 caractères minimum.');
        return;
      }
      await exec(() => garePlanningApi.proposerHoraire(gareId, {
        destination_id: selectedLine, horaire_id: selectedHour,
        nouvel_horaire: newTime, motif: reason.trim(),
      }), 'Demande de modification enregistrée : contrôle des billets avant tout changement publié.');
    }
  }

  if (!access.gare_ids.length || !canSubmit) {
    return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 font-semibold text-red-700">Accès à la planification non autorisé.</div>;
  }

  return (
    <div className="messay-plan space-y-6 pb-8">
      <style>{`
        @keyframes mp-rise { from { opacity: 0; transform: translate3d(0, 19px, 0) scale(.985); } to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); } }
        @keyframes mp-soft-in { from { opacity: 0; filter: blur(5px); } to { opacity: 1; filter: blur(0); } }
        @keyframes mp-float { 0%, 100% { transform: translate3d(0, 0, 0); } 50% { transform: translate3d(0, -12px, 0); } }
        @keyframes mp-pulse { 0%, 100% { opacity: .45; transform: scale(1); } 50% { opacity: .8; transform: scale(1.06); } }
        @keyframes mp-track { from { transform: translateX(-110%); } to { transform: translateX(350%); } }
        .messay-plan .mp-enter { animation: mp-rise .68s cubic-bezier(.22,1,.36,1) both; }
        .messay-plan .mp-appear { animation: mp-soft-in .35s ease-out both; }
        .messay-plan .mp-float { animation: mp-float 7.5s ease-in-out infinite; }
        .messay-plan .mp-pulse { animation: mp-pulse 8s ease-in-out infinite; }
        .messay-plan .mp-raise { transition: transform .32s cubic-bezier(.22,1,.36,1), box-shadow .32s ease, border-color .25s ease;}
        .messay-plan .mp-raise:hover { transform: translateY(-4px); box-shadow: 0 20px 42px -28px rgba(15,23,42,.4); }
        .messay-plan .mp-press { transition: transform .18s ease, box-shadow .2s ease, background-color .2s ease; }
        .messay-plan .mp-press:active:not(:disabled) { transform: scale(.975); }
        .messay-plan .mp-sweep { position: relative; overflow: hidden; }
        .messay-plan .mp-sweep::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(110deg, transparent 10%, rgba(255,255,255,.15) 48%, transparent 75%); transform: translateX(-110%); transition: transform .7s ease; }
        .messay-plan .mp-sweep:hover::after { transform: translateX(110%); }
        .messay-plan .mp-progress { animation: mp-track 1.3s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .messay-plan *, .messay-plan *::before, .messay-plan *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
          .messay-plan .mp-raise:hover, .messay-plan .mp-press:active { transform: none !important; }
        }
      `}</style>

      {/* Hero immersif, sans chiffres fictifs. */}
      <header className="mp-enter relative isolate overflow-hidden rounded-[28px] bg-[#101827] px-6 py-8 text-white shadow-[0_24px_60px_-32px_rgba(16,24,39,.7)] sm:px-9 sm:py-10">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="mp-pulse absolute -right-24 -top-32 h-96 w-96 rounded-full bg-orange-500/25 blur-[80px]" />
          <div className="mp-float absolute -bottom-36 left-1/4 h-72 w-72 rounded-full bg-amber-400/10 blur-[70px]" />
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.45) .7px, transparent .7px)', backgroundSize: '20px 20px' }} />
          <BusFront className="mp-float absolute -right-4 top-10 h-48 w-48 -rotate-6 text-orange-400/10 sm:right-16 sm:h-64 sm:w-64"strokeWidth={1} />
        </div>
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/25 bg-orange-400/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.2em] text-orange-200">
              <Sparkles size={13} aria-hidden="true" /> MESSAY PRO / Exploitation
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">Gestion des <span className="text-orange-400">départs.</span></h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">Pilotez les lignes et les horaires de votre gare, transmettez vos propositions et coordonnez les agents d’exploitation.</p>
            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-200">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2"><MapPin size={14} className="text-orange-300" /> {stationName}</span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2"><ShieldCheck size={14} className="text-emerald-300" /> Accès {isChief ? 'Chef de gare' : 'Exploitation'}</span>
            </div>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading || busy}
            className="mp-press mp-sweep inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20 disabled:cursor-wait disabled:opacity-60">
            <RefreshCcw size={17} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
        </div>
      </header>

      <section className="mp-enter rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5" style={stagger(1)} aria-label="Gare de travail">
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-orange-50 text-orange-600"><Compass size={21} /></div>
          <div className="min-w-[170px] flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[.13em] text-slate-400">Gare affectée</p>
            <p className="mt-0.5 font-black text-slate-900">{stationName}</p>
          </div>
          <label className="min-w-[185px] text-xs font-bold text-slate-500">
            Choisir une gare
            <select value={gareId} onChange={(event) => changeStation(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100">
              {access.gare_ids.map((id) => (
                <option key={id} value={id}>{data?.gares.find((gare) => gare.id === id)?.nom ?? id}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error && <div role="alert" className="mp-appear flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800"><AlertTriangle size={19} className="mt-0.5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="mp-appear flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"><CheckCircle2 size={19} className="mt-0.5 shrink-0" />{notice}</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicateurs de planification">
        {[
          { icon: Route, label: 'Lignes publiées', value: data ? linesCount : '—', hint: 'Catalogue de la gare', color: 'text-orange-600', background: 'bg-orange-50' },
          { icon: Clock3, label: 'Horaires publiés', value: data ? hoursCount : '—', hint: 'Créneaux de référence', color: 'text-blue-600', background: 'bg-blue-50' },
          { icon: ClipboardCheck, label: 'Demandes en attente', value: data ? pendingCount : '—', hint: 'Soumises au chef', color: 'text-amber-600', background: 'bg-amber-50' },
          { icon: Users, label: 'Agents exploitation', value: data && isChief && staffLoaded ? agents.length : '—', hint: isChief ? 'Liste chargée' : 'Réservé au chef', color: 'text-emerald-600', background: 'bg-emerald-50' },
        ].map(({ icon: Icon, label, value, hint, color, background }, index) => (
          <article key={label} className="mp-enter mp-raise rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" style={stagger(index + 2)}>
            <div className="flex items-start justify-between gap-2">
              <span className={`rounded-xl p-2.5 ${background} ${color}`}><Icon size={20} /></span>
              <ArrowUpRight size={16} className="text-slate-300" aria-hidden="true" />
            </div>
            <p className="mt-4 text-xs font-semibold text-slate-500">{label}</p>
            <p className="mt-1 text-3xl font-black tracking-tight text-slate-900" aria-live="polite">{loading && !data ? '—' : value}</p>
            <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
          </article>
        ))}
      </section>

      {loading && <div className="relative overflow-hidden rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600" role="status"><span className="relative z-10">Synchronisation du planning de la gare…</span><span className="mp-progress absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-orange-200/70 to-transparent" aria-hidden="true" /></div>}

      {/* Catalogue : horaires publiés, pas preuve d'un départ effectivement réalisé. */}
      <section className="mp-enter overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm" style={stagger(4)}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
          <div>
            <div className="flex items-center gap-2"><span className="rounded-xl bg-orange-50 p-2 text-orange-600"><BusFront size={19}/></span><h2 className="text-lg font-black text-slate-900">Lignes et horaires publiés</h2></div>
            <p className="mt-2 text-xs text-slate-500">Horaires de référence : les circulations datées et les sièges disponibles ne sont pas confirmés ici.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">{linesCount} ligne{linesCount > 1 ?'s' : ''}</span>
        </div>
        <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2">
          {!loading && data?.lignes.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500 lg:col-span-2">Aucune ligne de départ publiée pour cette gare.</div>}
          {data?.lignes.map((line, index) => (
            <article key={`${gareId}-${line.id}`} className="mp-enter mp-raise group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/80 p-5" style={stagger(index)}>
              <span className="absolute inset-y-0 left-0 w-1 bg-orange-500" aria-hidden="true" />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-400"><MapPin size={13} /> Ligne interurbaine</div>
                  <h3 className="mt-2 text-base font-black text-slate-900">{line.depart_nom}<span className="mx-2 text-orange-500">→</span>{line.arrivee_nom || line.ville}</h3>
                </div>
                <span className="rounded-xl bg-orange-50 px-3 py-2 text-sm font-black text-orange-700">{money(line.prix)}</span>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500"><Clock3 size={14} /> Durée indicative: {line.duree || 'Non renseignée'}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {line.horaires.length === 0 && <span className="text-xs text-slate-400">Aucun horaire publié</span>}
                {line.horaires.map((hour) => <span key={hour.id} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 transition-colors group-hover:border-orange-100"><Clock3 size={12} className="text-orange-500" />{hour.heure_depart}</span>)}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Affectation d'un bus réel par le Chef de gare ; conservée hors du workflow d'édition des horaires. */}
      {isChief && data && (
        <ChefBusAffectations
          key={gareId}
          gareId={gareId}
          gareName={stationName}
          lignes={data.lignes}
        />
      )}

      {/* Calendrier mensuel en lecture seule. */}
      {isChief && data && (
        <PlanningMensuelBus
          key={`mensuel-${gareId}`}
          gareId={gareId}
          gareName={stationName}
          lignes={data.lignes}
        />
      )}

      {canSubmit && (
        <section className="mp-enter overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm" style={stagger(5)}>
          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex items-center gap-2"><span className="rounded-xl bg-orange-50 p-2 text-orange-600"><Sparkles size={19} /></span><h2 className="text-lg font-black text-slate-900">Actions opérationnelles</h2></div>
            <p className="mt-2 text-xs text-slate-500">Les modifications soumises à approbation suivent le circuit de validation prévu par la compagnie.</p>
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" role="group" aria-label="Choisir une opération">
              {availableTabs.map((tab) => {
                const Icon = tab.icon;
                const active = activePanel === tab.key;
                return (
                  <button key={tab.key} type="button" aria-pressed={active} onClick={() => { setPanel(tab.key); setError(''); }}
                    className={`mp-press flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors duration-300 ${active ? 'border-orange-300 bg-orange-50 shadow-[0_8px_22px_-16px_rgba(234,88,12,.5)]' : 'border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/40'}`}>
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${active ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-500'}`}><Icon size={18} /></span>
                    <span className="min-w-0 flex-1"><span className={`block text-sm font-black ${active ? 'text-orange-800' : 'text-slate-900'}`}>{tab.title}</span><span className="mt-0.5 block text-[11px] text-slate-500">{tab.description}</span></span>
                    <ChevronRight size={16} className={active ? 'text-orange-500' : 'text-slate-300'} />
                  </button>
                );
              })}
            </div>

            {activePanel && activePanel !== 'delegation' && (
              <form key={activePanel} onSubmit={(event) => void submit(event)} className="mp-enter mt-6 grid gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 md:grid-cols-2 sm:p-6">
                {activePanel === 'ligne' ? (
                  <>
                    <label className={labelClass}>Gare d’arrivée
                      <select required value={arrivalId} onChange={(event) => setArrivalId(event.target.value)} className={inputClass}>
                        <option value="">Sélectionner une gare…</option>
                        {data?.gares.filter((gare) => gare.id !== gareId).map((gare) => <option key={gare.id} value={gare.id}>{gare.nom} — {gare.ville}</option>)}
                      </select>
                    </label>
                    <label className={labelClass}>Tarif proposé (FCFA)
                      <input required type="number" min="100" max="1000000" value={price} onChange={(event) => setPrice(event.target.value)} className={inputClass}/>
                    </label>
                    <label className={labelClass}>Durée du trajet (ex. 3h30)
                      <input required value={duration} onChange={(event) => setDuration(event.target.value)} className={inputClass}/>
                    </label>
                    <label className={labelClass}>Horaires séparés par des virgules
                      <input required placeholder="07:30, 09:00, 14:30" value={times} onChange={(event) => setTimes(event.target.value)} className={inputClass}/>
                    </label>
                  </>
                ) : (
                  <>
                    <label className={labelClass}>Ligne de départ
                      <select required value={selectedLine} onChange={(event) => { setSelectedLine(event.target.value); setSelectedHour(''); }} className={inputClass}>
                        <option value="">Choisir une ligne…</option>
                        {data?.lignes.map((line) => <option key={line.id} value={line.id}>{line.ville} — {money(line.prix)}</option>)}
                      </select>
                    </label>
                    {activePanel === 'tarif' && (
                      <label className={labelClass}>Nouveau tarif proposé (FCFA)
                        <input required type="number" min="100" max="1000000" value={price} onChange={(event) => setPrice(event.target.value)} className={inputClass}/>
                      </label>
                    )}
                    {activePanel === 'ajout' && (
                      <label className={labelClass}>Nouvel horaire de départ
                        <input required type="time" value={time} onChange={(event) => setTime(event.target.value)} className={inputClass}/>
                      </label>
                    )}
                    {activePanel === 'modification' && (
                      <>
                        <label className={labelClass}>Horaire actuellement publié
                          <select required value={selectedHour} onChange={(event) => setSelectedHour(event.target.value)} className={inputClass}>
                            <option value="">Sélectionner l’horaire…</option>
                            {availableHours.map((hour) => <option key={hour.id} value={hour.id}>{hour.heure_depart}</option>)}
                          </select>
                        </label>
                        <label className={labelClass}>Nouvelle heure demandée
                          <input required type="time" value={newTime} onChange={(event) => setNewTime(event.target.value)} className={inputClass}/>
                        </label>
                        <label className={`${labelClass} md:col-span-2`}>Justification du changement
                          <textarea required minLength={8} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass}/>
                        </label>
                      </>
                    )}
                  </>
                )}
                <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                  <button type="submit" disabled={busy || loading || !data} className="mp-press mp-sweep inline-flex items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-orange-200 transition hover:bg-orange-700 disabled:cursor-wait disabled:opacity-50">
                    {busy ? <RefreshCcw size={17} className="animate-spin" /> : activePanel === 'ajout' ? <Plus size={17} /> : <Send size={17} />}
                    {busy ? 'Enregistrement…' : activePanel === 'ajout' ? 'Ajouter cet horaire' : 'Soumettre à validation'}
                    {!busy && <ArrowRight size={16} />}
                  </button>
                  <span className="text-xs text-slate-400">Opération autorisée selon les droits de votre gare</span>
                </div>
              </form>
            )}

            {activePanel === 'delegation' && isChief && (
              <div key="delegation" className="mp-enter mt-6 space-y-3">
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Seuls les agents d’exploitation de cette gare peuvent recevoir cette délégation. Vous pouvez retirer l'accès à tout moment.</p>
                {agents.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">Aucun agent d’exploitation trouvé pour cette gare.</p>}
                {agents.map((agent, index) => {
                  const enabled = delegations.some((item) => item.auth_user_id === agent.auth_user_id && item.autorise);
                  return (
                    <div key={agent.id} className="mp-enter mp-raise flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4" style={stagger(index)}>
                      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-orange-50 text-orange-600"><Users size={18}/></span><div><p className="font-bold text-slate-900">{agent.nom || agent.email || 'Agent d’exploitation'}</p><p className="text-xs text-slate-500">{agent.email || 'Compte actif'}</p></div></div>
                      <button type="button" disabled={busy || loading} onClick={() => void exec(() => garePlanningApi.delegation(gareId, agent.auth_user_id, !enabled), enabled ? 'Délégation retirée.' : 'Délégation accordée.')}
                        className={`mp-press rounded-xl px-4 py-2.5 text-xs font-bold transition disabled:opacity-50 ${enabled ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100' : 'bg-orange-600 text-white hover:bg-orange-700'}`}>
                        {enabled ? 'Retirer l’accès horaires' : 'Autoriser les ajouts'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {activePanel === 'modification' && (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-mediumtext-amber-900"><ShieldCheck size={16} className="shrink-0"/>Un horaire publié n'est pas écrasé avant le contrôle des billets existants et des notifications nécessaires.</p>
            )}
          </div>
        </section>
      )}

      <section className="mp-enter overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm" style={stagger(6)}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
          <div><div className="flex items-center gap-2"><span className="rounded-xl bg-orange-50 p-2 text-orange-600"><ClipboardCheck size={19} /></span><h2 className="text-lg font-black text-slate-900">Demandes de planification</h2></div><p className="mt-2 text-xs text-slate-500">Suivi des propositions et du circuit de validation.</p></div>
          <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">{demandes.length} demande{demandes.length > 1 ? 's' : ''}</span>
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          {!loading && demandes.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-7 text-center text-sm text-slate-500">Aucune demande enregistrée pour cette gare.</p>}
          {demandes.map((demand, index) => (
            <article key={`${gareId}-${demand.id}`} className="mp-enter mp-raise flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4" style={stagger(index)}>
              <div className="min-w-0 flex-1">
                <p className="font-black text-slate-900">{requestNames[demand.type] || demand.type}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(demand.cree_le).toLocaleString('fr-FR')}{demand.prix_fcfa ? ` ·${money(demand.prix_fcfa)}` : ''}</p>
                {demand.motif_decision && <p className="mt-2 text-xs text-slate-600">Motif : {demand.motif_decision}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1.5 text-[11px] font-black ring-1 ${statusStyle(demand.statut)}`}>{demand.statut.replace(/_/g, ' ')}</span>
                {isChief && demand.statut === 'SOUMIS_CHEF' && (
                  <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                    <input aria-label="Motif du refus" placeholder="Motif si refus" maxLength={1000} value={avisReasons[demand.id] || ''}
                      onChange={(event) => setAvisReasons((previous) => ({ ...previous, [demand.id]: event.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-orange-400"/>
                    <button type="button" disabled={busy || loading} onClick={() => void exec(() => garePlanningApi.avisChef(gareId,demand.id, 'TRANSMETTRE'), 'Demande transmise à la Direction.')}
                      className="mp-press inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700 disabled:opacity-50"><Send size={13} /> Transmettre</button>
                    <button type="button" disabled={busy || loading} onClick={() => {
                      const reasonText = (avisReasons[demand.id] || '').trim();
                      if (reasonText.length < 5) { setError('Motif de refus : au moins 5 caractères.'); return; }
                      void exec(() => garePlanningApi.avisChef(gareId, demand.id, 'REFUSER', reasonText), 'Proposition refusée avec motif.');
                    }} className="mp-press rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50">Refuser</button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 text-xs text-slate-500 sm:px-6">
          <span>Les ventes et paiements sont gérés dans les modules dédiés.</span>
          <Link to={isChief ? '/chef-gare/billetterie' : '/agent/exploitation'} className="inline-flex items-center gap-1.5 font-black text-orange-600 hover:text-orange-700">Accéder à l’exploitation <ArrowRight size={14} /></Link>
        </div>
      </section>
    </div>
  );
}