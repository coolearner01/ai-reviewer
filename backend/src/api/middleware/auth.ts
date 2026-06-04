import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { AppError } from '../../errors/AppError';
import type { AuthUser } from '../../types';

interface JwtPayload {
  sub: string;
  email: string;
  name: string;
}

/**
 * Augment Express's Request with our typed user. The `?:` keeps the field
 * optional everywhere — only routes that go through requireAuth can rely on it.
 */
declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export function signToken(user: AuthUser): string {
  const payload: JwtPayload = { sub: user.id, email: user.email, name: user.name };
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN } as jwt.SignOptions);
}

/**
 * Verifies the Authorization: Bearer <token> header and attaches req.user.
 * Throws 401 on any failure — never reveal whether it was missing, malformed
 * or expired (attackers should not be able to probe).
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw AppError.unauthorized();
    const token = header.slice('Bearer '.length).trim();
    if (!token) throw AppError.unauthorized();

    const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    req.user = { id: decoded.sub, email: decoded.email, name: decoded.name };
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(AppError.unauthorized());
  }
}
