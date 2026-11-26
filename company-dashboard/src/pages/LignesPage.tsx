/**
 * MESSAY PRO — Direction / Lignes de trajet
 * Lecture multi-compagnies sans identifiants codés en dur.
 *
 * La source principale est /api/company-dashboard/planification/reseau.
 * Le backend DOIT inclure les lignes sans gare pour une couverture complète.
 * Les fiches de gares ne sont qu'une source de complément/fallback.
 * Aucune mutation SQL ni publication commerciale ne sont réalisées ici.
 */
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  MapPin,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
  Pencil,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { completerGaresLigne } from '../services/messayLignesCorrectionApi';
import {
  garesManagementApi,
  type Gare,
  type GareOverview,
  type LigneGare,
} from '../services/garesManagementApi';
import {
  garePlanningApi,
  type GarePlanningGare,
  type GarePlanningLigne,
} from '../services/garePlanningApi';

type LigneReseau = {
  id: string;
  gare_depart_id: string | null;
  gare_arrivee_id: string | null;
  gare_depart_nom: string | null;
  gare_arrivee_nom: string | null;
  ville_depart: string | null;
  ville_arrivee: string;
  prix: number | null;
  duree: string | null;
  horaires: { id: string; heure_depart: string }[];
  publie: boolean | null;
};

type GareFiltre = { id: string; nom: string; ville: string };
const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Une erreur inattendue est survenue.';

function fromGare(ligne: LigneGare): LigneReseau {
  return {
    id: ligne.id,
    gare_depart_id: ligne.gare_depart_id,
    gare_arrivee_id: ligne.gare_arrivee_id,
    gare_depart_nom: ligne.gare_depart_nom,
    gare_arrivee_nom: ligne.gare_arrivee_nom,
    ville_depart: ligne.ville_depart,
    ville_arrivee: ligne.ville_arrivee,
    prix: ligne.prix,
    duree: ligne.duree,
    horaires: ligne.horaires ?? [],
    publie: null, // Les fiches de gare ne prouvent pas le statut de publication.
  };
}

function fromPlanning(ligne: GarePlanningLigne): LigneReseau {
  return {
    id: ligne.id,
    gare_depart_id: ligne.gare_depart_id || null,
    gare_arrivee_id: ligne.gare_arrivee_id || null,
    gare_depart_nom: ligne.depart_nom,
    gare_arrivee_nom: ligne.arrivee_nom,
    ville_depart: null,
    ville_arrivee: ligne.ville,
    prix: Number.isFinite(ligne.prix) ? ligne.prix : null,
    duree: ligne.duree,
    horaires: ligne.horaires ?? [],
    publie: ligne.publie,
  };
}

function isComplete(line: LigneReseau): boolean {
  return Boolean(
    line.gare_depart_id &&
    line.gare_arrivee_id &&
    line.gare_depart_id !== line.gare_arrivee_id &&
    typeof line.prix === 'number' && line.prix > 0 &&
    line.duree?.trim() &&
    line.horaires.length > 0,
  );
}

export default function LignesPage() {
  const [gares, setGares] = useState<GareFiltre[]>([]);
  const [lignes, setLignes] = useState<LigneReseau[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [search, setSearch] = useState('');
  const [gareFilter, setGareFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TOUTES' | 'COMPLETES' | 'INCOMPLETES'>('TOUTES');
  const [editing, setEditing] = useState<LigneReseau | null>(null);
  const [nextDepart, setNextDepart] = useState('');
  const [nextArrivee, setNextArrivee] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveNotice, setSaveNotice] = useState('');
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      setWarning('');

      const [networkResult, garesResult] = await Promise.allSettled([
        garePlanningApi.reseauDirection(),
        garesManagementApi.list(),
      ]);
      if (!active) return;

      const network = networkResult.status === 'fulfilled' ? networkResult.value : null;
      const stations: Gare[] = garesResult.status === 'fulfilled' ? garesResult.value : [];
      const stationsFromNetwork: GarePlanningGare[] = Array.isArray(network?.gares) ? network.gares : [];
      const stationById = new Map<string, GareFiltre>();
      for (const station of [...stationsFromNetwork, ...stations]) {
        stationById.set(station.id, { id: station.id, nom: station.nom, ville: station.ville });
      }
      setGares([...stationById.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')));

      const found = new Map<string, LigneReseau>();
      let failedOverviews = 0;
      if (stations.length) {
        for (let i = 0; i < stations.length; i += 5) {
          const batch = await Promise.allSettled(
            stations.slice(i, i + 5).map((station) => garesManagementApi.overview(station.id)),
          );
          if (!active) return;
          for (const item of batch) {
            if (item.status === 'rejected') {
              failedOverviews += 1;
              continue;
            }
            const overview: GareOverview = item.value;
            for (const ligne of [...(overview.departs ?? []), ...(overview.arrivees ?? [])]) {
              if (ligne.id) found.set(ligne.id, fromGare(ligne));
            }
          }
        }
      }

      // La source réseau a priorité : elle doit inclure les lignes sans aucune gare.
      for (const line of Array.isArray(network?.lignes) ? network.lignes : []) {
        if (line.id) {
          const previous = found.get(line.id);
          const mapped = fromPlanning(line);
          found.set(line.id, {
            ...mapped,
            gare_depart_nom: mapped.gare_depart_nom || previous?.gare_depart_nom || null,
            gare_arrivee_nom: mapped.gare_arrivee_nom || previous?.gare_arrivee_nom || null,
            ville_depart: mapped.ville_depart || (mapped.gare_depart_id ? stationById.get(mapped.gare_depart_id)?.ville : null) || previous?.ville_depart || null,
            horaires: mapped.horaires.length ? mapped.horaires : previous?.horaires ?? [],
          });
        }
      }

      if (!active) return;
      if (networkResult.status === 'rejected') {
        if (!found.size) {
          setError(`Impossible de charger le réseau de la compagnie : ${messageOf(networkResult.reason)}`);
        } else {
          setWarning('Le réseau général est indisponible : les lignes sans gare peuvent manquer dans cette liste.');
        }
      } else if (failedOverviews) {
        setWarning(`${failedOverviews} fiche(s) de gare non chargée(s). Vérifiez les informations complémentaires.`);
      }
      if (garesResult.status === 'rejected' && networkResult.status === 'rejected') {
        setError('Impossible de charger les gares et le réseau. Vérifiez le serveur MESSAY PRO.');
      }
      setLignes([...found.values()].sort((a, b) => a.ville_arrivee.localeCompare(b.ville_arrivee, 'fr')));
      setLoading(false);
    };

    void load();
    return () => { active = false; };
  }, [version]);

  const names = useMemo(() => new Map(gares.map((gare) => [gare.id, gare.nom])), [gares]);
  const filtered = useMemo(() => lignes.filter((line) => {
    if (gareFilter && line.gare_depart_id !== gareFilter && line.gare_arrivee_id !== gareFilter) return false;
    if (statusFilter === 'COMPLETES' && !isComplete(line)) return false;
    if (statusFilter === 'INCOMPLETES' && isComplete(line)) return false;
    const value = [
      line.gare_depart_nom,
      line.gare_arrivee_nom,
      line.gare_depart_id && names.get(line.gare_depart_id),
      line.gare_arrivee_id && names.get(line.gare_arrivee_id),
      line.ville_depart,
      line.ville_arrivee,
    ].filter(Boolean).join(' ').toLowerCase();
    return value.includes(search.trim().toLowerCase());
  }), [gareFilter, lignes, names, search, statusFilter]);

  function editLine(line: LigneReseau) {
    setEditing(line);
    setNextDepart(line.gare_depart_id || '');
    setNextArrivee(line.gare_arrivee_id || '');
    setSaveError('');
  }

  async function saveStations(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || saving) return;
    if (!nextDepart || !nextArrivee || nextDepart === nextArrivee) {
      setSaveError('Choisissez deux gares distinctes appartenant à cette compagnie.');
      return;
    }
    const match = gares.find(g => g.id === nextArrivee);
    const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    if (!match || norm(match.ville) !== norm(editing.ville_arrivee)) {
      setSaveError('La gare d’arrivée doit être dans la ville de destination de la ligne.');
      return;
    }
    const payload: { gare_depart_id?: string; gare_arrivee_id?: string } = {};
    if (!editing.gare_depart_id) payload.gare_depart_id = nextDepart;
    if (!editing.gare_arrivee_id) payload.gare_arrivee_id = nextArrivee;
    if (!Object.keys(payload).length) {
      setEditing(null);
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await completerGaresLigne(editing.id, payload);
      setEditing(null);
      setSaveNotice('Les gares de la ligne ont été enregistrées. Vérifiez les horaires et le tarif avant exploitation.');
      refresh();
    } catch (error) {
      setSaveError(messageOf(error));
    } finally {
      setSaving(false);
    }
  }

  const completeCount = lignes.filter(isComplete).length;
  const incompleteCount = lignes.length - completeCount;
  const schedulesCount = lignes.reduce((count, line) => count + line.horaires.length, 0);

  return (
    <main className="mx-auto max-w-7xl space-y-6 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-orange-600">
            <Route size={17} /> Direction · Réseau interurbain
          </p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">Lignes de trajet</h1>
          <p className="mt-1 text-sm text-slate-500">
            Lignes de votre compagnie, y compris celles dont la configuration reste incomplète.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/gares" className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-bold text-orange-700">
            <MapPin size={16} /> Gérer les gares
          </Link>
          <Link to="/horaires" className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white">
            <CalendarClock size={16} /> Planning et demandes
          </Link>
          <button type="button" onClick={refresh} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-4" aria-label="Résumé du réseau">
        {[
          ['Gares connues', gares.length],
          ['Lignes enregistrées', lignes.length],
          ['À compléter', incompleteCount],
          ['Horaires publiés ou enregistrés', schedulesCount],
        ].map(([label, count]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{count}</p>
          </div>
        ))}
      </section>

      {saveNotice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{saveNotice}</div>}
      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle size={18} className="shrink-0" /> {error}
        </div>
      )}
      {warning && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle size={18} className="shrink-0" /> {warning}
        </div>
      )}
      {!loading && incompleteCount > 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <ShieldAlert size={16} className="mr-2 inline-block" />
          {incompleteCount} ligne(s) nécessitent une configuration. Elles ne doivent pas être proposées à la vente avant validation du départ, du bus, du tarif et de l'inventaire.
        </p>
      )}

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-slate-900">Réseau de la compagnie</h2>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <Search size={16} className="text-slate-400" />
              <input aria-label="Rechercher une ligne" className="min-w-0 bg-transparent text-sm outline-none" placeholder="Ville ou gare…" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <select aria-label="Filtrer par gare" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={gareFilter} onChange={(event) => setGareFilter(event.target.value)}>
              <option value="">Toutes les gares</option>
              {gares.map((gare) => <option key={gare.id} value={gare.id}>{gare.nom} — {gare.ville}</option>)}
            </select>
            <select aria-label="Filtrer par configuration" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="TOUTES">Toutes les lignes</option>
              <option value="COMPLETES">Configuration complète</option>
              <option value="INCOMPLETES">À compléter</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p role="status" className="p-8 text-center text-sm text-slate-500">Chargement du réseau…</p>
        ) : error && lignes.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Impossible de charger les lignes.</p>
        ) : filtered.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">
            {lignes.length ? 'Aucune ligne ne correspond aux filtres.' : 'Aucune ligne retournée par le réseau.'}
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filtered.map((line) => {
              const complete = isComplete(line);
              const missing = [
                !line.gare_depart_id && 'gare de départ',
                !line.gare_arrivee_id && 'gare d’arrivée',
                Boolean(line.gare_depart_id && line.gare_arrivee_id && line.gare_depart_id === line.gare_arrivee_id) && 'gares identiques',
                !(typeof line.prix === 'number' && line.prix > 0) && 'tarif',
                !line.duree?.trim() && 'durée',
                !line.horaires.length && 'horaire',
              ].filter(Boolean).join(', ');
              return (
                <article key={line.id} className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${complete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                      {complete ? <CheckCircle2 size={15} /> : <ShieldAlert size={15} />}
                      {complete ? 'Configuration complète' : 'À compléter'}
                    </span>
                    {line.publie === true && <span className="text-xs text-slate-500">Catalogue publié</span>}
                  </div>
                  <div className="mt-4 flex items-start gap-3">
                    <MapPin size={19} className="mt-1 shrink-0 text-orange-600" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 font-extrabold text-slate-900">
                        <span>{line.gare_depart_nom || (line.gare_depart_id && names.get(line.gare_depart_id)) || 'Départ non renseigné'}</span>
                        <ArrowRight size={17} className="shrink-0 text-orange-500" />
                        <span>{line.gare_arrivee_nom || (line.gare_arrivee_id && names.get(line.gare_arrivee_id)) || line.ville_arrivee || 'Arrivée non renseignée'}</span>
                      </div>
                      {!complete && <p className="mt-2 text-xs font-semibold text-amber-800">À renseigner : {missing}</p>}
                      <p className="mt-2 text-sm text-slate-500">Durée : {line.duree || 'À confirmer'}</p>
                      <p className="mt-1 text-sm text-slate-500">Horaires : {line.horaires.length ? line.horaires.map((h) => h.heure_depart.slice(0, 5)).join(' · ') : 'Non publiés'}</p>
                      <p className="mt-2 text-sm font-extrabold text-orange-600">{typeof line.prix === 'number' && line.prix > 0 ? `${line.prix.toLocaleString('fr-FR')} FCFA` : 'Tarif à confirmer'}</p>
                      <p className="mt-2 break-all text-[11px] text-slate-400">ID ligne : {line.id}</p>
                      {(!line.gare_depart_id || !line.gare_arrivee_id) && (
                        <button type="button" onClick={() => editLine(line)}
                          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-orange-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-orange-700">
                          <Pencil size={14} /> Compléter les gares
                        </button>
                      )}

                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditing(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="edit-line-title"
            className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="edit-line-title" className="text-xl font-black text-slate-900">Compléter les gares</h2>
                <p className="mt-1 text-sm text-slate-600">Destination : {editing.ville_arrivee}</p>
              </div>
              <button type="button" disabled={saving} onClick={() => setEditing(null)} aria-label="Fermer"
                className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"><X size={20} /></button>
            </div>
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
              Sélectionnez les gares confirmées par la compagnie. Cette opération ne publie pas la ligne et ne crée aucun départ.
              Les gares déjà associées sont protégées.
            </p>
            <form onSubmit={(event) => void saveStations(event)} className="mt-4 space-y-4">
              <label className="block text-sm font-bold text-slate-700">Gare de départ
                <select required value={nextDepart} disabled={Boolean(editing.gare_depart_id) || saving}
                  onChange={(event) => setNextDepart(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
                  <option value="">Choisir la gare de départ</option>
                  {gares.map(g => <option key={g.id} value={g.id}>{g.nom} — {g.ville}</option>)}
                </select>
              </label>
              <label className="block text-sm font-bold text-slate-700">Gare d’arrivée
                <select required value={nextArrivee} disabled={Boolean(editing.gare_arrivee_id) || saving}
                  onChange={(event) => setNextArrivee(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
                  <option value="">Choisir la gare d’arrivée</option>
                  {gares.filter(g => g.id !== nextDepart && (
                    g.id === editing.gare_arrivee_id ||
                    g.ville.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() ===
                    editing.ville_arrivee.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
                  )).map(g => <option key={g.id} value={g.id}>{g.nom} — {g.ville}</option>)}
                </select>
              </label>
              {saveError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{saveError}</p>}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setEditing(null)} disabled={saving}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">Annuler</button>
                <button type="submit" disabled={saving || !nextDepart || !nextArrivee || nextDepart === nextArrivee}
                  className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  {saving ? 'Enregistrement…' : 'Enregistrer les gares'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      <p className="text-xs text-slate-500">
        La liste inclut les brouillons et lignes historiques. La correction des gares manquantes est autorisée pour la Direction uniquement. L'affichage des lignes sans gare dépend de la réponse du backend /planification/reseau. Une configuration complète ne garantit ni bus affecté ni billet disponible.
      </p>
    </main>
  );
}
