/** API authentifiée: réutilise le même client Axios MESSAY que /tickets. */
import api from './api';

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const QR = /^MESSAY:BUS:V1:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

export type NouveauBilletQr = Readonly<{
  id: string; compagnie: string; depart: string; destination: string;
  dateDepart: string; heureDepart: string; prix: number; statut: 'PAYE';
  siegeAffichage: string | null;
}>;
export type NouveauBilletQrDetail = NouveauBilletQr & Readonly<{ qrPayload: string }>;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function decodeBillet(data: unknown): NouveauBilletQr {
  if (!isObject(data) || typeof data.id !== 'string' || !UUID.test(data.id) ||
    typeof data.compagnie !== 'string' || !data.compagnie.trim() ||
    typeof data.depart !== 'string' || !data.depart.trim() ||
    typeof data.destination !== 'string' || !data.destination.trim() ||
    typeof data.dateDepart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.dateDepart) ||
    typeof data.heureDepart !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.heureDepart) ||
    typeof data.prix !== 'number' || !Number.isSafeInteger(data.prix) ||
    data.prix < 200 || data.prix > 2_500_000 || data.statut !== 'PAYE' ||
    (data.siegeAffichage !== null && typeof data.siegeAffichage !== 'string')) {
    throw new Error('MESSAY_BILLET_QR_REPONSE_INVALIDE');
  }
  return {
    id: data.id, compagnie: data.compagnie, depart: data.depart,
    destination: data.destination, dateDepart: data.dateDepart,
    heureDepart: data.heureDepart, prix: data.prix, statut: 'PAYE',
    siegeAffichage: data.siegeAffichage,
  };
}

export async function lireBilletsQr(): Promise<NouveauBilletQr[]> {
  const { data } = await api.get<unknown>('/interurbain/billets');
  if (!isObject(data) || !Array.isArray(data.billets) || data.billets.length > 100) {
    throw new Error('MESSAY_BILLETS_QR_REPONSE_INVALIDE');
  }
  const billets = data.billets.map(decodeBillet);
  if (new Set(billets.map(b => b.id)).size !== billets.length) {
    throw new Error('MESSAY_BILLETS_QR_DUPLIQUES');
  }
  return billets;
}

export async function lireQrBillet(ticketId: string): Promise<NouveauBilletQrDetail> {
  if (!UUID.test(ticketId)) throw new Error('MESSAY_BILLET_QR_ID_INVALIDE');
  const { data } = await api.get<unknown>(`/interurbain/billets/${ticketId}/qr`);
  const billet = decodeBillet(data);
  if (!isObject(data) || billet.id !== ticketId ||
    typeof data.qrPayload !== 'string' || !QR.test(data.qrPayload)) {
    throw new Error('MESSAY_BILLET_QR_NON_VERIFIE');
  }
  return { ...billet, qrPayload: data.qrPayload };
}
