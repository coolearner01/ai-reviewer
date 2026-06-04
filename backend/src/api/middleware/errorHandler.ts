import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../errors/AppError';
import { isProd } from '../../config';
import { logger } from '../../utils/logger';

/**
 * Central error middleware. Every thrown/forwarded error funnels through here
 * so the JSON response shape is consistent and no stack traces leak in prod.
 *
 * Response envelope:
 *   { error: { code, message, details? } }
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // express requires the 4-arg signature even if next is unused
  _next: NextFunction,
): void {
  const requestCtx = {
    method: req.method,
    path: req.path,
    userId: req.user?.id,
  };

  if (err instanceof ZodError) {
    logger.warn('Validation failed', { ...requestCtx, issues: err.issues });
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { ...requestCtx, code: err.code });
    }
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  const error = err as Error;
  logger.error('Unhandled error', { ...requestCtx, error: error.message, stack: error.stack });
  res.status(500).json({
    error: {
      code: 'INTERNAL',
      message: isProd ? 'Internal server error' : error.message,
    },
  });
}

/** Catches unmatched routes — keeps the 404 shape consistent. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}
