import { Request, Response } from 'express';
import { CourseService } from '../services/course.service';

const courseService = new CourseService();

export class CourseController {
  /**
   * Créer une demande de course
   */
  async createCourse(req: Request, res: Response): Promise<void> {
    try {
      // Les données sont déjà validées par le middleware validate(createCourseSchema)
      const result = await courseService.createCourse(req.userId!, req.body);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Obtenir l'historique des courses (User ou Admin)
   */
  async getUserCourses(req: Request, res: Response): Promise<void> {
    try {
      const courses = (req.userRole === 'ADMIN') 
        ? await courseService.getAllCourses() 
        : await courseService.getUserCourses(req.userId!);
        
      res.status(200).json({ courses });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtenir les détails d'une course spécifique
   */
  async getCourseById(req: Request, res: Response): Promise<void> {
    try {
      const course = await courseService.getCourseById(req.params.id);
      if (!course) {
        res.status(404).json({ error: "Course non trouvée" });
        return;
      }
      res.status(200).json(course);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Noter une course
   */
  async rateCourse(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // req.body est déjà validé par rateCourseSchema
      const result = await courseService.rateCourse(id, req.body);
      res.status(200).json({ message: 'Course notée avec succès', result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Trouver les conducteurs à proximité via Query Params
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

  // --- ACTIONS CONDUCTEUR ---

  async accepterCourse(req: Request, res: Response): Promise<void> {
    try {
      const course = await courseService.accepterCourse(req.params.id, req.userId!);
      res.status(200).json({ message: 'Course acceptée', course });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async demarrerCourse(req: Request, res: Response): Promise<void> {
    try {
      const course = await courseService.demarrerCourse(req.params.id, req.userId!);
      res.status(200).json({ message: 'Course démarrée', course });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async terminerCourse(req: Request, res: Response): Promise<void> {
    try {
      const course = await courseService.terminerCourse(req.params.id, req.userId!);
      res.status(200).json({ message: 'Course terminée', course });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getWeeklyStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await courseService.getWeeklyStats();
      res.status(200).json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}