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

// Charger les variables d'environnement
dotenv.config();

const app: Application = express();
const httpServer = createServer(app);

// Configuration Socket.IO pour le temps réel
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    methods: ['GET', 'POST'],
  },
});

// Middleware de sécurité
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true,
}));

// Parser JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Documentation Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'MESSAY API Documentation',
}));

// Routes API
app.use('/api', routes);

// Gestion Socket.IO pour le temps réel
io.on('connection', (socket) => {
  console.log('✅ Client connecté:', socket.id);

  // Rejoindre une room pour les mises à jour de course
  socket.on('join-course', (courseId: string) => {
    socket.join(`course-${courseId}`);
    console.log(`📍 Socket ${socket.id} a rejoint la course ${courseId}`);
  });

  // Mise à jour de position en temps réel
  socket.on('update-position', (data: { courseId: string; latitude: number; longitude: number }) => {
    io.to(`course-${data.courseId}`).emit('position-updated', {
      latitude: data.latitude,
      longitude: data.longitude,
      timestamp: new Date(),
    });
  });

  // Mise à jour du statut de course
  socket.on('course-status-update', (data: { courseId: string; statut: string }) => {
    io.to(`course-${data.courseId}`).emit('status-changed', {
      statut: data.statut,
      timestamp: new Date(),
    });
  });

  // Support chat en temps réel
  socket.on('support-message', (data: { ticketId: string; message: string; senderId: string }) => {
    io.to(`support-${data.ticketId}`).emit('new-message', {
      message: data.message,
      senderId: data.senderId,
      timestamp: new Date(),
    });
  });

  socket.on('disconnect', () => {
    console.log('❌ Client déconnecté:', socket.id);
  });
});

// Middleware de gestion des erreurs
app.use(notFound);
app.use(errorHandler);

// Démarrage du serveur
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║                                           ║
║   🚀 MESSAY API Server                    ║
║                                           ║
║   📡 Port: ${PORT}                         ║
║   🌍 Environment: ${process.env.NODE_ENV || 'development'}           ║
║   ⚡ Socket.IO: Activé                    ║
║   📚 Swagger: http://localhost:${PORT}/api-docs ║
║                                           ║
╚═══════════════════════════════════════════╝
  `);
});

// Gestion des erreurs non capturées
process.on('unhandledRejection', (err: Error) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});

export { app, io };
