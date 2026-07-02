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
    // Vérifie que le modèle existe dans schema.prisma
    const totalCourses = await prisma.trajet.count();
    
    // TODO: Remplacer par vraies données plus tard
    // const volume = await prisma.trajet.aggregate({ _sum: { prix: true } });
    
    res.json({
      volume: 1250000,
      courses: totalCourses,
      chauffeurs: 8,
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