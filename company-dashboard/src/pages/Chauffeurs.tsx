import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, Pencil, Plus, RefreshCw, Search, UserRound, UsersRound, X } from 'lucide-react';
import {
  chauffeursInterurbainsApi,
  type ChauffeurInput,
  type ChauffeurInterurbain,
  type ChauffeurStatut,
} from '../services/chauffeursInterurbainsApi';

const EMPTY: ChauffeurInput = {
  nom: '', prenom: null, telephone: null, numero_permis: '', categorie_permis: null,
  date_expiration_permis: null, statut: 'ACTIF',
};
const messageOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : 'Erreur inattendue.';

export default function Chauffeurs() {
  const [chauffeurs, setChauffeurs] = useState<ChauffeurInterurbain[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'TOUS' | ChauffeurStatut>('TOUS');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ChauffeurInput>(EMPTY);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((i) => i + 1), []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const result = await chauffeursInterurbainsApi.list();
        if (mounted) setChauffeurs(result);
      } catch (cause) {
        if (mounted) { setError(messageOf(cause)); setChauffeurs([]); }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, [version]);

  const filtered = useMemo(() => chauffeurs.filter((chauffeur) => {
    if (filter !== 'TOUS' && chauffeur.statut !== filter) return false;
    const content = [chauffeur.nom, chauffeur.prenom, chauffeur.telephone,
      chauffeur.numero_permis].filter(Boolean).join(' ').toLowerCase();
    return content.includes(search.trim().toLowerCase());
  }), [chauffeurs, filter, search]);
  const activeCount = chauffeurs.filter((chauffeur) => chauffeur.statut === 'ACTIF').length;

  const setField = <K extends keyof ChauffeurInput>(key: K, value: ChauffeurInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  function openNew() { setEditingId(null); setForm({ ...EMPTY }); setError(''); setFormOpen(true); }
  function openEdit(row: ChauffeurInterurbain) {
    setEditingId(row.id);
    setForm({ nom: row.nom, prenom: row.prenom, telephone: row.telephone,
      numero_permis: row.numero_permis, categorie_permis: row.categorie_permis,
      date_expiration_permis: row.date_expiration_permis, statut: row.statut });
    setError(''); setFormOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setSuccess('');
    if (form.nom.trim().length < 2 || form.numero_permis.trim().length < 3) {
      setError('Nom (2 caractères minimum) et numéro de permis (3 caractères minimum) obligatoires.');
      return;
    }
    setSaving(true);
    try {
      const payload: ChauffeurInput = {
        ...form,
        nom: form.nom.trim(), prenom: form.prenom?.trim() || null,
        telephone: form.telephone?.trim() || null,
        numero_permis: form.numero_permis.trim(),
        categorie_permis: form.categorie_permis?.trim() || null,
        date_expiration_permis: form.date_expiration_permis || null,
      };
      if (editingId) await chauffeursInterurbainsApi.update(editingId, payload);
      else await chauffeursInterurbainsApi.create(payload);
      setFormOpen(false);
      setSuccess(editingId ? 'Fiche chauffeur mise à jour.' : 'Chauffeur enregistré.');
      refresh();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }

  return <main className="mx-auto max-w-7xl space-y-6 pb-10">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-orange-600"><UsersRound size={17} /> Direction · Transport interurbain</p>
        <h1 className="mt-2 text-2xl font-black text-slate-900">Gestion des chauffeurs</h1>
        <p className="mt-1 text-sm text-slate-500">Registre réel des chauffeurs de bus de votre compagnie, distinct des conducteurs de tricycles.</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={refresh} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualiser</button>
        <button type="button" onClick={openNew} className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white"><Plus size={16} /> Ajouter un chauffeur</button>
      </div>
    </header>
    {!loading && !error && <div className="grid gap-4 sm:grid-cols-3">
      {[
        ['Chauffeurs enregistrés', chauffeurs.length],
        ['Chauffeurs actifs', activeCount],
        ['Chauffeurs inactifs', chauffeurs.length - activeCount],
      ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-slate-900">{value}</p></div>)}
    </div>}
    {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertTriangle size={19} className="shrink-0" /> {error}</div>}
    {success && <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"><CheckCircle2 size={18} /> {success}</div>}

    {formOpen && <form onSubmit={(event) => void submit(event)} className="rounded-3xl border border-orange-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black text-slate-900">{editingId ? 'Modifier le chauffeur' : 'Enregistrer un chauffeur de bus'}</h2><button aria-label="Fermer le formulaire" type="button" onClick={() => setFormOpen(false)} className="rounded-xl p-2 hover:bg-slate-100"><X size={19} /></button></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-bold text-slate-600">Nom *<input required minLength={2} maxLength={160} value={form.nom} onChange={(e) => setField('nom', e.target.value)} className="w-full rounded-xl border border-slate-200 p-3 font-normal text-slate-900" /></label>
        <label className="space-y-1 text-sm font-bold text-slate-600">Prénom<input maxLength={160} value={form.prenom ?? ''} onChange={(e) => setField('prenom', e.target.value)} className="w-full rounded-xl border border-slate-200 p-3 font-normal text-slate-900" /></label>
        <label className="space-y-1 text-sm font-bold text-slate-600">Téléphone<input type="tel" maxLength={25} placeholder="+225..." value={form.telephone ?? ''} onChange={(e) => setField('telephone', e.target.value)} className="w-full rounded-xl border border-slate-200 p-3 font-normal text-slate-900" /></label>
        <label className="space-y-1 text-sm font-bold text-slate-600">Numéro du permis *<input required minLength={3} maxLength={80} value={form.numero_permis} onChange={(e) => setField('numero_permis', e.target.value)} className="w-full rounded-xl border border-slate-200 p-3 font-normal text-slate-900" /></label>
        <label className="space-y-1 text-sm font-bold text-slate-600">Catégorie du permis<input maxLength={24} placeholder="Ex. D" value={form.categorie_permis ?? ''} onChange={(e) => setField('categorie_permis', e.target.value)} className="w-full rounded-xl border border-slate-200 p-3 font-normal text-slate-900" /></label>
        <label className="space-y-1 text-sm font-bold text-slate-600">Expiration du permis<input type="date" value={form.date_expiration_permis ?? ''} onChange={(e) => setField('date_expiration_permis', e.target.value)} className="w-full rounded-xl border border-slate-200 p-3 font-normal text-slate-900" /></label>
        <label className="space-y-1 text-sm font-bold text-slate-600">Statut<select value={form.statut} onChange={(e) => setField('statut', e.target.value as ChauffeurStatut)} className="w-full rounded-xl border border-slate-200 p-3 font-normal text-slate-900"><option value="ACTIF">Actif</option><option value="INACTIF">Inactif</option></select></label>
      </div>
      <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">Annuler</button><button disabled={saving} type="submit" className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Enregistrement…' : 'Enregistrer'}</button></div>
    </form>}

    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap justify-between gap-3"><h2 className="text-lg font-black text-slate-900">Registre de la compagnie</h2><div className="flex flex-wrap gap-2"><label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2"><Search size={16} className="text-slate-400" /><input aria-label="Rechercher un chauffeur" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, permis, téléphone…" className="bg-transparent text-sm outline-none" /></label><select aria-label="Filtrer les chauffeurs par statut" value={filter} onChange={(e) => setFilter(e.target.value as 'TOUS' | ChauffeurStatut)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="TOUS">Tous les statuts</option><option value="ACTIF">Actifs</option><option value="INACTIF">Inactifs</option></select></div></div>
      {loading ? <p role="status" className="p-8 text-center text-sm text-slate-500">Chargement des chauffeurs…</p> : error && !chauffeurs.length ? <p className="p-8 text-center text-sm text-slate-500">Registre indisponible tant que l'API ne répond pas.</p> : filtered.length === 0 ? <p className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">{chauffeurs.length ? 'Aucun chauffeur ne correspond aux filtres.' : 'Aucun chauffeur interurbain enregistré pour cette compagnie.'}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Chauffeur</th><th className="p-3">Téléphone</th><th className="p-3">Permis</th><th className="p-3">Expiration</th><th className="p-3">Statut</th><th className="p-3">Action</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id} className="border-t border-slate-100"><td className="p-3 font-bold text-slate-800"><span className="inline-flex items-center gap-2"><UserRound size={17} className="text-orange-600" />{[row.prenom, row.nom].filter(Boolean).join(' ')}</span></td><td className="p-3 text-slate-600">{row.telephone || '—'}</td><td className="p-3 text-slate-600">{row.numero_permis} {row.categorie_permis ? `(${row.categorie_permis})` : ''}</td><td className="p-3 text-slate-600">{row.date_expiration_permis || '—'}</td><td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${row.statut === 'ACTIF' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{row.statut === 'ACTIF' ? 'Actif' : 'Inactif'}</span></td><td className="p-3"><button type="button" onClick={() => openEdit(row)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 font-bold text-slate-700 hover:border-orange-300"><Pencil size={14} /> Modifier</button></td></tr>)}</tbody></table></div>}
      <p className="mt-4 text-xs text-slate-500">Le statut « Actif » est administratif : il ne signifie pas « en ligne ». L'affectation à un bus et le GPS nécessitent un parcours métier distinct.</p>
    </section>
  </main>;
}
