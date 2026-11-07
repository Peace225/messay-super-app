import { Request, Response } from 'express';
import { CourseError, CourseService } from '../services/course.service';
import { getIO } from '../server';
import type { AuthenticatedRequest } from '../middleware/auth';

const courseService = new CourseService();

type HttpError = Error & { statusCode?: number; code?: string };

/** Ne jamais révéler les erreurs internes ou répondre 200 en cas d'échec. */
function sendError(res: Response, error: unknown, context: string): void {
  console.error(`[CourseController] ${context}`, error);

  if (error instanceof CourseError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  const known = error as HttpError | null;
  if (known?.code === 'P2025') {
    res.status(404).json({ error: 'Course introuvable' });
    return;
  }
  if (known?.code === 'P2034') {
    res.status(409).json({ error: 'Conflit de mise à jour, veuillez réessayer' });
    return;
  }

  res.status(500).json({ error: 'Erreur interne du serveur' });
}

/** Une défaillance Socket.IO ne doit pas transformer une écriture DB réussie en HTTP 500. */
function publishRealtime(publish: (io: ReturnType<typeof getIO>) => void): void {
  try {
    publish(getIO());
  } catch (error) {
    console.error('[CourseController] Notification temps réel non envoyée', error);
  }
}

function getUserId(req: AuthenticatedRequest, res: Response): string | null {
  const id = req.user?.id;
  if (typeof id !== 'string' || !id.trim()) {
    res.status(401).json({ error: 'Non authentifié' });
    return null;
  }
  return id;
}

function getCourseId(req: Request, res: Response): string | null {
  const id = req.params.id;
  if (typeof id !== 'string' || !id.trim()) {
    res.status(400).json({ error: 'Identifiant de course invalide' });
    return null;
  }
  return id;
}

function readNumber(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export class CourseController {
  createCourse = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = getUserId(req, res);
    if (!userId) return;

    try {
      // Validation du corps assurée par validate(createCourseSchema) dans les routes.
      const course = await courseService.createCourse(userId, req.body);

      publishRealtime((io) => {
        // Ne pas diffuser les adresses, numéros de téléphone ou coordonnées GPS en public.
        // Le radar recharge les détails autorisés via GET /api/courses/disponibles.
        const event = { courseId: course.id };
        io.emit('new-course-available', event);
        io.emit('new_course_available', event); // Compatibilité anciennes versions du mobile

        // IMPORTANT : authentifier et autoriser les accès à admin-room dans server.ts.
        io.to('admin-room').emit('new_notification', {
          title: 'Nouvelle course',
          message: 'Une nouvelle course a été enregistrée',
          type: 'COURSE',
          timestamp: new Date().toISOString(),
        });
      });

      res.status(201).json(course);
    } catch (error: unknown) {
      sendError(res, error, 'createCourse');
    }
  };

  accepterCourse = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = getUserId(req, res);
    if (!userId) return;
    const courseId = getCourseId(req, res);
    if (!courseId) return;

    try {
      // Le service vérifie la disponibilité, l'affectation unique et le rôle conducteur.
      const course = await courseService.accepterCourse(courseId, userId);
      const tricycle = course.conducteur?.tricycle;

      publishRealtime((io) => {
        io.to(`user-${course.userId}`).emit('course_accepted', {
          courseId: course.id,
          conducteur: {
            id: course.conducteurId,
            nom: course.conducteur?.user.nom ?? null,
            prenom: course.conducteur?.user.prenom ?? null,
            telephone: course.conducteur?.user.telephone ?? null,
            photo: course.conducteur?.user.photo ?? null,
            rating: course.conducteur?.rating ?? null,
          },
          tricycle: tricycle
            ? { modele: tricycle.modele, immatriculation: tricycle.immatriculation }
            : null,
          message: 'Votre conducteur arrive !',
        });
        io.emit('course_taken', { courseId: course.id });
        io.to(`course-${course.id}`).emit('status-changed', {
          courseId: course.id,
          statut: 'ACCEPTEE',
        });
      });

      res.status(200).json({ message: 'Course acceptée avec succès', course });
    } catch (error: unknown) {
      sendError(res, error, 'accepterCourse');
    }
  };

  demarrerCourse = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = getUserId(req, res);
    if (!userId) return;
    const courseId = getCourseId(req, res);
    if (!courseId) return;

    try {
      const course = await courseService.demarrerCourse(courseId, userId);
      publishRealtime((io) => {
        io.to(`user-${course.userId}`).emit('course_started', {
          courseId: course.id,
          message: 'Course démarrée',
        });
        io.to(`course-${course.id}`).emit('status-changed', {
          courseId: course.id,
          statut: 'EN_COURS',
        });
        io.to(`course-${course.id}`).emit('driver_location_start', { courseId: course.id });
      });
      res.status(200).json({ message: 'Course démarrée', course });
    } catch (error: unknown) {
      sendError(res, error, 'demarrerCourse');
    }
  };

  terminerCourse = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = getUserId(req, res);
    if (!userId) return;
    const courseId = getCourseId(req, res);
    if (!courseId) return;

    try {
      const course = await courseService.terminerCourse(courseId, userId);
      const prixFinal = course.prixFinal ?? course.prix;

      publishRealtime((io) => {
        io.to(`user-${course.userId}`).emit('course_finished', {
          courseId: course.id,
          prixFinal,
          duree: course.duree,
          distance: course.distance,
          message: 'Course terminée',
        });
        io.to(`course-${course.id}`).emit('status-changed', {
          courseId: course.id,
          statut: 'TERMINEE',
        });
        // Aucun montant diffusé dans un salon admin encore non sécurisé.
        io.to('admin-room').emit('stats_updated', {
          type: 'COURSE_COMPLETED',
          courseId: course.id,
        });
      });

      res.status(200).json({ message: 'Course terminée', course });
    } catch (error: unknown) {
      sendError(res, error, 'terminerCourse');
    }
  };

  getWeeklyStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = getUserId(req, res);
    if (!userId) return;
    try {
      const stats = await courseService.getWeeklyStats(userId);
      res.status(200).json(stats);
    } catch (error: unknown) {
      sendError(res, error, 'getWeeklyStats');
    }
  };

  findNearbyDrivers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!getUserId(req, res)) return;

    const lat = readNumber(req.query.lat ?? req.query.latitude);
    const lng = readNumber(req.query.lng ?? req.query.longitude);
    const rayon = req.query.rayon === undefined ? 5 : readNumber(req.query.rayon);

    if (lat === null || lng === null || rayon === null ||
        Math.abs(lat) > 90 || Math.abs(lng) > 180 || rayon <= 0 || rayon > 30) {
      res.status(400).json({ error: 'Coordonnées ou rayon invalides' });
      return;
    }

    try {
      const drivers = await courseService.findNearbyDrivers(lat, lng, rayon);
      res.status(200).json(drivers);
    } catch (error: unknown) {
      sendError(res, error, 'findNearbyDrivers');
    }
  };

  getAvailableCourses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = getUserId(req, res);
    if (!userId) return;
    try {
      res.status(200).json(await courseService.getAvailableCourses(userId));
    } catch (error: unknown) {
      sendError(res, error, 'getAvailableCourses');
    }
  };

  getConducteurCourses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = getUserId(req, res);
    if (!userId) return;
    try {
      res.status(200).json(await courseService.getConducteurCourses(userId));
    } catch (error: unknown) {
      sendError(res, error, 'getConducteurCourses');
    }
  };

  getUserCourses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = getUserId(req, res);
    if (!userId) return;
    try {
      res.status(200).json(await courseService.getUserCourses(userId));
    } catch (error: unknown) {
      sendError(res, error, 'getUserCourses');
    }
  };

  getCourseById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = getUserId(req, res);
    if (!userId) return;
    const courseId = getCourseId(req, res);
    if (!courseId) return;
    try {
      // Le service contrôle que le demandeur est client, conducteur assigné ou admin.
      res.status(200).json(await courseService.getCourseById(courseId, userId));
    } catch (error: unknown) {
      sendError(res, error, 'getCourseById');
    }
  };

  rateCourse = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = getUserId(req, res);
    if (!userId) return;
    const courseId = getCourseId(req, res);
    if (!courseId) return;

    try {
      // Correspond exactement au rateCourseSchema et au service mobile corrigé.
      const { noteConducteur, commentaire } = req.body;
      const course = await courseService.rateCourse(courseId, userId, noteConducteur, commentaire);
      res.status(200).json({ message: 'Course notée avec succès', course });
    } catch (error: unknown) {
      sendError(res, error, 'rateCourse');
    }
  };

  // Conserve la signature utilisée par les anciennes routes ; hors périmètre tricycle/interurbain.
  // Pas de faux succès ni de liste vide présentée comme une réponse métier réelle.
  getChauffeurLivraisons = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.status(501).json({ error: 'Fonctionnalité BTP non prise en charge par ce contrôleur' });
  };
}
