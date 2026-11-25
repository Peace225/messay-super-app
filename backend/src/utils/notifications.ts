import {
  notifyMessayUser,
  type ExpoPushResult,
} from '../services/sendExpoPush';

/**
 * Envoi réel via Expo Push Service.
 * Une acceptation Expo ne garantit pas la livraison.
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<ExpoPushResult> {
  return notifyMessayUser(userId, title, body, data);
}

export async function sendDepartReminder(
  userId: string,
  compagnie: string,
  heureDepart: string
): Promise<void> {
  await sendPushNotification(
    userId,
    '🚌 Rappel de départ',
    `Votre bus ${compagnie} part à ${heureDepart}. Soyez à l'heure !`
  );
}

export async function sendCommandeConfirmation(
  userId: string,
  type: string
): Promise<void> {
  await sendPushNotification(
    userId,
    '✅ Commande confirmée',
    `Votre commande ${type} a été confirmée avec succès.`
  );
}

export async function sendConducteurArrive(
  userId: string,
  conducteurNom: string
): Promise<void> {
  await sendPushNotification(
    userId,
    '🚗 Conducteur arrivé',
    `${conducteurNom} est arrivé à votre position.`
  );
}

export async function sendLivraisonProche(
  userId: string,
  eta: string
): Promise<void> {
  await sendPushNotification(
    userId,
    '🚛 Livraison proche',
    `Votre livraison arrivera dans ${eta} minutes.`
  );
}
