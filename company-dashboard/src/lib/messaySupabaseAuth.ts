/**
 * MESSAY PRO — Authentification du Dashboard Compagnie
 * Client public unique : Direction, Chefs de gare et Agents.
 *
 * Ce fichier appartient exclusivement au frontend Vite.
 * Ne jamais y placer de clé service_role, sb_secret_ ou d'identifiants privés.
 * Les permissions métier restent vérifiées par le backend MESSAY.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const supabasePublicKey = String(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim();

if (!supabaseUrl || !supabasePublicKey) {
  throw new Error(
    'MESSAY PRO : configuration de connexion manquante. ' +
    'Vérifiez les variables VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY ' +
    '(ou VITE_SUPABASE_ANON_KEY).'
  );
}

// Les projets Supabase hébergés utilisent HTTPS.
let parsedUrl: URL;
try {
  parsedUrl = new URL(supabaseUrl);
} catch {
  throw new Error('MESSAY PRO : adresse du service de connexion invalide.');
}

if (parsedUrl.protocol !== 'https:') {
  throw new Error('MESSAY PRO : la connexion doit utiliser HTTPS.');
}

/**
 * Rejette les clés secrètes placées accidentellement dans les variables Vite.
 * Le décodage du JWT sert uniquement à repérer une configuration dangereuse :
 * ce n'est PAS une vérification d'authenticité du jeton.
 */
function isSecretKey(key: string): boolean {
  if (/^sb_(secret|service_role)_/i.test(key)) return true;
  if (!key.includes('.')) return false;

  const segments = key.split('.');
  if (segments.length !== 3) return false;

  try {
    const payloadBase64 = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(payloadBase64));
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

if (isSecretKey(supabasePublicKey)) {
  throw new Error(
    'MESSAY PRO : une clé privée a été détectée dans le navigateur. ' +
    'Configurez uniquement une clé publishable ou anon.'
  );
}

/**
 * MESSAY utilise actuellement des invitations qui reviennent vers
 * /invitation#access_token=...&refresh_token=...
 * Il s'agit du flux implicite, adapté à ce frontend React/Vite sans SSR.
 * Si le projet migre vers PKCE, il faudra migrer conjointement les liens
 * d'invitation, les callbacks et le reste du parcours de connexion.
 */
export const messayAuth = createClient(supabaseUrl, supabasePublicKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  },
});

/**
 * Messages lisibles pour les écrans MESSAY PRO.
 * Utiliser cette fonction dans InvitationPage et Login.
 * Les limites d'envoi et la validité des liens restent imposées par le serveur.
 */
export function toMessayAuthMessage(error: unknown): string {
  const issue = error && typeof error === 'object'
    ? (error as { message?: unknown; code?: unknown; status?: unknown })
    : {};

  const message = typeof issue.message === 'string' ? issue.message : '';
  const code = typeof issue.code === 'string' ? issue.code.toLowerCase() : '';
  const status = typeof issue.status === 'number' ? issue.status : null;

  const cooldown = message.match(/only request this after\s+(\d+)\s+seconds?/i);
  if (cooldown) {
    return `MESSAY PRO : pour protéger votre compte, veuillez patienter ${cooldown[1]} secondes avant de demander un nouveau lien de connexion.`;
  }

  if (status === 429 || /rate.?limit|too many requests/i.test(message) ||
      /over_email_send_rate_limit|over_request_rate_limit/.test(code)) {
    return 'MESSAY PRO : trop de demandes ont été effectuées. Réessayez plus tard.';
  }

  if (/otp_expired|expired_token|email_link_invalid/.test(code) ||
      /(?:expired|invalid).*?(?:link|token|otp|code)|(?:link|token).*?expired/i.test(message)) {
    return 'MESSAY PRO : ce lien de connexion est invalide ou expiré. Demandez un nouveau lien.';
  }

  if (/invalid_credentials|invalid_grant/.test(code) ||
      /invalid login credentials/i.test(message)) {
    return 'MESSAY PRO : les identifiants saisis sont incorrects.';
  }

  if (/email_not_confirmed/.test(code) || /email not confirmed/i.test(message)) {
    return 'MESSAY PRO : confirmez votre adresse e-mail avant de vous connecter.';
  }

  if (/user_already_exists|email_exists/.test(code) ||
      /already registered|already exists/i.test(message)) {
    return 'MESSAY PRO : un compte existe déjà avec cette adresse e-mail. Connectez-vous avec ce compte.';
  }

  if (/failed to fetch|network request failed|fetch failed/i.test(message)) {
    return 'MESSAY PRO : connexion indisponible. Vérifiez votre accès Internet puis réessayez.';
  }

  // Les détails internes et messages bruts du fournisseur ne sont pas exposés.
  return 'MESSAY PRO : impossible de terminer cette opération. Veuillez réessayer ou contacter la Direction.';
}

// Alias conservés pour les imports existants de l'application.
export const messaySupabaseAuth = messayAuth;
export const supabase = messayAuth;
export const supabaseClient = messayAuth;
export default messayAuth;
