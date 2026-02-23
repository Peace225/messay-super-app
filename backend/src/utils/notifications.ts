import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import prisma from '../config/database';

const expo = new Expo();

/**
 * Envoyer une push notification à un utilisateur
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: any
): Promise<void> {
  try {
    // Récupérer le token push de l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: userId },
      // select: { pushToken: true }, // Décommenter après avoir ajouté le champ
    });

    // if (!user?.pushToken) {
    //   console.log('Pas de token push pour l\'utilisateur:', userId);
    //   return;
    // }

    // Simuler l'envoi pour le moment
    console.log(`📱 Push notification envoyée à ${userId}:`, title, body);

    // Code réel pour envoyer la notification (décommenter après configuration)
    /*
    const messages: ExpoPushMessage[] = [{
      to: user.pushToken,
      sound: 'default',
      title,
      body,
      data,
    }];

    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Erreur envoi push notification:', error);
      }
    }
    */
  } catch (error) {
    console.error('Erreur sendPushNotification:', error);
  }
}

/**
 * Envoyer une notification de rappel de départ
 */
export async function sendDepartReminder(userId: string, compagnie: string, heureDepart: string): Promise<void> {
  await sendPushNotification(
    userId,
    '🚌 Rappel de départ',
    `Votre bus ${compagnie} part à ${heureDepart}. Soyez à l'heure !`
  );
}

/**
 * Envoyer une notification de confirmation de commande
 */
export async function sendCommandeConfirmation(userId: string, type: string): Promise<void> {
  await sendPushNotification(
    userId,
    '✅ Commande confirmée',
    `Votre commande ${type} a été confirmée avec succès.`
  );
}

/**
 * Envoyer une notification de conducteur arrivé
 */
export async function sendConducteurArrive(userId: string, conducteurNom: string): Promise<void> {
  await sendPushNotification(
    userId,
    '🚗 Conducteur arrivé',
    `${conducteurNom} est arrivé à votre position.`
  );
}

/**
 * Envoyer une notification de livraison proche
 */
export async function sendLivraisonProche(userId: string, eta: string): Promise<void> {
  await sendPushNotification(
    userId,
    '🚛 Livraison proche',
    `Votre livraison arrivera dans ${eta} minutes.`
  );
}
