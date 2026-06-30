// prisma.config.ts
import { defineConfig } from '@prisma/config';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
  // La commande doit être dans l'objet migrations
  migrations: {
    seed: 'ts-node ./prisma/seed.ts',
  },
});