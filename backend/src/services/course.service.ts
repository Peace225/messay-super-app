import prisma from '../config/database';
import { calculateDistance, calculateCoursePrice, estimateDuration } from '../utils/distance';
import { CreateCourseInput } from '../validators/course.validator';
import { io } from '../server'; // Import de l'instance Socket.IO

const COURSE_INCLUDE = {
  user: { select: { id: true, nom: true, prenom: true, telephone: true, photo: true } },
  conducteur: { include: { user: { select: { nom: true, prenom: true, photo: true, telephone: true } } } },
};

export class CourseService {
  
  async createCourse(userId: string, data: CreateCourseInput) {
    const distance = calculateDistance(data.departLatitude, data.departLongitude, data.destinationLatitude, data.destinationLongitude);
    const dureeEstimee = estimateDuration(distance);
    const tarif = await prisma.tarifCourse.findFirst({ where: { isActif: true } });

    if (!tarif) throw new Error('Aucun tarif configuré');

    const prix = calculateCoursePrice(distance, dureeEstimee, tarif);

    const course = await prisma.course.create({
      data: {
        userId,
        ...data,
        distance,
        dureeEstimee,
        prix,
        statut: 'EN_ATTENTE',
      },
      include: COURSE_INCLUDE
    });

    // 📣 TEMPS RÉEL : Notifier les conducteurs à proximité qu'une nouvelle course est dispo
    io.emit('new-course-available', { courseId: course.id, depart: data.departAdresse });

    return { course, conducteursDisponibles: 0 }; // findNearbyDrivers à intégrer ici
  }

  async accepterCourse(courseId: string, userId: string) {
    const conducteur = await prisma.conducteur.findUnique({ where: { userId } });
    if (!conducteur || conducteur.statut !== 'DISPONIBLE') throw new Error('Conducteur non disponible');

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course || course.statut !== 'EN_ATTENTE') throw new Error('Course non disponible');

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

      // 📣 TEMPS RÉEL : Informer l'utilisateur que sa course a été acceptée
      io.to(`course-${courseId}`).emit('status-changed', { 
        statut: 'ACCEPTEE', 
        conducteur: updatedCourse.conducteur 
      });

      return updatedCourse;
    });
  }

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

      // 📣 TEMPS RÉEL : Informer l'utilisateur que la course est finie (pour afficher la notation)
      io.to(`course-${courseId}`).emit('status-changed', { statut: 'TERMINEE' });

      return course;
    });
  }
}