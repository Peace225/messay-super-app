/**
 * Documents privés des conducteurs MESSAY.
 * À monter DANS adminTransport.routes.ts, après authenticate + authorize('ADMIN')
 * et la vérification du compte admin non bloqué.
 * Stockage : Supabase Storage, bucket PRIVÉ, clé service-role exclusivement backend.
 * Aucune modification du schéma Prisma.
 */
import { randomUUID } from 'crypto';
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import prisma from '../config/database';

const router = Router();
const BUCKET = process.env.SUPABASE_DRIVER_DOCS_BUCKET || 'messay-driver-documents';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const KINDS = ['photo', 'permis', 'identite', 'carte-grise'] as const;
type Kind = (typeof KINDS)[number];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const acceptedMime = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

let client: SupabaseClient | undefined;
function storage(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!client) client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

async function privateStorage(): Promise<{ client: SupabaseClient; error?: never } | { client?: never; error: string }> {
  const supabase = storage();
  if (!supabase) return { error: 'SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante' };
  const { data, error } = await supabase.storage.getBucket(BUCKET);
  if (error || !data) return { error: `Bucket ${BUCKET} absent ou inaccessible` };
  if (data.public) return { error: 'Le bucket de documents ne doit pas être public' };
  return { client: supabase };
}

function params(req: Request): { id: string; kind: Kind } | null {
  const { id, kind } = req.params;
  return UUID.test(id) && KINDS.some(k => k === kind) ? { id, kind: kind as Kind } : null;
}

function detectFile(buffer: Buffer): { mime: string; ext: string } | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' };
  }
  if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') {
    return { mime: 'application/pdf', ext: 'pdf' };
  }
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 0 },
  fileFilter: (_req, file, callback) => {
    if (!acceptedMime.includes(file.mimetype)) {
      callback(new Error('Format invalide : JPG, PNG, WEBP ou PDF seulement'));
    } else {
      callback(null, true);
    }
  },
}).single('file');

function multipart(req: Request, res: Response, next: () => void): void {
  upload(req, res, (err) => {
    if (err) {
      const tooLarge = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE';
      res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? 'Fichier supérieur à 5 Mo' : err.message });
      return;
    }
    next();
  });
}

async function driverExists(id: string): Promise<boolean> {
  return !!(await prisma.conducteur.findUnique({ where: { id }, select: { id: true } }));
}

async function listLatest(supabase: SupabaseClient, id: string, kind: Kind) {
  const { data, error } = await supabase.storage.from(BUCKET).list(`${id}/${kind}`, {
    limit: 100,
    sortBy: { column: 'created_at', order: 'desc' },
  });
  if (error) throw error;
  const latest = data?.filter(f => f.name !== '.emptyFolderPlaceholder' && !!f.id)
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];
  return latest ? {
    kind, name: latest.name, createdAt: latest.created_at ?? null,
    path: `${id}/${kind}/${latest.name}`,
  } : null;
}

// Précontrôle pour empêcher la création d'un compte si l'upload demandé est impossible.
router.get('/documents/status', async (_req: Request, res: Response) => {
  try {
    const check = await privateStorage();
    res.setHeader('Cache-Control', 'no-store');
    res.status(check.error ? 503 : 200).json({ ready: !check.error, error: check.error ?? null });
  } catch (error) {
    console.error('[DRIVER/DOCUMENTS/STATUS]', error);
    res.status(503).json({ ready: false, error: 'Stockage documentaire indisponible' });
  }
});

router.get('/:id/documents', async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!UUID.test(id)) { res.status(400).json({ error: 'ID conducteur invalide' }); return; }
  try {
    if (!(await driverExists(id))) { res.status(404).json({ error: 'Conducteur introuvable' }); return; }
    const check = await privateStorage();
    if (!check.client) { res.status(503).json({ error: check.error }); return; }
    const items = (await Promise.all(KINDS.map(kind => listLatest(check.client, id, kind)))).filter(Boolean);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ items });
  } catch (error) {
    console.error('[DRIVER/DOCUMENTS/LIST]', error);
    res.status(502).json({ error: 'Impossible de récupérer les documents' });
  }
});

router.post('/:id/documents/:kind', multipart, async (req: Request, res: Response) => {
  const parsed = params(req);
  if (!parsed) { res.status(400).json({ error: 'ID ou type de document invalide' }); return; }
  if (!req.file) { res.status(400).json({ error: 'Choisissez un fichier' }); return; }
  const detected = detectFile(req.file.buffer);
  if (!detected || detected.mime !== req.file.mimetype || (parsed.kind === 'photo' && detected.mime === 'application/pdf')) {
    res.status(415).json({ error: 'Type ou signature de fichier incorrect' }); return;
  }
  try {
    if (!(await driverExists(parsed.id))) { res.status(404).json({ error: 'Conducteur introuvable' }); return; }
    const check = await privateStorage();
    if (!check.client) { res.status(503).json({ error: check.error }); return; }
    const path = `${parsed.id}/${parsed.kind}/${randomUUID()}.${detected.ext}`;
    const { error } = await check.client.storage.from(BUCKET).upload(path, req.file.buffer, {
      contentType: detected.mime, upsert: false, cacheControl: '0',
    });
    if (error) throw error;
    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({ kind: parsed.kind, saved: true });
  } catch (error) {
    console.error('[DRIVER/DOCUMENTS/UPLOAD]', error);
    res.status(502).json({ error: 'Le document n’a pas pu être stocké' });
  }
});

router.get('/:id/documents/:kind/url', async (req: Request, res: Response) => {
  const parsed = params(req);
  if (!parsed) { res.status(400).json({ error: 'ID ou type de document invalide' }); return; }
  try {
    if (!(await driverExists(parsed.id))) { res.status(404).json({ error: 'Conducteur introuvable' }); return; }
    const check = await privateStorage();
    if (!check.client) { res.status(503).json({ error: check.error }); return; }
    const latest = await listLatest(check.client, parsed.id, parsed.kind);
    if (!latest) { res.status(404).json({ error: 'Document introuvable' }); return; }
    const { data, error } = await check.client.storage.from(BUCKET).createSignedUrl(latest.path, 60);
    if (error || !data?.signedUrl) throw error || new Error('Lien temporaire absent');
    res.setHeader('Cache-Control', 'no-store');
    res.json({ url: data.signedUrl, expiresInSeconds: 60 });
  } catch (error) {
    console.error('[DRIVER/DOCUMENTS/URL]', error);
    res.status(502).json({ error: 'Impossible d’ouvrir le document' });
  }
});

export default router;
