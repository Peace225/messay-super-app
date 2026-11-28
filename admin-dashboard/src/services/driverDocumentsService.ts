import api from './api';

export type DriverDocumentKind = 'photo' | 'permis' | 'identite' | 'carte-grise';

export interface DriverDocument {
  kind: DriverDocumentKind;
  name: string;
  createdAt: string | null;
  path: string;
}

const root = '/admin/transport/conducteurs';

export const driverDocumentsService = {
  async ensureReady(): Promise<void> {
    const { data } = await api.get<{ ready: boolean; error: string | null }>(`${root}/documents/status`);
    if (!data.ready) throw new Error(data.error || 'Stockage documentaire non configuré');
  },

  async list(conducteurId: string): Promise<DriverDocument[]> {
    const { data } = await api.get<{ items: DriverDocument[] }>(
      `${root}/${encodeURIComponent(conducteurId)}/documents`,
    );
    return data.items;
  },

  async upload(conducteurId: string, kind: DriverDocumentKind, file: File): Promise<void> {
    const data = new FormData();
    data.append('file', file, file.name);
    await api.post(
      `${root}/${encodeURIComponent(conducteurId)}/documents/${kind}`,
      data,
      // Axios must set the multipart boundary automatically; api.ts defaults to JSON.
      { headers: { 'Content-Type': undefined } },
    );
  },

  async signedUrl(conducteurId: string, kind: DriverDocumentKind): Promise<string> {
    const { data } = await api.get<{ url: string }>(
      `${root}/${encodeURIComponent(conducteurId)}/documents/${kind}/url`,
    );
    return data.url;
  },
};
