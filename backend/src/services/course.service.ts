import prisma from '../config/database';
import { calculateDistance, calculateCoursePrice, estimateDuration } from '../utils/distance';
import { CreateCourseInput } from '../validators/course.validator';

/**
 * Service de gestion des courses (tricycles)
 */
export class CourseService {
  /**
   * Créer une nouvelle demande de course
   */
  async createCourse(userId: string, data: CreateCourseInput) {
    // Calculer la distance
    const distance = calculateDistance(
      data.departLatitude,
      data.departLongitude,
      data.destinationLatitude,
      data.destinationLongitude
    );

    // Estimer la durée
    const dureeEstimee = estimateDuration(distance);

    // Récupérer le tarif actif
    const tarif = await prisma.tarifCourse.findFirst({
      where: { isActif: true },
    });

    if (!tarif) {
      throw new Error('Aucun tarif configuré');
    }

    // Calculer le prix
    const prix = calculateCoursePrice(distance, dureeEstimee, tarif);

    // Créer la course
    const course = await prisma.course.create({
      data: {
        userId,
        departLatitude: data.departLatitude,
        departLongitude: data.departLongitude,
        departAdresse: data.departAdresse,
        destinationLatitude: data.destinationLatitude,
        destinationLongitude: data.destinationLongitude,
        destinationAdresse: data.destinationAdresse,
        distance,
        dureeEstimee,
        prix,
        partageTrajet: data.partageTrajet || false,
        statut: 'EN_ATTENTE',
      },
      include: {
        user: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            telephone: true,
            photo: true,
          },
        },
      },
    });

    // Rechercher des conducteurs disponibles à proximité
    const conducteursProches = await this.findNearbyDrivers(
      data.departLatitude,
      data.departLongitude,
      5 // rayon de 5 km
    );

    return {
      course,
      conducteursDisponibles: conducteursProches.length,
      message: conducteursProches.length > 0
        ? 'Recherche de conducteur en cours...'
        : 'Aucun conducteur disponible pour le moment',
    };
  }

  /**
   * Trouver les conducteurs disponibles à proximité
   */
  async findNearbyDrivers(latitude: number, longitude: number, rayonKm: number = 5) {
    const conducteurs = await prisma.conducteur.findMany({
      where: {
        statut: 'DISPONIBLE',
        isVerified: true,
        positionLatitude: { not: null },
        positionLongitude: { not: null },
      },
      include: {
        user: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            photo: true,
            telephone: true,
          },
        },
      },
    });

    // Filtrer par distance
    const conducteursProches = conducteurs.filter((conducteur) => {
      if (!conducteur.positionLatitude || !conducteur.positionLongitude) {
        return false;
      }

      const distance = calculateDistance(
        latitude,
        longitude,
        conducteur.positionLatitude,
        conducteur.positionLongitude
      );

      return distance <= rayonKm;
    });

    // Trier par distance (plus proche en premier)
    return conducteursProches.sort((a, b) => {
      const distA = calculateDistance(
        latitude,
        longitude,
        a.positionLatitude!,
        a.positionLongitude!
      );
      const distB = calculateDistance(
        latitude,
        longitude,
        b.positionLatitude!,
        b.positionLongitude!
      );
      return distA - distB;
    });
  }

  /**
   * Accepter une course (conducteur)
   */
  async acceptCourse(courseId: string, conducteurId: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new Error('Course non trouvée');
    }

    if (course.statut !== 'EN_ATTENTE') {
      throw new Error('Cette course n\'est plus disponible');
    }

    // Vérifier que le conducteur est disponible
    const conducteur = await prisma.conducteur.findUnique({
      where: { id: conducteurId },
    });

    if (!conducteur || conducteur.statut !== 'DISPONIBLE') {
      throw new Error('Conducteur non disponible');
    }

    // Mettre à jour la course et le conducteur
    const [updatedCourse] = await prisma.$transaction([
      prisma.course.update({
        where: { id: courseId },
        data: {
          conducteurId,
          statut: 'ACCEPTEE',
        },
        include: {
          user: true,
          conducteur: {
            include: {
              user: true,
            },
          },
        },
      }),
      prisma.conducteur.update({
        where: { id: conducteurId },
        data: { statut: 'EN_COURSE' },
      }),
    ]);

    return updatedCourse;
  }

  /**
   * Démarrer une course
   */
  async startCourse(courseId: string, conducteurId: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new Error('Course non trouvée');
    }

    if (course.conducteurId !== conducteurId) {
      throw new Error('Vous n\'êtes pas le conducteur de cette course');
    }

    if (course.statut !== 'ACCEPTEE') {
      throw new Error('La course ne peut pas être démarrée');
    }

    return await prisma.course.update({
      where: { id: courseId },
      data: {
        statut: 'EN_COURS',
        heureDebut: new Date(),
      },
      include: {
        user: true,
        conducteur: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  /**
   * Terminer une course
   */
  async completeCourse(courseId: string, conducteurId: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new Error('Course non trouvée');
    }

    if (course.conducteurId !== conducteurId) {
      throw new Error('Vous n\'êtes pas le conducteur de cette course');
    }

    if (course.statut !== 'EN_COURS') {
      throw new Error('La course n\'est pas en cours');
    }

    // Mettre à jour la course et le conducteur
    const [updatedCourse] = await prisma.$transaction([
      prisma.course.update({
        where: { id: courseId },
        data: {
          statut: 'TERMINEE',
          heureFin: new Date(),
        },
        include: {
          user: true,
          conducteur: {
            include: {
              user: true,
            },
          },
        },
      }),
      prisma.conducteur.update({
        where: { id: conducteurId },
        data: {
          statut: 'DISPONIBLE',
          nombreCourses: { increment: 1 },
        },
      }),
    ]);

    return updatedCourse;
  }

  /**
   * Obtenir l'historique des courses d'un utilisateur
   */
  async getUserCourses(userId: string) {
    return await prisma.course.findMany({
      where: { userId },
      include: {
        conducteur: {
          include: {
            user: {
              select: {
                nom: true,
                prenom: true,
                photo: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Obtenir toutes les courses (pour admin)
   */
  async getAllCourses() {
    return await prisma.course.findMany({
      include: {
        user: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
            telephone: true,
            photo: true,
          },
        },
        conducteur: {
          include: {
            user: {
              select: {
                id: true,
                nom: true,
                prenom: true,
                photo: true,
                telephone: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Obtenir les statistiques hebdomadaires
   */
  async getWeeklyStats() {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Dimanche
    startOfWeek.setHours(0, 0, 0, 0);

    const courses = await prisma.course.findMany({
      where: {
        createdAt: {
          gte: startOfWeek,
        },
      },
      select: {
        createdAt: true,
        prix: true,
      },
    });

    // Initialiser les données pour chaque jour
    const weekDays = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const stats = weekDays.map((name, index) => ({
      name,
      courses: 0,
      revenue: 0,
    }));

    // Compter les courses par jour
    courses.forEach((course) => {
      const dayIndex = course.createdAt.getDay();
      stats[dayIndex].courses += 1;
      stats[dayIndex].revenue += course.prix;
    });

    return stats;
  }
}
