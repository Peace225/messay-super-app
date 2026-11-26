/**
 * MESSAY E3.2 - routes compagnie, MUST BE MOUNTED AFTER requireMessayCompanyAccess.
 * GET/POST never trusts roles, company or gare supplied by the browser.
 * Disabled unless MESSAY_EMBARQUEMENT_ENABLED=true. No connection to GeniusPay.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { lireBilletQrPayload } from '../services/messayBilletQrFormat';

type Role = 'DIRECTION'|'CHEF_GARE'|'AGENT_EMBARQUEMENT'|'AGENT_BILLETTERIE'|'AGENT_CAISSE'|'AGENT_EXPLOITATION';
type Access = { userId: string; company_id: string; role: Role; gare_ids: string[] };
type ScopedRequest = Request & { messay?: Access };
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export const messayEmbarquementRouter = Router();

function access(req: ScopedRequest, res: Response): { a: Access; gareId: string; code: string } | null {
  res.setHeader('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  if (process.env.MESSAY_EMBARQUEMENT_ENABLED !== 'true') {
    res.status(503).json({ code: 'EMBARQUEMENT_DESACTIVE' }); return null;
  }
  const a = req.messay;
  if (!a || !UUID.test(a.userId) || !UUID.test(a.company_id)) {
    res.status(401).json({ code: 'EMBARQUEMENT_SESSION_INVALIDE' }); return null;
  }
  if (!['DIRECTION','CHEF_GARE','AGENT_EMBARQUEMENT'].includes(a.role)) {
    res.status(403).json({ code: 'EMBARQUEMENT_ROLE_INTERDIT' }); return null;
  }
  const body = req.body as { gareId?: unknown; qrPayload?: unknown } | undefined;
  const gareId = body?.gareId;
  if (typeof gareId !== 'string' || !UUID.test(gareId)) {
    res.status(400).json({ code: 'EMBARQUEMENT_GARE_INVALIDE' }); return null;
  }
  if (a.role !== 'DIRECTION' && !a.gare_ids?.includes(gareId)) {
    res.status(403).json({ code: 'EMBARQUEMENT_GARE_INTERDITE' }); return null;
  }
  try {
    const code = lireBilletQrPayload(body?.qrPayload as string);
    return { a, gareId, code };
  } catch {
    res.status(400).json({ code: 'EMBARQUEMENT_QR_INVALIDE' }); return null;
  }
}

/**
 * Does not write. Company + gare + financial state + departure are revalidated.
 */
messayEmbarquementRouter.post('/embarquement/controle', (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    const context = access(req as ScopedRequest, res); if (!context) return;
    const { a, gareId, code } = context;
    const rows = await prisma.$queryRaw<Array<{
      id: string; passager: string; dateDepart: string; statut: string;
    }>>(Prisma.sql`
      SELECT t.id::text AS id, t.passenger_name::text AS passager,
        to_char(a.date_depart,'YYYY-MM-DD') AS "dateDepart", t.status::text AS statut
      FROM public.tickets t
      JOIN public.messay_interurbain_payment_intents i ON i.id=t.intent_id
        AND i.company_id=t.company_id AND i.affectation_id=t.affectation_id
        AND i.hold_id=t.hold_id AND i.ticket_id=t.id::text
        AND i.amount_xof=t.price_paid::bigint
      JOIN public.messay_bus_affectations a ON a.id=i.affectation_id
        AND a.company_id=i.company_id AND a.gare_id=CAST(${gareId} AS uuid)
      JOIN public.messay_bus_sieges_reservations h ON h.id=i.hold_id
        AND h.company_id=i.company_id AND h.affectation_id=i.affectation_id
        AND h.actor_user_id=i.actor_user_id AND h.request_id=i.request_id
      JOIN public.companies c ON c.id=i.company_id AND c.is_active IS TRUE AND c.is_verified IS TRUE
      JOIN public.gares g ON g.id=a.gare_id AND g.company_id=i.company_id
      WHERE t.qr_code=${code} AND t.company_id=CAST(${a.company_id} AS uuid)
        AND i.financial_status='SUCCEEDED' AND i.issuance_status='ISSUED'
        AND h.statut='CONFIRMEE'
        AND upper(a.statut) IN ('PROGRAMME','PROGRAMMEE')
        AND t.travel_date=a.date_depart
      LIMIT 2
    `);
    if (rows.length !== 1 || !['PAYE','UTILISE'].includes(rows[0].statut)) {
      res.status(404).json({ code: 'EMBARQUEMENT_BILLET_INDISPONIBLE' }); return;
    }
    // This is preview only. Never call it 'boarding validated'.
    res.json({ billetId: rows[0].id, passager: rows[0].passager,
      dateDepart: rows[0].dateDepart, statut: rows[0].statut,
      validationPossible: rows[0].statut === 'PAYE' && rows[0].dateDepart === new Date().toISOString().slice(0,10) });
  })().catch(next);
});

/** Atomically marks UTILISE and creates unique boarding audit via SQL RPC. */
messayEmbarquementRouter.post('/embarquement/confirmer', (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    const context = access(req as ScopedRequest, res); if (!context) return;
    const { a, gareId, code } = context;
    const rows = await prisma.$queryRaw<Array<{
      resultat: string; billet_id: string | null; embarque_le: Date | null;
    }>>(Prisma.sql`
      SELECT resultat, billet_id::text AS billet_id, embarque_le
      FROM public.messay_interurbain_valider_embarquement(
        ${code}, CAST(${a.company_id} AS uuid), CAST(${gareId} AS uuid), CAST(${a.userId} AS uuid)
      )
    `);
    if (rows.length !== 1) { res.status(503).json({ code: 'EMBARQUEMENT_REPONSE_INVALIDE' }); return; }
    const outcome = rows[0];
    if (outcome.resultat === 'EMBARQUEMENT_VALIDE') {
      res.json({ resultat: outcome.resultat, billetId: outcome.billet_id, embarqueLe: outcome.embarque_le }); return;
    }
    if (outcome.resultat === 'DEJA_UTILISE') {
      res.status(409).json({ code: 'DEJA_UTILISE', embarqueLe: outcome.embarque_le }); return;
    }
    res.status(409).json({ code: 'EMBARQUEMENT_REFUSE' });
  })().catch((error: unknown) => {
    // No raw SQL error disclosure. Permissions are checked again inside the SQL function.
    console.error('[MESSAY/E32] erreur validation embarquement',
      error instanceof Error ? error.name : 'UNKNOWN');
    res.status(503).json({ code: 'EMBARQUEMENT_TEMPORAIREMENT_INDISPONIBLE' });
  });
});
