import { Router, type Request, type Response } from 'express';
import prisma from '../config/database';
import { verifyAccessToken } from '../utils/jwt';

/**
 * MESSAY : registre des appareils, indépendant des conducteurs/tricycles.
 * Les droits sont calculés exclusivement depuis le JWT et la BDD.
 * Migration requise : backend/sql/20261105_messay_push_devices.sql
 */
export const pushDevicesRouter = Router();

const EXPO_TOKEN_RE = /^(ExpoPushToken|ExponentPushToken)\[[^\]\s]{1,240}\]$/;

async function resolveUser(req: Request): Promise<string | null> {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  if (!token) return null;

  try {
    const decoded = verifyAccessToken(token);
    if (!decoded || typeof decoded.userId !== 'string' || !decoded.userId) return null;

    // Ne pas faire confiance au userId/role fourni dans le corps HTTP.
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, isBlocked: true },
    });
    if (!user || user.isBlocked) return null;
    return user.id;
  } catch {
    return null;
  }
}

pushDevicesRouter.post('/devices', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUser(req);
    if (!userId) {
      res.status(401).json({ error: 'Session MESSAY invalide ou expirée' });
      return;
    }

    const { expoPushToken, platform } = req.body ?? {};
    if (
      typeof expoPushToken !== 'string' ||
      !EXPO_TOKEN_RE.test(expoPushToken) ||
      (platform !== 'android' && platform !== 'ios')
    ) {
      res.status(400).json({ error: 'Token Expo ou plateforme invalide' });
      return;
    }

    // Reconnexion sur ce téléphone : le token est réaffecté atomiquement
    // au compte connecté, évitant que l'ancien compte reçoive les alertes.
    await prisma.$executeRaw`
      INSERT INTO public.messay_push_devices
        (user_id, expo_push_token, platform, enabled, created_at, updated_at)
      VALUES
        (${userId}, ${expoPushToken}, ${platform}, TRUE, NOW(), NOW())
      ON CONFLICT (expo_push_token)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        enabled = TRUE,
        updated_at = NOW()
    `;

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[MESSAY/PUSH/REGISTER]', error);
    res.status(500).json({ error: 'Enregistrement push indisponible' });
  }
});

pushDevicesRouter.delete('/devices', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUser(req);
    if (!userId) {
      res.status(401).json({ error: 'Session MESSAY invalide ou expirée' });
      return;
    }

    const expoPushToken = req.body?.expoPushToken;
    if (typeof expoPushToken !== 'string' || !EXPO_TOKEN_RE.test(expoPushToken)) {
      res.status(400).json({ error: 'Token Expo invalide' });
      return;
    }

    await prisma.$executeRaw`
      DELETE FROM public.messay_push_devices
      WHERE user_id = ${userId} AND expo_push_token = ${expoPushToken}
    `;
    res.status(204).send();
  } catch (error) {
    console.error('[MESSAY/PUSH/REVOKE]', error);
    res.status(500).json({ error: 'Révocation push indisponible' });
  }
});
