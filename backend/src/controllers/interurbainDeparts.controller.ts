
import type { Request, Response } from 'express';
import prisma from '../config/database';

const UUID_PATTERN =
  /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;

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

function validIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;

  const parsed = new Date(`${value}T12:00:00.000Z`);

  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

/**
 * MESSAY MOBILE <-> MESSAY PRO
 *
 * GET /api/tickets/departs-programmes
 *
 * Paramètres :
 * - companyId : UUID de la compagnie
 * - date : YYYY-MM-DD
 *
 * Retourne uniquement les départs réellement
 * programmés avec un bus affecté.
 *
 * Lecture seule :
 * - Aucun billet créé
 * - Aucun paiement
 * - Aucun siège bloqué
 */
export async function getDepartsProgrammes(
  req: Request,
  res: Response,
): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  const companyId =
    typeof req.query.companyId === 'string'
      ? req.query.companyId.trim()
      : '';

  const date =
    typeof req.query.date === 'string'
      ? req.query.date.trim()
      : '';

  // 1. Validation des paramètres
  if (
    !UUID_PATTERN.test(companyId) ||
    !validIsoDate(date)
  ) {
    res.status(400).json({
      error:
        'companyId (UUID) et date (YYYY-MM-DD) requis.',
    });
    return;
  }

  try {
    /**
     * 2. Recherche des départs réellement programmés.
     *
     * On relie chaque affectation au véritable
     * horaire publié par la compagnie.
     *
     * Les départs passés sont exclus selon
     * le fuseau horaire Africa/Abidjan.
     *
     * Requête paramétrée, exclusivement SELECT.
     */
    const departs =
      await prisma.$queryRaw<DepartProgrammeRow[]>`
        SELECT
          a.id::text AS id,
          a.company_id::text AS company_id,
          a.gare_id::text AS gare_id,
          a.destination_id::text AS destination_id,
          a.horaire_id::text AS horaire_id,
          a.date_depart::text AS date_depart,

          to_char(
            h.heure_depart::time,
            'HH24:MI'
          ) AS heure_depart,

          a.statut::text AS statut,

          a.numero_bus_snapshot::text
            AS numero_bus_snapshot,

          a.capacite_snapshot::integer
            AS capacite_snapshot

        FROM public.messay_bus_affectations a

        INNER JOIN public.companies c
          ON c.id = a.company_id

        INNER JOIN public.destinations d
          ON d.id = a.destination_id
          AND d.company_id = a.company_id
          AND d.publie IS TRUE

        INNER JOIN public.horaires h
          ON h.id = a.horaire_id
          AND h.destination_id = a.destination_id

        WHERE a.company_id = ${companyId}::uuid

          AND a.date_depart = ${date}::date

          AND UPPER(a.statut::text) IN (
            'PROGRAMME',
            'PROGRAMMEE'
          )

          AND a.capacite_snapshot
            BETWEEN 1 AND 120

          AND (
            a.date_depart >
              (
                now() AT TIME ZONE 'Africa/Abidjan'
              )::date

            OR (
              a.date_depart =
                (
                  now() AT TIME ZONE 'Africa/Abidjan'
                )::date

              AND h.heure_depart::time >
                (
                  now() AT TIME ZONE 'Africa/Abidjan'
                )::time
            )
          )

        ORDER BY
          h.heure_depart::time,
          a.id

        LIMIT 300
      `;

    // 3. Réponse destinée à l'application mobile
    res.status(200).json({
      departs,

      // Inventaire provisoire :
      // aucune vente autorisée.
      disponibilite_confirmee: false,
      paiement_actif: false,
      billet_emis: false,
    });
  } catch (error: unknown) {
    console.error(
      '[MESSAY/DEPARTS/LECTURE]',
      error,
    );

    res.status(503).json({
      error:
        'Catalogue des départs momentanément indisponible.',
    });
  }
}
