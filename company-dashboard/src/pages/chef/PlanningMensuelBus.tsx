/**
 * MESSAY — prévisualisation des créneaux mensuels d'une gare.
 * Lecture seule : aucun bus réservé, aucune affectation ni paiement créé.
 * Les données de planning proviennent du backend authentifié du Dashboard.
 */
import { useEffect, useMemo, useState } from 'react';
import ProgrammationGroupeeBus from './ProgrammationGroupeeBus';
import type { GarePlanningLigne } from '../../services/garePlanningApi';
import { messayBusApi, type BusAffectation } from '../../services/messayBusApi';

type Props = { gareId: string; gareName: string; lignes: GarePlanningLigne[] };
type Slot = {
  key: string;
  date: string;
  heure: string;
  destination: string;
  prix: number;
  affectation: BusAffectation | undefined;
};

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
function monthDays(month: string): string[] {
  if (!MONTH_PATTERN.test(month)) return [];
  const [year, mo] = month.split('-').map(Number);
  const count = new Date(Date.UTC(year, mo, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}
function monthAbidjan(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Abidjan', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date());
  const value = (kind: string) => parts.find(p => p.type === kind)?.value ?? '';
  return `${value('year')}-${value('month')}`;
}
const time = (value: string) => /^\d{1,2}:\d{2}(?::\d{2})?$/.test(value)
  ? value.slice(0, 5).padStart(5, '0') : '';

export default function PlanningMensuelBus({ gareId, gareName, lignes }: Props) {
  const [month, setMonth] = useState('2026-12');
  const [day, setDay] = useState('');
  const [destination, setDestination] = useState('');
  const [affectations, setAffectations] = useState<BusAffectation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [potentiallyTruncated, setPotentiallyTruncated] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void messayBusApi.lister().then(overview => {
      if (!active) return;
      const rows = overview.affectations ?? [];
      // GET /vehicules limite les affectations à 150. Ne pas les prendre pour un inventaire exhaustif.
      setPotentiallyTruncated(rows.length >= 150);
      setAffectations(rows.filter(a => a.gare_id === gareId));
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Impossible de charger les affectations.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [gareId]);

  const days = useMemo(() => monthDays(month), [month]);
  const published = useMemo(() => lignes.filter(l =>
    l.gare_depart_id === gareId && l.publie && Array.isArray(l.horaires),
  ), [gareId, lignes]);
  const slots = useMemo(() => {
    const map = new Map<string, BusAffectation>();
    for (const a of affectations) {
      const key = `${a.date_depart}|${a.destination_id}|${a.horaire_id}`;
      if (!map.has(key)) map.set(key, a);
    }
    const out: Slot[] = [];
    for (const date of days) for (const line of published) {
      if (destination && destination !== line.id) continue;
      for (const hour of line.horaires) {
        const heure = time(hour.heure_depart);
        if (!heure) continue;
        const key = `${date}|${line.id}|${hour.id}`;
        out.push({
          key, date, heure, destination: line.arrivee_nom || line.ville,
          prix: line.prix, affectation: map.get(key),
        });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.heure.localeCompare(b.heure) || a.destination.localeCompare(b.destination));
  }, [affectations, days, published, destination]);
  const shown = day ? slots.filter(s => s.date === day) : slots;
  const confirmed = slots.filter(s => s.affectation?.statut === 'PROGRAMME').length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Planning mensuel prévisionnel des bus">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-900">Planning mensuel — {gareName}</h2>
        <p className="text-sm text-slate-600">Créneaux calculés à partir des horaires publiés. Une ligne sans bus affecté n'est pas un départ commercial confirmé.</p>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold text-slate-700">Mois
          <input type="month" value={month} min={monthAbidjan()} onChange={e => {setMonth(e.target.value); setDay('');}}
            className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
        </label>
        <label className="text-sm font-semibold text-slate-700">Jour
          <select value={day} onChange={e => setDay(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 p-2">
            <option value="">Tout le mois</option>
            {days.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">Destination
          <select value={destination} onChange={e => setDestination(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 p-2">
            <option value="">Toutes les destinations</option>
            {published.map(l => <option key={l.id} value={l.id}>{l.arrivee_nom || l.ville}</option>)}
          </select>
        </label>
      </div>
      <p className="mb-3 text-sm text-slate-700">{slots.length} créneaux prévisionnels • {loading ? 'Chargement des affectations…' : `${confirmed} affectation(s) PROGRAMME visible(s)`}</p>
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {potentiallyTruncated && <p role="status" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Attention : l'API limite la liste des affectations à 150. Les états affichés peuvent être incomplets. Ne pas utiliser ce tableau pour certifier l'ensemble du mois.</p>}
      <div className="max-h-[520px] overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-100 text-slate-700"><tr>
            <th className="p-3">Date</th><th className="p-3">Heure</th><th className="p-3">Destination</th><th className="p-3">Tarif</th><th className="p-3">Bus / statut</th>
          </tr></thead>
          <tbody>
            {shown.slice(0, 250).map(s => <tr key={s.key} className="border-t border-slate-100">
              <td className="p-3">{s.date}</td><td className="p-3">{s.heure}</td>
              <td className="p-3">{s.destination}</td><td className="p-3">{s.prix.toLocaleString('fr-FR')} FCFA</td>
              <td className="p-3">{s.affectation ? `${s.affectation.numero_bus_snapshot} — ${s.affectation.statut}` : 'À planifier'}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {shown.length > 250 && <p className="mt-2 text-xs text-amber-800">Affichage limité aux 250 premiers créneaux : sélectionnez un jour ou une destination pour affiner.</p>}
      {!shown.length && <p className="mt-3 text-sm text-slate-500">Aucun horaire publié ne correspond à ce filtre.</p>}
      <p className="mt-3 text-xs text-slate-500">Le calendrier présente les créneaux prévisionnels. La programmation groupée ci-dessous permet de confirmer des départs avec des véhicules autorisés. Chaque affectation reste contrôlée par le backend. Aucun paiement n'est activé.</p>
      <ProgrammationGroupeeBus gareId={gareId} gareName={gareName} lignes={lignes} />
    </section>
  );
}
