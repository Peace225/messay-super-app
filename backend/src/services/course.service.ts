import prisma from '../config/database';
import { calculateDistance, calculateCoursePrice, estimateDuration } from '../utils/distance';
import { CreateCourseInput } from '../validators/course.validator';

/** Erreur métier utilisable par le contrôleur HTTP. */
export class CourseError extends Error {
  constructor(message: string, public readonly statusCode: number = 400) {
    super(message);
    this.name = 'CourseError';
  }
}

const COURSE_INCLUDE = {
  user: { select: { id: true, nom: true, prenom: true, telephone: true, photo: true } },
  conducteur: {
    include: {
      user: { select: { nom: true, prenom: true, photo: true, telephone: true } },
      tricycle: { select: { modele: true, immatriculation: true } },
    },
  },
} as const;

const AVAILABLE_COURSE_INCLUDE = {
  user: { select: { nom: true, prenom: true } },
} as const;

function mondayOfCurrentWeek(): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

export class CourseService {
  private async getVerifiedConducteur(userId: string) {
    const conducteur = await prisma.conducteur.findUnique({
      where: { userId },
      include: { user: { select: { nom: true, prenom: true, role: true, isBlocked: true } } },
    });
    if (!conducteur || conducteur.user.role !== 'CONDUCTEUR') {
      throw new CourseError('Profil conducteur introuvable', 403);
    }
    if (conducteur.user.isBlocked) throw new CourseError('Compte bloqué', 403);
    if (!conducteur.isVerified) throw new CourseError('Conducteur non vérifié par l’administration', 403);
    return conducteur;
  }

  /** Les montants représentent les courses terminées, pas nécessairement les paiements encaissés. */
  async getWeeklyStats(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, isBlocked: true } });
    if (!user || user.isBlocked) throw new CourseError('Accès refusé', 403);
    const since = mondayOfCurrentWeek();

    if (user.role === 'ADMIN') {
      const [courses, totalUsers, activeConducteurs] = await Promise.all([
        prisma.course.findMany({
          where: { statut: 'TERMINEE', heureFin: { gte: since } },
          select: { prix: true, prixFinal: true },
        }),
        prisma.user.count(),
        prisma.conducteur.count({
          where: { statut: 'DISPONIBLE', disponible: true, isAvailable: true, isVerified: true, user: { isBlocked: false } },
        }),
      ]);
      return {
        totalRevenus: courses.reduce((sum, c) => sum + (c.prixFinal ?? c.prix), 0),
        totalCourses: courses.length,
        totalUsers,
        activeConducteurs,
      };
    }

    if (user.role !== 'CONDUCTEUR') throw new CourseError('Accès réservé aux conducteurs', 403);
    const conducteur = await this.getVerifiedConducteur(userId);
    const courses = await prisma.course.findMany({
      where: { conducteurId: conducteur.id, statut: 'TERMINEE', heureFin: { gte: since } },
      select: { prix: true, prixFinal: true },
    });
    return {
      totalRevenus: courses.reduce((sum, c) => sum + (c.prixFinal ?? c.prix), 0),
      totalCourses: courses.length,
    };
  }

  async createCourse(userId: string, data: CreateCourseInput) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isBlocked: true } });
    if (!user || user.isBlocked) throw new CourseError('Compte non autorisé', 403);

    const distance = calculateDistance(
      data.departLatitude, data.departLongitude, data.destinationLatitude, data.destinationLongitude,
    );
    if (!Number.isFinite(distance) || distance <= 0) throw new CourseError('Départ et destination invalides');
    const dureeEstimee = estimateDuration(distance);
    const tarif = await prisma.tarifCourse.findFirst({ where: { isActif: true }, orderBy: { createdAt: 'desc' } });
    if (!tarif) throw new CourseError('Aucun tarif actif configuré', 503);
    const prix = calculateCoursePrice(distance, dureeEstimee, tarif);
    if (!Number.isFinite(prix) || prix < 0) throw new CourseError('Calcul du tarif invalide');

    return prisma.course.create({
      data: {
        userId,
        departLatitude: data.departLatitude,
        departLongitude: data.departLongitude,
        departAdresse: data.departAdresse,
        destinationLatitude: data.destinationLatitude,
        destinationLongitude: data.destinationLongitude,
        destinationAdresse: data.destinationAdresse,
        partageTrajet: data.partageTrajet ?? false,
        distance,
        dureeEstimee,
        prix,
        statut: 'EN_ATTENTE',
      },
      include: COURSE_INCLUDE,
    });
  }

  /** Verrou logique par CAS : un seul conducteur disponible et une seule attribution par course. */
  async accepterCourse(courseId: string, userId: string) {
    const conducteur = await this.getVerifiedConducteur(userId);
    return prisma.$transaction(async (tx) => {
      const lock = await tx.conducteur.updateMany({
        where: {
          id: conducteur.id,
          statut: 'DISPONIBLE',
          disponible: true,
          isAvailable: true,
          isVerified: true,
        },
        data: { statut: 'EN_COURSE', disponible: false, isAvailable: false },
      });
      if (lock.count !== 1) throw new CourseError('Conducteur indisponible ou déjà en course', 409);

      const accepted = await tx.course.updateMany({
        where: { id: courseId, statut: 'EN_ATTENTE', conducteurId: null },
        data: { conducteurId: conducteur.id, statut: 'ACCEPTEE' },
      });
      // Si une autre transaction a gagné, l'exception annule aussi le verrou du conducteur.
      if (accepted.count !== 1) throw new CourseError('Course déjà acceptée ou indisponible', 409);
      return tx.course.findUniqueOrThrow({ where: { id: courseId }, include: COURSE_INCLUDE });
    });
  }

  async demarrerCourse(courseId: string, userId: string) {
    const conducteur = await this.getVerifiedConducteur(userId);
    const result = await prisma.course.updateMany({
      where: { id: courseId, conducteurId: conducteur.id, statut: 'ACCEPTEE' },
      data: { statut: 'EN_COURS', heureDebut: new Date() },
    });
    if (result.count !== 1) throw new CourseError('Course non attribuée ou impossible à démarrer', 409);
    return prisma.course.findUniqueOrThrow({ where: { id: courseId }, include: COURSE_INCLUDE });
  }

  async terminerCourse(courseId: string, userId: string) {
    const conducteur = await this.getVerifiedConducteur(userId);
    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const done = await tx.course.updateMany({
        where: { id: courseId, conducteurId: conducteur.id, statut: 'EN_COURS' },
        data: { statut: 'TERMINEE', heureFin: now },
      });
      if (done.count !== 1) throw new CourseError('Course non attribuée ou non démarrée', 409);
      await tx.conducteur.update({
        where: { id: conducteur.id },
        data: {
          statut: 'DISPONIBLE',
          disponible: true,
          isAvailable: true,
          nombreCourses: { increment: 1 },
        },
      });
      return tx.course.findUniqueOrThrow({ where: { id: courseId }, include: COURSE_INCLUDE });
    });
  }

  async getConducteurCourses(userId: string) {
    const conducteur = await this.getVerifiedConducteur(userId);
    return prisma.course.findMany({
      where: { conducteurId: conducteur.id },
      orderBy: { createdAt: 'desc' },
      include: COURSE_INCLUDE,
    });
  }

  /** Radar HTTP : utile au chargement ou après une déconnexion du Socket.IO. */
  async getAvailableCourses(userId: string) {
    const conducteur = await this.getVerifiedConducteur(userId);
    if (conducteur.statut !== 'DISPONIBLE' || !conducteur.disponible || !conducteur.isAvailable) return [];
    return prisma.course.findMany({
      where: { statut: 'EN_ATTENTE', conducteurId: null },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: AVAILABLE_COURSE_INCLUDE,
    });
  }

  async getUserCourses(userId: string) {
    return prisma.course.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: COURSE_INCLUDE,
    });
  }

  /** Evite les consultations de courses d'autres utilisateurs par ID. */
  async getCourseById(id: string, requesterId: string) {
    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true, isBlocked: true },
    });
    if (!requester || requester.isBlocked) throw new CourseError('Accès refusé', 403);
    const course = await prisma.course.findUnique({ where: { id }, include: COURSE_INCLUDE });
    if (!course) throw new CourseError('Course introuvable', 404);
    if (requester.role !== 'ADMIN' && course.userId !== requesterId && course.conducteur?.userId !== requesterId) {
      throw new CourseError('Cette course ne vous appartient pas', 403);
    }
    return course;
  }

  async findNearbyDrivers(lat: number, lng: number, rayonKm = 5) {
    if (![lat, lng, rayonKm].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || rayonKm <= 0 || rayonKm > 30) {
      throw new CourseError('Coordonnées ou rayon invalides');
    }
    const conducteurs = await prisma.conducteur.findMany({
      where: {
        statut: 'DISPONIBLE', disponible: true, isAvailable: true, isVerified: true,
        positionLatitude: { not: null }, positionLongitude: { not: null },
        user: { isBlocked: false },
      },
      select: {
        id: true, rating: true, vehiculeType: true,
        positionLatitude: true, positionLongitude: true,
        user: { select: { nom: true, prenom: true, photo: true } },
        tricycle: { select: { modele: true } },
      },
    });
    return conducteurs.map(c => ({
      ...c,
      distanceKm: calculateDistance(lat, lng, c.positionLatitude!, c.positionLongitude!),
    })).filter(c => c.distanceKm <= rayonKm).sort((a, b) => a.distanceKm - b.distanceKm);
  }

  async rateCourse(courseId: string, userId: string, rating: number, comment?: string) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new CourseError('Note entre 1 et 5 requise');
    return prisma.$transaction(async (tx) => {
      const updated = await tx.course.updateMany({
        where: {
          id: courseId, userId, statut: 'TERMINEE',
          conducteurId: { not: null }, noteConducteur: null,
        },
        data: { noteConducteur: rating, commentaire: comment?.trim() || null },
      });
      if (updated.count !== 1) throw new CourseError('Course non éligible ou déjà notée', 409);
      const course = await tx.course.findUniqueOrThrow({ where: { id: courseId } });
      const average = await tx.course.aggregate({
        where: { conducteurId: course.conducteurId!, noteConducteur: { not: null } },
        _avg: { noteConducteur: true },
      });
      if (average._avg.noteConducteur !== null) {
        await tx.conducteur.update({
          where: { id: course.conducteurId! },
          data: { rating: average._avg.noteConducteur, note: average._avg.noteConducteur },
        });
      }
      return tx.course.findUniqueOrThrow({ where: { id: courseId }, include: COURSE_INCLUDE });
    });
  }
}
