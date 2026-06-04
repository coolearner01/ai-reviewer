import rateLimit from 'express-rate-limit';

/**
 * In-memory rate limiters. Backed by express-rate-limit's default Map store
 * (NOT Redis — we deliberately stay single-process for the initial build).
 *
 * When you scale to multiple Node instances, swap the `store` option for a
 * Redis-backed store (`rate-limit-redis`) — no other call sites change.
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // SSE connections are long-lived — don't count them against the burst limit.
  skip: (req) => req.path.endsWith('/progress'),
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many auth attempts' } },
});

/** 10 reviews / hour / authenticated user. */
export const reviewSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'anon',
  message: { error: { code: 'RATE_LIMITED', message: 'Review submit limit reached (10/hour)' } },
});
