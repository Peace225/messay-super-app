import prisma from '../config/database';
import { calculateDistance, calculateCoursePrice, estimateDuration } from '../utils/distance';
import { CreateCourseInput } from '../validators/course.validator';
import { getIO } from '../server'; // Utilise getIO pour éviter les problèmes d'import circulaire

const COURSE_INCLUDE = {
  user: { select: { id: true, nom: true, prenom: true, telephone: true, photo: true } },
  conducteur: { 
    include: { 
      user: { select: { nom: true, prenom: true, photo: true, telephone: true } } 
    } 
  },
};

export class CourseService {

  // 📊 STATS : Ajout de la gestion ADMIN pour éviter le crash 500
  async getWeeklyStats(userId: string) {
    const io = getIO();
    
    // 1. Chercher si c'est un Moussa (Tricycle)
    const conducteur = await prisma.conducteur.findUnique({ where: { userId } });
    if (conducteur) {
      const today = new Date();
      const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 1));
      firstDayOfWeek.setHours(0, 0, 0, 0);

      const coursesSemaine = await prisma.course.findMany({
        where: {
          conducteurId: conducteur.id,
          statut: 'TERMINEE',
          createdAt: { gte: firstDayOfWeek }
        }
      });

      return {
        totalRevenus: coursesSemaine.reduce((sum, c) => sum + c.prix, 0),
        totalCourses: coursesSemaine.length
      };
    }

    // 2. Chercher si c'est un Ibrahim (BTP)
    const chauffeur = await prisma.chauffeur.findUnique({ where: { userId } });
    if (chauffeur) return { totalRevenus: 0, totalCourses: 0 };

    // 3. Cas de l'ADMIN (Dashboard Principal)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.role === 'ADMIN') {
      const allDone = await prisma.course.findMany({ where: { statut: 'TERMINEE' } });
      return {
        totalRevenus: allDone.reduce((sum, c) => sum + c.prix, 0),
        totalCourses: allDone.length,
        totalUsers: await prisma.user.count(),
        activeConducteurs: await prisma.conducteur.count({ where: { statut: 'DISPONIBLE' } })
      };
    }

    throw new Error("Profil professionnel non trouvé");
  }

  // ⚙️ ACTIONS : Création avec notification Dashboard
  async createCourse(userId: string, data: CreateCourseInput) {
    const distance = calculateDistance(data.departLatitude, data.departLongitude, data.destinationLatitude, data.destinationLongitude);
    const dureeEstimee = estimateDuration(distance);
    
    const tarif = await prisma.tarifCourse.findFirst({ where: { isActif: true } });
    if (!tarif) throw new Error('Aucun tarif configuré');

    const prix = calculateCoursePrice(distance, dureeEstimee, tarif);

    const course = await prisma.course.create({
      data: { userId, ...data, distance, dureeEstimee, prix, statut: 'EN_ATTENTE' },
      include: COURSE_INCLUDE
    });

    // 📣 TEMPS RÉEL : On envoie l'événement que ton Header écoute
    const io = getIO();
    io.emit('new_notification', {
      title: '🚕 Nouvelle Course',
      // 🛠️ CORRECTION : Utilisation de departAdresse et destinationAdresse
      message: `De ${course.departAdresse} vers ${course.destinationAdresse}`,
      type: 'COURSE'
    });
    
    // Pour le radar des conducteurs
    io.emit('new-course-available', course);

    return course;
  }

  // ✅ ACTIONS : Accepter la course
  async accepterCourse(courseId: string, userId: string) {
    const conducteur = await prisma.conducteur.findUnique({ where: { userId }, include: { user: true } });
    if (!conducteur) throw new Error('Conducteur non trouvé');
    
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course || course.statut !== 'EN_ATTENTE') throw new Error('Course indisponible');

    return await prisma.$transaction(async (tx) => {
      const updatedCourse = await tx.course.update({
        where: { id: courseId },
        data: { conducteurId: conducteur.id, statut: 'ACCEPTEE' },
        include: COURSE_INCLUDE
      });

      await tx.conducteur.update({
        where: { id: conducteur.id },
        data: { statut: 'EN_COURSE' }
      });

      const io = getIO();
      // Notifier l'utilisateur spécifique
      io.to(`user-${course.userId}`).emit('status-changed', { 
        statut: 'ACCEPTEE', 
        message: `Le conducteur ${conducteur.user.prenom} arrive !` 
      });

      return updatedCourse;
    });
  }

  // 🏁 ACTIONS : Terminer la course
  async terminerCourse(courseId: string, userId: string) {
    const conducteur = await prisma.conducteur.findUnique({ where: { userId } });
    if (!conducteur) throw new Error('Conducteur non trouvé');

    return await prisma.$transaction(async (tx) => {
      const course = await tx.course.update({
        where: { id: courseId },
        data: { statut: 'TERMINEE', heureFin: new Date() },
        include: COURSE_INCLUDE
      });

      await tx.conducteur.update({
        where: { id: conducteur.id },
        data: { statut: 'DISPONIBLE', nombreCourses: { increment: 1 } }
      });

      const io = getIO();
      // Notifier l'admin pour mettre à jour les graphiques
      io.emit('new_notification', {
        title: '🏁 Course Terminée',
        message: `Revenu généré : ${course.prix} FCFA`,
        type: 'STATS'
      });

      return course;
    });
  }

  // =====================================================================
  // 🛠️ MÉTHODES MANQUANTES AJOUTÉES POUR LE CONTRÔLEUR
  // =====================================================================

  async getConducteurCourses(userId: string) {
    const conducteur = await prisma.conducteur.findUnique({ where: { userId } });
    if (!conducteur) return [];
    
    return prisma.course.findMany({
      where: { conducteurId: conducteur.id },
      orderBy: { createdAt: 'desc' },
      include: COURSE_INCLUDE
    });
  }

  async getUserCourses(userId: string) {
    return prisma.course.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      include: COURSE_INCLUDE
    });
  }

  async getCourseById(id: string) {
    const course = await prisma.course.findUnique({
      where: { id },
      include: COURSE_INCLUDE
    });
    if (!course) throw new Error('Course introuvable');
    return course;
  }

  async findNearbyDrivers(lat: number, lng: number) {
    // ⚠️ Version simple qui récupère les conducteurs disponibles. 
    // Plus tard, tu pourras utiliser les coordonnées (lat, lng) pour filtrer par distance.
    return prisma.conducteur.findMany({
      where: { statut: 'DISPONIBLE' },
      include: { user: true }
    });
  }

  async demarrerCourse(courseId: string, userId: string) {
    const conducteur = await prisma.conducteur.findUnique({ where: { userId } });
    if (!conducteur) throw new Error('Conducteur non trouvé');

    return prisma.course.update({
      where: { id: courseId },
      data: { statut: 'EN_COURS' },
      include: COURSE_INCLUDE
    });
  }
}