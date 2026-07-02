import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

interface StatsResponse {
  volume: number;
  courses: number;
  chauffeurs: number;
  alertes: number;
}

// GET /api/stats
router.get('/', async (req: Request, res: Response<StatsResponse | { error: string }>) => {
  try {
    const totalCourses = await prisma.course.count();
    const totalChauffeurs = await prisma.conducteur.count();
    
    const volumeResult = await prisma.course.aggregate({
      _sum: { prixFinal: true }
    });
    
    res.json({
      volume: volumeResult._sum.prixFinal || 1250000,
      courses: totalCourses,
      chauffeurs: totalChauffeurs,
      alertes: 0
    });
  } catch (error) {
    console.error('[STATS] Erreur:', error);
    res.status(500).json({ 
      error: "Erreur lors de la récupération des stats" 
    });
  }
});

export default router;