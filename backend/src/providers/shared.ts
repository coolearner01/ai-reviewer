import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from '../errors/AppError';
import { logger } from '../utils/logger';

/**
 * Cross-provider helpers shared by the GitHub / GitLab / Bitbucket adapters so
 * the same error-mapping and webhook-verification logic isn't copy-pasted into
 * each file.
 */

/**
 * Build an `(operation, error) => AppError` mapper for a provider. Logs the
 * underlying failure and returns a 502 with a consistent, user-readable message.
 *
 * @param tag  Lowercase log tag, e.g. "github".
 * @param name Display name used in the client-facing message, e.g. "GitHub".
 */
export function createApiErrorWrapper(tag: string, name: string) {
  return (operation: string, err: unknown): AppError => {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[${tag}] api error`, { op: operation, message });
    return AppError.external(`${name} API ${operation} failed: ${message}`);
  };
}

/** Constant-time compare of two strings. Returns false on length mismatch. */
function safeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Verify a GitHub/Bitbucket-style HMAC-SHA256 signature (`sha256=<hex>`).
 * Returns false when the secret or signature is missing.
 */
export function verifyHmacSha256(
  payload: Buffer,
  signature: string | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !signature) return false;
  const expected = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
  return safeEqual(signature, expected);
}

/**
 * Verify a GitLab-style shared secret token (sent verbatim in X-Gitlab-Token).
 * Returns false when the secret or token is missing.
 */
export function verifySecretToken(
  token: string | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !token) return false;
  return safeEqual(token, secret);
}
