import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Les jetons d'appareil ne sont pas des secrets de compte, mais ne doivent
// pas être exposés dans les logs ni être envoyés à un service non fiable.
const REGISTERED_PUSH_TOKEN_KEY = 'messay:registered-expo-push-token';

function pushEndpoint(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!configured) {
    throw new Error('EXPO_PUBLIC_API_URL non définie pour MESSAY mobile');
  }

  // Les projets historiques peuvent définir la base avec ou sans /api.
  const origin = configured.replace(/\/+$/, '').replace(/\/api$/i, '');
  return `${origin}/api/push/devices`;
}

export async function savePushDeviceOnBackend(
  accessToken: string,
  expoPushToken: string,
  signal?: AbortSignal
): Promise<void> {
  const platform = Platform.OS;
  if (platform !== 'android' && platform !== 'ios') return;

  const response = await fetch(pushEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ expoPushToken, platform }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Enregistrement push MESSAY refusé (HTTP ${response.status})`);
  }

  await AsyncStorage.setItem(REGISTERED_PUSH_TOKEN_KEY, expoPushToken);
}

// Appelée avant de supprimer la session. En cas d'échec réseau, la déconnexion
// locale reste prioritaire ; les tokens doivent être invalidés côté serveur
// également lors de la suppression du compte ou d'une session compromise.
export async function revokePushDeviceOnLogout(accessToken: string): Promise<void> {
  const expoPushToken = await AsyncStorage.getItem(REGISTERED_PUSH_TOKEN_KEY);
  if (!expoPushToken) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(pushEndpoint(), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ expoPushToken }),
      signal: controller.signal,
    });

    if (response.ok) {
      await AsyncStorage.removeItem(REGISTERED_PUSH_TOKEN_KEY);
    } else {
      throw new Error(`Révocation push refusée (HTTP ${response.status})`);
    }
  } finally {
    clearTimeout(timeout);
  }
}
