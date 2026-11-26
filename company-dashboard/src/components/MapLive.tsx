import { Building2, Bus, MapPin, Navigation, Radio } from 'lucide-react';

/**
 * Un trajet réel transmis par un composant parent / une API sécurisée.
 * Aucune donnée de démonstration n'est créée dans ce composant.
 */
export interface TrajetLive {
  id: string;
  gareDepart: string;
  gareArrivee: string;
  compagnie: string;
  immatriculation?: string | null;
  heureDepart?: string | null;
  statut: string;
  latitude?: number | null;
  longitude?: number | null;
  positionUpdatedAt?: string | null;
}

export interface MapLiveProps {
  /** Trajets autorisés, obtenus depuis le backend MESSAY. */
  trajets?: TrajetLive[];
  /** État réel de la connexion Socket.IO, contrôlé par le parent. */
  connected?: boolean;
  loading?: boolean;
  error?: string | null;
}

const statusStyles: Record<string, { label: string; className: string; dot: string }> = {
  EN_COURS: {
    label: 'En route',
    className: 'border-orange-100 bg-orange-50 text-orange-700',
    dot: 'bg-orange-500',
  },
  EN_ROUTE: {
    label: 'En route',
    className: 'border-orange-100 bg-orange-50 text-orange-700',
    dot: 'bg-orange-500',
  },
  ARRIVE: {
    label: 'Arrivé',
    className: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  PROGRAMME: {
    label: 'Programmé',
    className: 'border-blue-100 bg-blue-50 text-blue-700',
    dot: 'bg-blue-500',
  },
};

function formatPositionDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return null;
  return timestamp.toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function hasGpsPosition(trajet: TrajetLive): boolean {
  return (
    typeof trajet.latitude === 'number' &&
    Number.isFinite(trajet.latitude) &&
    trajet.latitude >= -90 &&
    trajet.latitude <= 90 &&
    typeof trajet.longitude === 'number' &&
    Number.isFinite(trajet.longitude) &&
    trajet.longitude >= -180 &&
    trajet.longitude <= 180
  );
}

export default function MapLive({
  trajets = [],
  connected = false,
  loading = false,
  error = null,
}: MapLiveProps) {
  const gpsCount = trajets.filter(hasGpsPosition).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-[24px] border border-gray-100 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-black text-gray-900">Suivi des trajets interurbains</h2>
          <p className="mt-1 text-xs text-gray-500">
            Véhicules et positions transmis par le backend MESSAY PRO
          </p>
        </div>

        <div
          role="status"
          className={`flex w-fit items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold ${
            connected
              ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
              : 'border-gray-200 bg-gray-50 text-gray-600'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-gray-400'}`}
            aria-hidden="true"
          />
          {connected ? 'Connexion temps réel établie' : 'Connexion temps réel non établie'}
        </div>
      </div>

      <section className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm sm:p-6" aria-label="Trajets suivis">
        <div className="relative min-h-[400px] overflow-hidden rounded-[20px] border border-gray-100 bg-gradient-to-br from-blue-50/60 via-slate-50 to-emerald-50/60 p-5 sm:p-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'radial-gradient(#0B4DA1 1.5px, transparent 1.5px)',
              backgroundSize: '24px 24px',
            }}
          />

          <div className="relative z-10 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-gray-100 bg-white/95 px-4 py-2.5 text-xs font-bold text-gray-700 shadow-sm">
              <Radio size={16} className="text-orange-500" />
              {gpsCount} position{gpsCount > 1 ? 's' : ''} GPS disponible{gpsCount > 1 ? 's' : ''}
            </div>
            <span className="rounded-xl border border-gray-100 bg-white/90 px-3 py-2 text-xs font-semibold text-gray-600">
              {trajets.length} trajet{trajets.length > 1 ? 's' : ''} reçu{trajets.length > 1 ? 's' : ''}
            </span>
          </div>

          {error ? (
            <p role="alert" className="relative z-10 mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div role="status" className="relative z-10 flex min-h-[270px] items-center justify-center text-sm text-gray-600">
              Chargement des trajets autorisés…
            </div>
          ) : trajets.length === 0 ? (
            <div className="relative z-10 flex min-h-[270px] flex-col items-center justify-center px-4 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm">
                <MapPin size={27} />
              </div>
              <h3 className="text-base font-black text-gray-900">Aucun trajet GPS reçu</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-gray-600">
                Cette vue attend les trajets et positions réels de votre compagnie.
                Aucun véhicule fictif n'est affiché.
              </p>
            </div>
          ) : (
            <div className="relative z-10 mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              {trajets.map((trajet) => {
                const status = statusStyles[trajet.statut] ?? {
                  label: trajet.statut || 'Statut à confirmer',
                  className: 'border-gray-200 bg-gray-50 text-gray-700',
                  dot: 'bg-gray-400',
                };
                const hasPosition = hasGpsPosition(trajet);
                const updatedAt = formatPositionDate(trajet.positionUpdatedAt);

                return (
                  <article
                    key={trajet.id}
                    className="rounded-[20px] border border-gray-100 bg-white/95 p-5 shadow-lg backdrop-blur-md transition hover:border-orange-200"
                  >
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-[11px] font-bold text-orange-600">
                        <Building2 size={12} /> {trajet.compagnie}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${status.className}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden="true" />
                        {status.label}
                      </span>
                    </div>

                    <h3 className="mt-2 flex items-center gap-2 text-base font-black text-gray-900">
                      <Navigation size={18} className="shrink-0 text-orange-500" />
                      {trajet.gareDepart} → {trajet.gareArrivee}
                    </h3>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 text-xs text-gray-600">
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <Bus size={14} /> Bus : {trajet.immatriculation || 'Non renseigné'}
                      </span>
                      <span className="rounded-lg bg-gray-50 px-2.5 py-1 font-bold text-gray-800">
                        Départ : {trajet.heureDepart || 'À confirmer'}
                      </span>
                    </div>

                    <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-600">
                      <MapPin size={13} className="shrink-0" />
                      {hasPosition
                        ? `GPS : ${trajet.latitude!.toFixed(5)}, ${trajet.longitude!.toFixed(5)}`
                        : 'Position GPS non transmise'}
                    </p>
                    {updatedAt && (
                      <p className="mt-1 text-[11px] text-gray-500">
                        Dernière position transmise : {updatedAt}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Cette vue affiche des informations de trajet ; elle ne remplace pas une carte géographique.
          La position en temps réel doit provenir d'une source GPS autorisée et vérifiée par le serveur.
        </p>
      </section>
    </div>
  );
}
