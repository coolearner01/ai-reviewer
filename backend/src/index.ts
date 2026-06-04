/**
 * Process entry point.
 *
 *   1. Validate env (already done at config import)
 *   2. Register the in-process review pipeline with the job queue
 *   3. Build the Express app and start listening
 *   4. Wire SIGTERM / SIGINT for clean shutdown
 */
import { createApp } from './api/server';
import { config } from './config';
import { db } from './infrastructure/database/client';
import { registerReviewPipeline } from './modules/reviews/reviewPipeline';
import { reviewService } from './modules/reviews/reviewService';
import { logger } from './utils/logger';

registerReviewPipeline();

const app = createApp();
const server = app.listen(config.PORT, () => {
  logger.info(`API listening on http://localhost:${config.PORT}`, {
    env: config.NODE_ENV,
    frontendUrl: config.FRONTEND_URL,
  });

  reviewService
    .failStuckReviews()
    .then((count) => {
      if (count > 0) logger.warn('[startup] reclaimed stuck reviews', { count });
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('[startup] failed to reclaim stuck reviews', { error: message });
    });
});

async function shutdown(signal: string) {
  logger.info(`[shutdown] received ${signal} — closing server`);
  // Give in-flight requests 10s to finish.
  const closeTimer = setTimeout(() => {
    logger.warn('[shutdown] force-exiting after timeout');
    process.exit(1);
  }, 10_000).unref();

  server.close(async (err) => {
    clearTimeout(closeTimer);
    if (err) logger.error('[shutdown] server close error', { error: err.message });
    await db.close().catch(() => undefined);
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// Never crash on unhandled promises — log and continue.
process.on('unhandledRejection', (reason) => {
  logger.error('[process] unhandledRejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
});
process.on('uncaughtException', (err) => {
  logger.error('[process] uncaughtException', { error: err.message, stack: err.stack });
});
