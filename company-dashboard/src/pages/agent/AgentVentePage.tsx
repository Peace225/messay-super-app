/**
 * MESSAY PRO — Espace agent de billetterie.
 * Consultation de l'historique, du catalogue, des départs datés et des sièges V1.
 * Lecture seule : aucune émission de billet, réservation ou confirmation de paiement.
 *
 * IMPORTANT : le backend doit également limiter les transactions à l'agent
 * connecté si l'écran doit représenter exclusivement « mes ventes ».
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  BusFront,
  Armchair,
  Info,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Ticket,
  Wallet,
} from 'lucide-react';
import {
  garesHierarchyApi,
  type GareAccessContext,
  type GareTransaction,
} from '../../services/garesManagementApi';
import {
  getInterurbainCatalogue,
  type CatalogueOffre,
} from '../../services/interurbainCatalogueApi';
import {
  getMessayBusAffectations,
  getMessayPlacesV1,
  type MessayBusAffectation,
  type MessayPlacesV1,
} from '../../services/messayBusSiegesClient';

function abidjanDay(date: Date): string {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Abidjan',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (key: string) => parts.find((p) => p.type === key)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(value))} F CFA`;
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? 'Date non renseignée'
    : new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Africa/Abidjan',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(parsed);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Impossible de récupérer les données.';
}

type HistoryState = {
  key: string;
  rows: GareTransaction[];
  cursor: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string;
  moreLoading: boolean;
  moreError: string;
};

type CatalogueState = {
  key: string;
  offers: CatalogueOffre[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string;
  truncated: boolean;
};

const initialHistory: HistoryState = {
  key: '', rows: [], cursor: null, status: 'idle',
  error: '', moreLoading: false, moreError: '',
};
const initialCatalogue: CatalogueState = {
  key: '', offers: [], status: 'idle', error: '', truncated: false,
};

// Les affectations correspondent à des départs datés réellement enregistrés.
// L'inventaire V1 ne couvre toutefois pas encore les billets de l'application mobile.
type DepartState = {
  key: string;
  rows: MessayBusAffectation[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string;
  potentiallyTruncated: boolean;
};
type SeatsState = {
  key: string;
  details: MessayPlacesV1 | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string;
};
const initialDeparts: DepartState = {
  key: '', rows: [], status: 'idle', error: '', potentiallyTruncated: false,
};
const initialSeats: SeatsState = {
  key: '', details: null, status: 'idle', error: '',
};

function dayOnly(value: string): string {
  return value.slice(0, 10);
}

export default function AgentVentePage() {
  const access = useOutletContext<GareAccessContext>();
  const [gareId, setGareId] = useState(() => access.gare_ids[0] ?? '');
  const [du, setDu] = useState(() => abidjanDay(new Date(Date.now() - 6 * 86_400_000)));
  const [au, setAu] = useState(() => abidjanDay(new Date()));
  const [dateDepart, setDateDepart] = useState(() => abidjanDay(new Date()));
  const [revision, setRevision] = useState(0);
  const [historyState, setHistoryState] = useState<HistoryState>(initialHistory);
  const [catalogueState, setCatalogueState] = useState<CatalogueState>(initialCatalogue);
  const [departState, setDepartState] = useState<DepartState>(initialDeparts);
  const [selectedDepartId, setSelectedDepartId] = useState('');
  const [seatRevision, setSeatRevision] = useState(0);
  const [seatsState, setSeatsState] = useState<SeatsState>(initialSeats);
  const historyRequestRef = useRef(0);
  const moreLockRef = useRef(false);

  const authorized = access.role === 'AGENT_BILLETTERIE';
  const allowed = authorized && Boolean(gareId) && access.gare_ids.includes(gareId);
  const validRange = Boolean(du && au && du <= au);
  const historyKey = JSON.stringify([gareId, du, au, revision]);
  const catalogueKey = JSON.stringify([access.company_id, gareId, dateDepart, revision]);
  const departsKey = JSON.stringify([access.company_id, gareId, dateDepart, revision]);
  const today = abidjanDay(new Date());

  // Si les droits de gare changent, revenir à une gare réellement autorisée.
  useEffect(() => {
    if (!access.gare_ids.includes(gareId)) setGareId(access.gare_ids[0] ?? '');
  }, [access.gare_ids, gareId]);

  useEffect(() => {
    const requestId = ++historyRequestRef.current;
    moreLockRef.current = false;

    if (!allowed) {
      setHistoryState({ ...initialHistory, key: historyKey });
      return;
    }
    if (!validRange) {
      setHistoryState({
        ...initialHistory,
        key: historyKey,
        status: 'error',
        error: 'La date de début doit être antérieure ou égale à la date de fin.',
      });
      return;
    }

    setHistoryState({ ...initialHistory, key: historyKey, status: 'loading' });
    void garesHierarchyApi.transactions(gareId, du, au)
      .then((page) => {
        if (requestId !== historyRequestRef.current) return;
        setHistoryState({
          key: historyKey,
          rows: page.transactions,
          cursor: page.next_cursor ?? null,
          status: 'ready',
          error: '',
          moreLoading: false,
          moreError: '',
        });
      })
      .catch((error: unknown) => {
        if (requestId !== historyRequestRef.current) return;
        setHistoryState({
          ...initialHistory,
          key: historyKey,
          status: 'error',
          error: getErrorMessage(error),
        });
      });

    return () => {
      historyRequestRef.current += 1;
      moreLockRef.current = false;
    };
  }, [allowed, gareId, du, au, validRange, historyKey]);

  // La date des départs est indépendante de la période des ventes passées.
  useEffect(() => {
    const controller = new AbortController();
    if (!allowed || !dateDepart) {
      setCatalogueState({ ...initialCatalogue, key: catalogueKey });
      return () => controller.abort();
    }

    setCatalogueState({ ...initialCatalogue, key: catalogueKey, status: 'loading' });
    void getInterurbainCatalogue(
      access.company_id,
      gareId,
      dateDepart,
      controller.signal,
    )
      .then((response) => {
        if (controller.signal.aborted) return;
        setCatalogueState({
          key: catalogueKey,
          offers: response.offres,
          status: 'ready',
          error: '',
          truncated: Boolean(response.tronque),
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setCatalogueState({
          ...initialCatalogue,
          key: catalogueKey,
          status: 'error',
          error: getErrorMessage(error),
        });
      });

    return () => controller.abort();
  }, [allowed, access.company_id, gareId, dateDepart, catalogueKey]);

  // Affectations réelles du bus, filtrées une deuxième fois par gare et date.
  // Le backend reste l'autorité pour les droits d'accès.
  useEffect(() => {
    const controller = new AbortController();
    if (!allowed || !dateDepart) {
      setDepartState({ ...initialDeparts, key: departsKey });
      return () => controller.abort();
    }
    setDepartState({ ...initialDeparts, key: departsKey, status: 'loading' });
    void getMessayBusAffectations(controller.signal)
      .then(({ affectations, listePotentiellementTronquee }) => {
        if (controller.signal.aborted) return;
        setDepartState({
          key: departsKey,
          rows: affectations.filter((item) => item.gare_id === gareId &&
            dayOnly(item.date_depart) === dateDepart),
          status: 'ready',
          error: '',
          potentiallyTruncated: listePotentiellementTronquee,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setDepartState({ ...initialDeparts, key: departsKey, status: 'error', error: getErrorMessage(error) });
      });
    return () => controller.abort();
  }, [allowed, gareId, dateDepart, departsKey]);

  const departs = departState.key === departsKey ? departState : initialDeparts;
  const selectedDepart = departs.rows.find((item) => item.id === selectedDepartId) ?? null;
  const seatsKey = JSON.stringify([departsKey, selectedDepart?.id ?? '', seatRevision]);

  // Une date, gare ou affectation différente invalide immédiatement l'ancien inventaire.
  useEffect(() => {
    const controller = new AbortController();
    if (!allowed || !selectedDepart) {
      setSeatsState({ ...initialSeats, key: seatsKey });
      return () => controller.abort();
    }
    setSeatsState({ ...initialSeats, key: seatsKey, status: 'loading' });
    void getMessayPlacesV1(selectedDepart.id, controller.signal)
      .then((details) => {
        if (controller.signal.aborted) return;
        setSeatsState({ key: seatsKey, details, status: 'ready', error: '' });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setSeatsState({ ...initialSeats, key: seatsKey, status: 'error', error: getErrorMessage(error) });
      });
    return () => controller.abort();
  }, [allowed, seatsKey, selectedDepart?.id]);

  const seats = seatsState.key === seatsKey ? seatsState : initialSeats;

  // Afficher uniquement les données appartenant à la requête active.
  // Cela évite de montrer celles de la gare précédente entre deux effets.
  const history = historyState.key === historyKey ? historyState : initialHistory;
  const catalogue = catalogueState.key === catalogueKey ? catalogueState : initialCatalogue;

  const ventesGuichet = useMemo(
    () => history.rows.filter(
      (tx) => tx.canal === 'GUICHET' && tx.statut === 'PAYE' &&
        Number.isFinite(Number(tx.montant_fcfa)) && Number(tx.montant_fcfa) > 0,
    ),
    [history.rows],
  );
  const ventesReferencees = useMemo(
    () => ventesGuichet.filter(
      (tx) => typeof tx.reference_billet === 'string' && tx.reference_billet.trim().length > 0,
    ),
    [ventesGuichet],
  );
  const referencesManquantes = ventesGuichet.length - ventesReferencees.length;
  const montantCharge = ventesGuichet.reduce((sum, tx) => sum + Number(tx.montant_fcfa), 0);

  async function loadMore() {
    if (!allowed || !validRange || history.status !== 'ready' || !history.cursor ||
        history.moreLoading || moreLockRef.current) return;

    const requestId = historyRequestRef.current;
    const requestedCursor = history.cursor;
    moreLockRef.current = true;
    setHistoryState((prev) => prev.key === historyKey
      ? { ...prev, moreLoading: true, moreError: '' }
      : prev);

    try {
      const page = await garesHierarchyApi.transactions(gareId, du, au, requestedCursor);
      if (requestId !== historyRequestRef.current) return;
      setHistoryState((prev) => {
        if (prev.key !== historyKey) return prev;
        const seen = new Set(prev.rows.map((tx) => tx.id));
        return {
          ...prev,
          rows: [...prev.rows, ...page.transactions.filter((tx) => !seen.has(tx.id))],
          cursor: page.next_cursor ?? null,
          moreLoading: false,
          moreError: '',
        };
      });
    } catch (error: unknown) {
      if (requestId !== historyRequestRef.current) return;
      setHistoryState((prev) => prev.key === historyKey
        ? { ...prev, moreLoading: false, moreError: getErrorMessage(error) }
        : prev);
    } finally {
      if (requestId === historyRequestRef.current) {
        moreLockRef.current = false;
        setHistoryState((prev) => prev.key === historyKey
          ? { ...prev, moreLoading: false }
          : prev);
      }
    }
  }

  if (!authorized) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
        Accès réservé aux agents de billetterie.
      </div>
    );
  }
  if (!access.gare_ids.length) {
    return (
      <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
        Aucune gare autorisée. Contactez le Chef de Gare.
      </div>
    );
  }

  const cards = [
    {
      title: 'Mouvements guichet (statut PAYE)',
      value: history.status === 'ready' ? String(ventesGuichet.length) : '—',
      hint: 'Uniquement les lignes chargées',
      icon: CreditCard,
    },
    {
      title: 'Avec référence billet',
      value: history.status === 'ready' ? String(ventesReferencees.length) : '—',
      hint: 'Référence présente, validité non vérifiée ici',
      icon: Ticket,
    },
    {
      title: 'Montant guichet chargé',
      value: history.status === 'ready' ? formatMoney(montantCharge) : '—',
      hint: 'Pas un total financier consolidé',
      icon: Wallet,
    },
  ] as const;

  return (
    <div className="space-y-6 pb-10">
      <style>{`
        @keyframes messay-ticket-enter {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .messay-ticket-enter { animation: messay-ticket-enter 420ms ease-out both; }
        }
      `}</style>
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#111B30] via-[#142A45] to-[#114655] px-5 py-7 text-white shadow-xl sm:px-8 sm:py-9">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full bg-orange-400/15 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 right-1/4 h-52 w-52 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-300">MESSAY PRO · Espace billetterie</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Ventes et départs de ma gare</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-200">
              Retrouvez les horaires publiés et les opérations de guichet accessibles à votre compte.
              Les montants affichés proviennent exclusivement du backend.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs font-bold text-white/90 backdrop-blur-sm">
            <ShieldCheck size={18} className="text-emerald-300" /> Accès agent de billetterie
          </div>
        </div>
      </section>

      <section role="note" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 sm:p-5">
        <AlertCircle size={21} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-extrabold">Émission de billets au guichet non activée</p>
          <p className="mt-1">
            La réservation atomique des sièges, la validation serveur des paiements et l’émission sécurisée
            des billets doivent être raccordées avant d’activer une vente. Aucune opération fictive n’est proposée.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Périmètre et dates des opérations">
        <div className="mb-4 flex items-center gap-2 text-sm font-black text-slate-900">
          <CalendarDays size={18} className="text-orange-600" /> Filtres de consultation
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {access.gare_ids.length > 1 && (
            <label className="min-w-[200px] flex-1 text-xs font-bold text-slate-600">
              Gare autorisée
              <select
                value={gareId}
                onChange={(e) => setGareId(e.target.value)}
                className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
              >
                {access.gare_ids.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </label>
          )}
          <label className="min-w-[150px] flex-1 text-xs font-bold text-slate-600">
            Ventes du
            <input type="date" value={du} max={au} onChange={(e) => setDu(e.target.value)}
              className="mt-2 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100" />
          </label>
          <label className="min-w-[150px] flex-1 text-xs font-bold text-slate-600">
            Ventes au
            <input type="date" value={au} min={du} onChange={(e) => setAu(e.target.value)}
              className="mt-2 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100" />
          </label>
          <button type="button" onClick={() => setRevision((value) => value + 1)}
            disabled={history.status === 'loading' || catalogue.status === 'loading'}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:border-orange-300 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:cursor-wait disabled:opacity-50"
          >
            <RefreshCw size={16} className={history.status === 'loading' || catalogue.status === 'loading' ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
        {!allowed && <p role="alert" className="mt-3 text-sm text-red-600">Gare non autorisée pour ce compte.</p>}
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Indicateurs des opérations chargées">
        {cards.map(({ title, value, hint, icon: Icon }, index) => (
          <article key={title}
            className="messay-ticket-enter rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 motion-safe:hover:-translate-y-1 hover:border-orange-200 hover:shadow-md"
            style={{ animationDelay: `${index * 75}ms` }}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-600">{title}</p>
              <span className="rounded-xl bg-orange-50 p-2.5 text-orange-600"><Icon size={20} /></span>
            </div>
            <p className="mt-4 break-words text-2xl font-black tracking-tight text-slate-900" aria-live="polite">{value}</p>
            <p className="mt-2 text-xs text-slate-500">{hint}</p>
          </article>
        ))}
      </section>

      {history.status === 'ready' && referencesManquantes > 0 && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle size={18} className="shrink-0" />
          {referencesManquantes} mouvement(s) de guichet marqués PAYE ne possèdent pas de référence de billet : contrôle nécessaire.
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-black text-slate-900"><Clock3 size={20} className="text-orange-600" /> Lignes et horaires publiés</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Horaires de référence ; disponibilité des sièges et circulation datée non garanties.</p>
          </div>
          <label className="text-xs font-bold text-slate-600">
            Date à consulter
            <input type="date" value={dateDepart} min={today} onChange={(e) => setDateDepart(e.target.value)}
              className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100" />
          </label>
        </div>
        {catalogue.status === 'loading' ? (
          <p role="status" className="flex items-center gap-2 p-5 text-sm text-slate-500"><RefreshCw size={16} className="animate-spin" /> Chargement du catalogue réel…</p>
        ) : catalogue.status === 'error' ? (
          <p role="alert" className="flex items-start gap-2 p-5 text-sm text-red-700"><AlertCircle size={18} className="shrink-0" />{catalogue.error}</p>
        ) : catalogue.status === 'ready' && catalogue.offers.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">Aucun horaire publié pour cette gare à la date consultée.</p>
        ) : catalogue.status === 'ready' ? (
          <>
            {catalogue.truncated && <p role="status" className="border-b border-amber-100 bg-amber-50 px-5 py-3 text-sm text-amber-800">La liste renvoyée par le catalogue est partielle.</p>}
            <div className="grid gap-3 p-4 lg:grid-cols-2 sm:p-5">
              {catalogue.offers.map((offer, index) => (
                <article key={`${offer.destination_id}:${offer.horaire_id}:${index}`}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition duration-300 motion-safe:hover:-translate-y-0.5 hover:border-orange-300 hover:bg-white hover:shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                        <MapPin size={16} className="shrink-0 text-orange-600" /> {offer.ville_depart} <ArrowRight size={14} className="shrink-0 text-slate-400" /> {offer.ville_arrivee}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">{offer.gare_depart_nom} · {offer.gare_arrivee_nom || 'Gare d’arrivée non renseignée'}</p>
                    </div>
                    <span className="rounded-lg bg-orange-50 px-3 py-1.5 text-sm font-extrabold text-orange-700">{offer.heure_depart}</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3">
                    <span className="text-xs text-slate-500">Tarif publié</span>
                    <strong className="text-sm text-slate-900">{offer.prix_fcfa == null ? 'Prix non publié' : formatMoney(offer.prix_fcfa)}</strong>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="p-5 text-sm text-slate-500">Sélectionnez une gare pour consulter les horaires.</p>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Départs affectés et sièges du registre provisoire">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
              <BusFront size={20} className="text-orange-600" /> Départs réellement affectés
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Bus programmés le {dateDepart.split('-').reverse().join('/')} dans votre gare. Sélectionnez-en un pour consulter son registre de sièges.
            </p>
          </div>
          <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-extrabold text-orange-800">
            Lecture seule · phase V1
          </span>
        </div>

        {departs.status === 'loading' ? (
          <p role="status" className="flex items-center gap-2 p-5 text-sm text-slate-500">
            <RefreshCw size={16} className="animate-spin" /> Chargement des départs affectés…
          </p>
        ) : departs.status === 'error' ? (
          <p role="alert" className="flex items-start gap-2 p-5 text-sm text-red-700">
            <AlertCircle size={18} className="shrink-0" /> {departs.error}
          </p>
        ) : departs.status === 'ready' && departs.rows.length === 0 ? (
          <div className="p-5 text-sm text-slate-600">
            Aucun bus affecté à cette gare pour le {dateDepart.split('-').reverse().join('/')}. Un horaire publié seul n'est pas un départ confirmé.
          </div>
        ) : departs.status === 'ready' ? (
          <div className="p-4 sm:p-5">
            {departs.potentiallyTruncated && (
              <p role="status" className="mb-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                La réponse backend est plafonnée à 150 affectations : certains départs peuvent manquer.
              </p>
            )}
            <div className="grid gap-3 lg:grid-cols-2">
              {departs.rows.map((depart) => {
                const offer = catalogue.offers.find((item) =>
                  item.destination_id === depart.destination_id && item.horaire_id === depart.horaire_id);
                const active = selectedDepart?.id === depart.id;
                return (
                  <button
                    key={depart.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedDepartId(active ? '' : depart.id)}
                    className={`rounded-2xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 ${
                      active ? 'border-orange-400 bg-orange-50 shadow-md' :
                        'border-slate-200 bg-slate-50/70 hover:border-orange-300 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold text-slate-900">
                        <BusFront size={18} className="shrink-0 text-orange-600" />
                        {depart.numero_bus_snapshot || 'Bus sans numéro publié'}
                      </span>
                      <span className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-slate-700">
                        {depart.statut || 'Statut non communiqué'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {offer ? `${offer.ville_depart} → ${offer.ville_arrivee} · ${offer.heure_depart}` : 'Itinéraire et horaire à consulter dans le catalogue'}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {depart.immatriculation_snapshot || 'Immatriculation non renseignée'} ·
                      {' '}{Number.isInteger(depart.capacite_snapshot) ? `${depart.capacite_snapshot} sièges` : 'Capacité inconnue'}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-orange-700">
                      <Armchair size={15} /> {active ? 'Masquer le plan' : 'Consulter le plan provisoire'}
                      <ArrowRight size={14} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="p-5 text-sm text-slate-500">Sélectionnez votre gare et la date du départ.</p>
        )}

        {selectedDepart && (
          <div className="border-t border-slate-100 p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                  <Armchair size={19} className="text-orange-600" /> Plan des sièges — registre V1
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  Bus {selectedDepart.numero_bus_snapshot || 'non identifié'} · {selectedDepart.date_depart.slice(0, 10)}
                </p>
              </div>
              <button type="button" onClick={() => setSeatRevision(v => v + 1)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                <RefreshCw size={15} /> Actualiser les sièges
              </button>
            </div>
            {seats.status === 'loading' ? (
              <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
                <RefreshCw size={16} className="animate-spin" /> Chargement du registre des sièges…
              </p>
            ) : seats.status === 'error' ? (
              <p role="alert" className="flex items-start gap-2 text-sm text-red-700">
                <AlertCircle size={18} className="shrink-0" /> {seats.error}
              </p>
            ) : seats.status === 'ready' && seats.details ? (
              <>
                <div role="note" className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <p>{seats.details.avertissement || 'Inventaire provisoire : anciens billets mobiles non rapprochés. Vente désactivée.'}</p>
                </div>
                <div className="mb-3 flex flex-wrap gap-4 text-xs font-bold text-slate-600">
                  <span><span className="mr-1 inline-block h-3 w-3 rounded bg-slate-100 ring-1 ring-slate-300" /> Non bloqué dans V1</span>
                  <span><span className="mr-1 inline-block h-3 w-3 rounded bg-orange-500" /> Occupé dans V1</span>
                  <span>{seats.details.places_libres_registre_v1} / {seats.details.capacite} non bloqués dans V1</span>
                </div>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10" aria-label="Visualisation non interactive des sièges">
                  {seats.details.places.map((place) => (
                    <div key={place.numero}
                      aria-label={`Siège ${place.numero} : ${place.disponible ? 'non bloqué dans le registre V1' : 'occupé dans le registre V1'}`}
                      className={`flex aspect-square items-center justify-center rounded-xl border text-sm font-extrabold ${
                        place.disponible ? 'border-slate-200 bg-slate-50 text-slate-700' :
                          'border-orange-600 bg-orange-500 text-white'
                      }`}
                    >
                      {place.numero}
                    </div>
                  ))}
                </div>
                <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500">
                  <Info size={15} className="mt-0.5 shrink-0" />
                  Aucun siège de cet écran ne peut être réservé, vendu ou encaissé. Les disponibilités réelles restent à certifier côté serveur.
                </p>
              </>
            ) : null}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-black text-slate-900"><Ticket size={20} className="text-orange-600" /> Mouvements guichet (statut PAYE)</h3>
            <p className="mt-1 text-xs text-slate-500">
              {history.status === 'ready' ? `${ventesGuichet.length} opération(s) correspondante(s) parmi ${history.rows.length} mouvement(s) chargé(s)` : 'Historique des opérations autorisées'}
            </p>
          </div>
          <Link to="/agent/rapports" className="inline-flex items-center gap-1 text-sm font-bold text-orange-600 hover:underline">Mes rapports <ArrowRight size={16} /></Link>
        </div>
        {history.status === 'loading' ? (
          <p role="status" className="flex items-center gap-2 p-5 text-sm text-slate-500"><RefreshCw size={16} className="animate-spin" /> Chargement des transactions…</p>
        ) : history.status === 'error' ? (
          <p role="alert" className="flex items-start gap-2 p-5 text-sm text-red-700"><AlertCircle size={18} className="shrink-0" />{history.error}</p>
        ) : history.status === 'ready' && ventesGuichet.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">Aucun mouvement de guichet marqué PAYE parmi les données chargées pour cette période.</p>
        ) : history.status === 'ready' ? (
          <div className="divide-y divide-slate-100">
            {ventesGuichet.map((tx) => {
              const hasReference = typeof tx.reference_billet === 'string' && Boolean(tx.reference_billet.trim());
              return (
                <article key={tx.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      {hasReference ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" /> : <AlertCircle size={16} className="shrink-0 text-amber-600" />}
                      {hasReference ? tx.reference_billet : 'Référence de billet manquante'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(tx.occurred_at)} · {tx.mode_paiement || 'Mode de paiement non précisé'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-900">{formatMoney(tx.montant_fcfa)}</p>
                    <p className="mt-1 text-xs font-bold text-emerald-700">Statut enregistré : PAYE</p>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="p-5 text-sm text-slate-500">Aucune transaction à afficher.</p>
        )}
        {history.moreError && <p role="alert" className="mx-5 mt-3 text-sm text-red-600">{history.moreError}</p>}
        {history.status === 'ready' && history.cursor && (
          <div className="border-t border-slate-100 p-4 sm:p-5">
            <button type="button" disabled={history.moreLoading} onClick={() => void loadMore()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-orange-300 hover:bg-orange-50 disabled:opacity-50">
              <RefreshCw size={16} className={history.moreLoading ? 'animate-spin' : ''} />
              {history.moreLoading ? 'Chargement…' : 'Charger d’autres opérations'}
            </button>
          </div>
        )}
      </section>

      <p className="flex items-start gap-2 text-xs leading-5 text-slate-500"><Info size={15} className="mt-0.5 shrink-0" />
        Les indicateurs reflètent uniquement les enregistrements chargés. Le contrôle du périmètre agent/gare,
        la confirmation des paiements, l’authenticité des billets et l’autorisation d’émettre un billet sont des
        vérifications à faire appliquer côté backend.
      </p>
    </div>
  );
}
