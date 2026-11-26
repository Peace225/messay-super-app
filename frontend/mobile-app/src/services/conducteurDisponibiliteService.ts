import api from './api';

export interface DisponibiliteConducteur {
  conducteurId: string;
  statut: string;
  disponible: boolean;
  isAvailable: boolean;
  isVerified: boolean;
  isOnline: boolean;
  rating: number | null;
}

export const conducteurDisponibiliteService = {
  async get(): Promise<DisponibiliteConducteur> {
    const { data } = await api.get<DisponibiliteConducteur>(
      '/conducteurs/me/disponibilite',
    );
    return data;
  },

  async set(disponible: boolean): Promise<DisponibiliteConducteur> {
    const { data } = await api.patch<DisponibiliteConducteur>(
      '/conducteurs/me/disponibilite',
      { disponible },
    );
    return data;
  },
};
