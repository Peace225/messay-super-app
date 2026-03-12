import prisma from '../config/database';
import { Course, Prisma } from '@prisma/client';

export const CourseRepository = {
  // Trouver une course par ID avec tous les détails
  async findById(id: string): Promise<Course | null> {
    return await prisma.course.findUnique({
      where: { id },
      include: {
        user: true,
        conducteur: { include: { user: true } }
      }
    });
  },

  // Créer une course (données brutes)
  async create(data: Prisma.CourseCreateInput): Promise<Course> {
    return await prisma.course.create({
      data,
    });
  },

  // Mettre à jour le statut
  async updateStatus(id: string, statut: any): Promise<Course> {
    return await prisma.course.update({
      where: { id },
      data: { statut }
    });
  },

  // Récupérer les courses d'un utilisateur
  async findByUserId(userId: string): Promise<Course[]> {
    return await prisma.course.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }
};