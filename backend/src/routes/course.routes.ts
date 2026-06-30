import { Router, Request, Response } from 'express';
import { CourseController } from '../controllers/course.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createCourseSchema, rateCourseSchema } from '../validators';

const router = Router();
const courseController = new CourseController();

// 🔒 Sécurité globale du routeur
router.use(authenticate);

// ============================================================
// 1. ROUTES DE RÉCUPÉRATION SPÉCIFIQUES (Radar & Livraisons)
// ============================================================

// 💡 On utilise "/mine/..." pour garantir qu'Express ne confonde JAMAIS avec un ID
router.get('/mine/conducteur', (req: Request, res: Response) => 
  courseController.getConducteurCourses(req, res)
);

router.get('/mine/chauffeur', (req: Request, res: Response) => 
  courseController.getChauffeurLivraisons(req, res)
);

router.get('/nearby-drivers', (req: Request, res: Response) => 
  courseController.findNearbyDrivers(req, res)
);

router.get('/weekly-stats', (req: Request, res: Response) => 
  courseController.getWeeklyStats(req, res)
);


// ============================================================
// 2. ROUTES GÉNÉRALES (Historique & Création)
// ============================================================

router.get('/', (req: Request, res: Response) => 
  courseController.getUserCourses(req, res)
);

router.post('/', validate(createCourseSchema), (req: Request, res: Response) => 
  courseController.createCourse(req, res)
);


// ============================================================
// 3. ACTIONS & DÉTAILS (Routes avec :id TOUJOURS en dernier)
// ============================================================

router.get('/:id', (req: Request, res: Response) => 
  courseController.getCourseById(req, res)
);

router.post('/:id/rate', validate(rateCourseSchema), (req: Request, res: Response) => 
  courseController.rateCourse(req, res)
);

router.patch('/:id/accepter', (req: Request, res: Response) => 
  courseController.accepterCourse(req, res)
);

router.patch('/:id/demarrer', (req: Request, res: Response) => 
  courseController.demarrerCourse(req, res)
);

router.patch('/:id/terminer', (req: Request, res: Response) => 
  courseController.terminerCourse(req, res)
);

export default router;