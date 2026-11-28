
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const REGISTERED_PUSH_TOKEN_KEY =
  'messay:registered-expo-push-token';

const PUSH_REQUEST_TIMEOUT_MS = 10000;
const PUSH_LOGOUT_TIMEOUT_MS = 2500;

const EXPO_PUSH_TOKEN_REGEX =
  /^(ExpoPushToken|ExponentPushToken)\[[^\]\s]{1,240}\]$/;

type PushPlatform = 'android' | 'ios';

function getPushPlatform(): PushPlatform | null {
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'ios') return 'ios';
  return null;
}

function assertAccessToken(accessToken: string): void {
  if (
    typeof accessToken !== 'string' ||
    !accessToken.trim()
  ) {
    throw new Error('Session MESSAY invalide ou absente');
  }
}

function assertExpoPushToken(expoPushToken: string): void {
  if (
    typeof expoPushToken !== 'string' ||
    !EXPO_PUSH_TOKEN_REGEX.test(expoPushToken)
  ) {
    throw new Error('Token Expo Push invalide');
  }
}

function pushEndpoint(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (!configured) {
    throw new Error(
      'EXPO_PUBLIC_API_URL non définie pour MESSAY mobile'
    );
  }

  const origin = configured
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '');

  if (!/^https?:\/\/[^/\s]+/i.test(origin)) {
    throw new Error('URL API MESSAY invalide');
  }

  if (
    !__DEV__ &&
    !origin.toLowerCase().startsWith('https://')
  ) {
    throw new Error(
      'HTTPS obligatoire pour les notifications MESSAY'
    );
  }

  return `${origin}/api/push/devices`;
}

async function pushRequest(
  method: 'POST' | 'DELETE',
  accessToken: string,
  expoPushToken: string,
  platform: PushPlatform | null,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<Response> {
  assertAccessToken(accessToken);
  assertExpoPushToken(expoPushToken);

  if (externalSignal?.aborted) {
    throw new Error('Opération Push annulée');
  }

  const controller = new AbortController();

  const abortRequest = () => controller.abort();

  externalSignal?.addEventListener(
    'abort',
    abortRequest,
    { once: true }
  );

  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    if (externalSignal?.aborted) {
      controller.abort();
    }

    const body =
      method === 'POST'
        ? { expoPushToken, platform }
        : { expoPushToken };

    const response = await fetch(pushEndpoint(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Requête Push MESSAY refusée (HTTP ${response.status})`
      );
    }

    return response;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abortRequest);
  }
}

/** Enregistre le token Expo auprès du backend après authentification. */
export async function savePushDeviceOnBackend(
  accessToken: string,
  expoPushToken: string,
  signal?: AbortSignal
): Promise<void> {
  const platform = getPushPlatform();
  if (!platform) return;

  await pushRequest(
    'POST',
    accessToken,
    expoPushToken,
    platform,
    PUSH_REQUEST_TIMEOUT_MS,
    signal
  );

  await AsyncStorage.setItem(REGISTERED_PUSH_TOKEN_KEY, expoPushToken);
}

/** Révoque l'appareil lors de la déconnexion, avant l'effacement du JWT. */
export async function revokePushDeviceOnLogout(
  accessToken: string
): Promise<void> {
  const expoPushToken = await AsyncStorage.getItem(REGISTERED_PUSH_TOKEN_KEY);
  if (!expoPushToken) return;

  // Ne révoquer que les appareils mobiles et un jeton Expo conforme.
  const platform = getPushPlatform();
  if (!platform) return;

  await pushRequest(
    'DELETE',
    accessToken,
    expoPushToken,
    platform,
    PUSH_LOGOUT_TIMEOUT_MS
  );

  await AsyncStorage.removeItem(REGISTERED_PUSH_TOKEN_KEY);
}
