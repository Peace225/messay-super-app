
import * as admin from 'firebase-admin';

let firebaseInitialized = admin.apps.length > 0;

const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ?.replace(/\\n/g, '\n');

if (!firebaseInitialized) {
  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      '⚠️ Firebase Admin non configuré : identifiants manquants'
    );
  } else {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });

      firebaseInitialized = true;

      console.log('✅ Firebase Admin initialisé');
    } catch (error: unknown) {
      console.error(
        '[FIREBASE] Initialisation impossible :',
        error instanceof Error
          ? error.message
          : 'Erreur inconnue'
      );
    }
  }
}

interface MissionNotification {
  id: string | number;
  destination?: string;
  materiau?: string;
}

export const notificationService = {
  sendToDriver: async (
    deviceToken: string,
    orderData: MissionNotification
  ): Promise<boolean> => {
    if (!firebaseInitialized) {
      console.warn(
        '[FIREBASE] Notification ignorée : service indisponible'
      );
      return false;
    }

    if (!deviceToken?.trim() || orderData?.id == null) {
      console.warn(
        '[FIREBASE] Token ou données de mission invalides'
      );
      return false;
    }

    // Les tokens Expo ne peuvent pas être envoyés
    // directement à Firebase Cloud Messaging.
    if (/^(ExpoPushToken|ExponentPushToken)\[/.test(deviceToken)) {
      console.warn(
        '[FIREBASE] Token Expo reçu : utiliser Expo Push Service'
      );
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        token: deviceToken,
        notification: {
          title: '🚚 Nouvelle Mission MESSAY !',
          body: `Course vers ${
            orderData.destination || 'destination inconnue'
          } pour du ${
            orderData.materiau || 'chargement'
          }.`,
        },
        data: {
          orderId: String(orderData.id),
          type: 'NEW_ASSIGNMENT',
        },
      };

      const response = await admin.messaging().send(message);

      console.log('✅ Notification Firebase envoyée:', response);

      return true;
    } catch (error: unknown) {
      console.error(
        '[FIREBASE] Échec envoi notification :',
        error instanceof Error
          ? error.message
          : 'Erreur inconnue'
      );
      return false;
    }
  },
};
