import { Router, type Request, type Response } from 'express';
import { validateParams } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { idParamSchema } from '../schemas';
import { reviewEventBus } from '../../infrastructure/events/eventBus';
import { reviewService } from '../../modules/reviews/reviewService';
import { logger } from '../../utils/logger';
import type { ReviewProgressEvent, ReviewStatus } from '../../types';

const router: Router = Router();

/**
 * GET /reviews/:id/progress  (Server-Sent Events)
 *
 * Wire format: standard SSE (`text/event-stream`). Each event is a JSON
 * payload matching ReviewProgressEvent.
 *
 * Auth: We support both `Authorization: Bearer` and `?token=` query param,
 * because EventSource in browsers cannot set headers.
 *
 * Time-to-first-byte: headers + a comment line are flushed immediately so the
 * client knows the stream is alive while we run the ownership DB check.
 */
router.get(
  '/:id/progress',
  promoteQueryToken,
  requireAuth,
  validateParams(idParamSchema),
  async (req: Request, res: Response, next) => {
    let headersSent = false;
    const reviewId = req.params.id;

    try {
      res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.flushHeaders();
      headersSent = true;

      // Tell the client (and proxies) the socket is open before any DB work.
      res.write(': connected\n\n');

      await reviewService.assertOwned(reviewId, req.user!.id);

      const current = await reviewService.findById(reviewId);

      if (current) {
        writeEvent(res, toProgressEvent(current));

        if (current.status === 'completed' || current.status === 'failed') {
          res.end();
          return;
        }
      } else {
        writeEvent(res, {
          reviewId,
          status: 'queued',
          message: 'Connected — waiting for progress…',
          progress: 0,
          timestamp: new Date().toISOString(),
        });
      }

      const unsubscribe = reviewEventBus.subscribe(reviewId, (event) => {
        // Skip duplicate snapshot if it matches what we already sent.
        if (
          current &&
          event.status === current.status &&
          event.progress === progressForStatus(current.status) &&
          event.message === messageForStatus(current.status, current.errorMessage)
        ) {
          return;
        }
        writeEvent(res, event);
        if (event.status === 'completed' || event.status === 'failed') {
          unsubscribe();
          res.end();
        }
      });

      const heartbeat = setInterval(() => {
        if (!res.writableEnded) res.write(': heartbeat\n\n');
      }, 15_000);

      req.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
        logger.debug('[sse] client disconnected', { reviewId });
      });
    } catch (err) {
      if (headersSent) {
        logger.warn('[sse] error after stream started', {
          reviewId,
          error: err instanceof Error ? err.message : String(err),
        });
        try {
          const message =
            err instanceof Error ? err.message : 'Progress stream error';
          writeEvent(res, {
            reviewId,
            status: 'failed',
            message,
            progress: 100,
            timestamp: new Date().toISOString(),
          });
          res.end();
        } catch {
          /* ignore */
        }
        return;
      }
      next(err);
    }
  },
);

function writeEvent(res: Response, event: ReviewProgressEvent): void {
  if (res.writableEnded) return;
  res.write(`data: ${JSON.stringify(event)}\n\n`);
  // Flush aggressively so browsers/proxies see events immediately.
  if (typeof (res as Response & { flush?: () => void }).flush === 'function') {
    (res as Response & { flush: () => void }).flush();
  }
}

function promoteQueryToken(req: Request, _res: Response, next: () => void): void {
  if (!req.headers.authorization && typeof req.query.token === 'string') {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}

function toProgressEvent(review: {
  id: string;
  status: ReviewStatus;
  errorMessage: string | null;
  completedAt: string | null;
  createdAt: string;
}): ReviewProgressEvent {
  return {
    reviewId: review.id,
    status: review.status,
    message: messageForStatus(review.status, review.errorMessage),
    progress: progressForStatus(review.status),
    timestamp: review.completedAt ?? review.createdAt ?? new Date().toISOString(),
  };
}

function progressForStatus(status: ReviewStatus): number {
  switch (status) {
    case 'queued':
      return 0;
    case 'fetching':
      return 10;
    case 'analyzing':
      return 50;
    case 'commenting':
      return 85;
    case 'completed':
    case 'failed':
      return 100;
    default:
      return 0;
  }
}

function messageForStatus(status: ReviewStatus, errorMessage: string | null): string {
  switch (status) {
    case 'queued':
      return 'Review queued…';
    case 'fetching':
      return 'Fetching PR diff and file contents…';
    case 'analyzing':
      return 'Running AI review agents…';
    case 'commenting':
      return 'Saving review findings…';
    case 'completed':
      return 'Review complete';
    case 'failed':
      return errorMessage ?? 'Review failed';
    default:
      return 'Processing…';
  }
}

export default router;
