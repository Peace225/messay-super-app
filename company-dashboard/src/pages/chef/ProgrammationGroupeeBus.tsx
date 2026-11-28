/**
 * MESSAY PRO — Programmation groupée non atomique, par la route d'affectation existante.
 * Chaque création reste soumise aux contrôles serveur (compagnie, gare, rôle, bus, ligne).
 * NE crée jamais de certification de capacité et NE déclenche aucun paiement.
 */
import { useEffect, useMemo, useState } from 'react';
import type { GarePlanningLigne } from '../../services/garePlanningApi';
import { messayBusApi, type Bus, type BusOverview } from '../../services/messayBusApi';

type Props = { gareId: string; gareName: string; lignes: GarePlanningLigne[] };
type Plan = { date: string; reason: string | null };

function localNow(): { date: string; heure: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Abidjan', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, heure: `${part('hour')}:${part('minute')}` };
}
function datesDuMois(month: string): string[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
  const [year, m] = month.split('-').map(Number);
  if (year < 2026 || year > 2100) return [];
  const count = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, n) => `${month}-${String(n + 1).padStart(2, '0')}`);
}
function estDemo(bus: Bus): boolean {
  return [bus.numero_interne, bus.marque, bus.modele].some(v =>
    /(?:^|[\s_-])(test|demo|d[eé]mo|fictif|fake)(?:$|[\s_-])/iu.test(v || ''),
  );
}
function horaireNormalise(raw: string): string {
  const value = /^([01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(raw) ? raw.slice(0, 5) : '';
  return value.padStart(value ? 5 : 0, '0');
}

export default function ProgrammationGroupeeBus({ gareId, gareName, lignes }: Props) {
  const [overview, setOverview] = useState<BusOverview | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [month, setMonth] = useState('2026-12');
  const [ligneId, setLigneId] = useState('');
  const [horaireId, setHoraireId] = useState('');
  const [busId, setBusId] = useState('');
  const [jours, setJours] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setOverview(null);
    setLoading(true);
    setError('');
    void messayBusApi.lister().then(data => { if (active) setOverview(data); })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : 'Chargement impossible.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [gareId, reload]);

  const lignesPubliees = useMemo(() => lignes.filter(l =>
    l.gare_depart_id === gareId && l.publie && Array.isArray(l.horaires) && l.horaires.length > 0,
  ), [lignes, gareId]);
  const ligne = lignesPubliees.find(l => l.id === ligneId);
  const horaire = ligne?.horaires.find(h => h.id === horaireId);
  const bus = overview?.vehicules.find(b => b.id === busId);
  const now = localNow();
  const autorise = Boolean(overview && overview.gares.some(g => g.id === gareId) &&
    (overview.role === 'DIRECTION' || overview.role === 'CHEF_GARE'));
  const inventaireComplet = Boolean(overview && overview.affectations.length < 150);
  const busValide = Boolean(bus && bus.statut === 'DISPONIBLE' && !estDemo(bus) &&
    Number.isInteger(bus.capacite) && bus.capacite >= 1 && bus.capacite <= 120 &&
    bus.immatriculation?.trim().length >= 3);
  const heure = horaireNormalise(horaire?.heure_depart ?? '');

  const plan = useMemo<Plan[]>(() => {
    if (!overview || !ligne || !horaire || !bus || !heure) return [];
    return datesDuMois(month)
      .filter(date => jours.includes(new Date(`${date}T12:00:00Z`).getUTCDay()))
      .map(date => {
        if (date < now.date || (date === now.date && heure <= now.heure)) {
          return { date, reason: 'Départ passé' };
        }
        const already = overview.affectations.some(a => a.gare_id === gareId &&
          a.destination_id === ligne.id && a.horaire_id === horaire.id &&
          a.date_depart === date && a.statut === 'PROGRAMME');
        if (already) return { date, reason: 'Créneau déjà programmé' };
        // Règle conservatrice : un même bus ne prend qu'un départ par jour
        // tant que les durées de trajet / rotation ne sont pas disponibles.
        const usedBus = overview.affectations.some(a => a.bus_id === bus.id &&
          a.date_depart === date && a.statut === 'PROGRAMME');
        if (usedBus) return { date, reason: 'Bus déjà utilisé ce jour' };
        return { date, reason: null };
      });
  }, [overview, ligne, horaire, bus, heure, month, jours, gareId, now.date, now.heure]);
  const admissibles = plan.filter(p => p.reason === null);
  const hasTruncation = Boolean(overview && !inventaireComplet);

  async function submit() {
    if (busy || loading || !autorise || !inventaireComplet || !busValide ||
        !ligne || !horaire || !heure || admissibles.length === 0) return;
    if (!window.confirm(
      `MESSAY — confirmer ${admissibles.length} départ(s) commerciaux ?\n` +
      `Gare : ${gareName}\nLigne : ${ligne.arrivee_nom || ligne.ville}\n` +
      `Horaire : ${heure}\nBus : ${bus?.numero_interne}\n` +
      `Période : ${month}\n\n` +
      `ATTENTION : les créations successives ne sont pas atomiques. ` +
      `Une erreur conserve les dates déjà créées. Aucune certification de vente n'est créée.`,
    )) return;
    setBusy(true);
    setError('');
    setInfo('');
    setCompleted([]);
    const faits: string[] = [];
    let failed = '';
    for (const day of admissibles) {
      try {
        await messayBusApi.affecter(gareId, {
          destination_id: ligne.id, horaire_id: horaire.id,
          date_depart: day.date, bus_id: bus!.id,
        });
        faits.push(day.date);
        setCompleted([...faits]);
      } catch (e: unknown) {
        failed = `${day.date} : ${e instanceof Error ? e.message : 'Erreur inconnue'}`;
        break; // fail-closed, ne jamais passer silencieusement à une autre date
      }
    }
    setInfo(`${faits.length} départ(s) enregistré(s).`);
    if (failed) setError(`Programmation interrompue à ${failed}. Les ${faits.length} départ(s) précédents restent créés.`);
    setBusy(false);
    setReload(n => n + 1);
  }

  const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Programmation groupée des départs">
      <h3 className="text-base font-bold text-slate-900">Programmer plusieurs départs</h3>
      <p className="mt-1 text-sm text-slate-600">
        Création confirmée date par date, selon les autorisations de votre compagnie.
        Un seul départ par bus et par journée est autorisé dans cet outil prudent.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-semibold">Mois
          <input className={input} type="month" min={now.date.slice(0, 7)} value={month}
            disabled={busy} onChange={e => setMonth(e.target.value)} />
        </label>
        <label className="text-sm font-semibold">Ligne publiée
          <select className={input} value={ligneId} disabled={busy}
            onChange={e => { setLigneId(e.target.value); setHoraireId(''); }}>
            <option value="">Choisir une ligne</option>
            {lignesPubliees.map(l => <option key={l.id} value={l.id}>{l.arrivee_nom || l.ville}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Horaire
          <select className={input} value={horaireId} disabled={busy} onChange={e => setHoraireId(e.target.value)}>
            <option value="">Choisir un horaire</option>
            {(ligne?.horaires ?? []).map(h => <option key={h.id} value={h.id}>{h.heure_depart}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Bus réel disponible
          <select className={input} value={busId} disabled={busy} onChange={e => setBusId(e.target.value)}>
            <option value="">Choisir un bus</option>
            {(overview?.vehicules ?? []).filter(b => b.statut === 'DISPONIBLE' && !estDemo(b))
              .map(b => <option key={b.id} value={b.id}>{b.numero_interne} — {b.capacite} places</option>)}
          </select>
        </label>
      </div>
      <fieldset className="mt-4" disabled={busy}>
        <legend className="text-sm font-semibold text-slate-800">Jours de circulation</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'].map((name, n) => (
            <label className="flex items-center gap-1.5 text-sm" key={name}>
              <input type="checkbox" checked={jours.includes(n)} onChange={e => setJours(old =>
                e.target.checked ? [...old, n] : old.filter(v => v !== n))} />{name}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mt-3 text-sm text-slate-700">
        {plan.length} date(s) sélectionnée(s), {admissibles.length} programmable(s),
        {' '}{plan.length - admissibles.length} exclue(s).
      </p>
      {hasTruncation && <p className="mt-2 text-sm text-amber-900" role="alert">
        L'API retourne jusqu'à 150 affectations : inventaire potentiellement incomplet.
        Programmation groupée bloquée pour éviter les collisions. Une API paginée est nécessaire.
      </p>}
      {error && <p className="mt-3 text-sm text-red-800" role="alert">{error}</p>}
      {info && <p className="mt-3 text-sm text-emerald-800" role="status">{info}</p>}
      {completed.length > 0 && <p className="mt-1 text-xs text-slate-600">Dates créées : {completed.join(', ')}</p>}
      <div className="mt-3 max-h-40 overflow-auto rounded-lg border border-slate-200 p-2 text-xs">
        {plan.length ? plan.map(p => <div key={p.date} className="flex justify-between gap-3 py-1">
          <span>{p.date}</span><span className={p.reason ? 'text-amber-800' : 'text-emerald-700'}>
            {p.reason || 'Prêt à programmer'}</span>
        </div>) : 'Sélectionnez une ligne, un horaire et un bus pour prévisualiser.'}
      </div>
      <button type="button" className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        disabled={busy || loading || !autorise || !inventaireComplet || !busValide || !ligne || !horaire || !heure || admissibles.length === 0}
        onClick={() => void submit()}>
        {busy ? `Programmation… (${completed.length}/${admissibles.length})` : `Confirmer ${admissibles.length} départ(s)`}
      </button>
      <p className="mt-2 text-xs text-slate-500">Aucune vente ni certification de places créée ici. Les bus fictifs sont interdits.</p>
    </section>
  );
}
