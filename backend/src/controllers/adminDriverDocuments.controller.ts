/**
 * MESSAY — Contrôleur des documents des conducteurs.
 * Réservé aux administrateurs via le routeur parent adminTransport.routes.ts.
 * Les pièces sont stockées dans un bucket Supabase Storage privé.
 * Ne jamais exposer la SERVICE_ROLE_KEY dans le navigateur.
 */
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import prisma from '../config/database';

const BUCKET = process.env.SUPABASE_DRIVER_DOCS_BUCKET || 'messay-driver-documents';
const DOCUMENT_KINDS = ['photo', 'permis', 'identite', 'carte-grise'] as const;
type DocumentKind = (typeof DOCUMENT_KINDS)[number];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let supabaseClient: SupabaseClient | undefined;

function storageClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  if (!supabaseClient) {
    supabaseClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseClient;
}

async function privateStorage(): Promise<
  { client: SupabaseClient; error?: never } | { client?: never; error: string }
> {
  const client = storageClient();
  if (!client) {
    return { error: 'Stockage Supabase non configuré sur le backend' };
  }

  const { data, error } = await client.storage.getBucket(BUCKET);
  if (error || !data) {
    return { error: 'Bucket de documents absent ou inaccessible' };
  }
  if (data.public) {
    return { error: 'Le bucket des documents conducteurs doit être privé' };
  }
  return { client };
}

function validatedId(req: Request): string | null {
  const id = req.params.id;
  return typeof id === 'string' && UUID_REGEX.test(id) ? id : null;
}

function validatedDocumentParams(
  req: Request
): { id: string; kind: DocumentKind } | null {
  const id = validatedId(req);
  const kind = req.params.kind;
  return id && DOCUMENT_KINDS.some(item => item === kind)
    ? { id, kind: kind as DocumentKind }
    : null;
}

function detectFileSignature(buffer: Buffer): { mime: string; ext: string } | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') {
    return { mime: 'application/pdf', ext: 'pdf' };
  }
  return null;
}

async function conductorExists(id: string): Promise<boolean> {
  const driver = await prisma.conducteur.findUnique({
    where: { id },
    select: { id: true },
  });
  return Boolean(driver);
}

interface StoredDocument {
  kind: DocumentKind;
  name: string;
  createdAt: string | null;
  path: string;
}

async function latestDocument(
  client: SupabaseClient,
  driverId: string,
  kind: DocumentKind
): Promise<StoredDocument | null> {
  const { data, error } = await client.storage.from(BUCKET).list(`${driverId}/${kind}`, {
    limit: 100,
    sortBy: { column: 'created_at', order: 'desc' },
  });
  if (error) throw error;

  const latest = data
    ?.filter(file => file.name !== '.emptyFolderPlaceholder' && Boolean(file.id))
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];

  return latest
    ? {
        kind,
        name: latest.name,
        createdAt: latest.created_at ?? null,
        path: `${driverId}/${kind}/${latest.name}`,
      }
    : null;
}

/** GET /api/admin/transport/conducteurs/documents/status */
async function status(_req: Request, res: Response): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const result = await privateStorage();
    res.status(result.error ? 503 : 200).json({
      ready: !result.error,
      error: result.error ?? null,
    });
  } catch (error) {
    console.error('[ADMIN/DRIVER-DOCS/STATUS]', error);
    res.status(503).json({ ready: false, error: 'Stockage documentaire indisponible' });
  }
}

/** GET /api/admin/transport/conducteurs/:id/documents */
async function list(_req: Request, res: Response): Promise<void> {
  const id = validatedId(_req);
  if (!id) {
    res.status(400).json({ error: 'Identifiant conducteur invalide' });
    return;
  }

  try {
    if (!(await conductorExists(id))) {
      res.status(404).json({ error: 'Conducteur introuvable' });
      return;
    }
    const storage = await privateStorage();
    if (!storage.client) {
      res.status(503).json({ error: storage.error });
      return;
    }
    const items = (await Promise.all(
      DOCUMENT_KINDS.map(kind => latestDocument(storage.client, id, kind))
    )).filter((item): item is StoredDocument => item !== null);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ items });
  } catch (error) {
    console.error('[ADMIN/DRIVER-DOCS/LIST]', error);
    res.status(502).json({ error: 'Impossible de récupérer les documents' });
  }
}

/** POST /api/admin/transport/conducteurs/:id/documents/:kind — champ multipart "file" */
async function upload(_req: Request, res: Response): Promise<void> {
  const parsed = validatedDocumentParams(_req);
  if (!parsed) {
    res.status(400).json({ error: 'Identifiant conducteur ou type de document invalide' });
    return;
  }
  if (!_req.file) {
    res.status(400).json({ error: 'Aucun fichier reçu (champ attendu : file)' });
    return;
  }

  const signature = detectFileSignature(_req.file.buffer);
  if (
    !signature ||
    signature.mime !== _req.file.mimetype ||
    (parsed.kind === 'photo' && signature.mime === 'application/pdf')
  ) {
    res.status(415).json({ error: 'Format ou signature de fichier invalide' });
    return;
  }

  try {
    if (!(await conductorExists(parsed.id))) {
      res.status(404).json({ error: 'Conducteur introuvable' });
      return;
    }
    const storage = await privateStorage();
    if (!storage.client) {
      res.status(503).json({ error: storage.error });
      return;
    }

    const path = `${parsed.id}/${parsed.kind}/${randomUUID()}.${signature.ext}`;
    const { error } = await storage.client.storage.from(BUCKET).upload(
      path,
      _req.file.buffer,
      { contentType: signature.mime, cacheControl: '0', upsert: false }
    );
    if (error) throw error;

    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({ kind: parsed.kind, saved: true });
  } catch (error) {
    console.error('[ADMIN/DRIVER-DOCS/UPLOAD]', error);
    res.status(502).json({ error: 'Impossible de stocker le document' });
  }
}

/** GET /api/admin/transport/conducteurs/:id/documents/:kind/url */
async function signedUrl(req: Request, res: Response): Promise<void> {
  const parsed = validatedDocumentParams(req);
  if (!parsed) {
    res.status(400).json({ error: 'Identifiant conducteur ou type de document invalide' });
    return;
  }

  try {
    if (!(await conductorExists(parsed.id))) {
      res.status(404).json({ error: 'Conducteur introuvable' });
      return;
    }
    const storage = await privateStorage();
    if (!storage.client) {
      res.status(503).json({ error: storage.error });
      return;
    }
    const latest = await latestDocument(storage.client, parsed.id, parsed.kind);
    if (!latest) {
      res.status(404).json({ error: 'Document introuvable' });
      return;
    }

    const { data, error } = await storage.client.storage
      .from(BUCKET)
      .createSignedUrl(latest.path, 60);
    if (error || !data?.signedUrl) {
      throw error ?? new Error('URL signée absente');
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ url: data.signedUrl, expiresInSeconds: 60 });
  } catch (error) {
    console.error('[ADMIN/DRIVER-DOCS/SIGNED-URL]', error);
    res.status(502).json({ error: 'Impossible de consulter le document' });
  }
}

export const adminDriverDocumentsController = { status, list, upload, signedUrl };
