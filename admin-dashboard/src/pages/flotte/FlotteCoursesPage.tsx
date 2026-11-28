import { useMemo, useState } from 'react';
import {
  ClipboardList,
  Download,
  Eye,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { FleetHeading } from '../../components/flotte/FlotteUI';
import { useAdminCourses, type AdminCourse } from '../../hooks/useAdminCourses';
import { exportCsv, formatAmount, formatDateTime } from '../../utils/fleetFormat';

type Person = {
  nom?: string | null;
  prenom?: string | null;
};

function personName(user?: Person | null): string {
  const name = [user?.prenom, user?.nom]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim())
    .join(' ');

  return name || 'Non renseigné';
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'EN_COURS'
      ? 'bg-orange-50 text-orange-700'
      : status === 'TERMINEE'
        ? 'bg-emerald-50 text-emerald-700'
        : status === 'ANNULEE'
          ? 'bg-red-50 text-red-700'
          : 'bg-blue-50 text-blue-700';

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${color}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function FlotteCoursesPage() {
  const data = useAdminCourses();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('TOUS');
  const [selected, setSelected] = useState<AdminCourse | null>(null);

  const statuses = useMemo<string[]>(
    () => ['TOUS', ...new Set(data.courses.map((course) => course.statut))],
    [data.courses],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.courses.filter((course) => {
      const searchableText = [
        course.id,
        course.departAdresse,
        course.destinationAdresse,
        personName(course.user),
        personName(course.conducteur?.user),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return (status === 'TOUS' || course.statut === status) && searchableText.includes(query);
    });
  }, [data.courses, search, status]);

  const cards = [
    { label: 'Courses chargées', value: data.courses.length },
    { label: 'En cours', value: data.courses.filter((c) => c.statut === 'EN_COURS').length },
    { label: 'Terminées', value: data.courses.filter((c) => c.statut === 'TERMINEE').length },
    { label: 'Annulées', value: data.courses.filter((c) => c.statut === 'ANNULEE').length },
  ];

  const handleExport = () => {
    exportCsv(
      'messay-courses',
      ['ID', 'Date', 'Départ', 'Destination', 'Passager', 'Conducteur', 'Statut', 'Prix'],
      filtered.map((course) => [
        course.id,
        course.createdAt,
        course.departAdresse,
        course.destinationAdresse,
        personName(course.user),
        personName(course.conducteur?.user),
        course.statut,
        course.prixFinal ?? course.prix,
      ]),
    );
  };

  const details: Array<{ label: string; value: string }> = selected
    ? [
        { label: 'Identifiant', value: selected.id },
        { label: 'Statut', value: selected.statut.replace(/_/g, ' ') },
        { label: 'Passager', value: personName(selected.user) },
        { label: 'Téléphone passager', value: selected.user?.telephone || 'Non renseigné' },
        { label: 'Conducteur', value: personName(selected.conducteur?.user) },
        { label: 'Départ', value: selected.departAdresse || '—' },
        { label: 'Destination', value: selected.destinationAdresse || '—' },
        { label: 'Prix', value: formatAmount(selected.prixFinal ?? selected.prix, ' F') },
        { label: 'Distance', value: formatAmount(selected.distance, ' km', 1) },
        { label: 'Durée estimée', value: formatAmount(selected.dureeEstimee, ' min') },
        { label: 'Création', value: formatDateTime(selected.createdAt) },
      ]
    : [];

  return (
    <main className="space-y-6 p-4 md:p-6">
      <FleetHeading
        title="Courses tricycle"
        subtitle="Historique, statuts, trajets et détails des courses de MESSAY."
      />

      {data.limitedScope && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          La liste chargée peut être limitée aux courses du compte connecté. Pour une vue complète,
          utilisez le endpoint ADMIN <code>/api/admin/transport/courses</code>.
        </div>
      )}

      {data.error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {data.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(({ label, value }) => (
          <div key={label} className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase text-gray-500">{label}</p>
            <p className="mt-2 text-3xl font-black text-gray-900">
              {data.updatedAt ? value.toLocaleString('fr-FR') : '—'}
            </p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <label className="relative min-w-[190px] flex-1">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input
              aria-label="Rechercher une course"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Départ, destination, passager, conducteur..."
              className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm outline-none focus:border-orange-500"
            />
          </label>

          <select
            aria-label="Statut de la course"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border bg-white px-3 py-2.5 text-sm"
          >
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => data.refresh()}
            disabled={data.loading}
            className="flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm disabled:opacity-40"
          >
            <RefreshCw size={16} className={data.loading ? 'animate-spin' : ''} />
            Actualiser
          </button>

          <button
            type="button"
            disabled={!data.updatedAt || filtered.length === 0}
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-3 py-2.5 text-sm text-white disabled:opacity-40"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                {['Course', 'Trajet', 'Passager', 'Conducteur', 'Statut', 'Prix', ''].map((heading) => (
                  <th key={heading} className="p-4">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((course) => (
                <tr key={course.id} className="hover:bg-orange-50/40">
                  <td className="p-4">
                    <p className="font-mono font-bold">#{course.id.slice(0, 8)}</p>
                    <p className="text-xs text-gray-500">{formatDateTime(course.createdAt)}</p>
                  </td>
                  <td className="max-w-[250px] p-4">
                    <p className="truncate font-semibold">{course.departAdresse || 'Départ inconnu'}</p>
                    <p className="truncate text-xs text-gray-500">
                      → {course.destinationAdresse || 'Destination inconnue'}
                    </p>
                  </td>
                  <td className="p-4">{personName(course.user)}</td>
                  <td className="p-4">{personName(course.conducteur?.user)}</td>
                  <td className="p-4"><StatusBadge status={course.statut} /></td>
                  <td className="p-4 font-bold">
                    {formatAmount(course.prixFinal ?? course.prix, ' F')}
                  </td>
                  <td className="p-4">
                    <button
                      type="button"
                      title="Consulter la course"
                      aria-label={`Détails de la course ${course.id}`}
                      onClick={() => setSelected(course)}
                      className="rounded-lg border p-2 hover:bg-orange-50"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.loading && <p className="p-8 text-center text-gray-500">Chargement des courses…</p>}
        {!data.loading && !data.error && filtered.length === 0 && (
          <p className="p-8 text-center text-gray-500">Aucune course disponible pour ces filtres.</p>
        )}
      </section>

      <p className="text-xs text-gray-500">
        Consultation uniquement : les annulations et réaffectations exigent des endpoints ADMIN sécurisés.
      </p>

      {selected && (
        <div
          className="fixed inset-0 z-[90] flex justify-end bg-black/50"
          onClick={() => setSelected(null)}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Détail de la course"
            onClick={(event) => event.stopPropagation()}
            className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-black">
                <ClipboardList className="text-orange-500" />
                Course #{selected.id.slice(0, 8)}
              </h2>
              <button
                type="button"
                aria-label="Fermer les détails"
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-8 space-y-4">
              {details.map(({ label, value }) => (
                <div key={label} className="border-b pb-3 text-sm">
                  <p className="text-gray-500">{label}</p>
                  <p className="mt-1 break-words font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
