import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, BellRing, Building2, BusFront, CalendarClock,
  CheckCircle2, ChevronRight, CircleAlert, Clock3, FileCheck2,
  ListChecks, MapPin, RefreshCw, Route, ShieldCheck,
  TicketCheck, UsersRound, Wallet, Armchair, Phone,
} from 'lucide-react';
import {
  companyDashboardApi,
  type CompanyProfile,
  type AssignedBusDeparture,
} from '../lib/companyDashboardApi';
import { garesManagementApi } from '../services/garesManagementApi';
import { garePlanningApi } from '../services/garePlanningApi';
import { messayBusApi } from '../services/messayBusApi';
import { chauffeursInterurbainsApi } from '../services/chauffeursInterurbainsApi';

const number = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const count = (value: unknown): string => number(value)?.toLocaleString('fr-FR') ?? '—';
const fcfa = (value: unknown): string => {
  const amount = number(value);
  return amount === null ? '—' : `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
};
const formatDeparture = (day: string, hour: string): string => {
  const date = new Date(`${day}T${hour}:00Z`);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString('fr-FR', {
        dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Abidjan',
      })
    : `${day} · ${hour}`;
};

const field = (data: unknown, ...names: string[]): string => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return '';
  const record = data as Record<string, unknown>;
  for (const name of names) {
    const value = record[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

type Approval = CompanyProfile['approval_status'];
const approvalInfo: Record<NonNullable<Approval>, { label: string; cls: string }> = {
  draft: { label: 'Dossier brouillon', cls: 'bg-slate-100 text-slate-700' },
  pending: { label: 'En attente de validation', cls: 'bg-amber-50 text-amber-800' },
  approved: { label: 'Compagnie approuvée', cls: 'bg-emerald-50 text-emerald-800' },
  rejected: { label: 'Dossier à corriger', cls: 'bg-red-50 text-red-700' },
};

function SectionHead({ eyebrow, title, subtitle, href, action }: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  href?: string;
  action?: string;
}) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div>
      <p className="text-[10px] font-black uppercase tracking-[.16em] text-orange-600">{eyebrow}</p>
      <h2 className="mt-1 text-lg font-black tracking-tight text-slate-900 sm:text-xl">{title}</h2>
      {subtitle && <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>}
    </div>
    {href && <Link to={href} className="inline-flex items-center gap-1 text-xs font-extrabold text-orange-600 transition hover:gap-2 hover:text-orange-700">
      {action || 'Voir tout'} <ArrowUpRight size={15} />
    </Link>}
  </div>;
}

function StatCard({ label, value, hint, icon, href, accent = false }: {
  label: string; value: string; hint: string; icon: ReactNode; href: string; accent?: boolean;
}) {
  return <Link to={href} className="group block rounded-[22px] border border-slate-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500">
    <div className="flex items-start justify-between gap-3">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${accent ? 'bg-orange-50 text-orange-600' : 'bg-slate-100 text-slate-700'}`}>{icon}</div>
      <ArrowUpRight size={17} className="text-slate-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-orange-500" />
    </div>
    <p className="mt-5 text-[10px] font-black uppercase tracking-[.12em] text-slate-400">{label}</p>
    <p className="mt-1 text-2xl font-black tabular-nums text-slate-900">{value}</p>
    <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p>
  </Link>;
}

function ActionLink({ href, icon, title, desc }: { href: string; icon: ReactNode; title: string; desc: string }) {
  return <Link to={href} className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">{icon}</div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-extrabold text-slate-900">{title}</p>
      <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{desc}</p>
    </div>
    <ChevronRight size={16} className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-orange-600" />
  </Link>;
}

function StatusLine({ label, status, href }: { label: string; status: 'ok' | 'missing' | 'unknown'; href: string }) {
  const data = {
    ok: { icon: <CheckCircle2 size={17} />, cls: 'text-emerald-600', text: 'Configuré' },
    missing: { icon: <CircleAlert size={17} />, cls: 'text-amber-600', text: 'À compléter' },
    unknown: { icon: <Clock3 size={17} />, cls: 'text-slate-400', text: 'À vérifier' },
  }[status];
  return <Link to={href} className="flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-slate-50">
    <span className={data.cls}>{data.icon}</span>
    <span className="flex-1 text-sm font-bold text-slate-700">{label}</span>
    <span className={`text-[10px] font-extrabold ${data.cls}`}>{data.text}</span>
    <ChevronRight size={14} className="text-slate-300" />
  </Link>;
}

function stepStatus(value: unknown): 'ok' | 'missing' | 'unknown' {
  const n = number(value);
  return n === null ? 'unknown' : n > 0 ? 'ok' : 'missing';
}

export default function Dashboard() {
  const [garesCount, setGaresCount] = useState<number | null>(null);
  const [lignesCount, setLignesCount] = useState<number | null>(null);
  const [horairesCount, setHorairesCount] = useState<number | null>(null);
  const [busCount, setBusCount] = useState<number | null>(null);
  const [chauffeursCount, setChauffeursCount] = useState<number | null>(null);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [departures, setDepartures] = useState<AssignedBusDeparture[] | null>(null);
  const [departuresComplete, setDeparturesComplete] = useState(false);
  const [departuresError, setDeparturesError] = useState('');
  const [gareNames, setGareNames] = useState<Record<string, string>>({});
  const [destinationNames, setDestinationNames] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true);
    // Chaque appel utilise le service métier existant et la session de l'utilisateur.
    // Une erreur sur une API n'empêche pas les autres indicateurs de fonctionner.
    const [profileRes, departuresRes, garesRes, lignesRes, busRes, chauffeursRes] =
      await Promise.allSettled([
        companyDashboardApi.getProfile(),
        companyDashboardApi.getUpcomingAssignedDepartures(),
        garesManagementApi.list(),
        garePlanningApi.reseauDirection(),
        messayBusApi.lister(),
        chauffeursInterurbainsApi.list(),
      ]);

    if (request !== requestId.current) return;

    setProfile(profileRes.status === 'fulfilled' ? profileRes.value : null);
    setGaresCount(
      garesRes.status === 'fulfilled' && Array.isArray(garesRes.value)
        ? garesRes.value.length
        : null,
    );
    const lignes = lignesRes.status === 'fulfilled' && Array.isArray(lignesRes.value.lignes)
      ? lignesRes.value.lignes
      : null;
    setLignesCount(lignes?.length ?? null);
    // Les horaires doivent venir de lignes publiées, jamais être générés dans l'interface.
    setHorairesCount(lignes === null ? null : lignes.reduce((total, ligne) => {
      const horaires: unknown = ligne.horaires;
      return total + (Array.isArray(horaires) ? horaires.length : 0);
    }, 0));
    setBusCount(
      busRes.status === 'fulfilled' && Array.isArray(busRes.value.vehicules)
        ? busRes.value.vehicules.length
        : null,
    );
    setChauffeursCount(
      chauffeursRes.status === 'fulfilled' && Array.isArray(chauffeursRes.value)
        ? chauffeursRes.value.length
        : null,
    );

    // Departs datés : une affectation de bus est exigée pour chaque ligne.
    setDepartures(departuresRes.status === 'fulfilled' ? departuresRes.value.departures : null);
    setDeparturesComplete(departuresRes.status === 'fulfilled' && departuresRes.value.complete);
    setDeparturesError(departuresRes.status === 'rejected'
      ? (departuresRes.reason instanceof Error ? departuresRes.reason.message : String(departuresRes.reason))
      : '');

    const namesByGare: Record<string, string> = {};
    if (garesRes.status === 'fulfilled' && Array.isArray(garesRes.value)) {
      for (const gare of garesRes.value) {
        if (typeof gare.id === 'string') namesByGare[gare.id] = gare.nom || 'Gare non renseignée';
      }
    }
    setGareNames(namesByGare);

    const namesByDestination: Record<string, string> = {};
    if (lignes !== null) {
      for (const ligne of lignes) {
        const id = field(ligne, 'id', 'destination_id', 'destinationId');
        const name = field(ligne, 'ville_arrivee', 'villeArrivee', 'gare_arrivee_nom', 'destination');
        if (id && name) namesByDestination[id] = name;
      }
    }
    setDestinationNames(namesByDestination);

    const reason = (value: unknown) => value instanceof Error ? value.message : String(value);
    const messages: string[] = [];
    if (garesRes.status === 'rejected') messages.push(`Gares : ${reason(garesRes.reason)}`);
    if (lignesRes.status === 'rejected') messages.push(`Lignes / horaires : ${reason(lignesRes.reason)}`);
    if (busRes.status === 'rejected') messages.push(`Bus : ${reason(busRes.reason)}`);
    if (chauffeursRes.status === 'rejected') messages.push(`Chauffeurs : ${reason(chauffeursRes.reason)}`);
    if (profileRes.status === 'rejected') messages.push(`Profil : ${reason(profileRes.reason)}`);
    // L'API d'occupation absente n'est plus appelée. L'erreur éventuelle du
    // catalogue des bus affectés est affichée dans sa section dédiée.
    setErrors(messages);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    return () => { requestId.current += 1; };
  }, [load]);

  // Le profil, validé par l'API, est notre seule source d'informations compagnie.
  const currentCompany = profile;
  const nextDepartures = useMemo(() => (departures ?? [])
    .slice()
    .sort((a, b) => `${a.date_depart}T${a.heure_depart}`.localeCompare(`${b.date_depart}T${b.heure_depart}`))
    .slice(0, 4), [departures]);
  // L'inventaire des billets historiques n'étant pas réconcilié,
  // aucun total « vendu » ni « libre » ne doit être présenté comme confirmé.
  const approval = currentCompany?.approval_status;
  const approvalBadge = approval && Object.prototype.hasOwnProperty.call(approvalInfo, approval)
    ? approvalInfo[approval as keyof typeof approvalInfo]
    : null;
  const profileHasContact = currentCompany ? Boolean(currentCompany.name?.trim() && currentCompany.telephone?.trim()) : null;
  const stateForProfile = profileHasContact === null ? 'unknown' : profileHasContact ? 'ok' : 'missing';

  return <div className="mx-auto max-w-7xl space-y-7 pb-12">
    {/* Présentation : la compagnie est déterminée par la session côté serveur. */}
    <div className="relative overflow-hidden rounded-[28px] bg-[#151E33] p-6 text-white shadow-xl shadow-slate-200 sm:p-8">
      <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/10">
            {currentCompany?.logo_url ? <img src={currentCompany.logo_url} alt={`Logo de ${currentCompany.name}`} className="h-full w-full object-contain" /> : <Building2 size={28} className="text-orange-300" />}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-orange-300">MESSAY PRO · TRANSPORT INTERURBAIN</p>
            <h1 className="mt-1 truncate text-2xl font-black tracking-tight sm:text-3xl">{currentCompany?.name || (loading ? 'Chargement…' : 'Espace compagnie')}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1"><Phone size={13} />{currentCompany?.telephone || 'Téléphone à renseigner'}</span>
              <span className="inline-flex items-center gap-1"><MapPin size={13} />{currentCompany?.siege_address || currentCompany?.gare_address || 'Adresse à renseigner'}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/compagnie" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-slate-900 transition hover:bg-orange-50"><Building2 size={16} /> Mon profil</Link>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-black text-white transition hover:bg-white/20 disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>{loading ? 'Chargement…' : 'Actualiser'}</button>
        </div>
      </div>
      <div className="relative mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${approvalBadge?.cls || 'bg-white/10 text-slate-200'}`}><ShieldCheck size={14} className="mr-1 inline"/>{approvalBadge?.label || 'Statut de validation non configuré'}</span>
          <span className="text-xs text-slate-300">La visibilité dans l’app mobile doit être décidée par l’API après approbation ADMIN.</span>
        </div>
        <Link to="/validation" className="inline-flex items-center gap-1 text-xs font-bold text-orange-200 hover:text-white">Mon dossier <ArrowRight size={15}/></Link>
      </div>
    </div>

    {errors.length > 0 && <section role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3"><CircleAlert size={20} className="mt-0.5 shrink-0 text-amber-700"/><div>
        <h2 className="font-black text-amber-900">Certaines données ne sont pas encore connectées au backend.</h2>
        <p className="mt-1 text-xs text-amber-800">Le tableau de bord n'affiche pas de statistiques fictives.</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-900">{errors.map(e => <li key={e}>{e}</li>)}</ul>
      </div></div>
    </section>}

    <section aria-label="Indicateurs de la compagnie">
      <SectionHead eyebrow="Pilotage" title="Votre activité en un coup d’œil" subtitle="Valeurs disponibles depuis les API existantes ; les autres restent à renseigner côté backend." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Gares" value={count(garesCount)} hint="Gares accessibles au compte connecté" icon={<MapPin size={21}/>} href="/gares" accent/>
        <StatCard label="Lignes" value={count(lignesCount)} hint="Lignes enregistrées par la compagnie" icon={<Route size={21}/>} href="/lignes" />
        <StatCard label="Bus" value={count(busCount)} hint="Véhicules enregistrés" icon={<BusFront size={21}/>} href="/vehicules" />
        <StatCard label="Chauffeurs" value={count(chauffeursCount)} hint="Chauffeurs du registre interurbain" icon={<UsersRound size={21}/>} href="/chauffeurs" />
        <StatCard label="Sièges vendus" value={count(null)} hint="Inventaire historique à rapprocher" icon={<TicketCheck size={21}/>} href="/sieges" accent/>
        <StatCard label="Sièges libres" value={count(null)} hint="Disponibilité non confirmée" icon={<Armchair size={21}/>} href="/sieges" />
      </div>
    </section>

    <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
      <section className="min-w-0 rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
        <SectionHead eyebrow="Exploitation" title="Prochains départs" subtitle="Bus réellement affectés à une date ; places non garanties." href="/horaires" action="Voir la planification" />
        {departuresError ? <div role="status" className="rounded-2xl bg-amber-50 px-4 py-6 text-center text-sm text-amber-900">
          Les départs réellement affectés ne peuvent pas être chargés : {departuresError}
          <p className="mt-2 text-xs">Aucun départ n'est reconstitué à partir des seuls horaires publiés.</p>
        </div>
          : departures === null ? <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Chargement des affectations réelles…</p>
          : nextDepartures.length === 0 ? <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            {departuresComplete
              ? 'Aucun bus affecté à un départ à venir dans les 7 prochains jours.'
              : 'Vérification incomplète : impossible de confirmer tous les départs des 7 prochains jours.'}
          </p>
          : <div className="space-y-3">{nextDepartures.map(dep => {
            const capacity = number(dep.capacite_snapshot);
            return <div key={dep.id} className="rounded-2xl border border-slate-100 p-4 transition hover:border-orange-200 hover:bg-orange-50/30">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900">
                    {gareNames[dep.gare_id] || 'Gare à préciser'}
                    <ArrowRight size={15} className="mx-1 inline text-orange-500" />
                    {destinationNames[dep.destination_id] || 'Destination à préciser'}
                  </h3>
                  <p className="mt-2 text-xs text-slate-500">
                    <CalendarClock size={13} className="mr-1 inline" />
                    {formatDeparture(dep.date_depart, dep.heure_depart)} · Bus {dep.numero_bus_snapshot || 'numéro non renseigné'}
                  </p>
                </div>
                <p className="text-sm font-extrabold text-orange-700">{capacity === null ? 'Capacité non renseignée' : `${count(capacity)} sièges (capacité)`}</p>
              </div>
              <p className="mt-3 text-[10px] font-medium text-amber-700">Disponibilité et nombre de sièges vendus non confirmés : rapprochement des billets requis.</p>
            </div>;
          })}</div>}
        {departures !== null && !departuresComplete && nextDepartures.length > 0 &&
          <p className="mt-3 text-xs text-amber-700">Résultats partiels : certaines dates du catalogue n'ont pas pu être interrogées.</p>}
      </section>

      <section className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
        <SectionHead eyebrow="Mise en service" title="Configurer votre compagnie" subtitle="Les étapes non renseignées doivent être complétées avant la mise en vente." />
        <StatusLine label="Profil et téléphone" href="/compagnie" status={stateForProfile}/>
        <StatusLine label="Gares de départ / arrivée" href="/gares" status={stepStatus(garesCount)}/>
        <StatusLine label="Lignes entre les gares" href="/lignes" status={stepStatus(lignesCount)}/>
        <StatusLine label="Horaires publiés" href="/horaires" status={stepStatus(horairesCount)}/>
        <StatusLine label="Bus et capacités" href="/vehicules" status={stepStatus(busCount)}/>
        <StatusLine label="Chauffeurs" href="/chauffeurs" status={stepStatus(chauffeursCount)}/>
        <StatusLine label="Approbation ADMIN" href="/validation" status={!approval ? 'unknown' : approval === 'approved' ? 'ok' : 'missing'}/>
        <p className="mt-3 rounded-xl bg-orange-50 px-3 py-3 text-[11px] leading-5 text-orange-800">Une compagnie en attente peut renseigner son dossier, mais ne doit pas être publiée ni vendre de billets avant l’approbation contrôlée côté serveur.</p>
      </section>
    </div>

    <section>
      <SectionHead eyebrow="Accès rapide" title="Gérer votre exploitation" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ActionLink href="/gares" icon={<MapPin size={20}/>} title="Gares et agences" desc="Coordonnées, localisation, responsables"/>
        <ActionLink href="/lignes" icon={<Route size={20}/>} title="Lignes de transport" desc="Gare de départ → gare d’arrivée"/>
        <ActionLink href="/horaires" icon={<CalendarClock size={20}/>} title="Horaires et départs" desc="Dates, heures, rotations des bus"/>
        <ActionLink href="/vehicules" icon={<BusFront size={20}/>} title="Bus et capacités" desc="Immatriculation et plan de sièges"/>
        <ActionLink href="/chauffeurs" icon={<UsersRound size={20}/>} title="Chauffeurs" desc="Affectations et documents"/>
        <ActionLink href="/reservations" icon={<ListChecks size={20}/>} title="Réservations" desc="Demandes, paiements, statuts"/>
        <ActionLink href="/billets" icon={<TicketCheck size={20}/>} title="Billets et contrôle" desc="Vérification à l’embarquement"/>
        <ActionLink href="/sieges" icon={<Armchair size={20}/>} title="Sièges vendus et libres" desc="Occupation réelle par bus et départ"/>
      </div>
    </section>

    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <section className="overflow-hidden rounded-[24px] bg-[#191C29] p-6 text-white shadow-lg">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-orange-300">Finances</p><h2 className="mt-2 text-lg font-black">Portefeuille compagnie</h2></div><Wallet size={23} className="text-orange-400"/></div>
        <p className="mt-5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Solde disponible selon le serveur</p>
        <p className="mt-1 text-3xl font-black tabular-nums">{fcfa(null)}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 text-xs">
          <div className="rounded-xl bg-white/5 p-3"><p className="text-slate-400">Part compagnie</p><p className="mt-1 font-black">{fcfa(null)}</p></div>
          <div className="rounded-xl bg-white/5 p-3"><p className="text-slate-400">Commission MESSAY</p><p className="mt-1 font-black">{fcfa(null)}</p></div>
        </div>
        <p className="mt-4 text-[11px] leading-5 text-slate-400">Les métriques financières ne sont pas encore exposées par les endpoints disponibles : les montants sont donc indisponibles, et non nuls. Un solde de portefeuille n’est pas un transfert bancaire exécuté.</p>
        <div className="mt-5 flex flex-wrap gap-2"><Link to="/portefeuille" className="rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-orange-600">Voir le portefeuille <ArrowRight size={14} className="ml-1 inline"/></Link><Link to="/retraits" className="rounded-xl border border-white/20 px-4 py-2.5 text-xs font-bold hover:bg-white/10">Retraits</Link></div>
      </section>

      <section className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
        <SectionHead eyebrow="Billetterie" title="Réservations récentes" subtitle="Raccordement API requis, sans passager fictif ni billet présumé payé." href="/reservations" />
        <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          La liste des réservations récentes n’est pas encore exposée par le service API du Dashboard.
          <p className="mt-2 text-xs">Consultez « Réservations » pour les opérations disponibles. Aucun billet ni paiement n’est simulé ici.</p>
        </div>
      </section>
    </div>

    <p className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400"><FileCheck2 size={14}/> Les autorisations, l'approbation des compagnies, les disponibilités et les commissions doivent être vérifiées côté API. <BellRing size={14}/> Aucune notification ou vente n’est simulée sur cet écran.</p>
  </div>;
}
