import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Standard Prisma client singleton.
 * 
 * Database assumptions:
 * - Single SQLite file at web/prisma/dev.db
 * - DATABASE_URL="file:./prisma/dev.db" (relative to web/)
 * - No custom path resolution - Prisma handles relative paths correctly
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
