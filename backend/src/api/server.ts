import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';

import { config, isProd } from '../config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimit';
import authRouter from './routes/auth';
import reviewsRouter from './routes/reviews';
import sseRouter from './routes/sse';
import repositoriesRouter from './routes/repositories';
import organizationsRouter from './routes/organizations';
import webhooksRouter from './routes/webhooks';
import settingsRouter from './routes/settings';
import promptsRouter from './routes/prompts';
import pullRequestsRouter from './routes/pullRequests';
import simulateRouter from './routes/simulate';
import insightsRouter from './routes/insights';
import { db } from '../infrastructure/database/client';
import { jobQueue } from '../infrastructure/jobs/jobQueue';

/**
 * Build the Express app. Kept as a factory so tests can spin one up without
 * touching the global server / port binding.
 */
export function createApp(): Express {
  const app = express();

  // Trust proxy headers (X-Forwarded-For / X-Forwarded-Proto) when behind a
  // load balancer. Rate limit will key on the real client IP.
  app.set('trust proxy', 1);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: config.FRONTEND_URL,
      credentials: true,
    }),
  );
  // Never compress SSE — gzip buffers `text/event-stream` and breaks live progress.
  app.use(
    compression({
      filter: (req, res) => {
        if (req.path.endsWith('/progress')) return false;
        const type = res.getHeader('Content-Type');
        if (type === 'text/event-stream') return false;
        return compression.filter(req, res);
      },
    }),
  );
  app.use(morgan(isProd ? 'combined' : 'dev'));

  // Webhooks need raw body for HMAC — they mount their own json parser, so
  // we mount them BEFORE the default express.json middleware.
  app.use('/webhooks', webhooksRouter);

  app.use(express.json({ limit: '1mb' }));
  app.use(generalLimiter);

  app.get('/health', async (_req: Request, res: Response) => {
    const dbOk = await db.healthCheck();
    res.status(dbOk ? 200 : 503).json({
      status: dbOk ? 'ok' : 'degraded',
      db: dbOk,
      queue: jobQueue.stats(),
      // AI keys are configured per-user / per-org in Settings → Models, so the
      // server can't report a global key status here.
      ai: { source: 'settings' },
      uptimeSec: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/auth',           authRouter);
  // Progress SSE must register before the generic GET /:id route.
  app.use('/reviews',        sseRouter);
  app.use('/reviews',        reviewsRouter);
  app.use('/repositories',   repositoriesRouter);
  app.use('/organizations',  organizationsRouter);
  app.use('/settings',       settingsRouter);
  app.use('/prompts',        promptsRouter);
  app.use('/pull-requests',  pullRequestsRouter);
  app.use('/simulate',       simulateRouter);
  app.use('/insights',       insightsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
