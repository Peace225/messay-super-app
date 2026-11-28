import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Afficher les notifications même si MESSAY est ouvert.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(): Promise<
  string | null
> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return null;
  }

  // Android : créer le canal avant de demander le token.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notifications MESSAY',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const current = await Notifications.getPermissionsAsync();

  let status = current.status;

  if (status !== 'granted') {
    const requested =
      await Notifications.requestPermissionsAsync();

    status = requested.status;
  }

  if (status !== 'granted') {
    return null;
  }

  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;

  if (!projectId) {
    throw new Error('Identifiant EAS MESSAY manquant');
  }

  const result = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  return result.data;
}