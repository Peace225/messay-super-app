/**
 * MESSAY — lecture des billets émis par le nouveau moteur interurbain.
 * Aucune création, mutation, RPC, clé Supabase ou paiement.
 *
 * Identité : l'acteur est un User.id du JWT MESSAY vérifié par authenticate.
 * On le compare à payment_intents.actor_user_id dans la même base Prisma.
 * Ne jamais utiliser tickets.user_id comme substitut : ce champ référence
 * auth.users et peut être NULL jusqu'au rapprochement des identités.
 *
 * Activer uniquement lorsque les migrations Lots 2, 4 et 5 sont validées
 * sur une base distincte et installées de manière contrôlée.
 */
import { Prisma, type PrismaClient } from '@prisma/client';

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

/** Contrat consommé par le service mobile de consultation. */
export type NouveauBilletPassager = Readonly<{
  id: string;
  compagnie: string;
  depart: string;
  destination: string;
  dateDepart: string;
  heureDepart: string;
  statut: string;
  prix: number;
  siegeNumero: number | null;
  siegeAffichage: string | null;
  statutAttributionSiege: 'EN_ATTENTE' | 'ATTRIBUE';
  affectationId: string;
  gareDepart: string | null;
  gareArrivee: null;
  createdAt: Date;
}>;

/**
 * Un billet n'est visible que si :
 *  - l'intention appartient à l'utilisateur courant ;
 *  - la transaction est SUCCEEDED et l'émission ISSUED ;
 *  - le ticket, le hold confirmé et l'affectation concordent en compagnie,
 *    départ, demande, propriétaire et montant ;
 *  - le titre existe réellement et porte le statut PAYE.
 *
 * On n'expose jamais hold.siege_numero (numéro TECHNIQUE).
 * L'attribution commerciale sera rendue lisible seulement après un RPC
 * SQL transactionnel dédié et audité. Jusque-là : EN_ATTENTE.
 */
export async function lireNouveauxBilletsEmis(
  db: PrismaClient,
  userId: string,
  limit: number,
  ticketId?: string,
): Promise<NouveauBilletPassager[]> {
  if (!UUID.test(userId) ||
      !Number.isInteger(limit) || limit < 1 || limit > 100 ||
      (ticketId !== undefined && !UUID.test(ticketId))) {
    throw new Error('MESSAY_LECTURE_BILLETS_PARAMETRES_INVALIDES');
  }

  // Requête paramétrée par Prisma : aucun identifiant de passager transmis
  // par l'application n'entre dans la clause d'appartenance.
  // Utilisation de to_jsonb(d) pour éviter de présumer du nom d'une colonne
  // de ville d'arrivée ; une valeur absente reste « non renseignée ».
  // Tant que la migration Lot 7 n'est pas validée, ne jamais lire son registre.
  const assignedReadEnabled = process.env.MESSAY_SEATS_READ_ENABLED === 'true';

  // Le filtre est paramétré par Prisma et s'ajoute toujours
  // au contrôle d'appartenance actor_user_id du JWT.
  const ticketFilter = ticketId === undefined
    ? Prisma.empty
    : Prisma.sql`AND t.id = CAST(${ticketId} AS uuid)`;
  const rows = await db.$queryRaw<NouveauBilletPassager[]>(Prisma.sql`
    SELECT
      t.id::text AS id,
      btrim(c.name) AS compagnie,
      COALESCE(NULLIF(btrim(g.ville), ''), 'Départ non renseigné') AS depart,
      COALESCE(
        NULLIF(btrim(to_jsonb(d)->>'ville_arrivee'), ''),
        NULLIF(btrim(to_jsonb(d)->>'ville_destination'), ''),
        NULLIF(btrim(to_jsonb(d)->>'destination'), ''),
        NULLIF(btrim(to_jsonb(d)->>'ville'), ''),
        NULLIF(btrim(to_jsonb(d)->>'nom'), ''),
        'Destination non renseignée'
      ) AS destination,
      to_char(a.date_depart, 'YYYY-MM-DD') AS "dateDepart",
      to_char(h.heure_depart, 'HH24:MI') AS "heureDepart",
      t.status::text AS statut,
      t.price_paid::integer AS prix,
      ${assignedReadEnabled ? Prisma.sql`sa.siege_numero` : Prisma.sql`NULL::integer`} AS "siegeNumero",
      ${assignedReadEnabled ? Prisma.sql`sa.siege_numero::text` : Prisma.sql`NULL::text`} AS "siegeAffichage",
      ${assignedReadEnabled ? Prisma.sql`CASE WHEN sa.ticket_id IS NULL THEN 'EN_ATTENTE' ELSE 'ATTRIBUE' END::text` : Prisma.sql`'EN_ATTENTE'::text`} AS "statutAttributionSiege",
      a.id::text AS "affectationId",
      NULLIF(btrim(g.nom), '') AS "gareDepart",
      NULL::text AS "gareArrivee",
      t.created_at AS "createdAt"
    FROM public.messay_interurbain_payment_intents AS i
    JOIN public.tickets AS t
      ON t.intent_id = i.id
     AND t.id::text = i.ticket_id
     AND t.hold_id = i.hold_id
     AND t.affectation_id = i.affectation_id
     AND t.company_id = i.company_id
     AND t.price_paid::bigint = i.amount_xof
    JOIN public.messay_bus_affectations AS a
      ON a.id = i.affectation_id
     AND a.company_id = i.company_id
    JOIN public.messay_bus_sieges_reservations AS r
      ON r.id = i.hold_id
     AND r.company_id = i.company_id
     AND r.affectation_id = i.affectation_id
     AND r.actor_user_id = i.actor_user_id
     AND r.request_id = i.request_id
     AND r.statut = 'CONFIRMEE'
    ${assignedReadEnabled ? Prisma.sql`LEFT JOIN public.messay_interurbain_sieges_attribues AS sa ON sa.ticket_id=t.id
      AND sa.affectation_id=i.affectation_id AND sa.company_id=i.company_id` : Prisma.empty}
    JOIN public.companies AS c ON c.id = i.company_id
    JOIN public.gares AS g
      ON g.id = a.gare_id AND g.company_id = i.company_id
    JOIN public.destinations AS d
      ON d.id = a.destination_id AND d.company_id = i.company_id
    JOIN public.horaires AS h ON h.id = a.horaire_id
    WHERE i.actor_user_id = CAST(${userId} AS uuid)
      ${ticketFilter}
      AND i.financial_status = 'SUCCEEDED'
      AND i.issuance_status = 'ISSUED'
      AND t.status = 'PAYE'
      AND NULLIF(btrim(c.name), '') IS NOT NULL
    ORDER BY i.issued_at DESC NULLS LAST, t.created_at DESC
    LIMIT ${limit}
  `);

  // Fail closed si le contrat SQL a changé : ne jamais afficher un billet
  // dont les champs obligatoires sont invalides ou non déterminés.
  for (const row of rows) {
    if (!UUID.test(row.id) || !UUID.test(row.affectationId) ||
        typeof row.compagnie !== 'string' || !row.compagnie.trim() ||
        typeof row.depart !== 'string' || !row.depart.trim() ||
        typeof row.destination !== 'string' || !row.destination.trim() ||
        typeof row.dateDepart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.dateDepart) ||
        typeof row.heureDepart !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.heureDepart) ||
        row.statut !== 'PAYE' || !Number.isSafeInteger(row.prix) ||
        row.prix < 200 || row.prix > 2_500_000 ||
        !['EN_ATTENTE','ATTRIBUE'].includes(row.statutAttributionSiege) ||
        (row.statutAttributionSiege === 'ATTRIBUE' &&
          (typeof row.siegeNumero !== 'number' || !Number.isInteger(row.siegeNumero) ||
           row.siegeNumero < 1 || row.siegeNumero > 120 ||
           row.siegeAffichage !== String(row.siegeNumero))) ||
        (row.statutAttributionSiege === 'EN_ATTENTE' &&
          (row.siegeNumero !== null || row.siegeAffichage !== null)) ||
        !(row.createdAt instanceof Date) || !Number.isFinite(row.createdAt.getTime())) {
      throw new Error('MESSAY_BILLET_SQL_INCOHERENT');
    }
  }
  return rows;
}


/**
 * Lecture individuelle d'un nouveau billet.
 * L'identité du propriétaire est toujours contrôlée en SQL.
 */
export async function lireNouveauBilletEmisParId(
  db: PrismaClient,
  userId: string,
  ticketId: string,
): Promise<NouveauBilletPassager | null> {
  const billets = await lireNouveauxBilletsEmis(
    db,
    userId,
    1,
    ticketId,
  );

  return billets[0] ?? null;
}
