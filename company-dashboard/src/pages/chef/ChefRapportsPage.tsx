/**
 * MESSAY PRO — Rapports et validations du Chef de gare.
 * Les accès aux gares, décisions et agrégats sont vérifiés par le backend.
 * Aucun montant n'est présenté comme un rapprochement comptable certifié.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCheck,
  ClipboardCheck,
  CornerDownLeft,
  FilePlus2,
  RefreshCcw,
  Send,
} from 'lucide-react';
import {
  garesHierarchyApi,
  type GareRapportHierarchique,
} from '../../services/garesManagementApi';
import {
  Alert,
  Card,
  ChefPage,
  EmptyState,
  Field,
  StationScope,
  StatusTag,
  actionClass,
  inputClass,
  localDay,
  money,
  outlineClass,
  previousDay,
  toMessage,
  useChefStation,
} from './ChefShared';

type ReportSnapshot = {
  key: string;
  rapports: GareRapportHierarchique[];
};

function validLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function numericAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!/^(0|[1-9]\d*)$/.test(trimmed)) return null;
  const amount = Number(trimmed);
  return Number.isSafeInteger(amount) ? amount : null;
}

export default function ChefRapportsPage() {
  const station = useChefStation();
  const gareId = station.gare?.id ?? '';

  const [from, setFrom] = useState(() => previousDay(6));
  const [to, setTo] = useState(() => localDay());
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [date, setDate] = useState(() => localDay());
  const [cash, setCash] = useState('');
  const [observation, setObservation] = useState('');
  const [returning, setReturning] = useState<string | null>(null);
  const [motif, setMotif] = useState('');

  // Rend les réponses d'anciennes requêtes inoffensives (changement de gare,
  // de période, double actualisation ou démontage du composant).
  const requestNumber = useRef(0);
  const savingLock = useRef(false);
  const scopeKey = `${gareId}|${from}|${to}`;

  const reload = useCallback(async (): Promise<void> => {
    const requestId = ++requestNumber.current;

    if (!gareId) {
      setSnapshot(null);
      setLoading(false);
      return;
    }
    if (!validLocalDate(from) || !validLocalDate(to) || from > to) {
      setSnapshot(null);
      setLoading(false);
      setError('Période invalide : vérifiez les dates de début et de fin.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await garesHierarchyApi.reports(gareId, from, to);
      if (requestId !== requestNumber.current) return;
      setSnapshot({ key: scopeKey, rapports: result.rapports });
    } catch (err: unknown) {
      if (requestId !== requestNumber.current) return;
      setSnapshot(null);
      setError(toMessage(err));
    } finally {
      if (requestId === requestNumber.current) setLoading(false);
    }
  }, [gareId, from, to, scopeKey]);

  useEffect(() => {
    void reload();
    return () => {
      requestNumber.current += 1;
    };
  }, [reload]);

  useEffect(() => {
    setReturning(null);
    setMotif('');
    setError('');
    setNotice('');
  }, [gareId]);

  // L'ancienne gare / l'ancienne période n'est jamais affichée pendant
  // le chargement de la nouvelle sélection.
  const isCurrent = snapshot?.key === scopeKey;
  const rows = isCurrent ? snapshot.rapports : [];
  const pending = rows.filter(
    (report) => report.type === 'AGENT' && report.statut === 'SOUMIS_CHEF',
  );
  const other = rows.filter(
    (report) => !(report.type === 'AGENT' && report.statut === 'SOUMIS_CHEF'),
  );
  const isReading = loading || (Boolean(gareId) && !isCurrent && !error);

  async function sendReport(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!gareId || savingLock.current) return;

    const amount = numericAmount(cash);
    if (amount === null || !validLocalDate(date) || date > localDay()) {
      setError('Indiquez une date valide non future et un montant entier positif ou nul.');
      setNotice('');
      return;
    }

    savingLock.current = true;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await garesHierarchyApi.submitReport(gareId, {
        date_rapport: date,
        especes_declarees_fcfa: amount,
        observation: observation.trim() || null,
      });
      setCash('');
      setObservation('');
      setNotice(
        'Rapport du Chef de gare soumis à la Direction. Le nombre de billets est calculé côté serveur.',
      );

      // Après soumission, rendre visible le rapport même si sa date ne
      // figurait pas dans la plage sélectionnée.
      if (date < from || date > to) {
        if (date < from) setFrom(date);
        if (date > to) setTo(date);
      } else {
        await reload();
      }
    } catch (err: unknown) {
      setError(toMessage(err));
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  }

  async function review(
    reportId: string,
    decision: 'APPROUVER' | 'RETOURNER',
  ): Promise<void> {
    if (!gareId || savingLock.current || loading) return;

    const explanation = motif.trim();
    if (decision === 'RETOURNER' && explanation.length < 5) {
      setError('Le motif du retour doit comporter au moins 5 caractères.');
      setNotice('');
      return;
    }

    // N'autoriser le traitement que d'un rapport d'agent encore soumis.
    if (!pending.some((report) => report.id === reportId)) {
      setError('Ce rapport n’est plus dans la liste des rapports à contrôler. Actualisez la page.');
      return;
    }

    savingLock.current = true;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await garesHierarchyApi.reviewReport(
        gareId,
        reportId,
        decision,
        decision === 'RETOURNER' ? explanation : null,
      );
      setNotice(
        decision === 'APPROUVER'
          ? 'Rapport agent approuvé par le Chef de gare.'
          : 'Rapport retourné à son auteur avec le motif indiqué.',
      );
      setReturning(null);
      setMotif('');
      await reload();
    } catch (err: unknown) {
      setError(toMessage(err));
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  }

  function renderReport(report: GareRapportHierarchique, reviewable: boolean) {
    return (
      <article
        key={report.id}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-slate-900">
              {report.auteur_nom || 'Auteur non renseigné'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {report.type === 'AGENT' ? 'Rapport agent' : 'Rapport Chef de gare'}
              {' · '}{report.date_rapport}
            </p>
          </div>
          <StatusTag value={report.statut} />
        </div>

        <div className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-2">
          <p>
            <span className="text-slate-500">Billets déclarés : </span>
            <strong>{report.billets_declares}</strong>
          </p>
          <p>
            <span className="text-slate-500">Espèces déclarées : </span>
            <strong>{money(report.especes_declarees_fcfa)}</strong>
          </p>
        </div>

        {report.observation && (
          <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-600">
            {report.observation}
          </p>
        )}

        {reviewable && (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving || loading}
                onClick={() => void review(report.id, 'APPROUVER')}
                className={actionClass}
              >
                <CheckCheck size={16} /> Approuver
              </button>
              <button
                type="button"
                disabled={saving || loading}
                onClick={() => {
                  setReturning((current) => current === report.id ? null : report.id);
                  setMotif('');
                  setError('');
                }}
                className={outlineClass}
              >
                <CornerDownLeft size={16} /> Retourner à l’agent
              </button>
            </div>

            {returning === report.id && (
              <div className="space-y-2 rounded-xl border border-orange-100 bg-orange-50/50 p-3">
                <Field label="Motif du retour">
                  <textarea
                    className={inputClass}
                    rows={3}
                    maxLength={2000}
                    minLength={5}
                    required
                    value={motif}
                    onChange={(event) => setMotif(event.target.value)}
                    placeholder="Décrivez les corrections nécessaires (minimum 5 caractères)"
                  />
                </Field>
                <button
                  type="button"
                  className={actionClass}
                  disabled={saving || loading || motif.trim().length < 5}
                  onClick={() => void review(report.id, 'RETOURNER')}
                >
                  Confirmer le retour
                </button>
              </div>
            )}
          </div>
        )}
      </article>
    );
  }

  return (
    <ChefPage
      title="Rapports et validations"
      description="Contrôlez les rapports des agents de votre gare, puis transmettez votre rapport à la Direction. Les permissions et les décisions sont vérifiées côté serveur."
    >
      <StationScope
        gares={station.gares}
        selectedId={station.selectedId}
        onSelect={station.setSelectedId}
        onReload={() => {
          void station.reload();
          void reload();
        }}
        loading={station.loading || loading}
      />

      {station.error && <Alert>{station.error}</Alert>}
      {error && <Alert>{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <Card className="flex flex-wrap items-end gap-3">
        <Field label="Du">
          <input
            type="date"
            className={inputClass}
            value={from}
            max={to}
            onChange={(event) => setFrom(event.target.value)}
          />
        </Field>
        <Field label="Au">
          <input
            type="date"
            className={inputClass}
            value={to}
            min={from}
            onChange={(event) => setTo(event.target.value)}
          />
        </Field>
        <button
          type="button"
          disabled={loading || saving || !gareId}
          onClick={() => void reload()}
          className={outlineClass}
        >
          <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </Card>

      {!gareId && !station.loading && (
        <Card>
          <div className="flex items-center gap-2 text-amber-700">
            <AlertCircle size={18} />
            <p className="text-sm font-semibold">Aucune gare autorisée sélectionnée.</p>
          </div>
        </Card>
      )}

      {gareId && (
        <>
          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <ClipboardCheck size={20} className="text-orange-600" />
                <h3 className="text-lg font-black text-slate-900">
                  Rapports agents à contrôler ({isReading ? '…' : pending.length})
                </h3>
              </div>
              {isReading ? (
                <p role="status" className="text-sm text-slate-500">
                  Chargement des rapports de la gare…
                </p>
              ) : error && !isCurrent ? (
                <EmptyState>Les rapports n’ont pas pu être chargés. Réessayez.</EmptyState>
              ) : pending.length === 0 ? (
                <EmptyState>Aucun rapport agent en attente sur la période sélectionnée.</EmptyState>
              ) : (
                <div className="space-y-3">{pending.map((report) => renderReport(report, true))}</div>
              )}
            </Card>

            <Card>
              <div className="mb-4 flex items-center gap-2">
                <FilePlus2 size={20} className="text-orange-600" />
                <h3 className="text-lg font-black text-slate-900">
                  Transmettre mon rapport à la Direction
                </h3>
              </div>
              <form onSubmit={(event) => void sendReport(event)} className="space-y-4">
                <Field label="Date du rapport">
                  <input
                    className={inputClass}
                    type="date"
                    required
                    max={localDay()}
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </Field>
                <Field label="Espèces déclarées (FCFA)">
                  <input
                    className={inputClass}
                    type="number"
                    required
                    min={0}
                    step={1}
                    value={cash}
                    onChange={(event) => setCash(event.target.value)}
                    placeholder="Montant réellement constaté"
                  />
                </Field>
                <Field label="Observations">
                  <textarea
                    className={inputClass}
                    rows={4}
                    maxLength={2000}
                    value={observation}
                    onChange={(event) => setObservation(event.target.value)}
                    placeholder="Écarts observés, justifications, incidents…"
                  />
                </Field>
                <button type="submit" disabled={saving || loading || !gareId} className={actionClass}>
                  <Send size={17} />
                  {saving ? 'Transmission…' : 'Soumettre à la Direction'}
                </button>
              </form>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                Les billets déclarés sont calculés côté backend. Les espèces saisies sont une
                déclaration humaine et non un solde bancaire ou un rapprochement comptable certifié.
              </p>
            </Card>
          </div>

          <Card>
            <h3 className="mb-4 text-lg font-black text-slate-900">
              Historique des rapports ({isReading ? '…' : other.length})
            </h3>
            {isReading ? (
              <p role="status" className="text-sm text-slate-500">Chargement de l’historique…</p>
            ) : error && !isCurrent ? (
              <EmptyState>Historique indisponible pour le moment.</EmptyState>
            ) : other.length === 0 ? (
              <EmptyState>Aucun autre rapport pour la période sélectionnée.</EmptyState>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {other.map((report) => renderReport(report, false))}
              </div>
            )}
            <p className="mt-4 text-xs text-slate-500">
              Les nombres affichés correspondent aux rapports retournés par l’API pour cette période.
            </p>
          </Card>
        </>
      )}
    </ChefPage>
  );
}
