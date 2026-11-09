
import type { Request, Response } from 'express';
import prisma from '../config/database';

const UUID_PATTERN =
  /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;

type ProgrammeRow = {
  destinationId: string;
  horaireId: string;
  villeDepart: string;
  villeArrivee: string;
  gareDepart: string | null;
  gareArrivee: string | null;
  heureDepart: string;
  prix: number | null;
  duree: string | null;
};

type LigneProgramme = {
  destinationId: string;
  villeDepart: string;
  villeArrivee: string;
  gareDepart: string | null;
  gareArrivee: string | null;
  prix: number | null;
  duree: string | null;
  horaires: {
    horaireId: string;
    heureDepart: string;
  }[];
};

type CompagnieSuggestion = {
  id: string;
  nom: string;
  logoUrl: string | null;
  correspondance: 'MEME_TRAJET' | 'MEME_DEPART';
};

function getString(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

/**
 * MESSAY — Programmes de lignes interurbaines
 *
 * GET /api/tickets/programmes-lignes
 *
 * Requête publique en lecture seule.
 *
 * Les horaires sont indicatifs :
 * aucun bus, siège ou départ n'est garanti.
 */
export async function getProgrammesLignes(
  req: Request,
  res: Response
): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  const companyId = getString(req.query.companyId);

  if (!UUID_PATTERN.test(companyId)) {
    res.status(400).json({
      error: 'companyId UUID requis.',
    });
    return;
  }

  try {
    const programmes =
      await prisma.$queryRaw<ProgrammeRow[]>`
        SELECT
          d.id::text AS "destinationId",
          h.id::text AS "horaireId",

          COALESCE(
            NULLIF(BTRIM(d.ville_depart), ''),
            NULLIF(BTRIM(gd.ville), ''),
            ''
          ) AS "villeDepart",

          COALESCE(
            NULLIF(BTRIM(d.ville), ''),
            NULLIF(BTRIM(ga.ville), ''),
            ''
          ) AS "villeArrivee",

          gd.nom AS "gareDepart",
          ga.nom AS "gareArrivee",

          to_char(
            h.heure_depart::time,
            'HH24:MI'
          ) AS "heureDepart",

          d.prix::integer AS prix,
          d.duree::text AS duree

        FROM public.destinations d

        INNER JOIN public.horaires h
          ON h.destination_id = d.id

        LEFT JOIN public.gares gd
          ON gd.id = COALESCE(
            d.gare_depart_id,
            d.gare_id
          )
          AND gd.company_id = d.company_id

        LEFT JOIN public.gares ga
          ON ga.id = d.gare_arrivee_id
          AND ga.company_id = d.company_id

        WHERE d.company_id = ${companyId}::uuid
          AND d.publie IS TRUE

        ORDER BY
          "villeDepart",
          "villeArrivee",
          h.heure_depart::time,
          h.id

        LIMIT 300
      `;

    // Regroupement des horaires par ligne.
    // Évite d'afficher une carte par horaire.
    const lignesMap = new Map<
      string,
      LigneProgramme
    >();

    for (const programme of programmes) {
      let ligne = lignesMap.get(
        programme.destinationId
      );

      if (!ligne) {
        ligne = {
          destinationId: programme.destinationId,
          villeDepart: programme.villeDepart,
          villeArrivee: programme.villeArrivee,
          gareDepart: programme.gareDepart,
          gareArrivee: programme.gareArrivee,
          prix: programme.prix,
          duree: programme.duree,
          horaires: [],
        };

        lignesMap.set(
          programme.destinationId,
          ligne
        );
      }

      ligne.horaires.push({
        horaireId: programme.horaireId,
        heureDepart: programme.heureDepart,
      });
    }

    res.status(200).json({
      // Format conservé pour la compatibilité.
      programmes,

      // Format recommandé pour l'interface mobile.
      lignes: Array.from(lignesMap.values()),

      disponibiliteConfirmee: false,
      reservationActive: false,
      paiementActif: false,
      billetEmis: false,

      message:
        'Horaires publiés à titre informatif. ' +
        'Aucun bus ni siège garanti.',
    });
  } catch (error: unknown) {
    console.error(
      '[MESSAY/PROGRAMMES/LIGNES]',
      error
    );

    res.status(503).json({
      error:
        'Programmes des lignes indisponibles.',
    });
  }
}

/**
 * MESSAY — Suggestions de compagnies
 *
 * GET /api/tickets/compagnies-suggestions
 *
 * Critères :
 * 1. Même trajet publié
 * 2. Autre trajet depuis la même ville
 * 3. Maximum 4 compagnies distinctes
 *
 * Exclut la compagnie sélectionnée.
 * Ne garantit aucune disponibilité à une date.
 */
export async function getCompagniesSuggestions(
  req: Request,
  res: Response
): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  const companyId = getString(req.query.companyId);
  const villeDepart = getString(
    req.query.villeDepart
  );
  const villeArrivee = getString(
    req.query.villeArrivee
  );

  if (
    !UUID_PATTERN.test(companyId) ||
    villeDepart.length < 2 ||
    villeDepart.length > 80 ||
    villeArrivee.length < 2 ||
    villeArrivee.length > 80
  ) {
    res.status(400).json({
      error:
        'companyId, villeDepart et villeArrivee invalides.',
    });
    return;
  }

  try {
    const suggestions =
      await prisma.$queryRaw<CompagnieSuggestion[]>`
        WITH lignes AS (
          SELECT
            d.company_id,

            COALESCE(
              NULLIF(BTRIM(d.ville_depart), ''),
              NULLIF(BTRIM(gd.ville), ''),
              ''
            ) AS depart,

            COALESCE(
              NULLIF(BTRIM(d.ville), ''),
              NULLIF(BTRIM(ga.ville), ''),
              ''
            ) AS arrivee

          FROM public.destinations d

          LEFT JOIN public.gares gd
            ON gd.id = COALESCE(
              d.gare_depart_id,
              d.gare_id
            )
            AND gd.company_id = d.company_id

          LEFT JOIN public.gares ga
            ON ga.id = d.gare_arrivee_id
            AND ga.company_id = d.company_id

          WHERE d.publie IS TRUE
            AND d.company_id <> ${companyId}::uuid

            AND EXISTS (
              SELECT 1
              FROM public.horaires h
              WHERE h.destination_id = d.id
            )
        ),

        scores AS (
          SELECT
            company_id,

            MAX(
              CASE
                WHEN LOWER(BTRIM(depart)) =
                     LOWER(${villeDepart})
                 AND LOWER(BTRIM(arrivee)) =
                     LOWER(${villeArrivee})
                  THEN 2

                WHEN LOWER(BTRIM(depart)) =
                     LOWER(${villeDepart})
                  THEN 1

                ELSE 0
              END
            ) AS priorite

          FROM lignes
          GROUP BY company_id
        ),

        compagnies AS (
          SELECT
            c.id,

            COALESCE(
              NULLIF(
                BTRIM(to_jsonb(c)->>'nom'),
                ''
              ),
              NULLIF(
                BTRIM(to_jsonb(c)->>'name'),
                ''
              ),
              NULLIF(
                BTRIM(to_jsonb(c)->>'raison_sociale'),
                ''
              )
            ) AS nom,

            NULLIF(
              BTRIM(to_jsonb(c)->>'logo_url'),
              ''
            ) AS logo_url

          FROM public.companies c
        )

        SELECT
          c.id::text AS id,
          c.nom AS nom,
          c.logo_url AS "logoUrl",

          CASE
            WHEN s.priorite = 2
              THEN 'MEME_TRAJET'
            ELSE 'MEME_DEPART'
          END AS correspondance

        FROM scores s

        INNER JOIN compagnies c
          ON c.id = s.company_id

        WHERE s.priorite > 0
          AND c.nom IS NOT NULL

        ORDER BY
          s.priorite DESC,
          c.nom ASC

        LIMIT 4
      `;

    res.status(200).json({
      suggestions,
      reservationActive: false,
      paiementActif: false,
    });
  } catch (error: unknown) {
    console.error(
      '[MESSAY/COMPAGNIES/SUGGESTIONS]',
      error
    );

    res.status(503).json({
      error:
        'Suggestions de compagnies indisponibles.',
    });
  }
}
