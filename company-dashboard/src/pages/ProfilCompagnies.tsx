import { useEffect, useState, type FormEvent } from 'react';
import { Building2, Phone, MapPin, ShieldCheck, Save, RefreshCcw, AlertTriangle } from 'lucide-react';
import { companyDashboardApi, type CompanyProfile } from '../lib/companyDashboardApi';

function validatePhone(value: string): boolean {
  // Format international ou local, 8 à 15 chiffres ; conserver les espaces et + pour lisibilité.
  const compact = value.replace(/[\s().-]/g, '');
  return /^\+?[0-9]{8,15}$/.test(compact);
}

export default function ProfilCompagnie() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const data = await companyDashboardApi.getProfile();
      setProfile(data); setPhone(data.telephone ?? '');
    } catch (e) { setError(e instanceof Error ? e.message : 'Chargement indisponible'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault(); setNotice(null);
    if (!validatePhone(phone)) { setError('Téléphone invalide : entre 8 et 15 chiffres, avec indicatif si nécessaire.'); return; }
    setSaving(true); setError(null);
    try {
      const updated = await companyDashboardApi.updateProfile({ telephone: phone.trim() });
      setProfile(updated); setPhone(updated.telephone ?? '');
      setNotice('Numéro transmis au serveur et enregistré.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement impossible'); }
    finally { setSaving(false); }
  };

  return <div className="mx-auto max-w-5xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-extrabold uppercase tracking-wider text-orange-600">Identité de l'entreprise</p>
        <h2 className="text-2xl font-black text-slate-900">Profil & numéro officiel</h2>
        <p className="mt-1 text-sm text-slate-500">Le téléphone de la compagnie sera visible dans l'application après approbation ADMIN.</p></div>
      <button type="button" onClick={() => void load()} className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold" disabled={loading}><RefreshCcw size={16}/> Actualiser</button>
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertTriangle size={16} className="mr-2 inline"/>{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
    <div className="grid gap-5 md:grid-cols-[1fr_1.3fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-orange-50">
          {profile?.logo_url ? <img src={profile.logo_url} alt="Logo compagnie" className="h-full w-full object-contain"/> : <Building2 className="text-orange-600" size={27}/>}
        </div>
        <h3 className="text-xl font-black text-slate-900">{profile?.name || (loading ? 'Chargement…' : 'Compagnie non chargée')}</h3>
        <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-500"><Phone size={16}/> {profile?.telephone || 'Téléphone non renseigné'}</p>
        <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-500"><MapPin size={16}/> {profile?.siege_address || profile?.gare_address || 'Adresse non renseignée'}</p>
        <div className="mt-6 flex items-center gap-2 rounded-xl bg-orange-50 p-3 text-xs font-semibold text-orange-800"><ShieldCheck size={17}/>{profile?.approval_status === 'approved' ? 'Approuvée par MESSAY' : 'Publication soumise à validation ADMIN'}</div>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-black text-slate-900">Coordonnées de contact</h3>
        <p className="mt-1 text-sm text-slate-500">Le numéro doit appartenir à la compagnie, pas au chauffeur.</p>
        <form onSubmit={save} className="mt-6 space-y-4">
          <label htmlFor="company-phone" className="block text-sm font-bold text-slate-700">Téléphone de la compagnie *</label>
          <input id="company-phone" type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="Ex. +225 07 00 00 00 00" maxLength={28}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />
          <p className="text-xs leading-relaxed text-slate-500">D'autres coordonnées (email, numéro secondaire, contact d'urgence) pourront être ajoutées après validation du modèle de données.</p>
          <button disabled={loading || saving || !profile} type="submit" className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><Save size={17}/>{saving ? 'Enregistrement…' : 'Enregistrer le numéro'}</button>
        </form>
      </section>
    </div>
  </div>;
}
