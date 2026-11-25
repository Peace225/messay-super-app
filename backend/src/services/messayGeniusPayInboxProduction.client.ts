/**
 * MESSAY — client privilégié pour la seule réception des webhooks GeniusPay.
 * Reprend les contrôles de cohérence des cibles Supabase / Prisma :
 * pas d'accès en local, pas de projet distinct, pas de clé publique.
 * Aucune action financière ni émission de billet dans ce module.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const REF = /^[a-z0-9-]{6,64}$/;

function isServiceRoleKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return key.length > 40;
  if (key.startsWith('sb_publishable_') || !key.startsWith('eyJ')) return false;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    );
    return decoded !== null && typeof decoded === 'object' &&
      !Array.isArray(decoded) && 'role' in decoded &&
      decoded.role === 'service_role';
  } catch {
    return false;
  }
}

function postgresDsnMatchesProject(dsn: string, projectRef: string): boolean {
  try {
    const url = new URL(dsn);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
      return false;
    }
    const host = url.hostname.toLowerCase();
    const username = decodeURIComponent(url.username);
    if (host === `db.${projectRef}.supabase.co`) {
      return username === 'postgres' || username === `postgres.${projectRef}`;
    }
    return host.endsWith('.pooler.supabase.com') &&
      username === `postgres.${projectRef}`;
  } catch {
    return false;
  }
}

/** Retourne null plutôt qu'un client incertain. */
export function getGeniusPayInboxProductionClient(): SupabaseClient | null {
  if (process.env.NODE_ENV !== 'production' ||
      process.env.MESSAY_GENIUSPAY_INBOX_ENABLED !== 'true') {
    return null;
  }
  const prodRef = (process.env.MESSAY_PRODUCTION_SUPABASE_PROJECT_REF ?? '')
    .trim().toLowerCase();
  const stagingRef = (process.env.MESSAY_STAGING_SUPABASE_PROJECT_REF ?? '')
    .trim().toLowerCase();
  if (!REF.test(prodRef) || (stagingRef !== '' &&
      (!REF.test(stagingRef) || stagingRef === prodRef))) {
    return null;
  }

  let url: URL;
  try {
    url = new URL((process.env.SUPABASE_URL ?? '').trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' ||
      url.hostname.toLowerCase() !== `${prodRef}.supabase.co` ||
      url.port !== '' || url.pathname !== '/' || url.search !== '' ||
      url.hash !== '' || url.username !== '' || url.password !== '') {
    return null;
  }

  const dbUrl = process.env.DATABASE_URL ?? '';
  const directUrl = process.env.DIRECT_URL;
  if (!postgresDsnMatchesProject(dbUrl, prodRef) ||
      (directUrl && !postgresDsnMatchesProject(directUrl, prodRef))) {
    return null;
  }

  const keys = [
    process.env.SUPABASE_SECRET_KEY,
    process.env.SERVICE_ROLE_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ].map(key => key?.trim()).filter((key): key is string => !!key);
  const secretKey = keys[0];
  if (!secretKey || new Set(keys).size !== 1 ||
      !isServiceRoleKey(secretKey)) {
    return null;
  }

  return createClient(url.origin, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false,
      detectSessionInUrl: false },
  });
}
