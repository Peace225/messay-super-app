/**
 * Route passager, non montée automatiquement.
 * Monter seulement après la vérification de l'auth et des migrations.
 * GET /api/interurbain/billets/:ticketId/qr
 */
import { Router, type Request, type Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { lireQRCodeBilletPassager } from '../services/messayBilletQrPassager.service';
import { lireNouveauxBilletsEmis } from '../services/messayNouveauxBilletsLecture.service';

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export function creerRouterBilletQrPassager(db: PrismaClient): Router {
  const router = Router();
  // GET /api/interurbain/billets : liste des titres reellement emis,
  // uniquement pour le compte du JWT MESSAY; ne renvoie jamais qr_code.
  router.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Pragma', 'no-cache');
    res.vary('Authorization');
    if (process.env.MESSAY_INTERURBAIN_QR_ENABLED !== 'true') {
      res.status(503).json({ code: 'MESSAY_QR_DESACTIVE' });
      return;
    }
    const actorId: unknown = req.user?.id;
    if (typeof actorId !== 'string' || !UUID.test(actorId)) {
      res.status(401).json({ code: 'MESSAY_IDENTITE_INVALIDE' });
      return;
    }
    try {
      const billets = await lireNouveauxBilletsEmis(db, actorId, 100);
      res.status(200).json({ billets });
    } catch {
      res.status(503).json({ code: 'MESSAY_BILLETS_LECTURE_INDISPONIBLE' });
    }
  });
  router.get('/:ticketId/qr', authenticate, async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Pragma', 'no-cache');
    res.vary('Authorization');
    if (process.env.MESSAY_INTERURBAIN_QR_ENABLED !== 'true') {
      res.status(503).json({ code: 'MESSAY_QR_DESACTIVE' });
      return;
    }
    const actorId: unknown = req.user?.id;
    const ticketId: unknown = req.params.ticketId;
    if (typeof actorId !== 'string' || !UUID.test(actorId)) {
      res.status(401).json({ code: 'MESSAY_IDENTITE_INVALIDE' });
      return;
    }
    if (typeof ticketId !== 'string' || !UUID.test(ticketId)) {
      res.status(400).json({ code: 'MESSAY_BILLET_ID_INVALIDE' });
      return;
    }
    try {
      const item = await lireQRCodeBilletPassager(db, actorId, ticketId);
      if (!item) {
        // Ne jamais révéler si un billet existe pour un autre utilisateur.
        res.status(404).json({ code: 'MESSAY_BILLET_NON_DISPONIBLE' });
        return;
      }
      res.status(200).json(item);
    } catch {
      res.status(503).json({ code: 'MESSAY_QR_LECTURE_INDISPONIBLE' });
    }
  });
  return router;
}
