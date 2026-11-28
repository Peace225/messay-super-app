import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  CheckCircle2, FileImage, FileText, ImagePlus, KeyRound, Lock,
  Plus, RefreshCw, Search, ShieldCheck, Trash2, UploadCloud,
  UserRoundCog, X,
} from 'lucide-react';
import { FleetHeading } from '../../components/flotte/FlotteUI';
import TricycleIcon from '../../components/flotte/TricycleIcon';
import {
  adminTransportService, getTransportError,
  type AdminDriver, type CreatedDriver, type DriverRegistration,
} from '../../services/adminTransportService';
import {
  driverDocumentsService,
  type DriverDocument, type DriverDocumentKind,
} from '../../services/driverDocumentsService';

const documentTypes: { kind: DriverDocumentKind; label: string; hint: string; accept: string }[] = [
  { kind: 'photo', label: 'Photo du conducteur', hint: 'Photo portrait · JPG, PNG, WEBP', accept: 'image/jpeg,image/png,image/webp' },
  { kind: 'permis', label: 'Permis de conduire', hint: 'Recto ou document numérisé', accept: 'image/jpeg,image/png,image/webp,application/pdf' },
  { kind: 'identite', label: "Pièce d'identité", hint: 'CNI, passeport ou justificatif', accept: 'image/jpeg,image/png,image/webp,application/pdf' },
  { kind: 'carte-grise', label: 'Carte grise du tricycle', hint: 'Document du véhicule', accept: 'image/jpeg,image/png,image/webp,application/pdf' },
];

const maxSize = 5 * 1024 * 1024;
type Uploads = Record<DriverDocumentKind, File | null>;
const emptyUploads = (): Uploads => ({ photo: null, permis: null, identite: null, 'carte-grise': null });
const emptyForm = (): DriverRegistration => ({
  nom: '', prenom: '', telephone: '', email: '', permis: 'B', numeroPermis: '',
  immatriculation: '', modele: 'TVS King', annee: new Date().getFullYear(),
});

function normalizePhone(input: string): string {
  const raw = input.replace(/[\s.\-]/g, '');
  if (/^0[157]\d{8}$/.test(raw)) return `+225${raw}`;
  return raw;
}

function validateFile(kind: DriverDocumentKind, file: File): string | null {
  if (file.size === 0) return 'Le fichier est vide.';
  if (file.size > maxSize) return 'Taille maximale : 5 Mo par fichier.';
  const types = kind === 'photo'
    ? ['image/jpeg', 'image/png', 'image/webp']
    : ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!types.includes(file.type)) return 'Format accepté : JPG, PNG, WEBP' + (kind === 'photo' ? '.' : ' ou PDF.');
  return null;
}

function UploadField({
  label, hint, accept, kind, file, onFile, disabled,
}: {
  label: string; hint: string; accept: string; kind: DriverDocumentKind;
  file: File | null; onFile: (kind: DriverDocumentKind, file: File | null) => void;
  disabled?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white text-orange-600">
          {preview ? <img src={preview} alt="Aperçu du fichier choisi" className="h-full w-full object-cover" />
            : file ? <FileText size={24} /> : <ImagePlus size={24} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-800">{label}</p>
          <p className="text-xs text-gray-500">{hint}</p>
          {file && <p className="mt-1 truncate text-xs font-medium text-orange-700" title={file.name}>
            {file.name} · {(file.size / 1024 / 1024).toFixed(2)} Mo
          </p>}
        </div>
        {file && (
          <button type="button" disabled={disabled} aria-label={`Retirer ${label}`}
            className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            onClick={() => onFile(kind, null)}><Trash2 size={17}/></button>
        )}
      </div>
      <label className={`mt-3 flex items-center justify-center gap-2 rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs font-bold text-orange-700 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-orange-50'}`}>
        <UploadCloud size={16}/>{file ? 'Remplacer le fichier' : 'Choisir un fichier'}
        <input key={`${kind}-${file?.name || 'empty'}`} type="file" className="sr-only"
          accept={accept} disabled={disabled}
          onChange={event => {
            const chosen = event.target.files?.[0];
            if (chosen) onFile(kind, chosen);
            event.target.value = '';
          }} />
      </label>
    </div>
  );
}

export default function FlotteConducteursPage() {
  const [drivers, setDrivers] = useState<AdminDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<DriverRegistration>(emptyForm);
  const [files, setFiles] = useState<Uploads>(emptyUploads);
  const [created, setCreated] = useState<CreatedDriver | null>(null);
  const [pending, setPending] = useState<Uploads>(emptyUploads);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [documentsDriver, setDocumentsDriver] = useState<AdminDriver | null>(null);
  const [existingDocs, setExistingDocs] = useState<DriverDocument[]>([]);
  const [editingFiles, setEditingFiles] = useState<Uploads>(emptyUploads);
  const [docsBusy, setDocsBusy] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [docsMessage, setDocsMessage] = useState<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const rows = await adminTransportService.drivers(signal);
      if (!signal?.aborted) { setDrivers(rows); setError(null); }
    } catch (err) {
      if (!signal?.aborted) setError(getTransportError(err));
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const timer = window.setInterval(() => void refresh(controller.signal), 30_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [refresh]);

  const filtered = useMemo(() => drivers.filter(driver => {
    const text = [driver.user.nom, driver.user.prenom, driver.user.telephone,
      driver.numeroPermis, driver.tricycle?.immatriculation].join(' ').toLowerCase();
    return text.includes(search.trim().toLowerCase());
  }), [drivers, search]);

  function update<K extends keyof DriverRegistration>(field: K, value: DriverRegistration[K]) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function updateFile(target: 'create' | 'edit', kind: DriverDocumentKind, file: File | null) {
    if (file) {
      const validation = validateFile(kind, file);
      if (validation) {
        if (target === 'create') setFileError(`${documentTypes.find(d => d.kind === kind)?.label} : ${validation}`);
        else setDocsError(`${documentTypes.find(d => d.kind === kind)?.label} : ${validation}`);
        return;
      }
    }
    if (target === 'create') { setFileError(null); setFiles(prev => ({ ...prev, [kind]: file })); }
    else { setDocsError(null); setEditingFiles(prev => ({ ...prev, [kind]: file })); }
  }

  async function uploadAll(id: string, selected: Uploads): Promise<Uploads> {
    const failed = emptyUploads();
    const issues: string[] = [];
    for (const doc of documentTypes) {
      const file = selected[doc.kind];
      if (!file) continue;
      try {
        await driverDocumentsService.upload(id, doc.kind, file);
      } catch (err) {
        failed[doc.kind] = file;
        issues.push(`${doc.label} : ${getTransportError(err)}`);
      }
    }
    if (issues.length) setUploadError(issues.join(' · '));
    else setUploadError(null);
    return failed;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true); setError(null); setFileError(null);
    const selected = { ...files };
    let result: CreatedDriver;
    try {
      // Stoppe avant de créer le compte si l'ADMIN a choisi des fichiers mais que le stockage est indisponible.
      if (Object.values(selected).some(Boolean)) await driverDocumentsService.ensureReady();
      result = await adminTransportService.createDriver({
        ...form,
        telephone: normalizePhone(form.telephone),
        immatriculation: form.immatriculation.trim().toUpperCase(),
        email: form.email?.trim() || undefined,
        annee: Number(form.annee),
      });
    } catch (err) {
      setError(getTransportError(err));
      setSubmitting(false);
      return;
    }
    // Le compte est réellement créé : garder les identifiants affichés même si un upload échoue.
    setCreated(result);
    setPending(selected);
    setOpen(false);
    setForm(emptyForm());
    setFiles(emptyUploads());
    setSubmitting(false);
    void refresh();
    if (Object.values(selected).some(Boolean)) {
      setUploading(true);
      try { setPending(await uploadAll(result.conducteur.id, selected)); }
      finally { setUploading(false); }
    }
  }

  async function retryUploads() {
    if (!created || uploading) return;
    setUploading(true);
    try { setPending(await uploadAll(created.conducteur.id, pending)); }
    finally { setUploading(false); }
  }

  async function changeVerification(driver: AdminDriver) {
    if (!window.confirm(driver.isVerified
      ? 'Retirer la validation de ce conducteur ?'
      : `Confirmer que le permis et l’identité de ${driver.user.prenom || ''} ${driver.user.nom} ont été vérifiés ?`)) return;
    setBusyId(driver.id);
    try { await adminTransportService.verifyDriver(driver.id, !driver.isVerified); await refresh(); }
    catch (err) { setError(getTransportError(err)); }
    finally { setBusyId(null); }
  }

  async function changeBlock(driver: AdminDriver) {
    if (!window.confirm(driver.user.isBlocked ? 'Réactiver ce compte ?' : 'Suspendre ce compte conducteur ?')) return;
    setBusyId(driver.id);
    try { await adminTransportService.blockDriver(driver.id, !driver.user.isBlocked); await refresh(); }
    catch (err) { setError(getTransportError(err)); }
    finally { setBusyId(null); }
  }

  async function openDocuments(driver: AdminDriver) {
    setDocumentsDriver(driver);
    setEditingFiles(emptyUploads());
    setDocsMessage(null); setDocsError(null); setExistingDocs([]);
    setDocsBusy(true);
    try { setExistingDocs(await driverDocumentsService.list(driver.id)); }
    catch (err) { setDocsError(getTransportError(err)); }
    finally { setDocsBusy(false); }
  }

  async function saveDocuments() {
    if (!documentsDriver || docsBusy) return;
    setDocsBusy(true); setDocsError(null); setDocsMessage(null);
    try {
      const queued = { ...editingFiles };
      await driverDocumentsService.ensureReady();
      const errors: string[] = [];
      const nextFiles = emptyUploads();
      for (const doc of documentTypes) {
        const file = queued[doc.kind];
        if (!file) continue;
        try { await driverDocumentsService.upload(documentsDriver.id, doc.kind, file); }
        catch (err) { errors.push(`${doc.label} : ${getTransportError(err)}`); nextFiles[doc.kind] = file; }
      }
      setEditingFiles(nextFiles);
      setExistingDocs(await driverDocumentsService.list(documentsDriver.id));
      setDocsMessage(errors.length ? null : 'Documents enregistrés dans le stockage privé.');
      if (errors.length) setDocsError(errors.join(' · '));
    } catch (err) { setDocsError(getTransportError(err)); }
    finally { setDocsBusy(false); }
  }

  async function openDocument(kind: DriverDocumentKind) {
    if (!documentsDriver) return;
    // Ouverture créée lors du clic, pour ne pas bloquer la fenêtre pop-up après l'appel réseau.
    const windowRef = window.open('about:blank', '_blank');
    try {
      const url = await driverDocumentsService.signedUrl(documentsDriver.id, kind);
      if (windowRef) { windowRef.opener = null; windowRef.location.replace(url); }
      else setDocsError('Le navigateur bloque l’ouverture du document. Autorisez les fenêtres pop-up.');
    } catch (err) { windowRef?.close(); setDocsError(getTransportError(err)); }
  }

  return (
    <main className="space-y-6 p-4 md:p-6">
      <FleetHeading title="Conducteurs MESSAY" subtitle="Annuaire PostgreSQL, création des comptes et documents professionnels privés." />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4">
        <div className="flex items-center gap-3"><UserRoundCog className="text-orange-600"/>
          <div><strong>{loading ? 'Chargement…' : `${drivers.length} conducteur(s)`}</strong>
            <p className="text-xs text-gray-500">Les nouveaux comptes restent non vérifiés jusqu’à validation ADMIN.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void refresh()} disabled={loading} className="rounded-xl border px-4 py-2.5 text-sm font-bold disabled:opacity-40"><RefreshCw className="mr-2 inline" size={16}/>Actualiser</button>
          <button type="button" onClick={() => { setFileError(null); setError(null); setOpen(true); }} className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white"><Plus className="mr-2 inline" size={16}/>Ajouter un conducteur</button>
        </div>
      </div>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      <label className="relative block"><Search className="absolute left-3 top-3 text-gray-400" size={18}/>
        <input aria-label="Rechercher un conducteur" value={search} onChange={event => setSearch(event.target.value)}
          placeholder="Nom, téléphone, permis, plaque" className="w-full rounded-xl border bg-white py-3 pl-10 pr-3 outline-none focus:border-orange-500" />
      </label>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map(driver => (
          <article key={driver.id} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div><h2 className="font-black text-gray-900">{driver.user.prenom} {driver.user.nom}</h2>
                <p className="mt-1 text-sm text-gray-500">{driver.user.telephone || 'Téléphone absent'}</p></div>
              <span className={`rounded-lg px-2 py-1 text-xs font-bold ${driver.user.isBlocked ? 'bg-red-50 text-red-700' : driver.isVerified ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                {driver.user.isBlocked ? 'SUSPENDU' : driver.isVerified ? 'VÉRIFIÉ' : 'À VÉRIFIER'}</span>
            </div>
            <div className="mt-4 space-y-1 border-t pt-3 text-sm">
              <p><strong>ID profil : </strong><span className="break-all font-mono text-xs">{driver.id}</span></p>
              <p><strong>Permis : </strong>{driver.numeroPermis || '—'} ({driver.permis || '—'})</p>
              <p className="flex items-center gap-1"><TricycleIcon size={16} className="text-orange-500" />{driver.tricycle?.immatriculation || 'Aucun tricycle'} · {driver.tricycle?.status || '—'}</p>
              <p><strong>Activité : </strong>{driver.disponible && driver.isAvailable ? 'Disponible' : 'Indisponible'}</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void changeVerification(driver)} disabled={busyId === driver.id} className="rounded-xl border border-orange-200 px-3 py-2 text-xs font-bold text-orange-700 disabled:opacity-50"><ShieldCheck className="mr-1 inline" size={15}/>{driver.isVerified ? 'Révoquer validation' : 'Vérifier permis'}</button>
              <button type="button" onClick={() => void changeBlock(driver)} disabled={busyId === driver.id} className="rounded-xl border px-3 py-2 text-xs font-bold text-gray-700 disabled:opacity-50"><Lock className="mr-1 inline" size={15}/>{driver.user.isBlocked ? 'Réactiver' : 'Suspendre'}</button>
            </div>
            <button type="button" onClick={() => void openDocuments(driver)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm font-bold text-orange-700 hover:bg-orange-100"><FileImage size={16}/>Documents du conducteur</button>
          </article>
        ))}
      </div>
      {!loading && filtered.length === 0 && <p className="rounded-xl border bg-white p-8 text-center text-gray-500">Aucun conducteur trouvé.</p>}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3" onClick={() => { if (!submitting) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-label="Créer un conducteur" className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-black">Nouveau conducteur + tricycle</h2>
              <button type="button" disabled={submitting} aria-label="Fermer" onClick={() => setOpen(false)}><X/></button></div>
            <form onSubmit={event => void submit(event)} className="grid gap-4 sm:grid-cols-2">
              {([['nom','Nom'],['prenom','Prénom'],['telephone','Téléphone (+225...)'],['email','E-mail (facultatif)'],
                ['permis','Catégorie permis'],['numeroPermis','Numéro de permis'],['immatriculation','Immatriculation'],['modele','Modèle de tricycle']] as const).map(([field, label]) => (
                <label key={field} className="block text-xs font-bold text-gray-600">{label}
                  <input value={form[field] || ''} onChange={event => update(field, event.target.value)} required={field !== 'email'} disabled={submitting}
                    type={field === 'email' ? 'email' : field === 'telephone' ? 'tel' : 'text'} autoComplete="off"
                    className="mt-1 block w-full rounded-xl border px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-500" />
                </label>
              ))}
              <label className="block text-xs font-bold text-gray-600">Année du véhicule
                <input type="number" min={1995} max={new Date().getFullYear() + 1} value={form.annee} disabled={submitting}
                  onChange={event => update('annee', Number(event.target.value))} required className="mt-1 block w-full rounded-xl border px-3 py-2.5 text-sm" />
              </label>
              <div className="self-end rounded-xl bg-orange-50 p-3 text-xs text-orange-900">Le compte restera non vérifié jusqu’à l’approbation des documents par un ADMIN.</div>
              <div className="sm:col-span-2">
                <h3 className="mb-1 flex items-center gap-2 font-black text-gray-900"><UploadCloud size={19} className="text-orange-600"/>Documents à téléverser</h3>
                <p className="mb-3 text-xs text-gray-500">Fichiers privés · JPG, PNG, WEBP ou PDF · 5 Mo maximum par fichier. Facultatifs à la création, à examiner avant validation.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {documentTypes.map(doc => <UploadField key={doc.kind} {...doc} file={files[doc.kind]}
                    onFile={(kind, file) => updateFile('create', kind, file)} disabled={submitting} />)}
                </div>
                {fileError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{fileError}</p>}
              </div>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <button type="button" disabled={submitting} onClick={() => setOpen(false)} className="rounded-xl border px-4 py-2.5 font-bold disabled:opacity-50">Annuler</button>
                <button disabled={submitting} type="submit" className="rounded-xl bg-orange-600 px-5 py-2.5 font-bold text-white disabled:opacity-50">{submitting ? 'Création…' : 'Créer le compte et le véhicule'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {created && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4">
          <section role="dialog" aria-modal="true" aria-label="Identifiants du conducteur" className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-green-700"><CheckCircle2/><h2 className="text-xl font-black">Conducteur créé</h2></div>
            <p className="mt-3 text-sm text-gray-600">Transmettez les identifiants de manière sécurisée. Le mot de passe initial ne sera plus affiché après fermeture.</p>
            <div className="mt-4 space-y-3 rounded-xl bg-gray-50 p-4 text-sm">
              <p><KeyRound className="mr-1 inline" size={16}/>Identifiant : <strong className="break-all">{created.connexion.identifiant}</strong></p>
              <p>Mot de passe initial : <strong className="break-all font-mono">{created.connexion.motDePasseTemporaire}</strong></p>
              <p>ID conducteur : <span className="break-all font-mono">{created.conducteur.id}</span></p>
              <p>Tricycle : {created.tricycle.immatriculation}</p>
            </div>
            {uploading && <p className="mt-3 flex items-center gap-2 text-sm text-orange-700"><RefreshCw size={16} className="animate-spin"/>Envoi sécurisé des documents en cours…</p>}
            {uploadError && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">Le compte a été créé, mais certains documents n’ont pas été enregistrés : {uploadError}</p>}
            {!uploading && Object.values(pending).some(Boolean) && <button type="button" onClick={() => void retryUploads()} className="mt-3 rounded-xl border border-orange-300 px-4 py-2 text-sm font-bold text-orange-700">Réessayer les documents non envoyés</button>}
            {!uploading && !uploadError && <p className="mt-3 text-sm font-medium text-emerald-700">Enregistrement terminé. Validation documentaire encore nécessaire.</p>}
            <p className="mt-3 text-xs text-amber-700">L'application conducteur doit imposer le changement du mot de passe au premier accès.</p>
            <button type="button" disabled={uploading} onClick={() => { setCreated(null); setPending(emptyUploads()); setUploadError(null); }}
              className="mt-5 w-full rounded-xl bg-gray-900 px-4 py-3 font-bold text-white disabled:opacity-50">J’ai transmis les identifiants · Fermer</button>
          </section>
        </div>
      )}

      {documentsDriver && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3" onClick={() => { if (!docsBusy) setDocumentsDriver(null); }}>
          <section role="dialog" aria-modal="true" aria-label="Documents du conducteur" className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-lg font-black">Documents — {documentsDriver.user.prenom} {documentsDriver.user.nom}</h2>
              <button type="button" disabled={docsBusy} aria-label="Fermer" onClick={() => setDocumentsDriver(null)}><X/></button>
            </div>
            <p className="mb-4 text-xs text-gray-500">Ces documents sont privés. Les liens de consultation expirent après 60 secondes.</p>
            {docsError && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{docsError}</p>}
            {docsMessage && <p role="status" className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{docsMessage}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {documentTypes.map(doc => {
                const stored = existingDocs.find(item => item.kind === doc.kind);
                return <div key={doc.kind}>
                  <UploadField {...doc} file={editingFiles[doc.kind]} disabled={docsBusy} onFile={(kind, file) => updateFile('edit', kind, file)} />
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                    <span className={stored ? 'text-emerald-700' : 'text-gray-500'}>{stored ? 'Enregistré' : 'Aucun document enregistré'}</span>
                    {stored && <button type="button" disabled={docsBusy} className="font-bold text-orange-700 underline" onClick={() => void openDocument(doc.kind)}>Consulter</button>}
                  </div>
                </div>;
              })}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={docsBusy} onClick={() => setDocumentsDriver(null)} className="rounded-xl border px-4 py-2 font-bold">Fermer</button>
              <button type="button" disabled={docsBusy || !Object.values(editingFiles).some(Boolean)} onClick={() => void saveDocuments()}
                className="rounded-xl bg-orange-600 px-4 py-2 font-bold text-white disabled:opacity-50">
                {docsBusy ? 'Envoi…' : 'Enregistrer les fichiers'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
