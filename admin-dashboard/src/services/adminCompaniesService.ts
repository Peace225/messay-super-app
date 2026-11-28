import api from './api';

export type AdminCompany = {
  id: string;
  name: string;
  description: string | null;
  telephone: string | null;
  logo_url: string | null;
  bus_image_url: string | null;
  is_active: boolean;
  is_verified: boolean;
};
export type NewCompany = {
  name: string;
  description: string;
  telephone: string;
  logo_url: string | null;
  bus_image_url: string | null;
};
const base = '/admin/companies';

export const adminCompaniesService = {
  async list() {
    const response = await api.get<{ items: AdminCompany[] }>(base);
    return response.data.items;
  },
  async create(payload: NewCompany) {
    const response = await api.post<AdminCompany>(base, payload);
    return response.data;
  },
  async approve(id: string) {
    const response = await api.patch<AdminCompany>(`${base}/${encodeURIComponent(id)}/approve`);
    return response.data;
  },
  async suspend(id: string) {
    const response = await api.patch<AdminCompany>(`${base}/${encodeURIComponent(id)}/suspend`);
    return response.data;
  },
  async updateMedia(id: string, logo_url: string | null, bus_image_url: string | null) {
    const response = await api.patch<AdminCompany>(`${base}/${encodeURIComponent(id)}/media`, { logo_url, bus_image_url });
    return response.data;
  },
  async upload(kind: 'logo' | 'cover', file: File): Promise<string> {
    const response = await api.post<{ url: string }>(`${base}/media/${kind}`, file, {
      headers: { 'Content-Type': 'application/octet-stream' },
      timeout: 45000,
    });
    return response.data.url;
  },
};
