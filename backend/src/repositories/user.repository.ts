import prisma from '../config/database';
import { User, Prisma, UserRole } from '@prisma/client';

export const UserRepository = {
  /**
   * Trouver un utilisateur par son ID (Profil complet)
   */
  async findById(id: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { id },
      include: {
        conducteurProfile: true,
        chauffeurProfile: true,
      }
    });
  },

  /**
   * Trouver un utilisateur par son Email (Utile pour le Login)
   */
  async findByEmail(email: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { email },
    });
  },

  /**
   * Trouver un utilisateur par son Téléphone (Utile pour l'OTP)
   */
  async findByTelephone(telephone: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { telephone },
    });
  },

  /**
   * Créer un nouvel utilisateur (Registration)
   */
  async create(data: Prisma.UserCreateInput): Promise<User> {
    return await prisma.user.create({
      data,
    });
  },

  /**
   * Mettre à jour les informations de l'utilisateur (Profil, OTP, Tokens)
   */
  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return await prisma.user.update({
      where: { id },
      data,
    });
  },

  /**
   * Vérifier si un utilisateur existe par Email ou Téléphone
   */
  async exists(email: string, telephone: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: {
        OR: [
          { email },
          { telephone }
        ]
      }
    });
    return count > 0;
  },

  /**
   * Supprimer un utilisateur (GDPR / Désinscription)
   */
  async delete(id: string): Promise<User> {
    return await prisma.user.delete({
      where: { id },
    });
  }
};