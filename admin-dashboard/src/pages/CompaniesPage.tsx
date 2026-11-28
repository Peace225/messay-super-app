import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { adminCompaniesService, type AdminCompany, type NewCompany } from '../services/adminCompaniesService';

const initial: NewCompany = {
  name: '', description: '', telephone: '', logo_url: null, bus_image_url: null,
};
const MAX_SIZE = 5 * 1024 * 1024;
const MIME = ['image/jpeg', 'image/png', 'image/webp'];

function messageOf(error: unknown): string {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : 'Une erreur est survenue.';
}

export default function CompaniesPage() {
  const [items, setItems] = useState<AdminCompany[]>([]);
  const [form, setForm] = useState<NewCompany>(initial);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    try { setItems(await adminCompaniesService.list()); setError(''); }
    catch (err) { setError(messageOf(err)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      let logo_url = form.logo_url;
      let bus_image_url = form.bus_image_url;
      if (logoFile) logo_url = await adminCompaniesService.upload('logo', logoFile);
      if (coverFile) bus_image_url = await adminCompaniesService.upload('cover', coverFile);
      const result = await adminCompaniesService.create({ ...form, logo_url, bus_image_url });
      setForm(initial); setLogoFile(null); setCoverFile(null);
      const formElement = event.currentTarget;
      if (formElement?.isConnected) formElement.reset();
      setNotice(`${result.name} enregistrée en attente d'approbation.`);
      await refresh();
    } catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  };

  const changeStatus = async (company: AdminCompany, action: 'approve' | 'suspend') => {
    const question = action === 'approve'
      ? `Approuver et publier « ${company.name} » dans le mobile ?`
      : `Suspendre « ${company.name} » et la retirer du catalogue mobile ?`;
    if (!window.confirm(question)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (action === 'approve') await adminCompaniesService.approve(company.id);
      else await adminCompaniesService.suspend(company.id);
      setNotice(`Statut de ${company.name} mis à jour.`);
      await refresh();
    } catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  };

  const changeMedia = async (company: AdminCompany, kind: 'logo' | 'cover', file: File) => {
    if (!MIME.includes(file.type) || file.size > MAX_SIZE) {
      setError('Image JPEG, PNG ou WebP, au maximum 5 Mo.'); return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      const url = await adminCompaniesService.upload(kind, file);
      await adminCompaniesService.updateMedia(
        company.id,
        kind === 'logo' ? url : company.logo_url,
        kind === 'cover' ? url : company.bus_image_url,
      );
      setNotice(`Image de ${company.name} actualisée.`);
      await refresh();
    } catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-5 md:p-8">
      <header>
        <h1 className="text-2xl font-black text-slate-900">Gestion des compagnies</h1>
        <p className="mt-1 text-sm text-slate-600">Création, identité visuelle et validation des partenaires interurbains. Aucune compagnie non approuvée n’est publiée.</p>
      </header>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
      <form onSubmit={e => void submit(e)} className="grid gap-4 rounded-2xl border bg-white p-5 shadow-sm md:grid-cols-2">
        <h2 className="text-lg font-bold md:col-span-2">Créer une compagnie</h2>
        <label className="space-y-1 text-sm font-semibold">Nom de la compagnie *
          <input className="w-full rounded-lg border p-3" required maxLength={140} value={form.name}
            onChange={e => setForm(v => ({ ...v, name: e.target.value }))}/>
        </label>
        <label className="space-y-1 text-sm font-semibold">Téléphone
          <input className="w-full rounded-lg border p-3" maxLength={35} value={form.telephone}
            onChange={e => setForm(v => ({ ...v, telephone: e.target.value }))}/>
        </label>
        <label className="space-y-1 text-sm font-semibold md:col-span-2">Description
          <textarea className="w-full rounded-lg border p-3" maxLength={2000} rows={3} value={form.description}
            onChange={e => setForm(v => ({ ...v, description: e.target.value }))}/>
        </label>
        <label className="space-y-1 text-sm font-semibold">Logo (JPEG, PNG, WebP – 5 Mo max.)
          <input type="file" accept="image/jpeg,image/png,image/webp" className="w-full rounded-lg border p-3"
            onChange={e => setLogoFile(e.target.files?.[0] || null)} />
        </label>
        <label className="space-y-1 text-sm font-semibold">Photo de couverture du bus (5 Mo max.)
          <input type="file" accept="image/jpeg,image/png,image/webp" className="w-full rounded-lg border p-3"
            onChange={e => setCoverFile(e.target.files?.[0] || null)} />
        </label>
        <div className="md:col-span-2">
          <button disabled={busy} className="rounded-xl bg-orange-600 px-5 py-3 font-bold text-white disabled:opacity-50">
            {busy ? 'Enregistrement…' : 'Créer — en attente de validation'}
          </button>
        </div>
      </form>
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold">Compagnies enregistrées ({items.length})</h2>
          <button type="button" onClick={() => void refresh()} className="rounded-lg border px-3 py-2 text-sm">Actualiser</button>
        </div>
        {loading ? <p>Chargement…</p> : items.length === 0 ? <p className="text-sm text-slate-600">Aucune compagnie.</p> : (
          <div className="space-y-4">
            {items.map(item => (
              <article key={item.id} className="flex flex-wrap items-center gap-4 rounded-xl border p-4">
                {item.logo_url ? <img src={item.logo_url} alt={`Logo ${item.name}`} className="h-16 w-16 rounded-xl object-contain" /> : <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 text-xs">Logo</div>}
                {item.bus_image_url ? <img src={item.bus_image_url} alt={`Bus ${item.name}`} className="h-16 w-28 rounded-xl object-cover" /> : <div className="flex h-16 w-28 items-center justify-center rounded-xl bg-slate-100 text-xs">Couverture</div>}
                <div className="min-w-44 flex-1">
                  <h3 className="font-bold">{item.name}</h3>
                  <p className="text-xs text-slate-600">{item.is_active && item.is_verified ? 'Approuvée — visible sur mobile' : item.is_verified ? 'Suspendue' : 'En attente de validation'}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    <label className="cursor-pointer text-orange-700">Modifier le logo
                      <input disabled={busy} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
                        onChange={e => { const f=e.target.files?.[0]; if (f) void changeMedia(item,'logo',f); e.target.value=''; }} />
                    </label>
                    <label className="cursor-pointer text-orange-700">Modifier la couverture
                      <input disabled={busy} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
                        onChange={e => { const f=e.target.files?.[0]; if (f) void changeMedia(item,'cover',f); e.target.value=''; }} />
                    </label>
                  </div>
                </div>
                {(!item.is_verified || !item.is_active) && <button disabled={busy} onClick={() => void changeStatus(item,'approve')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Approuver</button>}
                {item.is_active && <button disabled={busy} onClick={() => void changeStatus(item,'suspend')} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Suspendre</button>}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
