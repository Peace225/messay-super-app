/**
 * MESSAY PRO — Direction · Validation des lignes et tarifs
 * Motion design sans dépendance supplémentaire (CSS + Tailwind).
 * Les décisions restent exclusivement traitées par le backend autorisé.
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BusFront,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileCheck2,
  MapPin,
  RefreshCcw,
  Route,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import {
  garePlanningApi,
  type GarePlanningDemande,
  type GarePlanningLigne,
} from '../services/garePlanningApi';

const LABEL: Record<string, string> = {
  CREATION_LIGNE: 'Création de ligne',
  CHANGEMENT_TARIF: 'Révision de tarif',
  MODIFICATION_HORAIRE: 'Changement d’horaire existant',
};

const formatMoney = (value: number) => `${Number(value).toLocaleString('fr-FR')} FCFA`;
const stagger = (index: number): CSSProperties => ({
  animationDelay: `${Math.min(index, 16) * 75}ms`,
});

function statusAppearance(status: string): string {
  if (status === 'APPROUVEE' || status === 'APPROUVE' || status === 'VALIDEE') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (status === 'REFUSEE' || status === 'REFUSE' || status === 'REJETEE') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

export default function DirectionPlanningDemandesPage() {
  const [items, setItems] = useState<GarePlanningDemande[]>([]);
  const [lines, setLines] = useState<GarePlanningLigne[]>([]);
  const [filterGare, setFilterGare] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [response, network] = await Promise.all([
        garePlanningApi.demandesDirection(),
        garePlanningApi.reseauDirection(),
      ]);
      setItems(response.demandes);
      setLines(network.lignes);
    } catch (cause: unknown) {
      setItems([]);
      setLines([]);
      setError(cause instanceof Error ? cause.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(item: GarePlanningDemande, approve: boolean) {
    if (busy || loading) return;
    if (approve && item.type === 'MODIFICATION_HORAIRE') {
      setError('Les horaires existants ne peuvent pas être validés avant le raccordement aux billets datés et aux notifications passagers.');
      return;
    }

    const reason = (reasons[item.id] || '').trim();
    if (!approve && reason.length < 5) {
      setError('Un motif de refus de 5 caractères minimum est requis.');
      return;
    }

    if (!window.confirm(approve
      ? 'Approuver et publier cette nouvelle ligne ou ce nouveau tarif ?'
      : 'Confirmer le refus de cette demande ?')) return;

    setBusy(item.id);
    setError('');
    setNotice('');
    try {
      await garePlanningApi.decider(item.id, approve ? 'APPROUVER' : 'REFUSER', reason);
      setNotice(approve
        ? 'Demande approuvée et appliquée en base.'
        : 'Demande refusée avec motif.');
      await load();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Décision refusée.');
    } finally {
      setBusy(null);
    }
  }

  const pending = items.filter((item) => item.statut === 'EN_ATTENTE');
  const history = items.filter((item) => item.statut !== 'EN_ATTENTE');
  const approvedCount = items.filter((item) => item.statut === 'APPROUVEE').length;
  const refusedCount = items.filter((item) => item.statut === 'REFUSEE').length;
  const visibleLines = lines.filter((line) => !filterGare || line.gare_depart_id === filterGare);
  const gareOptions = [...new Map(
    lines.filter((line) => line.gare_depart_id)
      .map((line) => [line.gare_depart_id, line.depart_nom] as const),
  ).entries()];

  const stats = [
    { label: 'En attente', count: pending.length, Icon: Clock3, accent: 'text-amber-600', bg: 'bg-amber-50', description: 'À examiner par la Direction' },
    { label: 'Approuvées', count: approvedCount, Icon: CheckCircle2, accent: 'text-emerald-600', bg: 'bg-emerald-50', description: 'Décisions enregistrées' },
    { label: 'Refusées', count: refusedCount, Icon: XCircle, accent: 'text-rose-600', bg: 'bg-rose-50', description: 'Avec motif de refus' },
  ];

  return (
    <div className="messay-direction-motion space-y-6 pb-10">
      <style>{`
        @keyframes mdm-enter { from { opacity: 0; transform: translate3d(0, 22px, 0) scale(.985); } to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); } }
        @keyframes mdm-fade { from { opacity: 0; filter: blur(5px); } to { opacity: 1; filter: blur(0); } }
        @keyframes mdm-float { 0%, 100% { transform: translate3d(0, 0, 0); } 50% { transform: translate3d(0, -15px, 0); } }
        @keyframes mdm-glow { 0%, 100% { opacity: .5; transform: scale(1); } 50% { opacity: .8; transform: scale(1.08); } }
        @keyframes mdm-sweep { from { transform: translateX(-130%); } to { transform: translateX(330%); } }
        @keyframes mdm-pulse-dot { 0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,.35); } 55% { box-shadow: 0 0 0 7px rgba(245,158,11,0); } }
        .messay-direction-motion .mdm-enter { animation: mdm-enter .7s cubic-bezier(.22,1,.36,1) both; }
        .messay-direction-motion .mdm-fade { animation: mdm-fade .35s ease-out both; }
        .messay-direction-motion .mdm-float { animation: mdm-float 8s ease-in-out infinite; }
        .messay-direction-motion .mdm-glow { animation: mdm-glow 9s ease-in-out infinite; }
        .messay-direction-motion .mdm-loading { animation: mdm-sweep 1.25s ease-in-out infinite; }
        .messay-direction-motion .mdm-pending-dot { animation: mdm-pulse-dot 2.6s ease-out infinite; }
        .messay-direction-motion .mdm-lift { transition: transform .3s cubic-bezier(.22,1,.36,1), box-shadow .3s ease, border-color .3s ease, background-color .3s ease; }
        .messay-direction-motion .mdm-lift:hover { transform: translateY(-4px); box-shadow: 0 22px 45px -28px rgba(15,23,42,.35); }
        .messay-direction-motion .mdm-button { transition: transform .2s ease, box-shadow .2s ease, background-color .2s ease, border-color .2s ease; }
        .messay-direction-motion .mdm-button:hover:not(:disabled) { transform: translateY(-2px); }
        .messay-direction-motion .mdm-button:active:not(:disabled) { transform: scale(.97); }
        .messay-direction-motion .mdm-sheen { position: relative; overflow: hidden; }
        .messay-direction-motion .mdm-sheen::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(110deg,transparent 12%,rgba(255,255,255,.16) 49%,transparent 77%); transform: translateX(-110%); transition: transform .75s ease; }
        .messay-direction-motion .mdm-sheen:hover::after { transform: translateX(110%); }
        @media (prefers-reduced-motion: reduce) {
          .messay-direction-motion *, .messay-direction-motion *::before, .messay-direction-motion *::after {
            animation: none !important; transition: none !important; scroll-behavior: auto !important;
          }
          .messay-direction-motion .mdm-lift:hover, .messay-direction-motion .mdm-button:hover:not(:disabled), .messay-direction-motion .mdm-button:active:not(:disabled) { transform: none !important; }
        }
      `}</style>

      {/* Hero premium — les valeurs métier proviennent exclusivement du backend. */}
      <header className="mdm-enter relative isolate overflow-hidden rounded-[28px] bg-[#121D31] px-6 py-8 text-white shadow-[0_25px_65px_-38px_rgba(18,29,49,.8)] sm:px-9 sm:py-10">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="mdm-glow absolute -right-24 -top-40 h-96 w-96 rounded-full bg-orange-500/30 blur-[80px]" />
          <div className="mdm-float absolute -bottom-40 left-1/4 h-80 w-80 rounded-full bg-cyan-400/15 blur-[90px]" />
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.4) .7px, transparent .7px)', backgroundSize: '22px 22px' }} />
          <Route className="mdm-float absolute -right-5 top-8 h-52 w-52 -rotate-12 text-orange-400/10 sm:right-14 sm:h-72 sm:w-72" strokeWidth={1} />
        </div>
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/25 bg-orange-400/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.16em] text-orange-200">
              <Sparkles size={14} aria-hidden="true" /> MESSAY PRO · Direction
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
              Validation des <span className="text-orange-400">lignes et tarifs.</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Les chefs de gare proposent les lignes et les tarifs. La Direction examine les demandes, puis décide de leur publication.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-200">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2"><ShieldCheck size={14} className="text-emerald-300" /> Décisions réservées à la Direction</span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2"><BusFront size={14} className="text-orange-300" /> Réseau interurbain</span>
            </div>
          </div>
          <button
            onClick={() => void load()}
            type="button"
            disabled={loading || !!busy}
            className="mdm-button mdm-sheen inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 disabled:cursor-wait disabled:opacity-50"
          >
            <RefreshCcw size={17} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            Actualiser
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Indicateurs de validation">
        {stats.map(({ label, count, Icon, accent, bg, description }, index) => (
          <article key={label} style={stagger(index + 1)} className="mdm-enter mdm-lift rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <span className={`grid h-11 w-11 place-items-center rounded-xl ${bg} ${accent}`}><Icon size={21} aria-hidden="true" /></span>
              <ArrowUpRight size={17} className="text-slate-300" aria-hidden="true" />
            </div>
            <p className="mt-4 text-xs font-bold text-slate-500">{label}</p>
            <strong className="mt-1 block text-3xl font-black tracking-tight text-slate-900" aria-live="polite">{loading && !items.length ? '—' : count}</strong>
            <p className="mt-1 text-[11px] text-slate-400">{description}</p>
          </article>
        ))}
      </section>

      {error && (
        <div role="alert" className="mdm-fade flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
          <AlertTriangle size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div role="status" className="mdm-fade flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          <CheckCircle2 size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      )}
      {loading && (
        <div role="status" className="relative overflow-hidden rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">
          <span className="relative z-10 inline-flex items-center gap-2"><RefreshCcw size={16} className="animate-spin" /> Synchronisation des données de la compagnie…</span>
          <span className="mdm-loading absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-orange-200/70 to-transparent" aria-hidden="true" />
        </div>
      )}

      <section className="mdm-enter overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm" style={stagger(4)} aria-labelledby="mdm-reseau-title">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-50 text-orange-600"><Route size={19} aria-hidden="true" /></span>
              <div>
                <h2 id="mdm-reseau-title" className="text-lg font-black text-slate-900">Réseau publié de la compagnie</h2>
                <p className="mt-1 text-xs text-slate-500">Lecture seule · horaires enregistrés, places non confirmées</p>
              </div>
            </div>
          </div>
          <label className="relative block min-w-[190px] text-xs font-semibold text-slate-600">
            <span className="sr-only">Filtrer par gare</span>
            <select
              aria-label="Filtrer par gare"
              value={filterGare}
              onChange={(event) => setFilterGare(event.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-3 pl-4 pr-10 text-sm font-semibold text-slate-700 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
            >
              <option value="">Toutes les gares</option>
              {gareOptions.map(([id, nom]) => <option key={id} value={id}>{nom || id}</option>)}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute bottom-3.5 right-3 text-slate-400" aria-hidden="true" />
          </label>
        </div>
        <div className="grid gap-3 p-4 sm:p-6 lg:grid-cols-2">
          {!loading && visibleLines.length === 0 && (
            <div className="mdm-fade rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500 lg:col-span-2">
              Aucune ligne publiée pour ce filtre.
            </div>
          )}
          {visibleLines.map((line, index) => (
            <article key={line.id} style={stagger(index)} className="mdm-enter mdm-lift group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/70 p-5 hover:border-orange-200">
              <span className="absolute inset-y-0 left-0 w-1 bg-orange-500" aria-hidden="true" />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400"><MapPin size={13} className="text-orange-500" /> Ligne publiée</p>
                  <h3 className="mt-2 flex flex-wrap items-center gap-2 text-sm font-black text-slate-900 sm:text-base">
                    <span>{line.depart_nom || 'Gare'}</span>
                    <ArrowRight size={16} className="text-orange-500 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
                    <span>{line.arrivee_nom || line.ville}</span>
                  </h3>
                </div>
                <strong className="rounded-xl bg-orange-50 px-3 py-2 text-sm font-black text-orange-700">{formatMoney(Number(line.prix))}</strong>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                <Clock3 size={14} aria-hidden="true" />
                {line.horaires.map((hour) => hour.heure_depart).join(' · ') || 'Aucun horaire publié'}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="mdm-demandes-title">
        <div className="mdm-enter flex flex-wrap items-center justify-between gap-3" style={stagger(5)}>
          <div>
            <h2 id="mdm-demandes-title" className="text-xl font-black text-slate-900">Demandes à contrôler</h2>
            <p className="mt-1 text-sm text-slate-500">Décisions enregistrées et vérifiées côté serveur.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">
            <span className="mdm-pending-dot h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
            {pending.length} en attente
          </span>
        </div>
        {!pending.length && !loading && (
          <div className="mdm-fade rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
            <CheckCircle2 size={30} className="mx-auto text-emerald-500" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-slate-600">Aucune demande en attente.</p>
          </div>
        )}
        {pending.map((item, index) => (
          <article key={item.id} style={stagger(index + 5)} className="mdm-enter mdm-lift overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm hover:border-orange-200">
            <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-transparent" />
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black uppercase tracking-[.12em] text-orange-600">{LABEL[item.type] || item.type}</p>
                  <h3 className="mt-2 flex flex-wrap items-center gap-2 text-lg font-black text-slate-900">
                    <span>{item.gare_nom || 'Gare'}</span>
                    {item.arrivee_nom && <><ArrowRight size={17} className="text-orange-500" aria-hidden="true" /><span>{item.arrivee_nom}</span></>}
                  </h3>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><CalendarClock size={14} aria-hidden="true" /> {new Date(item.cree_le).toLocaleString('fr-FR')}</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">
                  <span className="mdm-pending-dot h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" /> À valider
                </span>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {item.prix_fcfa != null && <span className="rounded-lg bg-orange-50 px-3 py-2 text-xs font-black text-orange-700">{formatMoney(item.prix_fcfa)}</span>}
                {item.duree && <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700"><Clock3 size={13} /> {item.duree}</span>}
                {item.horaires?.length > 0 && <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700"><CalendarClock size={13} /> {item.horaires.join(' · ')}</span>}
                {item.nouvel_horaire && <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">Nouvelle heure : {item.nouvel_horaire}</span>}
              </div>
              {item.motif && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Justification : {item.motif}</p>}
              {item.type === 'MODIFICATION_HORAIRE' && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">
                  <ShieldCheck size={17} className="shrink-0" aria-hidden="true" />
                  La validation d’un horaire publié reste désactivée : contrôler d’abord les billets datés et informer les passagers concernés.
                </div>
              )}
              <label className="mt-5 block text-sm font-bold text-slate-700" htmlFor={`mdm-reason-${item.id}`}>
                Motif de décision <span className="font-normal text-slate-500">(obligatoire pour un refus)</span>
              </label>
              <textarea
                id={`mdm-reason-${item.id}`}
                value={reasons[item.id] || ''}
                onChange={(event) => setReasons((previous) => ({ ...previous, [item.id]: event.target.value }))}
                maxLength={1000}
                rows={2}
                placeholder="Justification de la décision…"
                className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm text-slate-800 outline-none transition duration-200 placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
              />
              <div className="mt-4 flex flex-wrap gap-3">
                {item.type !== 'MODIFICATION_HORAIRE' && (
                  <button type="button" disabled={!!busy || loading} onClick={() => void decide(item, true)}
                    className="mdm-button mdm-sheen inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700 hover:shadow-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-wait disabled:opacity-50">
                    {busy === item.id ? <RefreshCcw size={17} className="animate-spin" /> : <Check size={17} />}
                    Approuver <ArrowRight size={15} />
                  </button>
                )}
                <button type="button" disabled={!!busy || loading} onClick={() => void decide(item, false)}
                  className="mdm-button inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-extrabold text-rose-700 hover:border-rose-300 hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:cursor-wait disabled:opacity-50">
                  <XCircle size={17} aria-hidden="true" /> Refuser
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="mdm-enter overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm" style={stagger(7)} aria-labelledby="mdm-history-title">
        <div className="flex items-center gap-3 border-b border-slate-100 p-5 sm:p-6">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700"><FileCheck2 size={19} aria-hidden="true" /></span>
          <div>
            <h2 id="mdm-history-title" className="text-lg font-black text-slate-900">Historique des décisions</h2>
            <p className="mt-1 text-xs text-slate-500">Traçabilité des validations et refus enregistrés</p>
          </div>
        </div>
        <div className="space-y-3 p-4 sm:p-6">
          {!history.length && <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Aucune décision enregistrée.</p>}
          {history.map((item, index) => (
            <article key={item.id} style={stagger(index)} className="mdm-enter mdm-lift flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900">{LABEL[item.type] || item.type} — {item.gare_nom || 'Gare'}</p>
                <p className="mt-1 text-xs text-slate-500">{item.motif_decision || new Date(item.cree_le).toLocaleDateString('fr-FR')}</p>
              </div>
              <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${statusAppearance(item.statut)}`}>{item.statut.replace(/_/g, ' ')}</span>
            </article>
          ))}
        </div>
      </section>

      <p className="flex items-start gap-2 text-xs leading-6 text-slate-500">
        <ShieldCheck size={17} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
        Les trajets approuvés sont publiés dans l’API commune. L’inventaire des sièges n’est pas encore réconcilié avec les anciens billets ; aucune vente ni paiement simulé n’est activé ici.
      </p>
    </div>
  );
}
