import { Request, Response } from 'express';
import { CourseService } from '../services/course.service';
import { createCourseSchema, updateCourseStatusSchema, rateCourseSchema } from '../validators/course.validator';

const courseService = new CourseService();

/**
 * Contrôleur de gestion des courses
 */
export class CourseController {
  /**
   * POST /api/courses - Créer une demande de course
   */
  async createCourse(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = createCourseSchema.parse(req.body);
      const result = await courseService.createCourse(req.userId!, validatedData);
      
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * GET /api/courses - Obtenir l'historique des courses
   */
  async getUserCourses(req: Request, res: Response): Promise<void> {
    try {
      // Si l'utilisateur est admin, retourner toutes les courses
      if (req.userRole === 'ADMIN') {
        const courses = await courseService.getAllCourses();
        res.status(200).json({ courses });
      } else {
        const courses = await courseService.getUserCourses(req.userId!);
        res.status(200).json({ courses });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/courses/:id - Obtenir les détails d'une course
   */
  async getCourseById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // TODO: Implémenter la logique
      res.status(200).json({ message: 'Course details' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/courses/:id/accept - Accepter une course (conducteur)
   */
  async acceptCourse(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { conducteurId } = req.body;
      
      const course = await courseService.acceptCourse(id, conducteurId);
      res.status(200).json({ course });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * POST /api/courses/:id/start - Démarrer une course
   */
  async startCourse(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { conducteurId } = req.body;
      
      const course = await courseService.startCourse(id, conducteurId);
      res.status(200).json({ course });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * POST /api/courses/:id/complete - Terminer une course
   */
  async completeCourse(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { conducteurId } = req.body;
      
      const course = await courseService.completeCourse(id, conducteurId);
      res.status(200).json({ course });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * POST /api/courses/:id/rate - Noter une course
   */
  async rateCourse(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const validatedData = rateCourseSchema.parse(req.body);
      
      // TODO: Implémenter la logique de notation
      res.status(200).json({ message: 'Course rated successfully' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * GET /api/courses/nearby-drivers - Trouver les conducteurs à proximité
   */
  async findNearbyDrivers(req: Request, res: Response): Promise<void> {
    try {
      const { latitude, longitude, rayon } = req.query;
      
      const drivers = await courseService.findNearbyDrivers(
        parseFloat(latitude as string),
        parseFloat(longitude as string),
        rayon ? parseFloat(rayon as string) : 5
      );
      
      res.status(200).json({ drivers });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/courses/weekly-stats - Obtenir les statistiques hebdomadaires
   */
  async getWeeklyStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await courseService.getWeeklyStats();
      res.status(200).json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

  /**
   * GET /api/courses/conducteur/mes-courses - Obtenir les courses du conducteur
   */
  async getConducteurCourses(req: Request, res: Response): Promise<void> {
    try {
      const courses = await courseService.getConducteurCourses(req.userId!);
      res.status(200).json(courses);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * PATCH /api/courses/:id/accepter - Accepter une course
   */
  async accepterCourse(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const course = await courseService.accepterCourse(id, req.userId!);
      res.status(200).json({ message: 'Course acceptée', course });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * PATCH /api/courses/:id/demarrer - Démarrer une course
   */
  async demarrerCourse(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const course = await courseService.demarrerCourse(id, req.userId!);
      res.status(200).json({ message: 'Course démarrée', course });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * PATCH /api/courses/:id/terminer - Terminer une course
   */
  async terminerCourse(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const course = await courseService.terminerCourse(id, req.userId!);
      res.status(200).json({ message: 'Course terminée', course });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}
