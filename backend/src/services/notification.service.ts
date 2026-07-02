import * as admin from 'firebase-admin';
import path from 'path';

let firebaseInitialized = false;

try {
  const serviceAccountPath = path.resolve(__dirname, '../config/firebase-service-account.json');
  const serviceAccount = require(serviceAccountPath);
  
  if (!admin.apps.length && serviceAccount && Object.keys(serviceAccount).length > 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    firebaseInitialized = true;
    console.log('✅ Firebase initialisé');
  }
} catch (error) {
  console.warn('⚠️ Firebase non configuré - notifications désactivées');
}

export const notificationService = {
  sendToDriver: async (deviceToken: string, orderData: any) => {
    if (!firebaseInitialized) {
      console.log('📵 Notification ignorée (Firebase non configuré)');
      return false;
    }

    const message: admin.messaging.Message = {
      notification: {
        title: '🚚 Nouvelle Mission MESSAY !',
        body: `Course vers ${orderData.destination} pour du ${orderData.materiau || 'chargement'}.`,
      },
      data: {
        orderId: orderData.id.toString(),
        type: 'NEW_ASSIGNMENT',
      },
      token: deviceToken,
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('✅ Push envoyé:', response);
      return true;
    } catch (error) {
      console.error('❌ Erreur Push Firebase:', error);
      return false;
    }
  }
};