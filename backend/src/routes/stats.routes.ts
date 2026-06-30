import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Route pour récupérer les stats du Dashboard
router.get('/', async (req, res) => {
  try {
    // On compte le nombre de trajets en base de données
    const totalCourses = await prisma.trajet.count();
    
    // On renvoie un objet JSON que votre Dashboard pourra lire
    res.json({
      volume: 1250000, // Vous pourrez remplacer par la somme réelle des prix ici
      courses: totalCourses,
      chauffeurs: 8,
      alertes: 0
    });
  } catch (error) {
    console.error("Erreur stats:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des stats" });
  }
});

export default router;
```

### 2. "Brancher" ce fichier dans votre serveur
Il faut maintenant dire à votre serveur (`server.ts`) d'utiliser ce nouveau fichier. Ouvrez `backend/src/server.ts` et ajoutez ces deux lignes :

```typescript
// 1. En haut du fichier, importez la route
import statsRoutes from './routes/stats.routes';

// 2. Plus bas, dans la configuration des routes (après app.use('/api/auth', ...))
app.use('/api/stats', statsRoutes);