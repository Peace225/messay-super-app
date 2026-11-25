/**
 * MESSAY — lecture du QR d'un billet interurbain réellement émis.
 * AUCUNE génération supplémentaire, aucune mutation et aucun siège attribué.
 * Le JWT MESSAY est vérifié par authenticate au niveau de la route.
 */
import { Prisma, type PrismaClient } from '@prisma/client';
import { lireNouveauBilletEmisParId } from './messayNouveauxBilletsLecture.service';
import { billetQrPayload } from './messayBilletQrFormat';

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

type QrRow = { qr_code: string | null };

export async function lireQRCodeBilletPassager(
  db: PrismaClient,
  actorUserId: string,
  ticketId: string,
) {
  if (!UUID.test(actorUserId) || !UUID.test(ticketId)) {
    throw new Error('MESSAY_BILLET_QR_PARAMETRES_INVALIDES');
  }
  // Réutiliser le contrat déjà audité de lecture des billets de l'acteur.
  const billet = await lireNouveauBilletEmisParId(db, actorUserId, ticketId);
  if (!billet) return null;

  // Relecture indépendante des garanties essentielles : un changement d'état
  // survenu entre les requêtes ne doit jamais exposer un QR révoqué.
  const rows = await db.$queryRaw<QrRow[]>(Prisma.sql`
    SELECT t.qr_code
    FROM public.tickets AS t
    JOIN public.messay_interurbain_payment_intents AS i
      ON i.id=t.intent_id
     AND i.ticket_id=t.id::text
     AND i.company_id=t.company_id
     AND i.affectation_id=t.affectation_id
     AND i.hold_id=t.hold_id
     AND i.amount_xof=t.price_paid::bigint
    JOIN public.messay_bus_sieges_reservations AS h
      ON h.id=i.hold_id
     AND h.company_id=i.company_id
     AND h.affectation_id=i.affectation_id
     AND h.actor_user_id=i.actor_user_id
     AND h.request_id=i.request_id
    WHERE t.id=CAST(${ticketId} AS uuid)
      AND i.actor_user_id=CAST(${actorUserId} AS uuid)
      AND i.financial_status='SUCCEEDED'
      AND i.issuance_status='ISSUED'
      AND h.statut='CONFIRMEE'
      AND t.status='PAYE'
    LIMIT 2
  `);
  if (rows.length === 0) return null;
  if (rows.length !== 1 || typeof rows[0].qr_code !== 'string') {
    throw new Error('MESSAY_BILLET_QR_INCOHERENT');
  }
  const qrPayload = billetQrPayload(rows[0].qr_code);
  return {
    ...billet,
    qrPayload,
  };
}
