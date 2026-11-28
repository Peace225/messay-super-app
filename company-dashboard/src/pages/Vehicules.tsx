import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BusFront, RefreshCw, Search, AlertCircle } from 'lucide-react';
import {
  getRelationText, getText, loadExploitation, numberOrNull,
  type ApiRecord,
} from '../services/exploitationApi';

type Vehicule = {
  id: string;
  immatriculation: string;
  designation: string;
  capacite: number | null;
  statut: string;
};

function toVehicule(row: ApiRecord, index: number): Vehicule {
  const marque = getText(row.marque ?? row.brand);
  const modele = getText(row.modele ?? row.model);
  return {
    id: getText(row.id) ?? `position-${index}`,
    immatriculation: getText(row.immatriculation ?? row.registration ?? row.plaque) ?? 'Non renseignée',
    designation:
      getRelationText(row.nom, 'nom') ??
      [marque, modele].filter(Boolean).join(' ') ?? 'Bus',
    capacite: numberOrNull(row.capacite ?? row.capacity ?? row.nombre_places ?? row.places),
    statut: getText(row.statut ?? row.status) ?? 'Non renseigné',
  };
}

export default function Vehicules() {
  const [rows, setRows] = useState<Vehicule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const controllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const result = await loadExploitation('vehicules', controller.signal);
      if (!controller.signal.aborted) setRows(result.map(toVehicule));
    } catch (cause) {
      if (!controller.signal.aborted) {
        setRows([]);
        setError(cause instanceof Error ? cause.message : 'Chargement impossible.');
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => controllerRef.current?.abort();
  }, [refresh]);

  const filtered = useMemo(() => rows.filter((v) =>
    `${v.immatriculation} ${v.designation} ${v.statut}`.toLowerCase().includes(search.trim().toLowerCase())
  ), [rows, search]);

  return (
    <main className="mx-auto max-w-7xl space-y-5 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><BusFront size={23} /></div>
          <div>
            <h1 className="text-xl font-black text-gray-900">Bus et capacités</h1>
            <p className="mt-1 text-sm text-gray-500">Inventaire réel des véhicules de la compagnie</p>
            {!loading && !error && <p className="mt-1 text-xs font-bold text-orange-600">{rows.length} véhicule(s)</p>}
          </div>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-50 px-4 py-2.5 text-sm font-bold text-orange-700 disabled:opacity-50">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </header>
      <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3">
        <Search size={18} className="text-gray-400" />
        <input aria-label="Rechercher un bus" value={search} onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher un bus ou une immatriculation..." className="w-full bg-transparent text-sm outline-none" />
      </label>
      {error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"><AlertCircle size={20} className="shrink-0" /><p>{error}</p></div>}
      {loading && <p role="status" className="rounded-2xl bg-white p-8 text-center text-sm text-gray-500">Chargement des véhicules…</p>}
      {!loading && !error && filtered.length === 0 && <p className="rounded-2xl bg-white p-8 text-center text-sm text-gray-500">{rows.length ? 'Aucun résultat pour cette recherche.' : 'Aucun véhicule enregistré pour cette compagnie.'}</p>}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => (
            <article key={v.id} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <BusFront className="text-orange-600" size={23} />
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{v.statut}</span>
              </div>
              <h2 className="break-words text-lg font-black text-gray-900">{v.immatriculation}</h2>
              <p className="mt-1 text-sm text-gray-500">{v.designation || 'Modèle non renseigné'}</p>
              <p className="mt-4 rounded-xl bg-orange-50 p-3 text-sm font-bold text-orange-700">
                Capacité : {v.capacite === null ? 'Non renseignée' : `${v.capacite} places`}
              </p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
