/** MESSAY - Administration multi-compagnies. Désactivée par défaut.
 * Prisma ADMIN JWT uniquement. Les données commerciales restent dans public.companies.
 * NE PAS activer sans recette sur environnement isolé et stockage configuré.
 */
import { randomUUID } from 'crypto';
import { Router, raw, type Request, type Response, type NextFunction } from 'express';
import { Prisma, UserRole } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import prisma from '../config/database';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate, authorize('ADMIN'));

// Fermeture explicite : ne jamais ouvrir le module par défaut sur la base distante.
router.use((_req, res, next) => {
  if (process.env.MESSAY_ADMIN_COMPANIES_ENABLED !== 'true') {
    res.status(503).json({ message: 'Gestion des compagnies non activée sur cet environnement.' });
    return;
  }
  next();
});

router.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const identity = req.user as { id?: string; userId?: string } | undefined;
    const id = identity?.userId || identity?.id;
    if (!id) { res.status(401).json({ message: 'Session administrateur invalide.' }); return; }
    const user = await prisma.user.findUnique({
      where: { id }, select: { role: true, isBlocked: true },
    });
    if (!user || user.role !== UserRole.ADMIN || user.isBlocked) {
      res.status(403).json({ message: 'Accès administrateur refusé.' }); return;
    }
    next();
  } catch (error) { next(error); }
});

type Company = {
  id: string; name: string; description: string | null; telephone: string | null;
  logo_url: string | null; bus_image_url: string | null;
  is_active: boolean; is_verified: boolean;
};
const columns = Prisma.sql`id, name, description, telephone, logo_url, bus_image_url, is_active, is_verified`;

const companyInput = z.object({
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().max(2000).optional().default(''),
  telephone: z.string().trim().max(35).optional().default(''),
  logo_url: z.string().trim().url().max(2000).optional().nullable(),
  bus_image_url: z.string().trim().url().max(2000).optional().nullable(),
}).strict();

function storageConfig() {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const bucket = process.env.MESSAY_COMPANY_MEDIA_BUCKET || '';
  if (!url.startsWith('https://') || !key || !/^[a-z0-9][a-z0-9-]{1,60}$/i.test(bucket)) return null;
  return { url: url.replace(/\/+$/, ''), key, bucket };
}
function imageUrlAllowed(value: string | null | undefined): boolean {
  if (!value) return true;
  const config = storageConfig();
  if (!config) return false;
  try {
    const url = new URL(value);
    const origin = new URL(config.url).origin;
    return url.protocol === 'https:' && url.origin === origin &&
      url.pathname.startsWith(`/storage/v1/object/public/${config.bucket}/companies/`) &&
      !url.username && !url.password;
  } catch { return false; }
}
function requireWrite(_req: Request, res: Response, next: NextFunction) {
  if (process.env.MESSAY_ADMIN_COMPANIES_WRITE_ENABLED !== 'true') {
    res.status(503).json({ message: 'Modifications des compagnies non activées.' });
    return;
  }
  next();
}
function respondError(res: Response, error: unknown) {
  console.error('[admin-companies]', error);
  res.status(503).json({ message: 'Gestion des compagnies temporairement indisponible.' });
}

router.get('/', async (_req, res) => {
  try {
    const companies = await prisma.$queryRaw<Company[]>(Prisma.sql`
      SELECT ${columns} FROM public.companies ORDER BY name ASC LIMIT 500
    `);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ items: companies });
  } catch (error) { respondError(res, error); }
});

router.post('/', requireWrite, async (req, res) => {
  const parsed = companyInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Informations de compagnie invalides.' }); return; }
  const input = parsed.data;
  if (!imageUrlAllowed(input.logo_url) || !imageUrlAllowed(input.bus_image_url)) {
    res.status(400).json({ message: 'Les images doivent provenir du stockage MESSAY autorisé.' }); return;
  }
  try {
    const id = randomUUID();
    const rows = await prisma.$queryRaw<Company[]>(Prisma.sql`
      INSERT INTO public.companies
        (id, name, description, telephone, logo_url, bus_image_url, is_active, is_verified)
      VALUES
        (${id}::uuid, ${input.name}, ${input.description || null}, ${input.telephone || null},
         ${input.logo_url || null}, ${input.bus_image_url || null}, FALSE, FALSE)
      RETURNING ${columns}
    `);
    res.status(201).json(rows[0]);
  } catch (error) { respondError(res, error); }
});

// Publication = approbation ET activation dans une transaction atomique.
router.patch('/:id/approve', requireWrite, async (req, res) => {
  if (!z.string().uuid().safeParse(req.params.id).success) { res.status(400).json({ message: 'ID invalide.' }); return; }
  try {
    const rows = await prisma.$queryRaw<Company[]>(Prisma.sql`
      UPDATE public.companies SET is_verified=TRUE, is_active=TRUE
      WHERE id=${req.params.id}::uuid RETURNING ${columns}
    `);
    if (!rows.length) { res.status(404).json({ message: 'Compagnie introuvable.' }); return; }
    res.json(rows[0]);
  } catch (error) { respondError(res, error); }
});

// Suspendre sans effacer les historiques, lignes, réservations ou billets.
router.patch('/:id/suspend', requireWrite, async (req, res) => {
  if (!z.string().uuid().safeParse(req.params.id).success) { res.status(400).json({ message: 'ID invalide.' }); return; }
  try {
    const rows = await prisma.$queryRaw<Company[]>(Prisma.sql`
      UPDATE public.companies SET is_active=FALSE
      WHERE id=${req.params.id}::uuid RETURNING ${columns}
    `);
    if (!rows.length) { res.status(404).json({ message: 'Compagnie introuvable.' }); return; }
    res.json(rows[0]);
  } catch (error) { respondError(res, error); }
});

// Actualisation de l'identité visuelle sans affecter les autres compagnies.
router.patch('/:id/media', requireWrite, async (req, res) => {
  if (!z.string().uuid().safeParse(req.params.id).success) { res.status(400).json({ message: 'ID invalide.' }); return; }
  const parsed = z.object({
    logo_url: z.string().url().nullable(), bus_image_url: z.string().url().nullable(),
  }).strict().safeParse(req.body);
  if (!parsed.success || !imageUrlAllowed(parsed.data.logo_url) || !imageUrlAllowed(parsed.data.bus_image_url)) {
    res.status(400).json({ message: 'Images invalides.' }); return;
  }
  try {
    const rows = await prisma.$queryRaw<Company[]>(Prisma.sql`
      UPDATE public.companies
      SET logo_url=${parsed.data.logo_url}, bus_image_url=${parsed.data.bus_image_url}
      WHERE id=${req.params.id}::uuid RETURNING ${columns}
    `);
    if (!rows.length) { res.status(404).json({ message: 'Compagnie introuvable.' }); return; }
    res.json(rows[0]);
  } catch (error) { respondError(res, error); }
});

// Flux binaire, sans base64; contrôle extension, taille et signature fichier.
// Le bucket doit être EXISTANT, PUBLIC (pour affichage dans le mobile) et
// accessible uniquement par la clé service_role conservée côté serveur.
router.post('/media/:kind', requireWrite, raw({ type: 'application/octet-stream', limit: '5mb' }), async (req, res) => {
  const kind = req.params.kind;
  if (kind !== 'logo' && kind !== 'cover') { res.status(400).json({ message: 'Type image invalide.' }); return; }
  if (process.env.MESSAY_ADMIN_COMPANY_UPLOAD_ENABLED !== 'true') {
    res.status(503).json({ message: 'Envoi des images non activé.' }); return;
  }
  const cfg = storageConfig();
  if (!cfg) { res.status(503).json({ message: 'Stockage des images non configuré.' }); return; }
  const bytes = req.body;
  if (!Buffer.isBuffer(bytes) || bytes.length < 20 || bytes.length > 5 * 1024 * 1024) {
    res.status(400).json({ message: 'Image vide ou supérieure à 5 Mo.' }); return;
  }
  const jpeg = bytes.subarray(0, 3).equals(Buffer.from([0xff,0xd8,0xff]));
  const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const webp = bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP';
  const ext = jpeg ? 'jpg' : png ? 'png' : webp ? 'webp' : null;
  const mime = jpeg ? 'image/jpeg' : png ? 'image/png' : webp ? 'image/webp' : null;
  if (!ext || !mime) { res.status(415).json({ message: 'Formats autorisés : JPEG, PNG, WebP.' }); return; }
  try {
    const client = createClient(cfg.url, cfg.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const path = `companies/${kind}/${randomUUID()}.${ext}`;
    const upload = await client.storage.from(cfg.bucket).upload(path, bytes, {
      contentType: mime, cacheControl: '3600', upsert: false,
    });
    if (upload.error) throw upload.error;
    const { data } = client.storage.from(cfg.bucket).getPublicUrl(path);
    res.status(201).json({ url: data.publicUrl });
  } catch (error) { respondError(res, error); }
});

export default router;
