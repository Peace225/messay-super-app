import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  MapPin,
  Clock,
  CreditCard,
  Phone,
  ShieldCheck,
} from 'lucide-react';

/**
 * Conserve la compatibilité avec les objets `course` déjà fournis par
 * CoursesPage. Les noms exacts des champs seront à aligner avec son service API.
 */
interface CourseProps {
  course: any;
  onClose: () => void;
  /** Facultatif : le parent doit implémenter l'annulation via une API ADMIN. */
  onCancel?: (courseId: string) => Promise<void> | void;
}

const textOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

function formatPrice(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${new Intl.NumberFormat('fr-FR').format(value)} FCFA`;
  }

  const text = textOrUndefined(value);
  if (!text) return 'Non renseigné';
  if (/\b(?:FCFA|F CFA)\b/i.test(text)) return text;
  if (/^[\d\s.,]+$/.test(text)) return `${text} FCFA`;
  return text;
}

function formatDuration(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return `${Math.round(value)} min`;
  }
  return textOrUndefined(value) ?? 'Non renseignée';
}

function formatDate(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

function statusDetails(value: unknown) {
  const status = textOrUndefined(value)?.toUpperCase() ?? '';
  switch (status) {
    case 'EN_COURS':
      return { label: 'En cours', classes: 'bg-green-100 text-green-700' };
    case 'ACCEPTEE':
      return { label: 'Acceptée', classes: 'bg-blue-100 text-blue-700' };
    case 'EN_ATTENTE':
    case 'EN_RECHERCHE':
      return { label: 'En attente', classes: 'bg-amber-100 text-amber-700' };
    case 'TERMINEE':
      return { label: 'Terminée', classes: 'bg-gray-100 text-gray-700' };
    case 'ANNULEE':
    case 'ANNULEE_PAR_CLIENT':
      return { label: 'Annulée', classes: 'bg-red-100 text-red-700' };
    default:
      return {
        label: textOrUndefined(value) ?? 'Statut non renseigné',
        classes: 'bg-gray-100 text-gray-700',
      };
  }
}

export default function CourseDetailDrawer({
  course,
  onClose,
  onCancel,
}: CourseProps) {
  const [isCancelling, setIsCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const courseId = String(course?.id ?? '');
  const status = statusDetails(course?.statut ?? course?.status);
  const rawStatus = String(course?.statut ?? course?.status ?? '').toUpperCase();
  const driver = course?.conducteur?.user ?? course?.driver ?? {};
  const fullName = [driver?.prenom, driver?.nom].filter(Boolean).join(' ').trim();
  const driverName =
    textOrUndefined(course?.driverName) ??
    textOrUndefined(course?.conducteurName) ??
    textOrUndefined(fullName) ??
    'Conducteur non attribué';
  const driverPhone =
    textOrUndefined(course?.driverPhone) ??
    textOrUndefined(course?.telephoneConducteur) ??
    textOrUndefined(driver?.telephone);
  const phoneHref = driverPhone?.replace(/[^\d+]/g, '');
  const isVerified =
    course?.driverVerified === true || course?.conducteur?.isVerified === true;

  const startPoint =
    textOrUndefined(course?.startPoint) ??
    textOrUndefined(course?.adresseDepart) ??
    textOrUndefined(course?.depart) ??
    'Non renseigné';
  const endPoint =
    textOrUndefined(course?.endPoint) ??
    textOrUndefined(course?.adresseArrivee) ??
    textOrUndefined(course?.destination) ??
    'Non renseignée';
  const price = course?.price ?? course?.prix ?? course?.montant;
  const duration = course?.estimatedMinutes ?? course?.dureeEstimee;
  const createdAt = formatDate(course?.createdAt);
  const initials = driverName
    .split(/\s+/)
    .slice(0, 2)
    .map((part: string) => part.charAt(0))
    .join('')
    .toUpperCase();

  const isFinal = ['TERMINEE', 'ANNULEE', 'ANNULEE_PAR_CLIENT'].includes(rawStatus);
  const canCancel = Boolean(onCancel && courseId && !isFinal);

  const handleCancel = async () => {
    if (!canCancel || !onCancel || isCancelling) return;
    if (!window.confirm('Confirmer la demande d’annulation de cette course ?')) return;

    setActionError(null);
    setIsCancelling(true);
    try {
      await onCancel(courseId);
      onClose();
    } catch {
      setActionError('Annulation impossible. Vérifiez la connexion ou les autorisations ADMIN.');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Détails de la course"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed right-0 top-0 z-[100] h-screen w-full overflow-y-auto border-l border-gray-100 bg-white p-6 shadow-[-20px_0_50px_rgba(0,0,0,0.1)] md:w-[450px] md:p-8"
    >
      <div className="mb-10 flex items-center justify-between">
        <button
          type="button"
          aria-label="Fermer les détails de la course"
          onClick={onClose}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900 text-white transition-colors hover:bg-orange-600"
        >
          <X size={20} />
        </button>
        <span className="text-[10px] font-black uppercase italic tracking-[4px] text-gray-400">
          Détails de la course
        </span>
      </div>

      <div className="mb-8">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h2 className="text-3xl font-black uppercase italic tracking-tighter text-gray-900">
            #{courseId ? courseId.slice(0, 8) : '—'}
          </h2>
          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${status.classes}`}>
            {status.label}
          </span>
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
          Type : {textOrUndefined(course?.type) ?? 'Course en tricycle'}
        </p>
        {createdAt && <p className="mt-2 text-xs text-gray-500">Créée le {createdAt}</p>}
      </div>

      <div className="mb-8 flex items-center gap-5 rounded-[30px] border border-gray-100 bg-gray-50 p-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-white bg-orange-100 text-xl font-black text-orange-700 shadow-md">
          {initials || '—'}
        </div>
        <div className="min-w-0">
          <h3 className="mb-2 break-words text-lg font-black leading-tight text-gray-900">
            {driverName}
          </h3>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold uppercase text-gray-500">
            {driverPhone && phoneHref ? (
              <a href={`tel:${phoneHref}`} className="flex items-center hover:text-orange-600">
                <Phone size={12} className="mr-1 text-orange-500" />
                {driverPhone}
              </a>
            ) : (
              <span>Téléphone non renseigné</span>
            )}
            {isVerified && (
              <span className="flex items-center text-green-700">
                <ShieldCheck size={12} className="mr-1" /> Vérifié
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="relative mb-10 space-y-8">
        <div className="absolute bottom-4 left-[11px] top-4 border-l-2 border-dashed border-gray-200" />
        <div className="relative z-10 flex items-start gap-4">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-4 border-gray-900 bg-white" />
          <div>
            <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <MapPin size={12} /> Départ
            </p>
            <p className="text-sm font-bold text-gray-800">{startPoint}</p>
          </div>
        </div>
        <div className="relative z-10 flex items-start gap-4">
          <div className="h-6 w-6 shrink-0 rounded-full border-4 border-white bg-orange-500 shadow-lg" />
          <div>
            <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-orange-500">
              <MapPin size={12} /> Destination
            </p>
            <p className="text-sm font-bold text-gray-800">{endPoint}</p>
          </div>
        </div>
      </div>

      <div className="mb-10 grid grid-cols-2 gap-4">
        <div className="rounded-[25px] border border-gray-100 bg-white p-5 shadow-sm">
          <Clock className="mb-2 text-gray-400" size={18} />
          <p className="text-[10px] font-black uppercase text-gray-400">Durée estimée</p>
          <p className="mt-1 text-lg font-black italic tracking-tighter text-gray-900">
            {formatDuration(duration)}
          </p>
        </div>
        <div className="rounded-[25px] border border-gray-100 bg-white p-5 shadow-sm">
          <CreditCard className="mb-2 text-orange-500" size={18} />
          <p className="text-[10px] font-black uppercase text-gray-400">Tarif</p>
          <p className="mt-1 text-lg font-black italic tracking-tighter text-gray-900">
            {formatPrice(price)}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {driverPhone && phoneHref ? (
          <a
            href={`tel:${phoneHref}`}
            className="block w-full rounded-3xl bg-gray-900 py-5 text-center text-xs font-black uppercase tracking-[2px] text-white shadow-xl shadow-gray-900/20 transition-all hover:bg-orange-600"
          >
            Contacter le conducteur
          </a>
        ) : (
          <p className="rounded-2xl bg-gray-50 p-3 text-center text-sm text-gray-500">
            Aucun numéro de conducteur disponible pour cette course.
          </p>
        )}

        {canCancel && (
          <button
            type="button"
            onClick={() => void handleCancel()}
            disabled={isCancelling}
            className="w-full rounded-3xl bg-red-50 py-5 text-[10px] font-black uppercase tracking-[2px] text-red-600 transition-all hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCancelling ? 'Annulation en cours…' : 'Annuler la course (urgence)'}
          </button>
        )}
        {actionError && <p role="alert" className="text-sm text-red-600">{actionError}</p>}
      </div>
    </motion.div>
  );
}
