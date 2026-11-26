import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';

import {

  ArrowRight, Building2, BusFront, Check, ChevronRight, Clock3,

  ChartNoAxesColumn, Download, Wallet, FileCheck2,

  Compass, Loader2, Mail, MapPin, Navigation, Pencil, Phone,

  Plus, RefreshCw, Route as RouteIcon, Search, ShieldCheck,

  Ticket, UserRound, Users, X,

} from 'lucide-react';

import {

  garesManagementApi,

  type Gare,

  type GareInput,

  type GareOverview,

  type RapportGare,

  type LigneGare,

  type LigneInput,

  type ResponsableInput,

  type ResponsableRole,

  garesHierarchyApi,

  type GareAccessContext,

} from '../services/garesManagementApi';

import type { LucideIcon } from 'lucide-react';

import GareHierarchie from './GareHierarchie';

import DirectionSupervision from './DirectionSupervision';

type ModalName = 'gare' | 'responsable' | 'ligne' | 'cloture' | null;

type TabName = 'departs' | 'arrivees' | 'equipe' | 'rapports' | 'hierarchie';

const roles: { value: ResponsableRole; label: string }[] = [

  { value: 'ADJOINT', label: 'Adjoint au chef de gare' },

  { value: 'BILLETTERIE', label: 'Responsable billetterie' },

  { value: 'EMBARQUEMENT', label: 'Responsable embarquement' },

  { value: 'EXPLOITATION', label: 'Responsable exploitation' },

  { value: 'CAISSE', label: 'Responsable caisse' },

];

const emptyGare: GareInput = {

  nom: '', ville: '', adresse: '', chef_nom: null,

  chef_tel: null, latitude: null, longitude: null,

};

const blankResponsable: ResponsableInput = {

  nom: '', fonction: 'ADJOINT', telephone: null, email: null,

};

const blankLine = { gare_arrivee_id: '', prix: '', duree: '', horaires: '' };

const field = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100';

const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50';

const smallTitle = 'mb-1.5 block text-xs font-bold text-slate-600';

const clean = (value: string | null | undefined) => String(value || '').trim();

const phoneValid = (value: string | null) => !value || /^\+?[0-9]{7,15}$/.test(value.replace(/[\s().-]/g, ''));

const hourValid = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const fcfa = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

const errorMessage = (err: unknown) => err instanceof Error ? err.message : 'Une erreur est survenue.';

const humanRole = (role: ResponsableRole) => roles.find(item => item.value === role)?.label || role;

const localDate = (date: Date) => {

  const y = date.getFullYear();

  const m = String(date.getMonth() + 1).padStart(2, '0');

  const d = String(date.getDate()).padStart(2, '0');

  return `${y}-${m}-${d}`;

};

// Le fichier CSV exporte exclusivement les lignes renvoyées par le serveur.

// Préfixer les valeurs de type formule protège l'ouverture dans un tableur.

const csvCell = (value: string | number) => {

  const text = String(value);

  // Bloque aussi les formules precedees d'espaces dans Excel/LibreOffice.

  const escaped = /^\s*[=+@-]/.test(text) ? `'${text}` : text;

  return `"${escaped.replace(/"/g, '""')}"`;

};

function downloadReport(rapport: RapportGare, gareNom: string) {

  const rows: Array<Array<string | number>> = [

    ['Gare', gareNom], ['Du', rapport.du], ['Au', rapport.au],

    ['Billets payés', rapport.billets_payes], ['Montant brut FCFA', rapport.montant_brut_fcfa],

    ['Commission MESSAY FCFA', rapport.commission_messay_fcfa], ['Part compagnie FCFA', rapport.part_compagnie_fcfa],

    ['Remboursements FCFA', rapport.remboursements_fcfa], [],

    ['Responsable', 'Fonction', 'Billets payés', 'Montant FCFA'],

    ...rapport.ventes_par_responsable.map(r => [r.nom, r.fonction, r.billets_payes, r.montant_fcfa]),

    [], ['Clôture', 'Déclarée par', 'Déclaré FCFA', 'Attendu FCFA', 'Écart FCFA', 'Statut'],

    ...rapport.clotures.map(c => [c.date, c.declare_par, c.montant_especes_declare_fcfa, c.montant_especes_attendu_fcfa, c.ecart_fcfa, c.statut]),

  ];

  const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');

  const href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));

  const a = document.createElement('a'); a.href = href;

  a.download = `messay-rapport-gare-${rapport.du}-${rapport.au}.csv`; a.click();

  window.setTimeout(() => URL.revokeObjectURL(href), 1000);

}

function Dialog({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) {

  return (

    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>

      <section role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[26px] bg-white p-5 shadow-2xl sm:p-7">

        <div className="mb-5 flex items-start justify-between gap-4">

          <div><h3 className="text-xl font-black text-slate-900">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p></div>

          <button type="button" aria-label="Fermer" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X size={19}/></button>

        </div>

        {children}

      </section>

    </div>

  );

}

function InfoRow({ label, value, icon: Icon }: { label: string; value?: string | null; icon: LucideIcon }) {

  return (

    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">

      <div className="rounded-xl bg-white p-2 text-orange-500"><Icon size={17}/></div>

      <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="break-words text-sm font-bold text-slate-800">{value || 'Non renseigné'}</p></div>

    </div>

  );

}

function LigneCard({ ligne, direction }: { ligne: LigneGare; direction: 'departs' | 'arrivees' }) {

  const hasBoth = Boolean(ligne.gare_depart_id && ligne.gare_arrivee_id);

  return (

    <div className="rounded-2xl border border-slate-100 bg-white p-4 transition hover:border-orange-200 hover:shadow-sm">

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">

        <div className="flex items-start gap-3">

          <div className="rounded-xl bg-orange-50 p-2.5 text-orange-500"><BusFront size={19}/></div>

          <div>

            <p className="font-extrabold text-slate-900">{direction === 'departs' ? (ligne.gare_arrivee_nom || ligne.ville_arrivee) : (ligne.gare_depart_nom || ligne.ville_depart || 'Départ non précisé')}</p>

            <p className="mt-1 text-xs text-slate-500">{direction === 'departs' ? 'Gare d’arrivée' : 'Gare de départ'}</p>

          </div>

        </div>

        <div className="sm:text-right"><p className="text-sm font-black text-orange-600">{ligne.prix !== null ? fcfa(ligne.prix) : 'Prix à publier'}</p><p className="mt-1 text-xs text-slate-500">{ligne.duree ? `Durée : ${ligne.duree}` : 'Durée à compléter'}</p></div>

      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">

        {!hasBoth && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">Gares à relier — non réservable</span>}

        {ligne.horaires.length === 0 ? <span className="text-xs text-slate-400">Aucun horaire enregistré</span> : ligne.horaires.map(h => (

          <span key={h.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700"><Clock3 size={12}/>{h.heure_depart.slice(0, 5)}</span>

        ))}

      </div>

      {ligne.quota !== undefined && ligne.quota !== null && <p className="mt-3 text-[11px] text-slate-500">Quota historique : {ligne.quota}{typeof ligne.billets_vendus === 'number' ? ` · Billets vendus enregistrés : ${ligne.billets_vendus}` : ''}. La disponibilité réelle se calcule par départ et par bus.</p>}

    </div>

  );

}

export default function Gares() {

  const [gares, setGares] = useState<Gare[]>([]);

  const [directionView, setDirectionView] = useState(false);

  const [access, setAccess] = useState<GareAccessContext | null>(null);

  const isDirector = access?.role === 'DIRECTION';

  const isChief = access?.role === 'CHEF_GARE';

  const canManageTeam = isDirector || isChief;

  const [selectedId, setSelectedId] = useState('');

  const [details, setDetails] = useState<GareOverview | null>(null);

  const [loading, setLoading] = useState(true);

  const [detailLoading, setDetailLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');

  const [detailError, setDetailError] = useState('');

  const [actionError, setActionError] = useState('');

  const [notice, setNotice] = useState<{ kind: 'success' | 'warning'; text: string } | null>(null);

  const [search, setSearch] = useState('');

  const [activeTab, setActiveTab] = useState<TabName>('equipe');

  const [preferChiefInvitation, setPreferChiefInvitation] = useState(false);

  const [modal, setModal] = useState<ModalName>(null);

  const [editing, setEditing] = useState(false);

  const [gareForm, setGareForm] = useState<GareInput>(emptyGare);

  const [chefEmail, setChefEmail] = useState('');

  const [inviteChefNow, setInviteChefNow] = useState(true);

  const [responsableForm, setResponsableForm] = useState<ResponsableInput>(blankResponsable);

  const [lineForm, setLineForm] = useState(blankLine);

  const [rapport, setRapport] = useState<RapportGare | null>(null);

  const [rapportError, setRapportError] = useState('');

  const [rapportLoading, setRapportLoading] = useState(false);

  const [dateDebut, setDateDebut] = useState(() => localDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));

  const [dateFin, setDateFin] = useState(() => localDate(new Date()));

  const [clotureMontant, setClotureMontant] = useState('');

  const [clotureNote, setClotureNote] = useState('');

  const [clotureDate, setClotureDate] = useState(() => localDate(new Date()));

  const seq = useRef(0);

  const detailSeq = useRef(0);

  const selectedIdRef = useRef('');

  const rapportSeq = useRef(0);

  const selected = useMemo(() => gares.find(g => g.id === selectedId) || null, [gares, selectedId]);

  const filtered = useMemo(() => gares.filter(g => [g.nom, g.ville, g.adresse, g.chef_nom, g.chef_tel].some(value => clean(value).toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr').trim()))), [gares, search]);

  const loadGares = useCallback(async () => {

    const current = ++seq.current;

    setLoading(true); setError('');

    try {

      // Fail closed: no list without a verified backend role and company scope.

      const session = await garesHierarchyApi.access();

      if (!session || !['DIRECTION','CHEF_GARE','AGENT_BILLETTERIE','AGENT_CAISSE','AGENT_EMBARQUEMENT','AGENT_EXPLOITATION'].includes(session.role) || !session.company_id || !Array.isArray(session.gare_ids)) {

        throw new Error('Accès compagnie non validé par le serveur.');

      }

      const result = await garesManagementApi.list();

      if (current !== seq.current) return;

      if (!Array.isArray(result)) throw new Error('Format de la liste des gares incorrect.');

      // Filtrage defensif de l'interface, sans remplacer les controles du serveur/RLS.

      const authorizedGares = result.filter(g => g.company_id === session.company_id &&

        (session.role === 'DIRECTION' || session.gare_ids.includes(g.id)));

      setAccess(session);

      setGares(authorizedGares);

      setSelectedId(previous => authorizedGares.some(g => g.id === previous) ? previous : (authorizedGares[0]?.id || ''));

    } catch (err) {

      if (current === seq.current) { setError(errorMessage(err)); setAccess(null); setGares([]); setSelectedId(''); }

    } finally { if (current === seq.current) setLoading(false); }

  }, []);

  useEffect(() => { void loadGares(); return () => { seq.current++; detailSeq.current++; }; }, [loadGares]);

  const loadDetails = useCallback(async (id: string) => {

    const current = ++detailSeq.current;

    selectedIdRef.current = id;

    setDetails(null); setDetailError('');

    if (!id) return;

    setDetailLoading(true);

    try {

      const overview = await garesManagementApi.overview(id);

      if (current !== detailSeq.current || selectedIdRef.current !== id) return;

      setDetails({

        responsables: Array.isArray(overview.responsables) ? overview.responsables : [],

        departs: Array.isArray(overview.departs) ? overview.departs : [],

        arrivees: Array.isArray(overview.arrivees) ? overview.arrivees : [],

      });

    } catch (err) { if (current === detailSeq.current) setDetailError(errorMessage(err)); }

    finally { if (current === detailSeq.current) setDetailLoading(false); }

  }, []);

  useEffect(() => { void loadDetails(selectedId); return () => { detailSeq.current++; }; }, [selectedId, loadDetails]);

  const loadRapport = useCallback(async (id: string, du: string, au: string) => {

    const request = ++rapportSeq.current;

    setRapportError(''); setRapport(null);

    if (!id) return;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(du) || !/^\d{4}-\d{2}-\d{2}$/.test(au) || du > au) {

      setRapportError('Choisissez une période valide (début antérieur ou égal à la fin).'); return;

    }

    setRapportLoading(true);

    try {

      const result = await garesManagementApi.rapport(id, du, au);

      if (request !== rapportSeq.current) return;

      if (!result || !Array.isArray(result.ventes_par_responsable) || !Array.isArray(result.clotures)) {

        throw new Error('Le backend n’a pas renvoyé un rapport de gare complet.');

      }

      setRapport(result);

    } catch (error) { if (request === rapportSeq.current) setRapportError(errorMessage(error)); }

    finally { if (request === rapportSeq.current) setRapportLoading(false); }

  }, []);

  useEffect(() => {

    if (activeTab === 'rapports' && selectedId) void loadRapport(selectedId, dateDebut, dateFin);

    return () => { rapportSeq.current++; };

  }, [activeTab, selectedId, dateDebut, dateFin, loadRapport]);

  const declarerCloture = async (event: FormEvent<HTMLFormElement>) => {

    event.preventDefault();

    if (!selected || saving || !(isChief || access?.role === 'AGENT_CAISSE' || isDirector)) return;

    const amount = Number(clotureMontant);

    if (!clotureMontant.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(clotureDate) ||

        !Number.isSafeInteger(amount) || amount < 0 || clotureDate > localDate(new Date())) {

      setActionError('Date invalide ou montant non valide en FCFA.'); return;

    }

    setSaving(true); setActionError('');

    try {

      await garesManagementApi.declarerCloture(selected.id, {

        date: clotureDate, montant_especes_declare_fcfa: amount, notes: clean(clotureNote) || null,

      });

      setModal(null); setClotureMontant(''); setClotureNote('');

      if (activeTab === 'rapports') await loadRapport(selected.id, dateDebut, dateFin);

    } catch (error) { setActionError(errorMessage(error)); }

    finally { setSaving(false); }

  };

  const closeModal = () => { if (!saving) { setModal(null); setActionError(''); } };

  const editGare = (gare?: Gare) => {

    setEditing(Boolean(gare));

    setGareForm(gare ? {

      nom: gare.nom, ville: gare.ville, adresse: gare.adresse || '',

      chef_nom: gare.chef_nom, chef_tel: gare.chef_tel,

      latitude: gare.latitude ?? null, longitude: gare.longitude ?? null,

    } : emptyGare);

    setChefEmail('');

    setInviteChefNow(!gare);

    setNotice(null);

    setActionError(''); setModal('gare');

  };

  const saveGare = async (event: FormEvent<HTMLFormElement>) => {

    event.preventDefault();

    if (saving || !isDirector) return;

    const name = clean(gareForm.nom), ville = clean(gareForm.ville), adresse = clean(gareForm.adresse);

    if (name.length < 2 || ville.length < 2 || adresse.length < 3) { setActionError('Renseignez le nom, la ville et une adresse précise.'); return; }

    if (!editing && (clean(gareForm.chef_nom).length < 3 || !clean(gareForm.chef_tel))) { setActionError('Pour une nouvelle gare, indiquez le nom complet et le téléphone du chef responsable.'); return; }

    if (!phoneValid(gareForm.chef_tel)) { setActionError('Téléphone du chef de gare invalide.'); return; }

    if (!editing && inviteChefNow && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(chefEmail.trim())) {

      setActionError('Renseignez une adresse email valide pour envoyer l’invitation au chef.'); return;

    }

    if ((gareForm.latitude !== null && (!Number.isFinite(gareForm.latitude) || gareForm.latitude < -90 || gareForm.latitude > 90)) ||

        (gareForm.longitude !== null && (!Number.isFinite(gareForm.longitude) || gareForm.longitude < -180 || gareForm.longitude > 180))) {

      setActionError('Coordonnées GPS invalides.'); return;

    }

    setSaving(true); setActionError('');

    try {

      const input = { ...gareForm, nom: name, ville, adresse, chef_nom: clean(gareForm.chef_nom) || null, chef_tel: clean(gareForm.chef_tel) || null };

      // Etape 1 : enregistrement de la gare. Le backend deduit la compagnie de la session.

      const saved = editing && selected ? await garesManagementApi.update(selected.id, input) : await garesManagementApi.create(input);

      // Une invitation qui echoue ne doit JAMAIS entrainer une nouvelle creation de gare.

      setModal(null);

      setSelectedId(saved.id);

      if (!editing) { setPreferChiefInvitation(true); setActiveTab('hierarchie'); }

      setNotice(editing

        ? {kind:'success', text:'Fiche de gare mise à jour.'}

        : {kind:'success', text:'Gare créée. Dans « Transactions · Accès · Rapports », ouvrez l’onglet « Accès et invitations » pour inviter le chef.'});

      await loadGares();

      if (!editing && inviteChefNow) {

        try {

          // Etape 2 : inviter par email. Le compte n'est pas actif avant acceptation.

          await garesHierarchyApi.invite(saved.id, {

            nom: clean(gareForm.chef_nom), email: chefEmail.trim().toLowerCase(), role: 'CHEF_GARE',

          });

          setNotice({kind:'success', text:`Gare « ${name} » créée. Invitation au chef envoyée à ${chefEmail.trim()}. Il doit l’accepter pour activer son accès.`});

        } catch (inviteError) {

          setNotice({kind:'warning', text:`Gare « ${name} » créée, mais l’invitation du chef n’a pas abouti : ${errorMessage(inviteError)}. Ouvrez « Accès et invitations » pour la renvoyer SANS recréer la gare.`});

        }

      }

    } catch (err) { setActionError(errorMessage(err)); }

    finally { setSaving(false); }

  };

  const saveResponsable = async (event: FormEvent<HTMLFormElement>) => {

    event.preventDefault();

    if (!selected || saving || !canManageTeam) return;

    if (clean(responsableForm.nom).length < 3 || !phoneValid(responsableForm.telephone)) {

      setActionError('Saisissez un nom complet et un numéro valide.'); return;

    }

    const email = clean(responsableForm.email);

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setActionError('Adresse email invalide.'); return; }

    setSaving(true); setActionError('');

    try {

      await garesManagementApi.addResponsable(selected.id, { ...responsableForm, nom: clean(responsableForm.nom), email: email || null });

      setModal(null); await loadDetails(selected.id);

    } catch (err) { setActionError(errorMessage(err)); }

    finally { setSaving(false); }

  };

  const removeResponsable = async (id: string, nom: string) => {

    if (!selected || saving || !canManageTeam || !window.confirm(`Retirer ${nom} des responsables de cette gare ?`)) return;

    setSaving(true); setActionError('');

    try { await garesManagementApi.removeResponsable(selected.id, id); await loadDetails(selected.id); }

    catch (err) { setActionError(errorMessage(err)); }

    finally { setSaving(false); }

  };

  const saveLigne = async (event: FormEvent<HTMLFormElement>) => {

    event.preventDefault();

    if (!selected || saving || !isDirector) return;

    const destinationGare = gares.find(g => g.id === lineForm.gare_arrivee_id);

    const price = Number(lineForm.prix);

    const schedules = [...new Set(lineForm.horaires.split(',').map(t => t.trim()).filter(Boolean))];

    if (!destinationGare || destinationGare.id === selected.id) { setActionError('Choisissez une autre gare appartenant à votre compagnie.'); return; }

    if (!Number.isSafeInteger(price) || price <= 0) { setActionError('Saisissez un tarif positif en FCFA.'); return; }

    if (!/^\d{1,2}h(?:[0-5]\d)?$/.test(lineForm.duree.trim())) { setActionError('Durée attendue : 3h, 3h30, 12h00…'); return; }

    if (!schedules.length || schedules.some(t => !hourValid(t))) { setActionError('Horaires invalides : utilisez 07:00, 13:30…'); return; }

    const payload: LigneInput = { gare_depart_id: selected.id, gare_arrivee_id: destinationGare.id, prix: price, duree: lineForm.duree.trim(), horaires: schedules };

    setSaving(true); setActionError('');

    try {

      await garesManagementApi.createLigne(payload);

      setModal(null); await loadDetails(selected.id);

    } catch (err) { setActionError(errorMessage(err)); }

    finally { setSaving(false); }

  };

  return (

    <div className="mx-auto max-w-[1540px] space-y-5 pb-12">

      <div className="flex flex-col justify-between gap-4 rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center">

        <div>

          <div className="mb-1 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-orange-500"><Building2 size={15}/> Exploitation · Transport interurbain</div>

          <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">Gares et responsables</h1>

          <p className="mt-1 text-sm text-slate-500">Direction → chefs de gare → agents : accès, transactions et remontée des rapports.</p>

          {access && <p className="mt-2 text-xs font-bold text-orange-600">Compte : {access.display_name} · {access.role.replace(/_/g, ' ')} · Gares autorisées : {gares.length}</p>}

        </div>

        <div className="flex items-center gap-2">

          <button onClick={() => void loadGares()} aria-label="Actualiser les gares" className="rounded-xl border border-slate-200 p-3 text-slate-600 transition hover:bg-slate-50"><RefreshCw size={18}/></button>

          {isDirector && <button className={btnPrimary} onClick={() => setDirectionView(v => !v)}><Building2 size={17}/>{directionView ? 'Voir les gares' : 'Vue globale direction'}</button>}

          {isDirector && !directionView && <button className={btnPrimary} onClick={() => editGare()}><Plus size={17}/> Nouvelle gare</button>}

        </div>

      </div>

      {notice && <div role="status" className={`rounded-2xl border p-4 text-sm font-semibold ${notice.kind === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{notice.text}</div>}

      {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      {isDirector && directionView ? <DirectionSupervision/> : <div className="grid gap-5 lg:grid-cols-[315px_minmax(0,1fr)]">

        <aside className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm">

          <div className="mb-4 flex items-center justify-between"><h2 className="font-black text-slate-900">Mes gares</h2><span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-extrabold text-orange-600">{gares.length}</span></div>

          <label className="relative block">

            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

            <input className={`${field} pl-9`} placeholder="Ville, gare, responsable…" value={search} onChange={event => setSearch(event.target.value)} />

          </label>

          {loading ? <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="animate-spin" size={17}/> Chargement…</div>

            : !filtered.length ? <p className="py-8 text-center text-sm text-slate-500">{error ? 'Impossible de charger les gares.' : gares.length ? 'Aucune gare correspondante.' : 'Aucune gare enregistrée pour votre compagnie.'}</p>

              : <div className="mt-4 max-h-[68vh] space-y-2 overflow-y-auto pr-1">{filtered.map(g => (

                <button type="button" key={g.id} onClick={() => { setSelectedId(g.id); setActiveTab('equipe'); setPreferChiefInvitation(false); }}

                  className={`w-full rounded-2xl border p-3 text-left transition ${g.id === selectedId ? 'border-slate-900 bg-slate-900 text-white shadow-md' : 'border-slate-100 bg-slate-50/70 text-slate-900 hover:border-orange-200 hover:bg-white'}`}>

                  <div className="flex items-start gap-3"><span className={`mt-0.5 rounded-xl p-2 ${g.id === selectedId ? 'bg-white/15 text-orange-300' : 'bg-orange-100 text-orange-600'}`}><MapPin size={16}/></span>

                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{g.nom}</span><span className={`mt-0.5 block text-xs ${g.id === selectedId ? 'text-slate-300' : 'text-slate-500'}`}>{g.ville} · {g.adresse || 'Adresse non précisée'}</span><span className={`mt-2 flex items-center gap-1 text-[11px] ${g.id === selectedId ? 'text-orange-200' : 'text-slate-500'}`}><UserRound size={12}/>{g.chef_nom || 'Chef à désigner'}</span></span><ChevronRight size={15} className="mt-1 shrink-0"/></div>

                </button>

              ))}</div>}

        </aside>

        <main className="min-w-0 space-y-5">

          {!selected ? <section className="flex min-h-[330px] flex-col items-center justify-center rounded-[24px] border border-slate-100 bg-white p-6 text-center text-slate-500"><MapPin size={40} className="mb-3 text-orange-300"/><h2 className="font-black text-slate-800">Sélectionnez une gare</h2><p className="mt-2 max-w-md text-sm">Chaque gare dispose de sa propre équipe, de ses coordonnées et de ses liaisons.</p></section> : <>

            <section className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm sm:p-6">

              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                <div className="flex items-center gap-3"><span className="rounded-2xl bg-orange-500 p-3.5 text-white"><MapPin size={24}/></span><div><p className="text-xs font-extrabold uppercase tracking-wider text-orange-500">Fiche gare</p><h2 className="text-xl font-black text-slate-900 sm:text-2xl">{selected.nom}</h2><p className="text-sm text-slate-500">{selected.ville}</p></div></div>

                {isDirector && <div className="flex flex-wrap gap-2">

                  <button onClick={() => editGare(selected)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-extrabold text-slate-700 hover:border-orange-300 hover:text-orange-600"><Pencil size={15}/> Modifier la fiche</button>

                  <button onClick={() => { setPreferChiefInvitation(true); setActiveTab('hierarchie'); }} className={btnPrimary}><Mail size={15}/> Accès et invitations</button>

                </div>}

              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

                <InfoRow icon={Navigation} label="Adresse" value={selected.adresse}/>

                <InfoRow icon={UserRound} label="Chef de gare" value={selected.chef_nom}/>

                <InfoRow icon={Phone} label="Téléphone du chef" value={selected.chef_tel}/>

                <InfoRow icon={Compass} label="Localisation GPS" value={selected.latitude != null && selected.longitude != null ? `${selected.latitude}, ${selected.longitude}` : null}/>

              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500"><span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-3 py-2"><ShieldCheck size={14}/> Les accès doivent être contrôlés par le backend</span><span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-3 py-2"><BusFront size={14}/> Les sièges sont gérés par départ et véhicule</span></div>

            </section>

            <section className="overflow-hidden rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm sm:p-6">

              <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">

                <div><h3 className="text-lg font-black text-slate-900">Gestion de la gare</h3><p className="text-xs text-slate-500">Équipe, trajets sortants et arrivants</p></div>

                <div className="flex flex-wrap gap-2">

                  {canManageTeam && <button onClick={() => { setResponsableForm(blankResponsable); setActionError(''); setModal('responsable'); }} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-700 hover:border-orange-300"><Users size={14}/> Fiche responsable</button>}

                  {isDirector && <button onClick={() => { setLineForm(blankLine); setActionError(''); setModal('ligne'); }} className={btnPrimary}><Plus size={15}/> Nouvelle ligne</button>}

                </div>

              </div>

              <div role="tablist" aria-label="Rubriques de la gare" className="mb-5 flex gap-2 overflow-x-auto border-b border-slate-100 pb-3">

                {([['equipe', 'Équipe et responsabilités', Users], ['departs', 'Départs', ArrowRight], ['arrivees', 'Arrivées', RouteIcon], ['rapports', 'Rapports de vente', ChartNoAxesColumn], ['hierarchie', 'Transactions · Accès · Rapports', ShieldCheck]] as const).map(([key, label, Icon]) => (

                  <button type="button" role="tab" aria-selected={activeTab === key} key={key} onClick={() => { setActiveTab(key); if (key !== 'hierarchie') setPreferChiefInvitation(false); }} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${activeTab === key ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}><Icon size={15}/>{label}{details && key !== 'rapports' && key !== 'hierarchie' && <span className="rounded-full bg-white/15 px-1.5">{key === 'equipe' ? details.responsables.length : key === 'departs' ? details.departs.length : details.arrivees.length}</span>}</button>

                ))}

              </div>

              {actionError && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
              {activeTab === 'hierarchie' && isDirector && preferChiefInvitation && (
                <p role="status" className="mb-4 rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs font-semibold text-orange-800">
                  Pour inviter un chef de gare, ouvrez l’onglet « Accès et invitations » ci-dessous.
                </p>
              )}

              {activeTab === 'hierarchie' && access ? <GareHierarchie key={`${selected.id}:${access.role}:${preferChiefInvitation ? 'invite' : 'general'}`} gare={selected} access={access} du={dateDebut} au={dateFin}/> : activeTab === 'rapports' ? (

                <div className="space-y-5">

                  <div className="flex flex-col justify-between gap-3 rounded-2xl bg-slate-50 p-4 md:flex-row md:items-end">

                    <div className="grid flex-1 gap-3 sm:grid-cols-2">

                      <label><span className={smallTitle}>Du</span><input type="date" className={field} value={dateDebut} max={dateFin} onChange={e => setDateDebut(e.target.value)}/></label>

                      <label><span className={smallTitle}>Au</span><input type="date" className={field} value={dateFin} min={dateDebut} max={localDate(new Date())} onChange={e => setDateFin(e.target.value)}/></label>

                    </div>

                    <div className="flex flex-wrap gap-2">

                      <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-black text-slate-700" onClick={() => void loadRapport(selected.id, dateDebut, dateFin)}><RefreshCw size={14}/> Actualiser</button>

                      <button type="button" disabled={!rapport} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-black text-slate-700 disabled:opacity-50" onClick={() => { if (rapport) downloadReport(rapport, selected.nom); }}><Download size={14}/> Exporter CSV</button>

                      {(isDirector || isChief || access?.role === 'AGENT_CAISSE') && <button type="button" className={btnPrimary} onClick={() => { setActionError(''); setClotureDate(localDate(new Date())); setModal('cloture'); }}><FileCheck2 size={15}/> Déclarer la caisse</button>}

                    </div>

                  </div>

                  {rapportLoading ? <p className="flex items-center gap-2 py-5 text-sm text-slate-500"><Loader2 size={16} className="animate-spin"/> Chargement du rapport comptable…</p> :

                  rapportError ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{rapportError} — Les données doivent être fournies par le backend sécurisé.</p> :

                  !rapport ? <p className="py-5 text-sm text-slate-500">Aucun rapport chargé pour la période.</p> : <>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

                      {([

                        ['Billets payés', String(rapport.billets_payes), Ticket],

                        ['Ventes confirmées', fcfa(rapport.montant_brut_fcfa), Wallet],

                        ['Commission MESSAY', fcfa(rapport.commission_messay_fcfa), ChartNoAxesColumn],

                        ['Part de la compagnie', fcfa(rapport.part_compagnie_fcfa), ShieldCheck],

                      ] as const).map(([label, value, Icon]) => (

                        <div className="rounded-2xl border border-slate-100 bg-white p-4" key={label}><Icon size={18} className="text-orange-500"/><p className="mt-3 text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-lg font-black text-slate-900">{value}</p></div>

                      ))}

                    </div>

                    <p className="text-xs text-slate-500">Remboursements sur la période : <strong>{fcfa(rapport.remboursements_fcfa)}</strong>. Les recettes du web et les espèces encaissées en gare doivent être rapprochées séparément.</p>

                    <div>

                      <h4 className="mb-3 text-sm font-black text-slate-900">Ventes par responsable</h4>

                      {rapport.ventes_par_responsable.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">Aucune vente attribuée à un responsable sur cette période, ou attribution non encore configurée.</p> : <div className="overflow-x-auto rounded-2xl border border-slate-100"><table className="w-full min-w-[540px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Responsable</th><th className="p-3">Fonction</th><th className="p-3">Billets payés</th><th className="p-3">Ventes confirmées</th></tr></thead><tbody>{rapport.ventes_par_responsable.map((r, index) => <tr key={`${r.responsable_id || r.nom}-${index}`} className="border-t border-slate-100"><td className="p-3 font-bold">{r.nom}</td><td className="p-3">{r.fonction}</td><td className="p-3">{r.billets_payes}</td><td className="p-3">{fcfa(r.montant_fcfa)}</td></tr>)}</tbody></table></div>}

                    </div>

                    <div>

                      <h4 className="mb-3 text-sm font-black text-slate-900">Clôtures de caisse déclarées</h4>

                      {rapport.clotures.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">Aucune clôture saisie pour cette période.</p> : <div className="overflow-x-auto rounded-2xl border border-slate-100"><table className="w-full min-w-[650px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Date</th><th className="p-3">Déclaré par</th><th className="p-3">Espèces déclarées</th><th className="p-3">Écart</th><th className="p-3">Statut</th></tr></thead><tbody>{rapport.clotures.map(c => <tr key={c.id} className="border-t border-slate-100"><td className="p-3">{c.date}</td><td className="p-3">{c.declare_par}</td><td className="p-3">{fcfa(c.montant_especes_declare_fcfa)}</td><td className="p-3">{fcfa(c.ecart_fcfa)}</td><td className="p-3 font-bold">{c.statut}</td></tr>)}</tbody></table></div>}

                    </div>

                  </>}

                </div>

              ) : detailLoading ? <div className="flex items-center gap-2 py-10 text-sm text-slate-500"><Loader2 size={18} className="animate-spin"/> Chargement des responsables et trajets…</div>

                : detailError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-bold text-amber-800">Détails de la gare indisponibles</p><p className="mt-1 text-xs leading-5 text-amber-700">{detailError}</p><button className="mt-3 inline-flex items-center gap-2 text-xs font-black text-amber-900 underline" onClick={() => void loadDetails(selected.id)}><RefreshCw size={14}/> Réessayer</button></div>

                  : !details ? <p className="py-8 text-sm text-slate-500">Aucune information disponible.</p>

                    : activeTab === 'equipe' ? <div className="space-y-3">

                      <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><span className="rounded-xl bg-white p-2 text-orange-600"><UserRound size={22}/></span><div><p className="text-xs font-black uppercase tracking-wide text-orange-700">Chef de gare</p><p className="font-black text-slate-900">{selected.chef_nom || 'Non désigné'}</p><p className="mt-1 text-xs text-slate-600">{selected.chef_tel || 'Téléphone non renseigné'}</p></div></div>{selected.chef_tel && <a href={`tel:${selected.chef_tel.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-black text-orange-700"><Phone size={14}/> Appeler</a>}</div></div>

                      <div className="flex items-center justify-between"><h4 className="text-sm font-black text-slate-900">Autres responsables</h4><span className="text-xs text-slate-500">{details.responsables.length} enregistré(s)</span></div>

                      {!details.responsables.length ? <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Aucun autre responsable enregistré. Ajoutez les responsables de billetterie, d’embarquement, de caisse ou d’exploitation.</p> : <div className="grid gap-3 md:grid-cols-2">{details.responsables.map(person => <div key={person.id} className="rounded-2xl border border-slate-100 p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><span className="rounded-xl bg-slate-100 p-2 text-slate-600"><Users size={18}/></span><div className="min-w-0"><p className="truncate font-black text-slate-900">{person.nom}</p><p className="mt-1 text-xs font-bold text-orange-600">{humanRole(person.fonction)}</p><p className="mt-1 text-[11px] text-slate-500">{person.actif ? 'Actif' : 'Inactif'}</p></div></div>{canManageTeam && <button title="Retirer ce responsable" aria-label={`Retirer ${person.nom}`} onClick={() => void removeResponsable(person.id, person.nom)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><X size={16}/></button>}</div><div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">{person.telephone && <a className="inline-flex items-center gap-1 hover:text-orange-600" href={`tel:${person.telephone.replace(/\s/g, '')}`}><Phone size={13}/>{person.telephone}</a>}{person.email && <a className="inline-flex items-center gap-1 hover:text-orange-600" href={`mailto:${person.email}`}><Mail size={13}/>{person.email}</a>}</div></div>)}</div>}

                    </div> : <div className="space-y-3">{(activeTab === 'departs' ? details.departs : details.arrivees).length === 0 ? <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">Aucune liaison {activeTab === 'departs' ? 'au départ' : 'à l’arrivée'} de cette gare. Les anciennes destinations sans gare associée doivent être complétées.</div> : (activeTab === 'departs' ? details.departs : details.arrivees).map(ligne => <LigneCard key={ligne.id} ligne={ligne} direction={activeTab === 'departs' ? 'departs' : 'arrivees'}/>)}</div>}

            </section>

          </>}

        </main>

      </div>

      }

      {modal === 'gare' && isDirector && <Dialog title={editing ? 'Modifier la gare' : 'Créer une gare et les accès du chef'} subtitle="La direction enregistre la gare, puis peut envoyer immédiatement un lien d'invitation sécurisé au chef." onClose={closeModal}>

        <form onSubmit={event => void saveGare(event)} className="space-y-4">

          <div className="grid gap-4 sm:grid-cols-2"><label><span className={smallTitle}>Nom de la gare *</span><input className={field} required minLength={2} value={gareForm.nom} onChange={e => setGareForm({ ...gareForm, nom: e.target.value })}/></label><label><span className={smallTitle}>Ville *</span><input className={field} required minLength={2} value={gareForm.ville} onChange={e => setGareForm({ ...gareForm, ville: e.target.value })}/></label></div>

          <label className="block"><span className={smallTitle}>Adresse précise *</span><input className={field} required minLength={3} value={gareForm.adresse} onChange={e => setGareForm({ ...gareForm, adresse: e.target.value })} placeholder="Quartier, rue, repère…"/></label>

          <div className="grid gap-4 sm:grid-cols-2"><label><span className={smallTitle}>Nom du chef de gare {!editing ? "*" : ""}</span><input className={field} value={gareForm.chef_nom || ''} onChange={e => setGareForm({ ...gareForm, chef_nom: e.target.value })}/></label><label><span className={smallTitle}>Téléphone du chef {!editing ? "*" : ""}</span><input className={field} type="tel" value={gareForm.chef_tel || ''} onChange={e => setGareForm({ ...gareForm, chef_tel: e.target.value })}/></label></div>

          {!editing && <div className="space-y-3 rounded-2xl border border-orange-100 bg-orange-50/60 p-4">

            <label className="flex items-start gap-2 text-sm font-bold text-slate-800">

              <input type="checkbox" className="mt-1 accent-orange-500" checked={inviteChefNow} onChange={e => setInviteChefNow(e.target.checked)}/>

              Envoyer une invitation de connexion au chef dès la création

            </label>

            {inviteChefNow && <label className="block"><span className={smallTitle}>Email personnel/professionnel du chef *</span>

              <input type="email" required className={field} placeholder="chef@compagnie.ci" value={chefEmail} onChange={e => setChefEmail(e.target.value)} autoComplete="email"/>

            </label>}

            <p className="text-xs leading-5 text-slate-600">Chaque chef crée son mot de passe à partir de l'invitation reçue. La direction ne connaît pas ses identifiants. Vous pouvez également inviter le chef plus tard.</p>

          </div>}

          <div className="grid gap-4 sm:grid-cols-2"><label><span className={smallTitle}>Latitude (facultatif)</span><input className={field} type="number" step="any" placeholder="5.32" value={gareForm.latitude ?? ''} onChange={e => setGareForm({ ...gareForm, latitude: e.target.value ? Number(e.target.value) : null })}/></label><label><span className={smallTitle}>Longitude (facultatif)</span><input className={field} type="number" step="any" placeholder="-4.02" value={gareForm.longitude ?? ''} onChange={e => setGareForm({ ...gareForm, longitude: e.target.value ? Number(e.target.value) : null })}/></label></div>

          {actionError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{actionError}</p>}

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={closeModal} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500">Annuler</button><button disabled={saving} className={btnPrimary} type="submit">{saving ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>} {editing ? 'Mettre à jour' : inviteChefNow ? 'Créer la gare et inviter le chef' : 'Créer la gare'}</button></div>

        </form>

      </Dialog>}

      {modal === 'responsable' && canManageTeam && selected && <Dialog title="Ajouter un responsable" subtitle={`Équipe de ${selected.nom}. Le chef principal se modifie dans la fiche gare.`} onClose={closeModal}>

        <p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Une fiche de responsable ne crée pas de connexion. Pour ouvrir un compte réel, utilisez l'onglet « Transactions · Accès · Rapports » puis « Accès et invitations ».</p>

        <form onSubmit={event => void saveResponsable(event)} className="space-y-4">

          <label className="block"><span className={smallTitle}>Nom complet *</span><input className={field} required minLength={3} value={responsableForm.nom} onChange={e => setResponsableForm({ ...responsableForm, nom: e.target.value })}/></label>

          <label className="block"><span className={smallTitle}>Fonction *</span><select className={field} value={responsableForm.fonction} onChange={e => setResponsableForm({ ...responsableForm, fonction: e.target.value as ResponsableRole })}>{roles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>

          <div className="grid gap-4 sm:grid-cols-2"><label><span className={smallTitle}>Téléphone</span><input className={field} type="tel" value={responsableForm.telephone || ''} onChange={e => setResponsableForm({ ...responsableForm, telephone: e.target.value })}/></label><label><span className={smallTitle}>Email</span><input className={field} type="email" value={responsableForm.email || ''} onChange={e => setResponsableForm({ ...responsableForm, email: e.target.value })}/></label></div>

          {actionError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{actionError}</p>}

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={closeModal} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500">Annuler</button><button disabled={saving} type="submit" className={btnPrimary}>{saving ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16}/>} Ajouter</button></div>

        </form>

      </Dialog>}

      {modal === 'cloture' && (isDirector || isChief || access?.role === 'AGENT_CAISSE') && selected && <Dialog title="Déclarer une clôture de caisse" subtitle={`Gare : ${selected.nom}. La direction vérifiera les montants déclarés, sans modifier les transactions déjà confirmées.`} onClose={closeModal}>

        <form onSubmit={event => void declarerCloture(event)} className="space-y-4">

          <label className="block"><span className={smallTitle}>Date de caisse *</span><input type="date" max={localDate(new Date())} required className={field} value={clotureDate} onChange={e => setClotureDate(e.target.value)}/></label>

          <label className="block"><span className={smallTitle}>Espèces réellement déclarées (FCFA) *</span><input className={field} required type="number" min="0" step="1" placeholder="Montant exact" value={clotureMontant} onChange={e => setClotureMontant(e.target.value)}/></label>

          <label className="block"><span className={smallTitle}>Observations (facultatif)</span><textarea className={field} rows={3} value={clotureNote} onChange={e => setClotureNote(e.target.value)} placeholder="Écart observé, référence de caisse…"/></label>

          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">La clôture est une déclaration soumise au contrôle de la direction, pas un encaissement ni un crédit automatique du portefeuille.</p>

          {actionError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{actionError}</p>}

          <div className="flex justify-end gap-3"><button type="button" onClick={closeModal} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500">Annuler</button><button type="submit" disabled={saving} className={btnPrimary}>{saving ? <Loader2 className="animate-spin" size={16}/> : <FileCheck2 size={16}/>} Soumettre la clôture</button></div>

        </form>

      </Dialog>}

      {modal === 'ligne' && isDirector && selected && <Dialog title="Nouvelle ligne de transport" subtitle={`Gare de départ : ${selected.nom} (${selected.ville}). La gare d’arrivée doit appartenir à votre compagnie.`} onClose={closeModal}>

        <form onSubmit={event => void saveLigne(event)} className="space-y-4">

          <label className="block"><span className={smallTitle}>Gare d’arrivée *</span><select className={field} required value={lineForm.gare_arrivee_id} onChange={e => setLineForm({ ...lineForm, gare_arrivee_id: e.target.value })}><option value="">Sélectionner une gare</option>{gares.filter(g => g.id !== selected.id).map(g => <option key={g.id} value={g.id}>{g.nom} — {g.ville}</option>)}</select></label>

          {gares.length < 2 && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">Enregistrez une deuxième gare avant de créer une liaison.</p>}

          <div className="grid gap-4 sm:grid-cols-2"><label><span className={smallTitle}>Tarif (FCFA) *</span><input className={field} type="number" min="1" step="1" required value={lineForm.prix} onChange={e => setLineForm({ ...lineForm, prix: e.target.value })}/></label><label><span className={smallTitle}>Durée *</span><input className={field} required placeholder="3h30" value={lineForm.duree} onChange={e => setLineForm({ ...lineForm, duree: e.target.value })}/></label></div>

          <label className="block"><span className={smallTitle}>Heures de départ *</span><input className={field} required placeholder="07:00, 13:30" value={lineForm.horaires} onChange={e => setLineForm({ ...lineForm, horaires: e.target.value })}/><span className="mt-1 block text-[11px] text-slate-500">Ce sont des horaires publiés ; les dates de circulation et la capacité devront être confirmées pour chaque départ.</span></label>

          {actionError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{actionError}</p>}

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={closeModal} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500">Annuler</button><button disabled={saving || gares.length < 2} className={btnPrimary} type="submit">{saving ? <Loader2 size={16} className="animate-spin"/> : <Ticket size={16}/>} Enregistrer la ligne</button>
          </div>
        </form>
      </Dialog>}
    </div>
  );
}
