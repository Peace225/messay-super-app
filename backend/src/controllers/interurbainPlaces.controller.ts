
import type { Request, Response } from 'express';
import prisma from '../config/database';

const UUID_PATTERN =
  /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;

const CAPACITE_MAX = 120;

type DepartInventoryRow = {
  id: string;
  date_depart: string;
  capacite_snapshot: number;
  statut: string;
  sieges_occupes: unknown;
};

type PlaceInterurbaine = {
  numero: number;
  occupe_registre_v1: boolean;
};

/**
 * MESSAY MOBILE <-> MESSAY PRO
 *
 * GET /api/tickets/departs/:affectationId/places
 *
 * Inventaire provisoire en lecture seule.
 *
 * - Aucun billet créé
 * - Aucun siège bloqué
 * - Aucun paiement déclenché
 * - Aucune donnée modifiée
 *
 * IMPORTANT :
 * Les anciens billets mobiles ne sont pas encore
 * rapprochés avec le registre MESSAY PRO.
 */
export async function getInterurbainPlaces(
  req: Request,
  res: Response,
): Promise<void> {
  res.setHeader('Cache-Control', 'private, no-store');

  // 1. Authentification utilisateur
  const userId = req.user?.id;

  if (typeof userId !== 'string' || !userId.trim()) {
    res.status(401).json({
      error: 'Connexion requise.',
    });
    return;
  }

  // 2. Validation de l'identifiant du départ
  const affectationId = String(
    req.params.affectationId ?? '',
  ).trim();

  if (!UUID_PATTERN.test(affectationId)) {
    res.status(400).json({
      error: 'Identifiant de départ invalide.',
    });
    return;
  }

  try {
    // 3. Vérifier le compte utilisateur
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isBlocked: true,
      },
    });

    if (!user) {
      res.status(401).json({
        error: 'Compte utilisateur introuvable.',
      });
      return;
    }

    if (user.isBlocked) {
      res.status(403).json({
        error: 'Ce compte utilisateur est bloqué.',
      });
      return;
    }

    /**
     * 4. Lire l'inventaire PostgreSQL MESSAY PRO.
     *
     * Une seule requête SQL paramétrée :
     * - évite l'injection SQL ;
     * - lit un état cohérent à cet instant ;
     * - ne modifie aucune table.
     *
     * Seuls les départs PROGRAMME / PROGRAMMEE
     * dont la date n'est pas passée sont visibles.
     */
    const rows =
      await prisma.$queryRaw<DepartInventoryRow[]>`
        SELECT
          a.id::text AS id,
          a.date_depart::text AS date_depart,
          a.capacite_snapshot::integer
            AS capacite_snapshot,
          a.statut::text AS statut,

          COALESCE(
            (
              SELECT jsonb_agg(
                s.siege_numero
                ORDER BY s.siege_numero
              )
              FROM public.messay_bus_sieges_reservations s
              WHERE s.affectation_id = a.id
                AND (
                  s.statut = 'CONFIRMEE'
                  OR (
                    s.statut = 'EN_ATTENTE'
                    AND s.expire_le > now()
                  )
                )
            ),
            '[]'::jsonb
          ) AS sieges_occupes

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

        WHERE a.id = ${affectationId}::uuid

          AND UPPER(a.statut::text) IN (
            'PROGRAMME',
            'PROGRAMMEE'
          )

          AND (
            a.date_depart >
              (now() AT TIME ZONE 'Africa/Abidjan')::date

            OR (
              a.date_depart =
                (now() AT TIME ZONE 'Africa/Abidjan')::date

              AND h.heure_depart::time >
                (now() AT TIME ZONE 'Africa/Abidjan')::time
            )
          )

        LIMIT 1
      `;

    // 5. Départ inexistant ou non accessible
    const depart = rows[0];

    if (!depart) {
      res.status(404).json({
        error:
          'Départ introuvable, non programmé ou date dépassée.',
      });
      return;
    }

    // 6. Vérifier la capacité du bus
    const capacite = Number(depart.capacite_snapshot);

    if (
      !Number.isInteger(capacite) ||
      capacite < 1 ||
      capacite > CAPACITE_MAX
    ) {
      res.status(503).json({
        error:
          'Capacité du bus invalide. Vérification administrative requise.',
      });
      return;
    }

    // 7. Contrôler le résultat du registre
    if (!Array.isArray(depart.sieges_occupes)) {
      res.status(503).json({
        error: 'Inventaire des sièges invalide.',
      });
      return;
    }

    const numeros: unknown[] =
      depart.sieges_occupes;

    // 8. Vérifier chaque numéro de siège
    const numerosValides = numeros.every(
      (value) =>
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 1 &&
        value <= capacite,
    );

    if (!numerosValides) {
      res.status(503).json({
        error:
          'Numérotation des sièges incohérente.',
      });
      return;
    }

    const occupes = new Set<number>(
      numeros as number[],
    );

    // 9. Rejeter les doublons et les dépassements
    if (
      occupes.size !== numeros.length ||
      occupes.size > capacite
    ) {
      res.status(503).json({
        error:
          'Inventaire des sièges incohérent. Vérification requise.',
      });
      return;
    }

    // 10. Construire le plan provisoire
    const places: PlaceInterurbaine[] =
      Array.from(
        { length: capacite },
        (_, index) => {
          const numero = index + 1;

          return {
            numero,
            occupe_registre_v1:
              occupes.has(numero),
          };
        },
      );

    // 11. Réponse sécurisée pour le mobile
    res.status(200).json({
      success: true,

      affectation_id: depart.id,
      date_depart: depart.date_depart,
      statut_depart: depart.statut,

      capacite,

      places_occupees_registre_v1:
        occupes.size,

      places_libres_registre_v1:
        capacite - occupes.size,

      places,

      // Sécurité : aucune disponibilité commerciale.
      disponibilite_confirmee: false,
      inventaire_legacy_non_reconcilie: true,

      reservation_active: false,
      paiement_actif: false,
      billet_emis: false,

      avertissement:
        'Inventaire provisoire MESSAY PRO : les anciens billets mobiles ne sont pas encore rapprochés. Les places non occupées dans ce registre ne sont pas nécessairement disponibles à la vente. Réservation et paiement désactivés.',
    });

  } catch (error: unknown) {
    console.error(
      '[MESSAY/INTERURBAIN/PLACES]',
      error,
    );

    res.status(503).json({
      success: false,
      error:
        'Inventaire des sièges temporairement indisponible.',
    });
  }
}
