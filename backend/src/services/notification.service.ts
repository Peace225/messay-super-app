import * as admin from 'firebase-admin';
import path from 'path';

// 1. Chemin corrigé pour être dans 'src/config'
// Rappel : renomme bien ton fichier en supprimant le .json en trop (firebase-service-account.json)
const serviceAccountPath = path.resolve(__dirname, '../config/firebase-service-account.json');
const serviceAccount = require(serviceAccountPath);

// 2. Initialisation sécurisée (évite l'erreur si l'app est déjà initialisée)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

export const notificationService = {
  /**
   * Envoie une alerte Push à un chauffeur de tricycle spécifique
   */
  sendToDriver: async (deviceToken: string, orderData: any) => {
    // 3. Mise à jour du branding vers MESSAY
    const message: admin.messaging.Message = {
      notification: {
        title: '🚚 Nouvelle Mission MESSAY !', // Correction du nom
        body: `Course vers ${orderData.destination} pour du ${orderData.materiau || 'chargement'}.`,
      },
      data: {
        orderId: orderData.id.toString(),
        type: 'NEW_ASSIGNMENT',
        // Note: Si tu utilises Expo, click_action n'est pas forcément nécessaire ici
        // mais gardons-le pour la compatibilité native.
      },
      token: deviceToken,
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('✅ Push envoyé avec succès pour MESSAY:', response);
      return true;
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi du Push Firebase:', error);
      return false;
    }
  }
};