/**
 * MESSAY — AuthService avec OTP passager.
 * Dépend de src/services/sms.service.ts et de la table SQL
 * public."PassengerOtpChallenge" (voir messay_otp_setup.sql).
 * Ne pas publier les routes OTP sans rate-limit IP / WAF.
 */
import bcrypt from 'bcrypt';
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { Prisma, UserRole, type User } from '@prisma/client';
import prisma from '../config/database';
import { UserRepository } from '../repositories/user.repository';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt';
import type { RegisterInput, LoginInput } from '../validators/auth.validator';
import { sendMessayOtp } from './sms.service';

/** Erreurs métier renvoyées proprement par AuthController. */
export class AuthError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Ne jamais retourner les secrets du modèle User au client. */
function publicProfile(user: User) {
  return {
    id: user.id,
    nom: user.nom,
    prenom: user.prenom,
    email: user.email,
    telephone: user.telephone,
    role: user.role,
    photo: user.photo,
    moyenPaiement: user.moyenPaiement,
    isVerified: user.isVerified,
    isBlocked: user.isBlocked,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

const hashRefreshToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

function createTokens(user: User) {
  const payload = {
    userId: user.id,
    email: user.email ?? '',
    role: user.role,
  };

  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken({ ...payload, nonce: randomUUID() }),
  };
}

function assertPhone(telephone: string): string {
  const value = telephone.trim();
  if (!/^\+2250[157]\d{8}$/.test(value)) {
    throw new AuthError('Numéro mobile ivoirien invalide', 400);
  }
  return value;
}

/**
 * IMPORTANT — état de l'intégration :
 * - Connexion historique par mot de passe : conservée pour les comptes existants.
 * - Le schéma Prisma actuel autorise email et password null.
 * - L'OTP utilise la table SQL PassengerOtpChallenge et Orange SMS.
 * - Cette version nécessite un contrôle anti-abus par IP sur les routes publiques,
 *   une politique d'envoi SMS et une configuration Orange active.
 * - Le parcours historique /register est maintenu pour compatibilité :
 *   fermer cette route publiquement après bascule complète vers l'OTP.
 */
export class AuthService {
  /** Inscription historique. À désactiver publiquement après migration OTP. */
  async register(data: RegisterInput) {
    if (data.role && data.role !== 'USER') {
      throw new AuthError('Inscription publique réservée aux clients', 403);
    }

    const telephone = assertPhone(data.telephone);
    const nom = data.nom.trim();
    if (nom.length < 2) {
      throw new AuthError('Nom requis', 400);
    }
    if (!data.password || data.password.length < 8) {
      throw new AuthError('Mot de passe de 8 caractères minimum requis', 400);
    }

    if (await UserRepository.findByTelephone(telephone)) {
      throw new AuthError('Ce numéro de téléphone est déjà utilisé', 409);
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    try {
      const user = await UserRepository.create({
        nom,
        prenom: data.prenom?.trim() || null,
        email: null,
        telephone,
        password: hashedPassword,
        role: UserRole.USER,
        isVerified: false,
        isBlocked: false,
      });
      return {
        user: publicProfile(user),
        message: 'Compte créé. Téléphone non encore vérifié.',
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AuthError('Téléphone déjà utilisé', 409);
      }
      throw error;
    }
  }

  /** Connexion historique par mot de passe, notamment pour les conducteurs. */
  async login(data: LoginInput) {
    const user = data.email
      ? await UserRepository.findByEmail(data.email.trim().toLowerCase())
      : data.telephone
        ? await UserRepository.findByTelephone(data.telephone.trim())
        : null;

    if (!user || !user.password || !(await bcrypt.compare(data.password, user.password))) {
      throw new AuthError('Identifiant ou mot de passe incorrect', 401);
    }
    if (user.isBlocked) {
      throw new AuthError('Votre compte MESSAY est bloqué', 403);
    }

    const tokens = createTokens(user);
    const saved = await UserRepository.update(user.id, {
      refreshToken: hashRefreshToken(tokens.refreshToken),
    });

    return { user: publicProfile(saved), ...tokens };
  }

  /** Rotation atomique d'un refresh token à usage unique. */
  async refreshToken(token: string) {
    if (typeof token !== 'string' || !token.trim()) {
      throw new AuthError('Refresh token manquant', 400);
    }

    let userId: string;
    try {
      const decoded = verifyRefreshToken(token);
      if (!decoded || typeof decoded.userId !== 'string') {
        throw new Error('Payload invalide');
      }
      userId = decoded.userId;
    } catch {
      throw new AuthError('Session expirée ou invalide', 401);
    }

    const user = await UserRepository.findById(userId);
    if (!user) throw new AuthError('Session révoquée', 401);
    if (user.isBlocked) throw new AuthError('Votre compte MESSAY est bloqué', 403);

    const tokens = createTokens(user);
    const rotated = await prisma.user.updateMany({
      where: {
        id: userId,
        refreshToken: hashRefreshToken(token),
        isBlocked: false,
      },
      data: { refreshToken: hashRefreshToken(tokens.refreshToken) },
    });

    if (rotated.count !== 1) {
      throw new AuthError('Session révoquée ou déjà renouvelée', 401);
    }
    return tokens;
  }

  /** Ancien endpoint : refuse tout code tant que l'OTP n'est pas connecté. */
  async verifyOTP(_telephone: string, _otpCode: string): Promise<never> {
    throw new AuthError('Vérification OTP non configurée', 501);
  }

  /**
   * Génère puis envoie un défi persisté en PostgreSQL.
   * Concurrence : verrou transactionnel par numéro, cooldown 60 s, 5 SMS/heure.
   * IMPORTANT : ajouter en amont une limite par IP et des protections anti-bot.
   */
  async requestPassengerOTP(telephone: string) {
    const phone = assertPhone(telephone);
    const secret = otpSecret();
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');
    const challenge = await prisma.$transaction(async (tx) => {
      // PostgreSQL renvoie `void` pour pg_advisory_xact_lock ;
      // SELECT d'une valeur entière évite une désérialisation Prisma de `void`.
      // Le verrou est détenu jusqu'à la fin de cette transaction.
      await tx.$queryRaw<Array<{ acquired: number }>>`
        SELECT 1::integer AS "acquired"
        FROM pg_advisory_xact_lock(hashtext(${phone}))
      `;
      const existing = await tx.$queryRaw<OtpRow[]>`
        SELECT * FROM public."PassengerOtpChallenge" WHERE "telephone" = ${phone} FOR UPDATE
      `;
      const old = existing[0];
      const now = new Date();
      if (old?.nextSendAt && old.nextSendAt > now) {
        return { allowed: false as const, status: 429, message: 'Patientez avant de demander un nouveau code.' };
      }
      const sameWindow = !!old && now.getTime() - old.windowStartedAt.getTime() < 3_600_000;
      if (sameWindow && old.sendCount >= 5) {
        return { allowed: false as const, status: 429, message: 'Limite de SMS atteinte, réessayez plus tard.' };
      }
      // L'ancien code est invalidé dès qu'une nouvelle demande est enregistrée.
      await tx.$executeRaw`
        INSERT INTO public."PassengerOtpChallenge"
          ("telephone", "codeHash", "expiresAt", "nextSendAt", "windowStartedAt", "sendCount", "attempts", "sendPending", "updatedAt")
        VALUES (${phone}, ${codeHash}, ${new Date(now.getTime() + 300_000)},
                ${new Date(now.getTime() + 60_000)}, ${sameWindow ? old!.windowStartedAt : now},
                ${sameWindow ? old!.sendCount + 1 : 1}, 0, true, ${now})
        ON CONFLICT ("telephone") DO UPDATE SET
          "codeHash" = EXCLUDED."codeHash", "expiresAt" = EXCLUDED."expiresAt",
          "nextSendAt" = EXCLUDED."nextSendAt", "windowStartedAt" = EXCLUDED."windowStartedAt",
          "sendCount" = EXCLUDED."sendCount", "attempts" = 0,
          "sendPending" = true, "updatedAt" = EXCLUDED."updatedAt"
      `;
      return { allowed: true as const };
    });
    if (!challenge.allowed) throw new AuthError(challenge.message, challenge.status);

    try {
      await sendMessayOtp(phone, code);
    } catch (error) {
      // Une panne réseau peut intervenir APRÈS acceptation par le fournisseur.
      // On invalide le défi sans réinitialiser les limites anti-abus :
      // le délai et le compteur de SMS restent en vigueur.
      await prisma.$executeRaw`
        UPDATE public."PassengerOtpChallenge"
        SET "expiresAt" = now(), "sendPending" = false, "updatedAt" = now()
        WHERE "telephone" = ${phone} AND "codeHash" = ${codeHash}
          AND "sendPending" = true
      `.catch(() => undefined);
      throw new AuthError('Envoi du SMS non confirmé. Réessayez après le délai indiqué.', 502);
    }
    await prisma.$executeRaw`
      UPDATE public."PassengerOtpChallenge" SET "sendPending" = false, "updatedAt" = now()
      WHERE "telephone" = ${phone} AND "codeHash" = ${codeHash}
    `;
    return { message: 'Si ce numéro peut recevoir des SMS, un code a été envoyé.', retryAfterSeconds: 60 };
  }

  /** Consomme l'OTP avec verrou DB, puis crée/actualise USER et sa session. */
  async verifyPassengerOTP(input: { telephone: string; code: string; nom: string }) {
    const phone = assertPhone(input.telephone);
    if (!/^\d{6}$/.test(input.code)) throw new AuthError('Code invalide', 400);
    const nom = input.nom.trim();
    if (nom.length < 2 || nom.length > 100) throw new AuthError('Nom invalide', 400);
    const candidate = createHmac('sha256', otpSecret()).update(`${phone}:${input.code}`).digest();

    const result = await prisma.$transaction(async (tx) => {
      // PostgreSQL renvoie `void` pour pg_advisory_xact_lock ;
      // SELECT d'une valeur entière évite une désérialisation Prisma de `void`.
      // Le verrou est détenu jusqu'à la fin de cette transaction.
      await tx.$queryRaw<Array<{ acquired: number }>>`
        SELECT 1::integer AS "acquired"
        FROM pg_advisory_xact_lock(hashtext(${phone}))
      `;
      const rows = await tx.$queryRaw<OtpRow[]>`
        SELECT * FROM public."PassengerOtpChallenge" WHERE "telephone" = ${phone} FOR UPDATE
      `;
      const challenge = rows[0];
      if (!challenge || challenge.sendPending || challenge.expiresAt <= new Date() || challenge.attempts >= 5) {
        return { ok: false as const, status: 401, message: 'Code expiré ou invalide.' };
      }
      const stored = Buffer.from(challenge.codeHash, 'hex');
      const valid = stored.length === candidate.length && timingSafeEqual(stored, candidate);
      if (!valid) {
        await tx.$executeRaw`
          UPDATE public."PassengerOtpChallenge" SET "attempts" = "attempts" + 1,
            "updatedAt" = now() WHERE "telephone" = ${phone}
        `;
        return { ok: false as const, status: 401, message: 'Code expiré ou invalide.' };
      }
      const user = await tx.user.findUnique({ where: { telephone: phone } });
      if (user && (user.isBlocked || user.role !== UserRole.USER)) {
        return { ok: false as const, status: 403, message: 'Compte non autorisé.' };
      }
      const verifiedUser = user
        ? await tx.user.update({ where: { id: user.id }, data: { isVerified: true } })
        : await tx.user.create({
            data: { nom, telephone: phone, email: null, password: null,
              role: UserRole.USER, isVerified: true, isBlocked: false },
          });
      const tokens = createTokens(verifiedUser);
      await tx.user.update({
        where: { id: verifiedUser.id },
        data: { refreshToken: hashRefreshToken(tokens.refreshToken) },
      });
      // Invalider définitivement le code tout en conservant la fenêtre de
      // limitation : nextSendAt / windowStartedAt / sendCount sont inchangés.
      // On efface aussi l'empreinte du code consommé.
      const consumedHash = randomBytes(32).toString('hex');
      await tx.$executeRaw`
        UPDATE public."PassengerOtpChallenge"
        SET "codeHash" = ${consumedHash},
            "expiresAt" = now(),
            "attempts" = 5,
            "sendPending" = false,
            "updatedAt" = now()
        WHERE "telephone" = ${phone}
      `;
      return { ok: true as const, user: publicProfile(verifiedUser), ...tokens };
    });
    if (!result.ok) throw new AuthError(result.message, result.status);
    return result;
  }
}

interface OtpRow {
  telephone: string;
  codeHash: string;
  expiresAt: Date;
  nextSendAt: Date;
  windowStartedAt: Date;
  sendCount: number;
  attempts: number;
  sendPending: boolean;
  updatedAt: Date;
}

function otpSecret(): string {
  const value = process.env.OTP_HASH_SECRET;
  if (!value || value.length < 32) throw new AuthError('Service OTP non configuré', 503);
  return value;
}
