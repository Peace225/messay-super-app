/**
 * Vérification LECTURE SEULE d'un QR au niveau d'une compagnie.
 * IMPORTANT : l'appelant doit avoir DÉJÀ autorisé l'agent pour la compagnie
 * et la gare à partir du JWT côté serveur. Ne pas exposer en route publique.
 * Ce service NE valide PAS l'embarquement et NE marque PAS le QR comme utilisé.
 */
import { Prisma, type PrismaClient } from '@prisma/client';
import { lireBilletQrPayload } from './messayBilletQrFormat';

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export type BilletQrControle = Readonly<{
  id: string;
  companyId: string;
  affectationId: string;
  passager: string;
  dateDepart: string;
  statut: 'PAYE';
}>;

export async function verifierBilletQrPourCompagnie(
  db: PrismaClient,
  companyIdAutorisee: string,
  qrPayloadScanne: string,
): Promise<BilletQrControle | null> {
  if (!UUID.test(companyIdAutorisee)) throw new Error('MESSAY_COMPAGNIE_INVALIDE');
  const code = lireBilletQrPayload(qrPayloadScanne);
  const rows = await db.$queryRaw<Array<{
    id: string; companyId: string; affectationId: string;
    passager: string; dateDepart: string; statut: string;
  }>>(Prisma.sql`
    SELECT t.id::text AS id,
           t.company_id::text AS "companyId",
           t.affectation_id::text AS "affectationId",
           t.passenger_name::text AS passager,
           to_char(t.travel_date, 'YYYY-MM-DD') AS "dateDepart",
           t.status::text AS statut
    FROM public.tickets AS t
    JOIN public.messay_interurbain_payment_intents AS i
      ON i.id=t.intent_id
     AND i.company_id=t.company_id
     AND i.affectation_id=t.affectation_id
     AND i.hold_id=t.hold_id
     AND i.ticket_id=t.id::text
     AND i.amount_xof=t.price_paid::bigint
    JOIN public.messay_bus_sieges_reservations AS h
      ON h.id=i.hold_id
     AND h.company_id=i.company_id
     AND h.affectation_id=i.affectation_id
     AND h.actor_user_id=i.actor_user_id
     AND h.request_id=i.request_id
    WHERE t.qr_code=${code}
      AND t.company_id=CAST(${companyIdAutorisee} AS uuid)
      AND i.financial_status='SUCCEEDED'
      AND i.issuance_status='ISSUED'
      AND t.status='PAYE'
      AND h.statut='CONFIRMEE'
    LIMIT 2
  `);
  if (rows.length === 0) return null;
  if (rows.length !== 1) throw new Error('MESSAY_QR_AMBIGU');
  const row = rows[0];
  if (!UUID.test(row.id) || row.companyId !== companyIdAutorisee ||
      !UUID.test(row.affectationId) || !row.passager?.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.dateDepart) || row.statut !== 'PAYE') {
    throw new Error('MESSAY_QR_BILLET_INCOHERENT');
  }
  return { ...row, statut: 'PAYE' };
}
