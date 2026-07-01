import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
import routes from './routes';
import { errorHandler, notFound } from './middleware/errorHandler';
import logistiqueRoutes from './routes/logistique.routes';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

dotenv.config();

// Prisma avec gestion d'erreurs
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'? ['query', 'error'] : ['error'],
});

const app: Application = express();
const httpServer = createServer(app);

// CORS configuré pour production
const corsOrigins = process.env.CORS_ORIGIN
 ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:3000', 'http://localhost:8081', '*'];

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
  origin: corsOrigins,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check pour Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/logistique', logistiqueRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api', routes);

// ===== ROUTES FINANCE =====
app.get('/api/finance/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [revenuTotal, revenuJour, depenses, courses, chauffeurs, flotteActive, flotteTotal, maintenance, ticketsJour] = await Promise.all([
      prisma.transaction.aggregate({
        _sum: { montant: true },
        where: { type: 'ENTRÉE', statut: 'VALIDÉ' }
      }),
      prisma.transaction.aggregate({
        _sum: { montant: true },
        where: { type: 'ENTRÉE', createdAt: { gte: today } }
      }),
      prisma.transaction.aggregate({
        _sum: { montant: true },
        where: { type: 'SORTIE' }
      }),
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
    console.error('Erreur stats:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/finance/transactions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const transactions = await prisma.transaction.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        conducteur: {
          include: {
            user: { select: { nom: true, prenom: true } }
          }
        }
      }
    });
    res.json(transactions);
  } catch (error) {
    console.error('Erreur transactions:', error);
    res.json([]);
  }
});

app.get('/api/finance/export', async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      include: { conducteur: { include: { user: true } } }
    });

    const csv = [
      'ID,Date,Motif,Montant,Type,Chauffeur',
     ...transactions.map(t =>
        `${t.id},"${t.createdAt.toISOString()}","${t.motif || ''}",${t.montant},${t.type},"${t.conducteur?.user.prenom || ''} ${t.conducteur?.user.nom || ''}"`
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=messay-finance-${Date.now()}.csv`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('Erreur export:', error);
    res.status(500).send('Erreur export');
  }
});

app.post('/api/finance/reports/generate', async (req, res) => {
  try {
    const report = await prisma.rapport.create({
      data: {
        type: req.body.type || 'FINANCIER',
        titre: `Rapport ${req.body.type || 'Financier'} - ${new Date().toLocaleDateString('fr-FR')}`,
        contenu: JSON.stringify(req.body),
        periode: '30j'
      }
    });
    res.json({ id: report.id, success: true, message: 'Rapport généré' });
  } catch (error) {
    console.error('Erreur rapport:', error);
    res.status(500).json({ error: 'Erreur génération' });
  }
});

// ===== SOCKET.IO =====
io.on('connection', (socket) => {
  console.log('✅ Client connecté:', socket.id);

  socket.on('driver-auth', ({ chauffeurId }) => {
    if (chauffeurId) {
      socket.data.chauffeurId = chauffeurId;
      socket.join(`driver-${chauffeurId}`);
      socket.join('drivers-room');
    }
  });

  socket.on('join-user-room', (userId: string) => {
    if (typeof userId === 'string') {
      socket.join(`user-${userId}`);
      socket.data.userId = userId;
    }
  });

  socket.on('join-admin-panel', () => {
    socket.join('admin-room');
    console.log('👨💼 Admin rejoint');
  });

  socket.on('client:join-course', ({ userId, courseId }) => {
    socket.join(`user-${userId}`);
    socket.join(`course-${courseId}`);
    socket.data.userId = userId;
  });

  socket.on('tricycles:get-all', async () => {
    try {
      const tricycles = await prisma.tricycle.findMany({
        include: { conducteur: { include: { user: true } } },
        orderBy: { createdAt: 'desc' }
      });
      const formatted = tricycles.map(t => ({
        id: t.id,
        immatriculation: t.immatriculation,
        chauffeur: t.conducteur? `${t.conducteur.user.prenom || ''} ${t.conducteur.user.nom}`.trim() : 'Non assigné',
        chauffeurTel: t.conducteur?.user.telephone || '',
        status: t.status,
        batterie: t.batterie,
        vitesse: t.vitesse,
        position: { lat: t.latitude, lng: t.longitude },
        derniereActivite: t.derniereActivite?.toLocaleTimeString('fr-FR') || 'À l\'instant',
        coursesAujourdhui: t.coursesAujourdhui,
        distanceParcourue: t.distanceParcourue,
        modele: t.modele,
        annee: t.annee || 2023
      }));
      socket.emit('tricycles:list', formatted);
    } catch (error) {
      console.error('Erreur tricycles:', error);
      socket.emit('tricycles:list', []);
    }
  });

  socket.on('clients:get-all', async () => {
    try {
      const users = await prisma.user.findMany({
        where: { role: 'USER' },
        orderBy: { createdAt: 'desc' },
        take: 100
      });
      const clients = users.map(u => ({
        id: u.id,
        nom: u.nom,
        prenom: u.prenom,
        telephone: u.telephone,
        email: u.email,
        isOnline: false,
        derniereConnexion: u.updatedAt.toLocaleDateString('fr-FR'),
        coursesTotal: 0,
        enCourse: false
      }));
      socket.emit('clients:list', clients);
    } catch (error) {
      console.error('Erreur clients:', error);
      socket.emit('clients:list', []);
    }
  });

  socket.on('tricycle:register', async (data) => {
    try {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const email = `${data.immatriculation.toLowerCase().replace(/\s/g, '')}${Date.now()}@messay.ci`;

      const user = await prisma.user.create({
        data: {
          nom: data.chauffeur.split(' ').slice(-1)[0] || 'Chauffeur',
          prenom: data.chauffeur.split(' ')[0] || data.chauffeur,
          email,
          telephone: data.chauffeurTel || `+22507000000${Math.floor(Math.random() * 100)}`,
          password: hashedPassword,
          role: 'CONDUCTEUR',
          isVerified: true,
        }
      });

      const conducteur = await prisma.conducteur.create({
        data: {
          userId: user.id,
          permis: 'B',
          numeroPermis: `PERM-${Date.now()}`,
          immatriculation: data.immatriculation,
          positionLatitude: 5.345 + Math.random() * 0.02,
          positionLongitude: -4.024 + Math.random() * 0.02,
          isVerified: true,
          isAvailable: true,
        }
      });

      const newTri = await prisma.tricycle.create({
        data: {
          immatriculation: data.immatriculation,
          conducteurId: conducteur.id,
          modele: data.modele || 'TVS King',
          annee: data.annee || 2024,
          latitude: conducteur.positionLatitude!,
          longitude: conducteur.positionLongitude!,
          status: 'HORS_LIGNE',
          batterie: 100,
          vitesse: 0,
          coursesAujourdhui: 0,
          distanceParcourue: 0,
        }
      });

      io.to('admin-room').emit('tricycle:registered', {
        id: newTri.id,
        immatriculation: newTri.immatriculation,
        chauffeur: `${user.prenom} ${user.nom}`,
        chauffeurTel: user.telephone,
        status: newTri.status,
        batterie: newTri.batterie,
        vitesse: 0,
        position: { lat: newTri.latitude, lng: newTri.longitude },
        derniereActivite: 'À l\'instant',
        coursesAujourdhui: 0,
        distanceParcourue: 0,
        modele: newTri.modele,
        annee: newTri.annee,
      });
    } catch (error: any) {
      console.error('Erreur register:', error);
      socket.emit('error', {
        message: error.code === 'P2002'? 'Immatriculation déjà utilisée' : 'Erreur inscription'
      });
    }
  });

  socket.on('tricycle:delete', async ({ id }) => {
    try {
      const tri = await prisma.tricycle.findUnique({
        where: { id },
        include: { conducteur: true }
      });
      if (tri?.conducteurId) {
        await prisma.tricycle.delete({ where: { id } });
        await prisma.conducteur.delete({ where: { id: tri.conducteurId } });
        await prisma.user.delete({ where: { id: tri.conducteur.userId } });
      }
      io.to('admin-room').emit('tricycle:deleted', { id, success: true });
    } catch (error) {
      console.error('Erreur delete:', error);
    }
  });

  socket.on('tricycle:control', async ({ tricycleId, action }) => {
    try {
      const status = action === 'activate'? 'DISPONIBLE' :
                     action === 'maintenance'? 'MAINTENANCE' : 'HORS_LIGNE';
      await prisma.tricycle.update({
        where: { id: tricycleId },
        data: { status: status as any }
      });
      io.to('admin-room').emit('tricycle:status-changed', {
        tricycleId,
        status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erreur control:', error);
    }
  });

  socket.on('driver:update-location', async (data) => {
    if (!data.chauffeurId ||!data.lat ||!data.lng) return;
    try {
      const tricycle = await prisma.tricycle.findFirst({
        where: { conducteurId: data.chauffeurId }
      });
      if (!tricycle) return;

      await prisma.tricycle.update({
        where: { id: tricycle.id },
        data: {
          latitude: data.lat,
          longitude: data.lng,
          vitesse: data.vitesse || 0,
          batterie: data.batterie || tricycle.batterie,
          derniereActivite: new Date(),
          status: 'EN_COURSE',
        }
      });

      io.to('admin-room').emit('position-updated', {
        tricycleId: tricycle.id,
        lat: data.lat,
        lng: data.lng,
        vitesse: data.vitesse || 0,
        batterie: data.batterie || tricycle.batterie,
        timestamp: Date.now(),
        type: 'DRIVER'
      });

      if (data.courseId) {
        io.to(`course-${data.courseId}`).emit('driver-position', {
          lat: data.lat,
          lng: data.lng,
          vitesse: data.vitesse
        });
      }
    } catch (error) {
      console.error('Erreur location driver:', error);
    }
  });

  socket.on('client:update-location', async (data) => {
    if (!data.userId ||!data.lat ||!data.lng) return;
    try {
      if (data.courseId) {
        io.to(`course-${data.courseId}`).emit('client-position', {
          userId: data.userId,
          lat: data.lat,
          lng: data.lng,
          timestamp: Date.now(),
          type: 'CLIENT'
        });
      }

      io.to('admin-room').emit('client:connected', {
        id: data.userId,
        position: { lat: data.lat, lng: data.lng },
        isOnline: true,
        derniereConnexion: 'À l\'instant'
      });
    } catch (error) {
      console.error('Erreur location client:', error);
    }
  });

  socket.on('tickets:get-today', async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tickets = await prisma.ticket.findMany({
        where: { dateDepart: { gte: today } },
        orderBy: { createdAt: 'desc' },
        take: 50
      });
      const formatted = tickets.map(t => ({
        id: t.id,
        compagnie: t.compagnie,
        passager: `${t.passagerNom} ${t.passagerPrenom || ''}`.trim(),
        telephone: t.telephone,
        trajet: `${t.depart} → ${t.destination}`,
        date: t.dateDepart.toISOString().split('T')[0],
        heure: t.heureDepart,
        siege: t.siege,
        prix: t.prix,
        statut: t.statut,
        paiement: t.methodePaiement || 'ESPECES',
        gareDepart: t.gareDepart,
        gareArrivee: t.gareArrivee
      }));
      socket.emit('tickets:list', formatted);
    } catch (error) {
      console.error('Erreur tickets:', error);
      socket.emit('tickets:list', []);
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Client déconnecté:', socket.id);
    if (socket.data.userId) {
      io.to('admin-room').emit('client:disconnected', { id: socket.data.userId });
    }
    if (socket.data.chauffeurId) {
      io.to('admin-room').emit('driver:disconnected', { id: socket.data.chauffeurId });
    }
  });
});

app.use(notFound);
app.use(errorHandler);

const PORT = parseInt(process.env.PORT || '5000', 10);

// Bind sur 0.0.0.0 pour Render/Railway
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MESSAY API démarré sur le port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`📚 Docs: http://localhost:${PORT}/api-docs`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Arrêt du serveur...');
  await prisma.$disconnect();
  httpServer.close(() => {
    console.log('Serveur arrêté');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export { app, httpServer, prisma };