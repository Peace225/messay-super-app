import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
import routes from './routes';
import { pushDevicesRouter } from './routes/pushDevices.routes';
import { errorHandler, notFound } from './middleware/errorHandler';
import logistiqueRoutes from './routes/logistique.routes';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

dotenv.config();

// Singleton Prisma pour éviter les connexions multiples sur Render
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

const app: Application = express();
const httpServer = createServer(app);

// CORS FIX : pas de '*' avec credentials
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8081'];

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

export const getIO = () => io;

// Middlewares
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || corsOrigins.includes('*') || corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Permissif en dev
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Routes
app.use('/api/logistique', logistiqueRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/push', pushDevicesRouter);
app.use('/api', routes);

// ===== FINANCE =====
app.get('/api/finance/stats', async (_req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [revenuTotal, revenuJour, depenses, courses, chauffeurs, flotteActive, flotteTotal, maintenance, ticketsJour] = await Promise.all([
      prisma.transaction.aggregate({ _sum: { montant: true }, where: { type: 'ENTREE', statut: 'VALIDE' } }),
      prisma.transaction.aggregate({ _sum: { montant: true }, where: { type: 'ENTREE', createdAt: { gte: today } } }),
      prisma.transaction.aggregate({ _sum: { montant: true }, where: { type: 'SORTIE' } }),
      prisma.course.count({ where: { statut: 'TERMINEE' } }),
      prisma.conducteur.count({ where: { isAvailable: true } }),
      prisma.tricycle.count({ where: { status: 'DISPONIBLE' } }),
      prisma.tricycle.count(),
      prisma.tricycle.count({ where: { status: 'MAINTENANCE' } }),
      prisma.ticket.count({ where: { createdAt: { gte: today } } })
    ]);

    res.json({
      revenuTotal: revenuTotal._sum.montant || 0,
      revenuJour: revenuJour._sum.montant || 0,
      benefice: (revenuTotal._sum.montant || 0) - (depenses._sum.montant || 0),
      depenses: depenses._sum.montant || 0,
      commissions: Math.floor((revenuTotal._sum.montant || 0) * 0.15),
      totalCourses: courses,
      chauffeursActifs: chauffeurs,
      flotteActive,
      flotteTotal,
      maintenance,
      uptime: 99.2,
      alertes: 2,
      ticketsJour
    });
  } catch (error) {
    console.error('[FINANCE/STATS]', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/finance/transactions', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const transactions = await prisma.transaction.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        conducteur: {
          include: { user: { select: { nom: true, prenom: true } } }
        }
      }
    });
    res.json(transactions);
  } catch (error) {
    console.error('[FINANCE/TX]', error);
    res.json([]);
  }
});

// ===== SOCKET.IO (simplifié) =====
io.on('connection', (socket) => {
  console.log('✅ Client:', socket.id);

  socket.on('driver-auth', ({ chauffeurId }) => {
    if (chauffeurId) {
      socket.data.chauffeurId = chauffeurId;
      socket.join(`driver-${chauffeurId}`);
      socket.join('drivers-room');
    }
  });

  socket.on('join-admin-panel', () => {
    socket.join('admin-room');
  });

  socket.on('tricycles:get-all', async () => {
    try {
      const tricycles = await prisma.tricycle.findMany({
        include: { conducteur: { include: { user: true } } },
        take: 100,
        orderBy: { createdAt: 'desc' }
      });
      socket.emit('tricycles:list', tricycles.map(t => ({
        id: t.id,
        immatriculation: t.immatriculation,
        chauffeur: t.conducteur ? `${t.conducteur.user.prenom} ${t.conducteur.user.nom}`.trim() : 'Non assigné',
        status: t.status,
        batterie: t.batterie,
        position: { lat: t.latitude, lng: t.longitude },
      })));
    } catch (error) {
      socket.emit('tricycles:list', []);
    }
  });

  socket.on('disconnect', () => {
    if (socket.data.userId) {
      io.to('admin-room').emit('client:disconnected', { id: socket.data.userId });
    }
  });
});

app.use(notFound);
app.use(errorHandler);

const PORT = parseInt(process.env.PORT || '10000', 10);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MESSAY API sur port ${PORT}`);
  console.log(`📊 Health: /health`);
});

// Graceful shutdown pour Render
process.on('SIGTERM', async () => {
  console.log('SIGTERM reçu');
  await prisma.$disconnect();
  httpServer.close(() => process.exit(0));
});

export { app, httpServer };