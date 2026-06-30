import { Request, Response } from 'express';
import { CourseService } from '../services/course.service';
import { getIO } from '../server'; 

interface AuthenticatedRequest extends Request {
  user?: any;
}

const courseService = new CourseService();

export class CourseController {

  /**
   * 🎫 CLIENT : Créer une demande
   */
  createCourse = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Non authentifié' });
        return;
      }

      const course = await courseService.createCourse(userId, req.body);
      const io = getIO();

      // 📡 Notifier tous les conducteurs
      io.emit('new_course_available', {
        id: course.id,
        depart: course.departAdresse || course.pickupAddress,
        destination: course.destinationAdresse || course.destAddress,
        prix: course.prix || course.estimatedPrice,
        type: course.type,
        clientId: userId,
        message: "🚕 Nouvelle course disponible !"
      });

      // Notifier l'admin
      io.to('admin-room').emit('new_notification', {
        title: 'Nouvelle Course',
        message: `Course de ${course.prix || course.estimatedPrice} FCFA`,
        type: 'COURSE',
        timestamp: new Date()
      });

      res.status(201).json(course);
    } catch (error: any) {
      console.error('❌ Erreur createCourse:', error);
      res.status(400).json({ error: error.message || 'Erreur création course' });
    }
  }

  /**
   * ✅ CONDUCTEUR : Accepter course
   */
  accepterCourse = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const courseId = req.params.id;
      
      if (!userId) {
        res.status(401).json({ error: 'Non authentifié' });
        return;
      }

      const course = await courseService.accepterCourse(courseId, userId);
      const io = getIO();

      // 📡 Notifier le CLIENT (room: user-{userId})
      io.to(`user-${course.userId}`).emit('course_accepted', {
        courseId: course.id,
        conducteur: {
          id: course.conducteurId,
          nom: course.conducteur?.user?.nom,
          prenom: course.conducteur?.user?.prenom,
          telephone: course.conducteur?.user?.telephone,
          photo: course.conducteur?.user?.photo,
          rating: course.conducteur?.rating,
        },
        tricycle: {
          modele: course.tricycle?.modele,
          immatriculation: course.tricycle?.immatriculation,
          couleur: course.tricycle?.couleur,
        },
        message: "✅ Votre conducteur arrive !"
      });

      // Notifier les autres conducteurs que la course est prise
      io.emit('course_taken', { courseId });

      res.status(200).json({ 
        message: 'Course acceptée avec succès', 
        course 
      });
    } catch (error: any) {
      console.error('❌ Erreur accepterCourse:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * 🚀 Démarrer la course
   */
  demarrerCourse = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const course = await courseService.demarrerCourse(req.params.id, userId);
      const io = getIO();

      io.to(`user-${course.userId}`).emit('course_started', {
        courseId: course.id,
        message: "🚀 Course démarrée"
      });

      io.to(`course-${course.id}`).emit('driver_location_start');

      res.status(200).json({ message: 'Course démarrée', course });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * 🏁 TERMINER LA COURSE
   */
  terminerCourse = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const course = await courseService.terminerCourse(req.params.id, userId);
      const io = getIO();

      // Notifier le client
      io.to(`user-${course.userId}`).emit('course_finished', {
        courseId: course.id,
        prixFinal: course.prixFinal || course.prix,
        duree: course.duree,
        distance: course.distance,
        message: "🏁 Course terminée"
      });

      // Mettre à jour stats admin
      io.to('admin-room').emit('stats_updated', { 
        type: 'COURSE_COMPLETED',
        amount: course.prixFinal || course.prix,
        courseId: course.id
      });

      res.status(200).json({ message: 'Course terminée', course });
    } catch (error: any) {
      console.error('❌ Erreur terminerCourse:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * 📊 STATS HEBDO
   */
  getWeeklyStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: "Non authentifié" });
        return;
      }
      
      const stats = await courseService.getWeeklyStats(userId);
      res.status(200).json(stats);
    } catch (error: any) {
      console.error("❌ Erreur Stats:", error);
      res.status(200).json({ 
        totalCourses: 0, 
        totalRevenue: 0, 
        chartData: [],
        weeklyData: []
      });
    }
  }

  /**
   * 📍 TROUVER CHAUFFEURS PROCHES - CORRIGÉ
   */
  findNearbyDrivers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // ✅ CORRECTION: Utilise query pour GET, pas body
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radius = parseFloat(req.query.radius as string) || 5;

      if (isNaN(lat) || isNaN(lng)) {
        res.status(400).json({ error: "Coordonnées invalides" });
        return;
      }

      const drivers = await courseService.findNearbyDrivers(lat, lng, radius);
      res.status(200).json(drivers);
    } catch (error: any) {
      console.error('❌ Erreur findNearby:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // ===== AUTRES MÉTHODES =====

  getConducteurCourses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const courses = await courseService.getConducteurCourses(userId);
      res.status(200).json(courses);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  getUserCourses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const courses = await courseService.getUserCourses(userId);
      res.status(200).json(courses);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  getCourseById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const course = await courseService.getCourseById(req.params.id);
      if (!course) {
        res.status(404).json({ error: 'Course non trouvée' });
        return;
      }
      res.status(200).json(course);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  rateCourse = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { rating, comment } = req.body;
      
      await courseService.rateCourse(req.params.id, userId, rating, comment);
      
      res.status(200).json({ message: "Course notée avec succès" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  getChauffeurLivraisons = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const livraisons = await courseService.getChauffeurLivraisons(userId);
      res.status(200).json(livraisons || []);
    } catch (error: any) {
      res.status(500).json({ error: "Erreur récupération livraisons" });
    }
  }
}