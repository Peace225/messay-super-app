import 'dotenv/config';

import express, {
  type Application,
  type Request,
  type Response,
} from 'express';
import cors, { type CorsOptions } from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import {
  Server as SocketIOServer,
  type Socket,
} from 'socket.io';
import swaggerUi from 'swagger-ui-express';
import prisma from './config/database';
import { verifyAccessToken } from './utils/jwt';
import { authenticate, authorize } from './middleware/auth';
import swaggerSpec from './config/swagger';
import routes from './routes';
import { pushDevicesRouter } from './routes/pushDevices.routes';
import logistiqueRoutes from './routes/logistique.routes';
import profileRoutes from './routes/profile.routes';
import {
  errorHandler,
  notFound,
} from './middleware/errorHandler';
// Une seule instance Prisma pour l'ensemble du backend
export { prisma };
const app: Application = express();
const httpServer = createServer(app);

// ============================================================
// 1. CONFIGURATION CORS

// ============================================================
const developmentOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8081',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8081',
];
const corsOrigins = (
  process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : process.env.NODE_ENV === 'production'
      ? []
      : developmentOrigins
)
  .map(value => value.trim().replace(/\/+$/, ''))
  .filter(Boolean);
if (corsOrigins.includes('*')) {
  throw new Error(
    'CORS_ORIGIN ne doit pas contenir "*" lorsque credentials=true'
  );
}
if (
  process.env.NODE_ENV === 'production' &&
  corsOrigins.length === 0
) {
  throw new Error(
    'CORS_ORIGIN doit contenir les domaines autorisés en production'
  );
}
const authorizedOrigins = new Set(corsOrigins);
const originAllowed = (origin?: string): boolean =>
  !origin ||
  authorizedOrigins.has(origin.replace(/\/+$/, ''));
const corsOptions: CorsOptions = {
  origin: (origin, callback) =>
    callback(null, originAllowed(origin)),
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
};

// ============================================================
// 2. INITIALISATION SOCKET.IO

// ============================================================
const io = new SocketIOServer(httpServer, {
  cors: corsOptions,
  allowRequest: (request, callback) => {
    callback(null, originAllowed(request.headers.origin));
  },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 100_000,
});
export const getIO = (): SocketIOServer => io;

// ============================================================
// 3. MIDDLEWARES EXPRESS

// ============================================================
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(
  express.urlencoded({
    extended: true,
    limit: '1mb',
  })
);

// ============================================================
// 4. HEALTH CHECK

// ============================================================
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// ============================================================
// 5. ROUTES EXISTANTES

// ============================================================
app.use('/api/logistique', logistiqueRoutes);
if (
  process.env.NODE_ENV !== 'production' ||
  process.env.ENABLE_API_DOCS === 'true'
) {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec)
  );
}

// ============================================================
// 6. STATISTIQUES FINANCIÈRES

// ============================================================
app.get(
  '/api/finance/stats',
  authenticate,
  authorize('ADMIN'),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const [
        entrees,
        entreesJour,
        sorties,
        courses,
        conducteurs,
        flotteActive,
        flotteTotal,
        maintenance,
        ticketsJour,
        alertes,
      ] = await Promise.all([
        prisma.transaction.aggregate({
          _sum: { montant: true },
          where: {
            type: 'ENTREE',
            statut: 'VALIDE',
          },
        }),
        prisma.transaction.aggregate({
          _sum: { montant: true },
          where: {
            type: 'ENTREE',
            statut: 'VALIDE',
            createdAt: { gte: today },
          },
        }),
        prisma.transaction.aggregate({
          _sum: { montant: true },
          where: {
            type: 'SORTIE',
            statut: 'VALIDE',
          },
        }),
        prisma.course.count({
          where: { statut: 'TERMINEE' },
        }),
        prisma.conducteur.count({
          where: {
            isVerified: true,
            disponible: true,
            isAvailable: true,
            statut: 'DISPONIBLE',
            user: { isBlocked: false },
          },
        }),
        prisma.tricycle.count({
          where: { status: 'DISPONIBLE' },
        }),
        prisma.tricycle.count(),
        prisma.tricycle.count({
          where: { status: 'MAINTENANCE' },
        }),
        prisma.ticket.count({
          where: {
            createdAt: { gte: today },
            statut: 'PAYE',
          },
        }),
        prisma.supportTicket.count({
          where: { statut: 'OUVERT' },
        }),
      ]);
      const revenuTotal = entrees._sum.montant ?? 0;
      const revenuJour = entreesJour._sum.montant ?? 0;
      const depenses = sorties._sum.montant ?? 0;
      res.status(200).json({
        revenuTotal,
        revenuJour,
        depenses,
        benefice: revenuTotal - depenses,
        commissions: null,
        totalCourses: courses,
        chauffeursActifs: conducteurs,
        flotteActive,
        flotteTotal,
        maintenance,
        ticketsJour,
        alertes,
        uptime: null,
        uptimeSeconds: Math.floor(process.uptime()),
        note:
          'Montants issus des transactions validées ; billetterie non consolidée.',
      });
    } catch (error) {
      console.error('[FINANCE/STATS]', error);
      res.status(500).json({
        error: 'Impossible de charger les statistiques',
      });
    }
  }
);

// ============================================================
// 7. TRANSACTIONS FINANCIÈRES

// ============================================================
app.get(
  '/api/finance/transactions',
  authenticate,
  authorize('ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    const rawLimit = req.query.limit;
    const limit =
      rawLimit === undefined ? 50 : Number(rawLimit);
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      res.status(400).json({
        error: 'limit doit être un entier entre 1 et 100',
      });
      return;
    }
    try {
      const transactions =
        await prisma.transaction.findMany({
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            conducteur: {
              select: {
                id: true,
                user: {
                  select: {
                    nom: true,
                    prenom: true,
                  },
                },
              },
            },
          },
        });
      res.status(200).json(transactions);
    } catch (error) {
      console.error('[FINANCE/TRANSACTIONS]', error);
      res.status(500).json({
        error: 'Impossible de charger les transactions',
      });
    }
  }
);

// Routes du profil : doivent être montées avant le routeur général.
// URL : /api/users/me/photo et /api/users/me/deletion-request
app.use('/api/users/me', profileRoutes);
// Routes principales du backend
app.use('/api/push', pushDevicesRouter);
app.use('/api', routes);

// ============================================================
// 8. TYPES ET UTILITAIRES SOCKET.IO

// ============================================================
type SocketIdentity = {
  userId: string;
  role: string;
  conducteurId?: string;
  expiresAt?: number;
};
const parseCourseId = (input: unknown): string | null => {
  if (!input || typeof input !== 'object') {
    return null;
  }
  const id = (input as { courseId?: unknown }).courseId;
  return typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
};
const identityOf = (socket: Socket): SocketIdentity =>
  socket.data as SocketIdentity;

// ============================================================
// 9. SALONS DES CONDUCTEURS

// ============================================================
async function updateDriverRoom(
  socket: Socket
): Promise<void> {
  const identity = identityOf(socket);
  if (identity.role !== 'CONDUCTEUR') {
    return;
  }
  const conducteur = await prisma.conducteur.findUnique({
    where: {
      userId: identity.userId,
    },
    select: {
      id: true,
      statut: true,
      disponible: true,
      isAvailable: true,
      isVerified: true,
      user: {
        select: {
          isBlocked: true,
          role: true,
        },
      },
    },
  });
  socket.leave('drivers-room');
  if (
    !conducteur ||
    conducteur.user.isBlocked ||
    conducteur.user.role !== 'CONDUCTEUR'
  ) {
    socket.disconnect(true);
    return;
  }
  identity.conducteurId = conducteur.id;
  socket.join(`driver-${conducteur.id}`);
  if (
    conducteur.isVerified &&
    conducteur.statut === 'DISPONIBLE' &&
    conducteur.disponible &&
    conducteur.isAvailable
  ) {
    socket.join('drivers-room');
  }
}

// ============================================================
// 10. AUTHENTIFICATION SOCKET.IO PAR JWT

// ============================================================
io.use(async (socket, next) => {
  try {
    const token: unknown = socket.handshake.auth?.token;
    if (
      typeof token !== 'string' ||
      !token.trim()
    ) {
      return next(
        new Error('Authentification Socket.IO requise')
      );
    }
    const payload = verifyAccessToken(token);
    if (
      !payload ||
      typeof payload.userId !== 'string' ||
      !payload.userId
    ) {
      return next(
        new Error('Session Socket.IO invalide')
      );
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        role: true,
        isBlocked: true,
      },
    });
    if (!user || user.isBlocked) {
      return next(
        new Error('Utilisateur non autorisé')
      );
    }
    const expiresAt =
      (payload as { exp?: unknown }).exp;
    socket.data.userId = user.id;
    socket.data.role = user.role;
    if (typeof expiresAt === 'number') {
      socket.data.expiresAt = expiresAt;
    }
    next();
  } catch {
    next(
      new Error('Token Socket.IO invalide ou expiré')
    );
  }
});

// ============================================================
// 11. CONNEXION SOCKET.IO

// ============================================================
io.on('connection', (socket: Socket) => {
  const identity = identityOf(socket);
  // Salon privé de l'utilisateur connecté
  socket.join(`user-${identity.userId}`);
  // Salon réservé aux administrateurs
  if (identity.role === 'ADMIN') {
    socket.join('admin-room');
  }
  // Salle du conducteur authentifié
  if (identity.role === 'CONDUCTEUR') {
    void updateDriverRoom(socket).catch(
      (error: unknown) => {
        console.error('[SOCKET/DRIVER]', error);
        socket.disconnect(true);
      }
    );
  }
  // Expiration de la session Socket.IO
  let expiryTimer:
    | ReturnType<typeof setTimeout>
    | undefined;
  if (identity.expiresAt) {
    const msRemaining =
      identity.expiresAt * 1000 - Date.now();
    if (msRemaining <= 0) {
      socket.disconnect(true);
      return;
    }
    expiryTimer = setTimeout(
      () => socket.disconnect(true),
      msRemaining
    );
    expiryTimer.unref?.();
  }
  // ==========================================================
  // 12. AUTHENTIFICATION CONDUCTEUR
  // ==========================================================
  socket.on('driver-auth', async () => {
    if (identity.role !== 'CONDUCTEUR') {
      return;
    }
    try {
      await updateDriverRoom(socket);
    } catch (error) {
      console.error(
        '[SOCKET/DRIVER-AUTH]',
        error
      );
    }
  });
  // Actualiser la disponibilité du conducteur
  socket.on(
    'driver:availability:refresh',
    async () => {
      if (identity.role !== 'CONDUCTEUR') {
        return;
      }
      try {
        await updateDriverRoom(socket);
      } catch (error) {
        console.error(
          '[SOCKET/AVAILABILITY]',
          error
        );
      }
    }
  );
  // ==========================================================
  // 13. SALON ADMINISTRATEUR
  // ==========================================================
  socket.on('join-admin-panel', () => {
    if (identity.role === 'ADMIN') {
      socket.join('admin-room');
    }
  });
  // ==========================================================
  // 14. SUIVI DES COURSES
  // ==========================================================
  socket.on(
    'join-course',
    async (payload: unknown) => {
      const courseId = parseCourseId(payload);
      if (!courseId) {
        return;
      }
      try {
        const course = await prisma.course.findUnique({
          where: { id: courseId },
          select: {
            userId: true,
            conducteur: {
              select: {
                userId: true,
              },
            },
          },
        });
        if (!course) {
          return;
        }
        const ownsCourse =
          course.userId === identity.userId ||
          course.conducteur?.userId ===
            identity.userId;
        if (
          identity.role === 'ADMIN' ||
          ownsCourse
        ) {
          socket.join(`course-${courseId}`);
        }
      } catch (error) {
        console.error(
          '[SOCKET/JOIN-COURSE]',
          error
        );
      }
    }
  );
  socket.on(
    'leave-course',
    (payload: unknown) => {
      const courseId = parseCourseId(payload);
      if (courseId) {
        socket.leave(`course-${courseId}`);
      }
    }
  );
  // ==========================================================
  // 15. FLOTTE TRICYCLE — ADMIN
  // ==========================================================
  socket.on('tricycles:get-all', async () => {
    if (identity.role !== 'ADMIN') {
      return;
    }
    try {
      const admin = await prisma.user.findUnique({
        where: { id: identity.userId },
        select: {
          role: true,
          isBlocked: true,
        },
      });
      if (
        !admin ||
        admin.isBlocked ||
        admin.role !== 'ADMIN'
      ) {
        socket.disconnect(true);
        return;
      }
      const tricycles =
        await prisma.tricycle.findMany({
          take: 100,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            immatriculation: true,
            status: true,
            batterie: true,
            vitesse: true,
            latitude: true,
            longitude: true,
            derniereActivite: true,
            coursesAujourdhui: true,
            distanceParcourue: true,
            modele: true,
            annee: true,
            createdAt: true,
            conducteur: {
              select: {
                user: {
                  select: {
                    nom: true,
                    prenom: true,
                    telephone: true,
                  },
                },
              },
            },
          },
        });
      socket.emit(
        'tricycles:list',
        tricycles.map(t => ({
          id: t.id,
          immatriculation: t.immatriculation,
          chauffeur: t.conducteur
            ? [
                t.conducteur.user.prenom,
                t.conducteur.user.nom,
              ]
                .filter(Boolean)
                .join(' ')
            : 'Non assigné',
          chauffeurTel:
            t.conducteur?.user.telephone ?? '',
          status: t.status,
          batterie: t.batterie,
          vitesse: t.vitesse,
          position: {
            lat: t.latitude,
            lng: t.longitude,
          },
          derniereActivite: t.derniereActivite,
          coursesAujourdhui: t.coursesAujourdhui,
          distanceParcourue: t.distanceParcourue,
          modele: t.modele,
          annee: t.annee,
          createdAt: t.createdAt,
        }))
      );
    } catch (error) {
      console.error(
        '[SOCKET/TRICYCLES]',
        error
      );
      socket.emit('server:error', {
        message: 'Impossible de charger la flotte',
      });
    }
  });
  // ==========================================================
  // 16. BILLETS INTERURBAINS — ADMIN
  // ==========================================================
  socket.on('tickets:get-today', async () => {
    if (identity.role !== 'ADMIN') {
      return;
    }
    try {
      const admin = await prisma.user.findUnique({
        where: { id: identity.userId },
        select: {
          role: true,
          isBlocked: true,
        },
      });
      if (
        !admin ||
        admin.isBlocked ||
        admin.role !== 'ADMIN'
      ) {
        socket.disconnect(true);
        return;
      }
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const tickets = await prisma.ticket.findMany({
        where: {
          createdAt: { gte: today },
        },
        take: 100,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          compagnie: true,
          passagerNom: true,
          passagerPrenom: true,
          telephone: true,
          depart: true,
          destination: true,
          dateDepart: true,
          heureDepart: true,
          prix: true,
          siege: true,
          methodePaiement: true,
          statut: true,
          gareDepart: true,
          gareArrivee: true,
        },
      });
      socket.emit(
        'tickets:list',
        tickets.map(t => ({
          id: t.id,
          compagnie: t.compagnie,
          passager: [
            t.passagerPrenom,
            t.passagerNom,
          ]
            .filter(Boolean)
            .join(' '),
          telephone: t.telephone,
          trajet:
            `${t.depart} → ${t.destination}`,
          date: t.dateDepart.toISOString(),
          heure: t.heureDepart,
          prix: t.prix,
          siege: t.siege,
          paiement:
            t.methodePaiement === 'ORANGE_MONEY' ||
            t.methodePaiement === 'MTN_MOMO'
              ? 'MOBILE_MONEY'
              : t.methodePaiement === 'CARTE_BANCAIRE'
                ? 'CARTE'
                : t.methodePaiement === 'WAVE'
                  ? 'WAVE'
                  : 'ESPECES',
          statut: t.statut,
          gareDepart: t.gareDepart ?? '',
          gareArrivee: t.gareArrivee ?? '',
        }))
      );
    } catch (error) {
      console.error(
        '[SOCKET/TICKETS]',
        error
      );
      socket.emit('server:error', {
        message: 'Impossible de charger les billets',
      });
    }
  });
  // ==========================================================
  // 17. DÉCONNEXION
  // ==========================================================
  socket.on('disconnect', () => {
    if (expiryTimer) {
      clearTimeout(expiryTimer);
    }
    if (identity.role === 'ADMIN') {
      return;
    }
    io.to('admin-room').emit(
      'client:disconnected',
      { id: identity.userId }
    );
  });
});

// ============================================================
// 18. ERREURS EXPRESS

// ============================================================
app.use(notFound);
app.use(errorHandler);

// ============================================================
// 19. DÉMARRAGE DU SERVEUR

// ============================================================
const PORT = Number(
  process.env.PORT || '10000'
);
if (
  !Number.isInteger(PORT) ||
  PORT < 1 ||
  PORT > 65535
) {
  throw new Error('PORT invalide');
}
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(
    `🚀 MESSAY API opérationnelle sur le port ${PORT}`
  );
});

// ============================================================
// 20. ARRÊT PROPRE DU SERVEUR

// ============================================================
let stopping = false;
async function shutdown(
  signal: string
): Promise<void> {
  if (stopping) {
    return;
  }
  stopping = true;
  console.log(
    `[MESSAY] Arrêt propre : ${signal}`
  );
  io.disconnectSockets(true);
  httpServer.close(async () => {
    try {
      await prisma.$disconnect();
      process.exit(0);
    } catch (error) {
      console.error(
        '[MESSAY/SHUTDOWN]',
        error
      );
      process.exit(1);
    }
  });
}
process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
export { app, httpServer };
