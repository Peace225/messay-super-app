/**
 * MESSAY PRO — Direction / Chef de gare : affectation d'un bus à un départ daté.
 * Réutilise exclusivement les API de bus existantes, sans créer de véhicule,
 * de réservation, de paiement ou de billet fictif.
 *
 * Les autorisations et les collisions d'affectation doivent être validées
 * côté backend par /api/company-dashboard/gares/:gareId/departs-bus.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  AlertTriangle, ArrowRight, BusFront, CalendarClock, CheckCircle2,
  Circle, ClipboardList, Info, RefreshCcw, ShieldCheck,
} from 'lucide-react';
import { messayBusApi, type BusOverview } from '../../services/messayBusApi';
import type { GarePlanningLigne } from '../../services/garePlanningApi';

type Props = {
  gareId: string;
  gareName: string;
  lignes: GarePlanningLigne[];
};

function todayAbidjan(): string {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Abidjan', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function isDemoBus(bus: { marque?: string | null; numero_interne?: string | null; modele?: string | null }): boolean {
  // Un simple libellé de test interdit la commercialisation du véhicule.
  return [bus.marque, bus.numero_interne, bus.modele].some((value) => {
    const normalized = (value ?? '').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').trim();
    return /(?:^|[\s_-])(test|demo|fictif|fake)(?:$|[\s_-])/i.test(normalized);
  });
}

/** Date et heure de la compagnie (et non celles du navigateur du responsable). */
function nowAbidjan(): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Abidjan',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (key: string) => parts.find((item) => item.type === key)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

/** Les horaires du planning peuvent être HH:mm ou HH:mm:ss. */
function normalizeHour(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(value).trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}

function departureInFuture(date: string, rawTime: string): boolean {
  if (!validDepartureDate(date)) return false;
  const time = normalizeHour(rawTime);
  if (!time) return false;
  const now = nowAbidjan();
  return date > now.date || (date === now.date && time > now.time);
}

function validDepartureDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Opération momentanément indisponible.';
}

const fieldClass = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';
const labelClass = 'block text-xs font-bold text-slate-600';

export default function ChefBusAffectations({ gareId, gareName, lignes }: Props) {
  const [overview, setOverview] = useState<BusOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [ligneId, setLigneId] = useState('');
  const [horaireId, setHoraireId] = useState('');
  const [busId, setBusId] = useState('');
  const [dateDepart, setDateDepart] = useState(todayAbidjan);
  const requestSequence = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const current = ++requestSequence.current;
    setLoading(true);
    setError('');
    setOverview(null);

    void messayBusApi.lister()
      .then((result) => {
        if (!mounted.current || current !== requestSequence.current) return;
        setOverview(result);
      })
      .catch((cause: unknown) => {
        if (!mounted.current || current !== requestSequence.current) return;
        setError(errorMessage(cause));
      })
      .finally(() => {
        if (mounted.current && current === requestSequence.current) setLoading(false);
      });

    return () => { requestSequence.current += 1; };
  }, [gareId, refresh]);

  // Le backend autorise la DIRECTION sur toutes les gares de sa compagnie,
  // et le CHEF_GARE sur les seules gares qui lui sont attribuées.
  // Le serveur effectue toujours le contrôle final.
  const authorized = Boolean(
    overview &&
    (overview.role === 'DIRECTION' || overview.role === 'CHEF_GARE') &&
    overview.gares.some((gare) => gare.id === gareId),
  );

  const publishedLines = useMemo(
    () => lignes.filter((line) =>
      line.gare_depart_id === gareId &&
      line.publie === true &&
      Array.isArray(line.horaires) &&
      line.horaires.length > 0,
    ),
    [lignes, gareId],
  );

  // Sélectionne automatiquement l'unique ligne publiée.
  // Ne sélectionne jamais automatiquement un bus ni ne crée un départ.
  useEffect(() => {
    setLigneId((current) => {
      if (publishedLines.some((line) => line.id === current)) return current;
      return publishedLines.length === 1 ? publishedLines[0].id : '';
    });
  }, [publishedLines]);

  const selectedLine = publishedLines.find((line) => line.id === ligneId);
  const selectedHours = selectedLine?.horaires ?? [];
  const selectableHours = selectedHours.filter((hour) =>
    departureInFuture(dateDepart, hour.heure_depart),
  );

  // La date/ligne change : ne pas garder un horaire devenu invalide.
  useEffect(() => {
    if (horaireId && !selectableHours.some((hour) => hour.id === horaireId)) {
      setHoraireId('');
    }
  }, [horaireId, selectableHours.map((hour) => hour.id).join('|')]);

  const availableBuses = useMemo(
    () => (overview?.vehicules ?? []).filter((bus) =>
      bus.statut === 'DISPONIBLE' &&
      !isDemoBus(bus) &&
      typeof bus.immatriculation === 'string' &&
      bus.immatriculation.trim().length >= 3 &&
      Number.isInteger(bus.capacite) && bus.capacite >= 1 && bus.capacite <= 120,
    ),
    [overview],
  );

  const selectedBus = availableBuses.find((bus) => bus.id === busId);

  const assigned = useMemo(
    () => (overview?.affectations ?? [])
      .filter((item) => item.gare_id === gareId)
      .sort((a, b) => b.date_depart.localeCompare(a.date_depart))
      .slice(0, 8),
    [overview, gareId],
  );

  const minimumDate = todayAbidjan();

  const formSteps = [
    { label: 'Accès Direction / Chef de gare vérifié', ok: authorized },
    { label: 'Ligne publiée sélectionnée', ok: Boolean(selectedLine) },
    {
      label: 'Horaire publié sélectionné',
      ok: selectableHours.some((hour) => hour.id === horaireId),
    },
    {
      label: 'Date de circulation valide',
      ok: validDepartureDate(dateDepart) &&
        dateDepart >= minimumDate,
    },
    { label: 'Bus réel et disponible sélectionné', ok: Boolean(selectedBus) },
  ];

  const stepsComplete = formSteps.every((step) => step.ok);
  const demoBusCount = (overview?.vehicules ?? []).filter(
    (bus) => bus.statut === 'DISPONIBLE' && isDemoBus(bus),
  ).length;
  const formReady = Boolean(!busy && !loading && stepsComplete);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || loading) return;

    setError('');
    setNotice('');

    if (!formReady || !selectedLine || !selectedBus) {
      setError(
        'Choisissez un bus disponible, une ligne publiée, un horaire et une date valide.',
      );
      return;
    }

    const hour = selectedHours.find((item) => item.id === horaireId);
    if (!hour || !departureInFuture(dateDepart, hour.heure_depart)) {
      setError('L’horaire sélectionné est déjà passé à Abidjan. Choisissez un horaire futur.');
      return;
    }
    if (isDemoBus(selectedBus)) {
      setError('Un bus TEST / DEMO / FICTIF est interdit dans les départs commerciaux.');
      return;
    }

    if (!window.confirm(
      `Confirmer ce départ réel ?\n` +
      `Gare : ${gareName}\n` +
      `Destination : ${selectedLine.arrivee_nom || selectedLine.ville}\n` +
      `Date : ${dateDepart} — ${hour?.heure_depart || ''}\n` +
      `Bus : ${selectedBus.numero_interne} (${selectedBus.immatriculation})\n\n` +
      'Ne confirmez pas un véhicule ou un départ fictif sur la base de production.',
    )) return;

    const current = requestSequence.current;
    const gareAtSubmit = gareId;
    setBusy(true);

    try {
      const created = await messayBusApi.affecter(gareAtSubmit, {
        destination_id: selectedLine.id,
        horaire_id: horaireId,
        date_depart: dateDepart,
        bus_id: selectedBus.id,
      });

      if (!mounted.current || current !== requestSequence.current) return;

      setNotice(
        `Départ enregistré (référence ${created.id}). Il apparaîtra sur le mobile si la compagnie et le bus satisfont les règles de publication et de disponibilité.`,
      );
      setBusId('');
      setRefresh((value) => value + 1);
    } catch (cause: unknown) {
      if (mounted.current && current === requestSequence.current) {
        setError(errorMessage(cause));
      }
    } finally {
      if (mounted.current && current === requestSequence.current) {
        setBusy(false);
      }
    }
  }

  return (
    <section
      className="mp-enter overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"
      aria-label="Affectation des bus à la gare"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-orange-50/50 px-5 py-5 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-orange-100 p-2 text-orange-700">
              <BusFront size={19} />
            </span>
            <h2 className="text-lg font-black text-slate-900">
              Affecter un bus à un départ
            </h2>
          </div>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            Gare : <strong>{gareName}</strong>. Départ daté, à partir
            d'une ligne et d'un horaire publiés.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRefresh((value) => value + 1)}
          disabled={loading || busy}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 transition hover:border-orange-200 hover:text-orange-700 disabled:opacity-50"
        >
          <RefreshCcw
            size={15}
            className={loading ? 'animate-spin' : ''}
          />
          Actualiser les bus
        </button>
      </div>

      <div className="space-y-4 p-4 sm:p-6">
        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        {notice && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            {notice}
          </p>
        )}

        {loading && (
          <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
            <RefreshCcw size={16} className="animate-spin" />
            Chargement du registre des bus…
          </p>
        )}

        {!loading && overview && !authorized && (
          <p
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            Affectation refusée : votre compte n'a pas accès à cette gare.
            La Direction doit vous attribuer la gare concernée, ou sélectionner
            une gare de votre périmètre.
          </p>
        )}

        {!loading && authorized && availableBuses.length === 0 && (
          <p
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            Aucun bus réel éligible pour cette compagnie. La Direction doit enregistrer
            un véhicule authentique (immatriculation, marque, capacité) dans « Véhicules ».
            Les horaires seuls ne créent pas de départ avec bus.
            Pour Abidjan → Yamoussoukro, sélectionnez aussi une gare de départ située à Abidjan.
          </p>
        )}

        {!loading && authorized && demoBusCount > 0 && (
          <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {demoBusCount} véhicule(s) identifié(s) comme TEST / DEMO / FICTIF
            sont exclus des affectations de production.
          </p>
        )}

        {!loading && authorized && publishedLines.length === 0 && (
          <p
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            Aucune ligne publiée avec horaire pour cette gare.
            Vérifiez la publication du planning.
          </p>
        )}

        {!loading && overview && authorized && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-black text-slate-900">
                Préparation du départ
              </h3>
              <span className="text-xs font-semibold text-slate-500">
                {formSteps.filter((step) => step.ok).length}/{formSteps.length}
                {' '}conditions remplies
              </span>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {formSteps.map((step) => (
                <div
                  key={step.label}
                  className="flex items-center gap-2 text-xs font-medium text-slate-700"
                >
                  {step.ok ? (
                    <CheckCircle2
                      size={15}
                      aria-hidden="true"
                      className="shrink-0 text-emerald-600"
                    />
                  ) : (
                    <Circle
                      size={15}
                      aria-hidden="true"
                      className="shrink-0 text-amber-500"
                    />
                  )}
                  {step.label}
                </div>
              ))}
            </div>

            <p className="mt-3 text-xs text-slate-500">
              {publishedLines.length} ligne(s) publiée(s) pour cette gare
              {' · '}
              {availableBuses.length} bus disponible(s) dans le
              registre de la compagnie.
            </p>
          </div>
        )}

        <form
          onSubmit={(event) => void submit(event)}
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          <label className={labelClass}>
            Ligne publiée
            <select
              className={fieldClass}
              value={ligneId}
              required
              disabled={!authorized || busy || loading}
              onChange={(event) => {
                setLigneId(event.target.value);
                setHoraireId('');
                setError('');
              }}
            >
              <option value="">Sélectionner la destination</option>
              {publishedLines.map((line) => (
                <option key={line.id} value={line.id}>
                  {line.depart_nom} → {line.arrivee_nom || line.ville}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            Horaire de départ
            <select
              className={fieldClass}
              value={horaireId}
              required
              disabled={!authorized || busy || loading || !selectedLine}
              onChange={(event) => setHoraireId(event.target.value)}
            >
              <option value="">Sélectionner un horaire</option>
              {selectedHours.map((hour) => {
                const future = departureInFuture(dateDepart, hour.heure_depart);
                return (
                  <option key={hour.id} value={hour.id} disabled={!future}>
                    {hour.heure_depart}{future ? '' : ' · passé / invalide'}
                  </option>
                );
              })}
            </select>
          </label>

          {selectedLine && selectableHours.length === 0 && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 md:col-span-2 xl:col-span-3" role="status">
              Aucun horaire futur pour la date choisie (fuseau Africa/Abidjan).
              Choisissez un autre jour ou demandez à la compagnie de publier un horaire.
            </p>
          )}

          <label className={labelClass}>
            Date de départ
            <input
              type="date"
              required
              min={minimumDate}
              className={fieldClass}
              value={dateDepart}
              disabled={!authorized || busy || loading}
              onChange={(event) => setDateDepart(event.target.value)}
            />
          </label>

          <label className={`${labelClass} md:col-span-2 xl:col-span-3`}>
            Bus disponible
            <select
              className={fieldClass}
              value={busId}
              required
              disabled={!authorized || busy || loading}
              onChange={(event) => setBusId(event.target.value)}
            >
              <option value="">
                Sélectionner un bus enregistré par la Direction
              </option>
              {availableBuses.map((bus) => (
                <option key={bus.id} value={bus.id}>
                  {bus.numero_interne} · {bus.immatriculation} · {bus.capacite} sièges
                  {bus.marque ? ` · ${bus.marque}` : ''}
                </option>
              ))}
            </select>
          </label>

          {selectedBus && isDemoBus(selectedBus) && (
            <p
              role="alert"
              className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 md:col-span-2 xl:col-span-3"
            >
              Un véhicule de démonstration ne peut pas être affecté en production.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 md:col-span-2 xl:col-span-3">
            <button
              type="submit"
              disabled={!formReady}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-extrabold text-white shadow-md shadow-orange-100 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <RefreshCcw size={16} className="animate-spin" />
              ) : (
                <CalendarClock size={16} />
              )}
              {busy ? 'Affectation en cours…' : 'Confirmer l’affectation'}
              <ArrowRight size={16} />
            </button>

            {!formReady && !loading && authorized && (
              <span role="status" className="text-xs font-semibold text-amber-800">
                Renseignez les conditions manquantes ci-dessus pour activer le bouton.
              </span>
            )}

            <p className="flex max-w-lg items-start gap-2 text-xs leading-5 text-slate-500">
              <ShieldCheck size={16} className="mt-0.5 shrink-0" />
              La vérification finale du bus, de la gare et de l'horaire
              appartient au serveur.
            </p>
          </div>
        </form>

        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">
          <Info size={15} className="mr-2 inline align-text-bottom" />
          Une affectation valide rend le départ visible au catalogue mobile ;
          elle ne crée ni réservation ni billet. Les paiements restent désactivés
          jusqu'à validation de la chaîne de réservation et d'encaissement.
        </div>
      </div>

      <div className="border-t border-slate-100 px-5 py-5 sm:px-6">
        <div className="mb-3 flex items-center gap-2">
          <ClipboardList size={18} className="text-orange-600" />
          <h3 className="text-sm font-black text-slate-900">
            Dernières affectations de cette gare
          </h3>
        </div>

        {assigned.length === 0 && !loading && (
          <p className="text-sm text-slate-500">
            Aucun départ avec bus affecté n'a été retourné pour cette gare.
          </p>
        )}

        {assigned.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-[630px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Bus</th>
                  <th className="p-3">Immatriculation</th>
                  <th className="p-3">Capacité</th>
                  <th className="p-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {assigned.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="p-3 font-semibold">{item.date_depart}</td>
                    <td className="p-3">{item.numero_bus_snapshot}</td>
                    <td className="p-3 font-mono text-xs">
                      {item.immatriculation_snapshot}
                    </td>
                    <td className="p-3">
                      {item.capacite_snapshot} places
                    </td>
                    <td className="p-3">{item.statut}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs text-slate-400">
          Affichage limité aux huit premières affectations retournées
          pour la gare ; l'API limite également le registre.
        </p>
      </div>
    </section>
  );
}
