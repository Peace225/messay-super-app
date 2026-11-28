import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, ArrowRight, Bus, CheckCircle2, ClipboardList, MapPinned,
  ShieldCheck, UserRoundCog, Users, WifiOff, Wrench,
} from 'lucide-react';
import { FleetConnection, FleetHeading, StatusTag } from '../../components/flotte/FlotteUI';
import TricycleIcon from '../../components/flotte/TricycleIcon';
import { useFleetAdmin, validCoordinates } from '../../hooks/useFleetAdmin';
import { useFleetOverviewStats } from '../../hooks/useFleetOverviewStats';
import { formatDateTime } from '../../utils/fleetFormat';

const sections = [
  { to: '/flotte/tricycles', label: 'Tous les tricycles', description: 'Véhicules et affectations réels', icon: TricycleIcon },
  { to: '/flotte/conducteurs', label: 'Conducteurs', description: 'Créer, vérifier et suspendre', icon: UserRoundCog },
  { to: '/flotte/utilisateurs', label: 'Utilisateurs', description: 'Comptes passagers inscrits', icon: Users },
  { to: '/flotte/courses', label: 'Courses', description: 'Trajets et historique réel', icon: ClipboardList },
  { to: '/flotte/direct', label: 'Suivi des courses', description: 'Dernières activités reçues', icon: Activity },
  { to: '/flotte/carte', label: 'Carte de la flotte', description: 'Dernières coordonnées GPS', icon: MapPinned },
  { to: '/flotte/maintenance', label: 'Maintenance', description: 'Suivre les véhicules indisponibles', icon: Wrench },
  { to: '/logistique/tickets-bus', label: 'Billets interurbains', description: 'Réservations et compagnies', icon: Bus },
];

export default function FlotteOverviewPage() {
  // Lecture réelle de /api/admin/transport/tricycles depuis le hook existant.
  const fleet = useFleetAdmin();
  // Totaux globaux calculés par Prisma, sans télécharger tous les utilisateurs/courses.
  const overview = useFleetOverviewStats();

  const loadedCounts = useMemo(() => ({
    total: fleet.vehicles.length,
    disponible: fleet.vehicles.filter(v => v.status === 'DISPONIBLE').length,
    enCourse: fleet.vehicles.filter(v => v.status === 'EN_COURSE').length,
    maintenance: fleet.vehicles.filter(v => v.status === 'MAINTENANCE').length,
    horsLigne: fleet.vehicles.filter(v => v.status === 'HORS_LIGNE').length,
  }), [fleet.vehicles]);

  // Si /stats n'est pas encore installé, on peut voir l'inventaire REST déjà chargé.
  // Ne jamais confondre ce nombre partiel avec le total PostgreSQL de la plateforme.
  const vehicleStats = overview.stats?.vehicles;
  const cards = [
    { label: vehicleStats ? 'Tricycles enregistrés' : 'Tricycles chargés', value: vehicleStats?.total ?? (fleet.loadedAt ? loadedCounts.total : null), icon: TricycleIcon, tone: 'text-gray-900', link: '/flotte/tricycles' },
    { label: 'Disponibles', value: vehicleStats?.disponible ?? (fleet.loadedAt ? loadedCounts.disponible : null), icon: CheckCircle2, tone: 'text-emerald-600', link: '/flotte/tricycles' },
    { label: 'En course', value: vehicleStats?.enCourse ?? (fleet.loadedAt ? loadedCounts.enCourse : null), icon: Activity, tone: 'text-orange-600', link: '/flotte/courses' },
    { label: 'Maintenance', value: vehicleStats?.maintenance ?? (fleet.loadedAt ? loadedCounts.maintenance : null), icon: Wrench, tone: 'text-amber-600', link: '/flotte/maintenance' },
    { label: 'Hors ligne', value: vehicleStats?.horsLigne ?? (fleet.loadedAt ? loadedCounts.horsLigne : null), icon: WifiOff, tone: 'text-slate-600', link: '/flotte/tricycles' },
    { label: 'Conducteurs', value: overview.stats?.drivers.total ?? null, icon: UserRoundCog, tone: 'text-violet-600', link: '/flotte/conducteurs' },
    { label: 'Passagers inscrits', value: overview.stats?.users.total ?? null, icon: Users, tone: 'text-blue-600', link: '/flotte/utilisateurs' },
    { label: 'Courses enregistrées', value: overview.stats?.courses.total ?? null, icon: ClipboardList, tone: 'text-slate-900', link: '/flotte/courses' },
  ];

  const recent = useMemo(() => fleet.vehicles.slice(0, 6), [fleet.vehicles]);
  const refreshAll = () => { fleet.refresh(); overview.refresh(); };

  return (
    <main className="space-y-6 p-4 md:p-6">
      <FleetHeading
        title="Gestion de la flotte tricycle"
        subtitle="Données MESSAY enregistrées dans PostgreSQL, accessibles uniquement aux administrateurs."
      />

      <section className="relative overflow-hidden rounded-3xl bg-[#101017] p-5 text-white shadow-xl md:p-7" aria-label="Présentation de la flotte">
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-orange-500/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-400">
              <TricycleIcon size={35} strokeWidth={1.65} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-400">MESSAY · Transport à 3 roues</p>
              <h2 className="mt-1 text-xl font-black md:text-2xl">Pilotage opérationnel</h2>
              <p className="mt-1 text-xs text-white/55">Inventaire, conducteurs, passagers et courses</p>
            </div>
          </div>
          <Link to="/flotte/conducteurs" className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-600">
            <UserRoundCog size={17} /> Gérer les conducteurs <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <FleetConnection
        loading={fleet.loading || overview.loading}
        connected={fleet.connected}
        error={fleet.error}
        loadedAt={fleet.loadedAt}
        refresh={refreshAll}
      />
      {overview.error && (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Statistiques globales indisponibles : {overview.error}. Les compteurs de véhicules affichent uniquement les enregistrements déjà chargés.
        </p>
      )}

      <section aria-label="Indicateurs réels de la flotte" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-4">
        {cards.map(item => {
          const Icon = item.icon;
          return (
            <Link key={item.label} to={item.link} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-orange-200 hover:shadow-md md:p-5">
              <Icon size={24} className={item.tone} />
              <p className="mt-3 text-xs font-semibold text-gray-500">{item.label}</p>
              <p className={`mt-1 text-3xl font-black tabular-nums ${item.tone}`}>
                {item.value === null ? '—' : item.value.toLocaleString('fr-FR')}
              </p>
            </Link>
          );
        })}
      </section>

      {overview.stats && (
        <section className="grid gap-3 md:grid-cols-3" aria-label="Statistiques de gestion">
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <div className="flex items-center gap-2 font-bold text-amber-900"><ShieldCheck size={18}/> Validation administrative</div>
            <p className="mt-2 text-2xl font-black text-amber-950">{overview.stats.drivers.pendingValidation}</p>
            <p className="text-xs text-amber-800">Conducteur(s) en attente de vérification</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 font-bold text-emerald-900"><CheckCircle2 size={18}/> Courses terminées</div>
            <p className="mt-2 text-2xl font-black text-emerald-950">{overview.stats.courses.terminees}</p>
            <p className="text-xs text-emerald-800">Courses clôturées dans PostgreSQL</p>
          </div>
          <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
            <div className="flex items-center gap-2 font-bold text-orange-900"><Activity size={18}/> Courses en cours</div>
            <p className="mt-2 text-2xl font-black text-orange-950">{overview.stats.courses.enCours}</p>
            <p className="text-xs text-orange-800">Trajets actuellement au statut EN_COURS</p>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm" aria-label="Derniers tricycles enregistrés">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5">
          <div>
            <h2 className="text-lg font-black text-gray-900">Derniers tricycles enregistrés</h2>
            <p className="mt-1 text-xs text-gray-500">Les positions et activités affichées proviennent de la dernière sauvegarde en base.</p>
          </div>
          <Link to="/flotte/tricycles" className="inline-flex items-center gap-1 text-sm font-bold text-orange-600 hover:text-orange-700">
            Voir toute la flotte <ArrowRight size={16}/>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th scope="col" className="p-4">Tricycle</th>
                <th scope="col" className="p-4">Conducteur affecté</th>
                <th scope="col" className="p-4">Statut</th>
                <th scope="col" className="p-4">Dernière activité</th>
                <th scope="col" className="p-4">GPS enregistré</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recent.map(vehicle => {
                const gps = validCoordinates(vehicle);
                return (
                  <tr key={vehicle.id} className="hover:bg-orange-50/30">
                    <td className="p-4">
                      <span className="flex items-center gap-2 font-bold text-gray-900"><TricycleIcon size={19} className="text-orange-500"/>{vehicle.immatriculation || 'Sans plaque'}</span>
                      <span className="mt-1 block text-xs text-gray-500">{vehicle.modele || 'Modèle non renseigné'}</span>
                    </td>
                    <td className="p-4 text-gray-700">{vehicle.chauffeur || 'Non affecté'}</td>
                    <td className="p-4"><StatusTag status={vehicle.status}/></td>
                    <td className="p-4 text-xs text-gray-600">{formatDateTime(vehicle.derniereActivite)}</td>
                    <td className="p-4 text-xs text-gray-600">{gps ? `${gps[0].toFixed(5)}, ${gps[1].toFixed(5)}` : 'Non renseigné'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!fleet.loading && !fleet.error && recent.length === 0 && (
            <p className="p-8 text-center text-sm text-gray-500">Aucun tricycle enregistré dans la base.</p>
          )}
        </div>
      </section>

      <section aria-label="Accès rapides">
        <h2 className="mb-3 text-lg font-black text-gray-900">Accès rapides</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {sections.map(({ to, label, description, icon: Icon }) => (
            <Link key={to} to={to} className="group flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-orange-300 hover:shadow-md">
              <span className="rounded-xl bg-orange-50 p-3 text-orange-600"><Icon size={21}/></span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm text-gray-900 group-hover:text-orange-600">{label}</strong>
                <span className="mt-1 block text-xs text-gray-500">{description}</span>
              </span>
              <ArrowRight size={15} className="mt-1 shrink-0 text-gray-300 group-hover:text-orange-500"/>
            </Link>
          ))}
        </div>
      </section>
      <p className="text-xs text-gray-500">
        Actualisation toutes les 30 secondes · API REST ADMIN protégée par JWT · GPS = dernières coordonnées enregistrées, pas une diffusion en direct.
      </p>
    </main>
  );
}
