/**
 * AppError — the only error class routes and services should throw.
 *
 * Carries an HTTP status code and a short machine-readable code so the central
 * error middleware can render a consistent JSON envelope to the client.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, code = 'APP_ERROR', details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, message, 'BAD_REQUEST', details);
  }
  static unauthorized(message = 'Unauthorized') {
    return new AppError(401, message, 'UNAUTHORIZED');
  }
  static forbidden(message = 'Forbidden') {
    return new AppError(403, message, 'FORBIDDEN');
  }
  static notFound(message = 'Not found') {
    return new AppError(404, message, 'NOT_FOUND');
  }
  static conflict(message: string) {
    return new AppError(409, message, 'CONFLICT');
  }
  static internal(message = 'Internal server error') {
    return new AppError(500, message, 'INTERNAL');
  }
  static external(message: string) {
    return new AppError(502, message, 'EXTERNAL_SERVICE');
  }
}
