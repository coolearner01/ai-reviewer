import { PrismaClient } from '@prisma/client';
import { config } from '../../config';
import { logger } from '../../utils/logger';

/**
 * Single shared Prisma client for the whole process.
 *
 * Prisma owns the connection pool internally, so — like the old pg pool — we
 * never instantiate more than one. Services import `prisma` and use the typed
 * model API; the small `db` facade below keeps the health-check / shutdown
 * call sites unchanged.
 */
export const prisma = new PrismaClient({
  datasources: { db: { url: config.DATABASE_URL } },
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
});

prisma.$on('warn', (e) => logger.warn('[prisma] warn', { message: e.message }));
prisma.$on('error', (e) => logger.error('[prisma] error', { message: e.message }));

prisma
  .$queryRaw`SELECT 1`
  .then(() => logger.info('Prisma client connected'))
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('Prisma warmup failed (will retry on first request)', { error: message });
  });

export const db = {
  async healthCheck(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  },

  async close(): Promise<void> {
    await prisma.$disconnect();
  },
};
