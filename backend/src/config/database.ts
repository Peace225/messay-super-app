import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL n'est pas défini dans le fichier .env");
}

// Initialisation simple et efficace
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export default prisma;