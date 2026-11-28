import React, { useMemo, useState } from 'react';

/**
 * Composant WEB réutilisable pour TOUS les Dashboards Compagnie MESSAY.
 * Ne contient aucun accès Supabase direct et ne donne aucune autorisation.
 * Le backend de onSave DOIT : authentifier, autoriser la compagnie,
 * valider les deux gares, créer destination + horaire en transaction.
 */
export type MessayGare = {
  id: string;
  company_id: string;
  nom: string;
  ville: string;
  adresse?: string | null;
};

export type NouvelleLiaison = {
  gare_depart_id: string;
  gare_arrivee_id: string;
  ville_depart: string;
  ville: string;
  heure_depart: string; // horaires.heure_depart (HH:MM)
  heure_arrivee_indicative: string; // Saisie UI : non stockée telle quelle dans la BDD actuelle
  jours_apres_arrivee: number;
  duree: string; // destinations.duree (format 3h30), dérivée des deux heures
  prix: number;
  quota: number;
};

type Props = {
  companyId: string; // Identifiant du contexte entreprise authentifié, PAS un droit d'accès
  companyName: string;
  gares: MessayGare[];
  onSave: (route: NouvelleLiaison) => Promise<void>;
};

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const minutes = (text: string) => {
  if (!/^\d{2}:\d{2}$/.test(text)) return null;
  const [h, m] = text.split(':').map(Number);
  return h >= 0 && h < 24 && m >= 0 && m < 60 ? h * 60 + m : null;
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 12px', boxSizing: 'border-box', borderRadius: 12,
  border: '1px solid #DCE3EC', color: '#172033', background: '#FFFFFF', fontSize: 14,
};
const labelStyle: React.CSSProperties = { display: 'grid', gap: 7, fontSize: 13, fontWeight: 700, color: '#344054' };

export default function CompanyRouteForm({ companyId, companyName, gares, onSave }: Props) {
  // Ne propose JAMAIS la gare d'une autre compagnie.
  const ownStations = useMemo(() => gares.filter(g => g.company_id === companyId && !!g.ville?.trim()), [gares, companyId]);
  const cities = useMemo(() => [...new Map(ownStations.map(g => [normalize(g.ville), g.ville])).values()].sort((a,b) => a.localeCompare(b, 'fr')), [ownStations]);
  const [fromCity, setFromCity] = useState('');
  const [toCity, setToCity] = useState('');
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [departure, setDeparture] = useState('');
  const [arrival, setArrival] = useState('');
  const [daysAfter, setDaysAfter] = useState(0);
  const [price, setPrice] = useState('');
  const [seats, setSeats] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const fromStations = ownStations.filter(g => normalize(g.ville) === normalize(fromCity));
  const toStations = ownStations.filter(g => normalize(g.ville) === normalize(toCity));
  const dep = ownStations.find(g => g.id === fromId);
  const arr = ownStations.find(g => g.id === toId);
  const depM = minutes(departure);
  const arrM = minutes(arrival);
  const totalM = depM === null || arrM === null ? null : arrM + daysAfter * 1440 - depM;
  const duration = totalM !== null && totalM > 0 ? `${Math.floor(totalM / 60)}h${String(totalM % 60).padStart(2, '0')}` : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage(''); setSuccess(false);
    if (!dep || !arr || dep.company_id !== companyId || arr.company_id !== companyId) {
      setMessage('Choisis deux gares réelles de cette compagnie.'); return;
    }
    if (dep.id === arr.id || normalize(dep.ville) === normalize(arr.ville)) {
      setMessage('Sélectionne deux villes différentes.'); return;
    }
    if (!duration || depM === null || arrM === null) {
      setMessage('Vérifie les heures et le jour d’arrivée : l’arrivée doit être postérieure au départ.'); return;
    }
    const amount = Number(price), quota = Number(seats);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(quota) || quota < 1) {
      setMessage('Le prix doit être positif et le nombre de places doit être un entier positif.'); return;
    }
    setSaving(true);
    try {
      await onSave({
        gare_depart_id: dep.id, gare_arrivee_id: arr.id,
        ville_depart: dep.ville, ville: arr.ville,
        heure_depart: departure, heure_arrivee_indicative: arrival,
        jours_apres_arrivee: daysAfter, duree: duration,
        prix: amount, quota,
      });
      setSuccess(true);
      setMessage('Liaison transmise et enregistrée par votre service sécurisé.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de créer cette liaison.');
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 750, background: '#FFF', padding: 24, borderRadius: 24, border: '1px solid #E7ECF3', boxShadow: '0 12px 38px rgba(20,30,55,.06)', display: 'grid', gap: 19 }}>
      <header>
        <p style={{ color: '#F97316', fontSize: 11, fontWeight: 800, letterSpacing: '1.4px', margin: 0 }}>MESSAY · DASHBOARD COMPAGNIE</p>
        <h2 style={{ margin: '6px 0 4px', fontSize: 24, color: '#162033' }}>Ajouter un départ</h2>
        <p style={{ color: '#667085', margin: 0 }}>Compagnie : <strong>{companyName}</strong>. Chaque gare doit être enregistrée avant de créer sa liaison.</p>
      </header>
      {ownStations.length === 0 && <p role="alert" style={{ color: '#9A3412', background: '#FFF7ED', padding: 13, borderRadius: 10 }}>Aucune gare de cette compagnie. Crée d’abord ses gares dans le Dashboard.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 15 }}>
        <label style={labelStyle}>Ville de départ
          <select style={inputStyle} value={fromCity} onChange={e => { setFromCity(e.target.value); setFromId(''); }} required>
            <option value="">Choisir une ville</option>{cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label style={labelStyle}>Gare de départ
          <select style={inputStyle} value={fromId} onChange={e => setFromId(e.target.value)} disabled={!fromCity} required>
            <option value="">Choisir la gare</option>{fromStations.map(g => <option key={g.id} value={g.id}>{g.nom}{g.adresse ? ` — ${g.adresse}` : ''}</option>)}
          </select>
        </label>
        <label style={labelStyle}>Heure de départ
          <input style={inputStyle} type="time" value={departure} onChange={e => setDeparture(e.target.value)} required />
        </label>
        <label style={labelStyle}>Ville de destination
          <select style={inputStyle} value={toCity} onChange={e => { setToCity(e.target.value); setToId(''); }} required>
            <option value="">Choisir une destination</option>{cities.filter(c => normalize(c) !== normalize(fromCity)).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label style={labelStyle}>Gare d’arrivée
          <select style={inputStyle} value={toId} onChange={e => setToId(e.target.value)} disabled={!toCity} required>
            <option value="">Choisir la gare</option>{toStations.map(g => <option key={g.id} value={g.id}>{g.nom}{g.adresse ? ` — ${g.adresse}` : ''}</option>)}
          </select>
        </label>
        <label style={labelStyle}>Heure d’arrivée prévue
          <input style={inputStyle} type="time" value={arrival} onChange={e => setArrival(e.target.value)} required />
        </label>
        <label style={labelStyle}>Arrivée après combien de jours ?
          <select style={inputStyle} value={daysAfter} onChange={e => setDaysAfter(Number(e.target.value))}>
            <option value={0}>Même jour</option><option value={1}>Jour suivant (+1)</option><option value={2}>Deux jours après (+2)</option>
          </select>
        </label>
        <label style={labelStyle}>Tarif (F CFA)
          <input style={inputStyle} type="number" min={1} step={1} value={price} onChange={e => setPrice(e.target.value)} required />
        </label>
        <label style={labelStyle}>Nombre de places proposées
          <input style={inputStyle} type="number" min={1} step={1} value={seats} onChange={e => setSeats(e.target.value)} required />
        </label>
      </div>
      <div style={{ padding: 14, background: '#FFF7ED', borderRadius: 14, color: '#92400E', fontSize: 13 }}>
        <strong>Durée calculée : {duration ?? 'À renseigner'}</strong>. L’heure d’arrivée est indicative ; le schéma actuel stocke <code>heure_depart</code> dans <code>horaires</code> et la durée dans <code>destinations</code>.
      </div>
      {message && <p role="status" style={{ color: success ? '#047857' : '#B42318', margin: 0 }}>{message}</p>}
      <button type="submit" disabled={saving || ownStations.length < 2} style={{ background: '#F97316', opacity: saving ? 0.6 : 1, border: 0, padding: '15px 19px', color: '#FFF', fontWeight: 800, borderRadius: 14, cursor: 'pointer', transition: 'transform .2s ease, background-color .2s ease' }}>
        {saving ? 'Enregistrement…' : 'Enregistrer le départ'}
      </button>
      <small style={{ color: '#667085' }}>Le composant n’effectue aucun INSERT directement. La fonction onSave doit appeler le backend authentifié, qui enregistre la destination et l’horaire dans une même transaction et vérifie les droits.</small>
    </form>
  );
}
