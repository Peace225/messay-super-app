import api from './api';
import type { AuthSession, AuthUser } from '../store/authStore';

// Réponse de demande : ne contient jamais le code SMS.
export interface OtpRequestResult {
  message?: string;
  expiresInSeconds?: number;
  retryAfterSeconds?: number;
}

export type OtpVerifyResult = AuthSession & {
  message?: string;
  ok?: boolean;
};

function isOtpPassenger(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false;
  const user = value as Partial<AuthUser>;
  return (
    typeof user.id === 'string' && user.id.length > 0 &&
    typeof user.nom === 'string' && user.nom.trim().length > 0 &&
    typeof user.telephone === 'string' && /^\+2250[157]\d{8}$/.test(user.telephone) &&
    user.role === 'USER' && user.isVerified === true && user.isBlocked !== true
  );
}

function parseOtpSession(raw: unknown, requestedPhone: string): OtpVerifyResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Réponse de vérification MESSAY invalide.');
  }
  const value = raw as Partial<OtpVerifyResult>;
  if (
    typeof value.accessToken !== 'string' || !value.accessToken.trim() ||
    typeof value.refreshToken !== 'string' || !value.refreshToken.trim() ||
    !isOtpPassenger(value.user) || value.user.telephone !== requestedPhone
  ) {
    throw new Error('La vérification du compte n’a pas retourné une session passager valide.');
  }
  return value as OtpVerifyResult;
}

export const otpAuthService = {
  async requestCode(telephone: string): Promise<OtpRequestResult> {
    const { data } = await api.post<OtpRequestResult>('/auth/otp/request', { telephone });
    return data;
  },

  async verifyAndRegister(input: {
    telephone: string;
    code: string;
    nom: string;
  }): Promise<OtpVerifyResult> {
    // Le vrai contrôle du code est exclusivement réalisé par le backend.
    const { data } = await api.post<unknown>('/auth/otp/verify', input);
    return parseOtpSession(data, input.telephone);
  },
};
