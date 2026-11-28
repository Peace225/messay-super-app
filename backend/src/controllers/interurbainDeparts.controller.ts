import type { Request, Response } from 'express';
import prisma from '../config/database';

const UUID_PATTERN = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type DepartProgrammeRow = {
  id: string;
  company_id: string;
  gare_id: string;
  destination_id: string;
  horaire_id: string;
  date_depart: string;
  heure_depart: string;
  statut: string;
  numero_bus_snapshot: string | null;
  capacite_snapshot: number;
};

type HorairePrevisionnelRow = {
  gare_id: string;
  destination_id: string;
  horaire_id: string;
  date_depart: string;
  heure_depart: string;
  destination: string;
  tarif_fcfa: number;
  statut: 'PREVU_NON_CONFIRME';
};

function validIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
}

function queryString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * GET /api/tickets/departs-programmes
 * Requis : companyId (UUID), date (YYYY-MM-DD)
 * Optionnels : gareDepartId (UUID), destinationId (UUID)
 *
 * Catalogue uniquement : aucune disponibilité de siège garantie,
 * aucune réservation, aucun paiement et aucun billet émis.
 */
export async function getDepartsProgrammes(
  req: Request,
  res: Response,
): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  // Ne pas ignorer silencieusement des paramètres répétés / objets.
  const values = [
    req.query.companyId,
    req.query.date,
    req.query.gareDepartId,
    req.query.destinationId,
  ];
  if (values.some((value) => value !== undefined && typeof value !== 'string')) {
    res.status(400).json({ error: 'Paramètres de recherche invalides.' });
    return;
  }

  const companyId = queryString(req.query.companyId);
  const date = queryString(req.query.date);
  const gareDepartId = queryString(req.query.gareDepartId);
  const destinationId = queryString(req.query.destinationId);

  if (!UUID_PATTERN.test(companyId) || !validIsoDate(date) ||
      (gareDepartId !== '' && !UUID_PATTERN.test(gareDepartId)) ||
      (destinationId !== '' && !UUID_PATTERN.test(destinationId))) {
    res.status(400).json({
      error: 'companyId (UUID) et date (YYYY-MM-DD) requis ; gareDepartId et destinationId doivent être des UUID valides lorsqu’ils sont fournis.',
    });
    return;
  }

  try {
    const departs = await prisma.$queryRaw<DepartProgrammeRow[]>`
      SELECT
        a.id::text AS id,
        a.company_id::text AS company_id,
        a.gare_id::text AS gare_id,
        a.destination_id::text AS destination_id,
        a.horaire_id::text AS horaire_id,
        a.date_depart::text AS date_depart,
        to_char(h.heure_depart::time, 'HH24:MI') AS heure_depart,
        a.statut::text AS statut,
        a.numero_bus_snapshot::text AS numero_bus_snapshot,
        a.capacite_snapshot::integer AS capacite_snapshot
      FROM public.messay_bus_affectations AS a
      INNER JOIN public.companies AS c
        ON c.id = a.company_id
      INNER JOIN public.gares AS g
        ON g.id = a.gare_id
        AND g.company_id = a.company_id
      INNER JOIN public.destinations AS d
        ON d.id = a.destination_id
        AND d.company_id = a.company_id
        AND d.gare_depart_id = a.gare_id
        AND d.publie IS TRUE
      INNER JOIN public.horaires AS h
        ON h.id = a.horaire_id
        AND h.destination_id = d.id
      INNER JOIN public.messay_bus_vehicules AS b
        ON b.id = a.bus_id
        AND b.company_id = a.company_id
      WHERE a.company_id = ${companyId}::uuid
        AND a.date_depart = ${date}::date
        AND (${gareDepartId || null}::uuid IS NULL OR a.gare_id = ${gareDepartId || null}::uuid)
        AND (${destinationId || null}::uuid IS NULL OR a.destination_id = ${destinationId || null}::uuid)
        AND c.is_active IS TRUE
        AND c.is_verified IS TRUE
        AND UPPER(a.statut::text) IN ('PROGRAMME', 'PROGRAMMEE')
        AND UPPER(b.statut::text) = 'DISPONIBLE'
        AND NULLIF(BTRIM(COALESCE(b.marque, '')), '') IS NOT NULL
        AND UPPER(BTRIM(COALESCE(b.marque, ''))) NOT IN ('TEST', 'DEMO', 'FICTIF')
        AND UPPER(BTRIM(COALESCE(b.modele, ''))) NOT IN ('TEST', 'DEMO', 'FICTIF')
        AND NULLIF(BTRIM(COALESCE(b.immatriculation, '')), '') IS NOT NULL
        AND NULLIF(BTRIM(COALESCE(a.immatriculation_snapshot, '')), '') IS NOT NULL
        AND a.capacite_snapshot BETWEEN 1 AND 120
        AND b.capacite BETWEEN 1 AND 120
        AND a.capacite_snapshot = b.capacite
        AND (
          a.date_depart > (NOW() AT TIME ZONE 'Africa/Abidjan')::date
          OR (
            a.date_depart = (NOW() AT TIME ZONE 'Africa/Abidjan')::date
            AND h.heure_depart::time > (NOW() AT TIME ZONE 'Africa/Abidjan')::time
          )
        )
      ORDER BY h.heure_depart::time, a.id
      LIMIT 300
    `;

    // Horaires publiés sans affectation de bus confirmée.
    // Consultation uniquement : jamais réservables ni payables.
    const horaires_previsionnels =
      await prisma.$queryRaw<HorairePrevisionnelRow[]>`
        SELECT
          g.id::text AS gare_id,
          d.id::text AS destination_id,
          h.id::text AS horaire_id,
          ${date}::date::text AS date_depart,
          to_char(h.heure_depart::time, 'HH24:MI') AS heure_depart,
          d.ville::text AS destination,
          d.prix::integer AS tarif_fcfa,
          'PREVU_NON_CONFIRME'::text AS statut
        FROM public.destinations AS d
        INNER JOIN public.gares AS g
          ON g.id = d.gare_depart_id
          AND g.company_id = d.company_id
        INNER JOIN public.horaires AS h
          ON h.destination_id = d.id
        INNER JOIN public.companies AS c
          ON c.id = d.company_id
        WHERE d.company_id = ${companyId}::uuid
          AND d.publie IS TRUE
          AND c.is_active IS TRUE
          AND c.is_verified IS TRUE
          AND (${gareDepartId || null}::uuid IS NULL
               OR g.id = ${gareDepartId || null}::uuid)
          AND (${destinationId || null}::uuid IS NULL
               OR d.id = ${destinationId || null}::uuid)
          AND (
            ${date}::date > (NOW() AT TIME ZONE 'Africa/Abidjan')::date
            OR (
              ${date}::date = (NOW() AT TIME ZONE 'Africa/Abidjan')::date
              AND h.heure_depart::time >
                (NOW() AT TIME ZONE 'Africa/Abidjan')::time
            )
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.messay_bus_affectations AS a
            WHERE a.company_id = d.company_id
              AND a.gare_id = g.id
              AND a.destination_id = d.id
              AND a.horaire_id = h.id
              AND a.date_depart = ${date}::date
              AND UPPER(a.statut::text) IN ('PROGRAMME', 'PROGRAMMEE')
          )
        ORDER BY h.heure_depart::time, d.ville
        LIMIT 300
      `;

    res.status(200).json({
      departs,
      horaires_previsionnels,
      disponibilite_confirmee: false,
      paiement_actif: false,
      billet_emis: false,
    });
  } catch (error: unknown) {
    console.error('[MESSAY/DEPARTS/LECTURE]', error);
    res.status(503).json({
      error: 'Catalogue des départs momentanément indisponible.',
    });
  }
}
