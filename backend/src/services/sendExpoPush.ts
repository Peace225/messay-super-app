import prisma from '../config/database';

export type ExpoPushResult = Readonly<{
  devices: number;
  accepted: number;
  rejected: number;
}>;

type PushDevice = {
  expo_push_token: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value);
}

/**
 * Envoie uniquement aux appareils actifs du destinataire.
 * accepted = accepté par Expo, PAS livré au téléphone.
 */
export async function notifyMessayUser(
  userId: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<ExpoPushResult> {
  if (!userId.trim() || !title.trim() || !body.trim()) {
    throw new Error('Notification MESSAY invalide');
  }

  const devices = await prisma.$queryRaw<PushDevice[]>`
    SELECT expo_push_token
    FROM public.messay_push_devices
    WHERE user_id = ${userId}
      AND enabled = TRUE
    ORDER BY updated_at DESC
    LIMIT 50
  `;

  if (devices.length === 0) {
    return { devices: 0, accepted: 0, rejected: 0 };
  }

  const messages = devices.map(device => ({
    to: device.expo_push_token,
    sound: 'default',
    title,
    body,
    data,
  }));

  const response = await fetch(
    'https://exp.host/--/api/v2/push/send',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(15000),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Expo Push indisponible (HTTP ${response.status})`
    );
  }

  const payload: unknown = await response.json();

  if (!isRecord(payload) ||
      !Array.isArray(payload.data) ||
      payload.data.length !== devices.length) {
    throw new Error('Réponse Expo Push invalide');
  }

  let accepted = 0;
  let rejected = 0;

  for (let index = 0; index < devices.length; index++) {
    const ticket: unknown = payload.data[index];

    if (!isRecord(ticket)) {
      throw new Error('Ticket Expo Push invalide');
    }

    if (ticket.status === 'ok' &&
        typeof ticket.id === 'string' &&
        ticket.id.length > 0) {
      accepted++;
      continue;
    }

    if (ticket.status !== 'error') {
      throw new Error('Statut du ticket Expo inconnu');
    }

    rejected++;

    const details = isRecord(ticket.details)
      ? ticket.details
      : null;

    if (details?.error === 'DeviceNotRegistered') {
      await prisma.$executeRaw`
        UPDATE public.messay_push_devices
        SET enabled = FALSE,
            updated_at = NOW()
        WHERE user_id = ${userId}
          AND expo_push_token = ${devices[index].expo_push_token}
      `;
    }

    console.warn('[MESSAY/PUSH] Ticket Expo refusé', {
      code: typeof details?.error === 'string'
        ? details.error
        : 'UNKNOWN',
    });
  }

  return {
    devices: devices.length,
    accepted,
    rejected,
  };
}
