
import { Bus, MapPin, Navigation, Radio } from 'lucide-react';
import MapLive from '../components/MapLive';

export default function TrajetsReel() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 pb-12">

      {/* EN-TÊTE */}
      <header className="flex flex-col justify-between gap-5 rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:p-6">

        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
            <Navigation size={23} />
          </div>

          <div>
            <h1 className="text-xl font-black tracking-tight text-gray-900 sm:text-2xl">
              Trajets en temps réel
            </h1>

            <p className="mt-1 max-w-xl text-sm leading-relaxed text-gray-500">
              Suivez les déplacements des bus interurbains
              et consultez leurs positions GPS entre les
              gares de départ et d'arrivée.
            </p>
          </div>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-2.5">
          <Radio size={15} className="text-orange-600" />
          <span className="text-xs font-bold text-orange-700">
            Suivi GPS
          </span>
        </div>
      </header>

      {/* INFORMATIONS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
            <Bus size={21} />
          </div>

          <div>
            <p className="text-sm font-black text-gray-900">
              Flotte interurbaine
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Localisation des véhicules de la compagnie
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <MapPin size={21} />
          </div>

          <div>
            <p className="text-sm font-black text-gray-900">
              Positions GPS
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Selon la disponibilité des données des véhicules
            </p>
          </div>
        </div>
      </div>

      {/* CARTE PRINCIPALE */}
      <section
        aria-label="Carte GPS des trajets interurbains"
        className="overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-black text-gray-900">
              <MapPin size={17} className="text-orange-600" />
              Carte de suivi des véhicules
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Positions transmises par les dispositifs GPS
            </p>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1.5 text-[11px] font-semibold text-gray-600">
            <span className="h-2 w-2 rounded-full bg-orange-500" />
            Transport interurbain
          </span>
        </div>

        <div className="relative min-h-[420px] w-full sm:min-h-[520px] lg:min-h-[620px]">
          <MapLive />
        </div>
      </section>

      {/* NOTE D'INFORMATION */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <Navigation
          size={18}
          className="mt-0.5 shrink-0 text-blue-600"
        />

        <p className="text-xs leading-relaxed text-blue-800">
          Les positions des véhicules doivent provenir du
          backend MESSAY et de leurs données GPS réelles.
          Les véhicules sans position disponible ne doivent
          pas apparaître sur la carte avec une localisation
          simulée.
        </p>
      </div>

    </main>
  );
}
