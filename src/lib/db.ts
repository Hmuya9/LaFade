import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Standard Prisma client singleton.
 * 
 * Database: PostgreSQL (configured via DATABASE_URL env var)
 * Supports both local and remote (Neon) PostgreSQL databases
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'], // you can add "query", "info" if you want more noise
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Small helper to retry flaky Prisma calls (e.g. when Neon wakes up
 * or a connection was closed).
 */
export async function withPrismaRetry<T>(
  fn: () => Promise<T>,
  label: string,
  attempts = 3,
  delayMs = 300
): Promise<T> {
  let lastError: unknown;

  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.error(`[prisma-retry][${label}] attempt ${i} failed`, err);

      // if this was the last attempt, rethrow
      if (i === attempts) break;

      // tiny backoff
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.error(`[prisma-retry][${label}] giving up after ${attempts} attempts`);
  throw lastError instanceof Error
    ? lastError
    : new Error(`[${label}] Prisma operation failed`);
}
