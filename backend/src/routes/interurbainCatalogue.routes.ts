/**
 * MESSAY — catalogue public commun à l'app mobile et au dashboard Compagnie.
 * Lecture des vraies gares, destinations et horaires publiés dans PostgreSQL.
 * AUCUNE opération de vente, aucun siège déclaré disponible ni paiement simulé.
 * Monter AVANT /api catch-all : app.use('/api/interurbain', interurbainCatalogueRouter)
 */
import 'dotenv/config';
import { Router, type Request, type Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const url = String(process.env.SUPABASE_URL || '').trim();
const key = [process.env.SUPABASE_SECRET_KEY, process.env.SERVICE_ROLE_KEY,
  process.env.SUPABASE_SERVICE_ROLE_KEY].find(v => Boolean(v?.trim()))?.trim();
if (!url || !key) {
  throw new Error('MESSAY : SUPABASE_URL et clé serveur requis pour le catalogue interurbain.');
}
// Même principe que companyDashboardGares.routes.ts : pas de clé privée dans le mobile.
if (key.startsWith('sb_publishable_') || (!key.startsWith('sb_secret_') && (() => {
  try {
    const [, payload] = key.split('.');
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).role !== 'service_role';
  } catch { return true; }
})())) {
  throw new Error('MESSAY : seule une clé serveur Supabase est autorisée.');
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
export const interurbainCatalogueRouter = Router();
const isUuid = (s: unknown): s is string => typeof s === 'string' && /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(s);
const dateValide = (s: unknown): s is string => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const date = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === s;
};
function safePrice(input: unknown): number | null {
  if (input == null || input === '') return null;
  const price = Number(input);
  return Number.isFinite(price) && price >= 0 ? price : null;
}
function validHour(input: unknown): string | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(input || ''));
  if (!match) return null;
  const h = Number(match[1]), m = Number(match[2]);
  return h < 24 && m < 60 ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}` : null;
}

interurbainCatalogueRouter.get('/catalogue', async (req: Request, res: Response) => {
  const companyId = req.query.company_id;
  const gareDepartId = req.query.gare_depart_id;
  const date = req.query.date;
  if (!isUuid(companyId)) {
    res.status(400).json({ message: 'MESSAY : sélectionnez une compagnie valide.' }); return;
  }
  if (gareDepartId !== undefined && !isUuid(gareDepartId)) {
    res.status(400).json({ message: 'MESSAY : gare de départ invalide.' }); return;
  }
  if (date !== undefined && !dateValide(date)) {
    res.status(400).json({ message: 'MESSAY : date attendue au format AAAA-MM-JJ.' }); return;
  }
  try {
    const [companyRes, garesRes, destinationsRes] = await Promise.all([
      // Seules les compagnies actives et approuvées sont consultables.
      db.from('companies').select('id,name').eq('id', companyId).eq('is_active', true).eq('is_verified', true).maybeSingle(),
      db.from('gares').select('id,nom,ville,adresse').eq('company_id', companyId)
        .order('ville', { ascending: true }).limit(201),
      // Filtrage par gare avant interrogation des horaires, pas après.
      (() => {
        let q = db.from('destinations')
          .select('id,ville,prix,duree,gare_depart_id,gare_arrivee_id')
          .eq('company_id', companyId);
        if (gareDepartId) q = q.eq('gare_depart_id', gareDepartId);
        return q.order('ville', { ascending: true }).limit(701);
      })(),
    ]);
    if (companyRes.error || garesRes.error || destinationsRes.error) {
      // Le détail ne quitte jamais le serveur (aucune clé ni donnée passager).
      for (const [table, error] of [
        ['companies', companyRes.error],
        ['gares', garesRes.error],
        ['destinations', destinationsRes.error],
      ] as const) {
        if (error) {
          console.error(`[MESSAY/catalogue] Lecture ${table}`, {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
        }
      }
      res.status(503).json({ message: 'MESSAY : catalogue momentanément indisponible.' }); return;
    }
    const compagnie = companyRes.data;
    if (!compagnie) {
      res.status(404).json({ message: 'MESSAY : compagnie introuvable.' }); return;
    }
    const gares = (garesRes.data || []).slice(0, 200);
    const rawDestinations = (destinationsRes.data || []).slice(0, 700);
    const ids = rawDestinations.map(item => item.id);
    const horairesRes = ids.length
      ? await db.from('horaires').select('id,destination_id,heure_depart')
          .in('destination_id', ids).order('heure_depart', { ascending: true }).limit(5001)
      : { data: [], error: null };
    if (horairesRes.error) {
      console.error('[MESSAY/catalogue] horaires:', horairesRes.error.code);
      res.status(503).json({ message: 'MESSAY : horaires temporairement indisponibles.' }); return;
    }
    const rawHoraires = horairesRes.data || [];
    const truncated = (garesRes.data || []).length > 200 ||
      (destinationsRes.data || []).length > 700 || rawHoraires.length >= 1000; // Peut atteindre la limite PostgREST du projet.
    const timetable = new Map<string, Array<{ id: string; destination_id: string; heure_depart: string }>>();
    for (const entry of rawHoraires.slice(0, 5000)) {
      const h = validHour(entry.heure_depart);
      if (!h) continue;
      const key = String(entry.destination_id);
      const list = timetable.get(key) || [];
      list.push({ id: String(entry.id), destination_id: key, heure_depart: h });
      timetable.set(key, list);
    }
    const stationMap = new Map(gares.map(g => [String(g.id), g]));
    const destinations = rawDestinations.map(row => ({
      id: String(row.id),
      ville: row.ville,
      prix: safePrice(row.prix),
      duree: row.duree,
      gare_depart_id: row.gare_depart_id,
      gare_arrivee_id: row.gare_arrivee_id,
      horaires: timetable.get(String(row.id)) || [],
    }));
    const offres = destinations.flatMap(row => {
      const from = row.gare_depart_id ? stationMap.get(String(row.gare_depart_id)) : null;
      const to = row.gare_arrivee_id ? stationMap.get(String(row.gare_arrivee_id)) : null;
      if (!from) return [];
      return row.horaires.map(h => ({
        destination_id: row.id, horaire_id: h.id,
        gare_depart_id: String(from.id), gare_arrivee_id: to ? String(to.id) : null,
        gare_depart_nom: from.nom, gare_arrivee_nom: to?.nom ?? null,
        ville_depart: from.ville, ville_arrivee: to?.ville || row.ville,
        heure_depart: h.heure_depart, prix_fcfa: row.prix, duree: row.duree,
        // Pas de planning daté et pas de compteur de places par départ dans les tables actuelles.
        disponibilite_confirmee: false,
      }));
    });
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      // Aucun indicateur d'activité dans le schéma actuel : statut inconnu, non inventé.
      compagnie: { id: compagnie.id, name: compagnie.name, is_active: null },
      gares, destinations, offres,
      date_recherche: typeof date === 'string' ? date : null,
      tronque: truncated,
      information: 'Horaires publiés. Circulation et disponibilité des places à confirmer avant paiement.',
    });
  } catch (err) {
    console.error('[MESSAY/catalogue] Erreur inattendue', err);
    res.status(500).json({ message: 'MESSAY : impossible de consulter les trajets pour le moment.' });
  }
});
