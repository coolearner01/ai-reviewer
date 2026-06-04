import { AppError } from '../../errors/AppError';

/**
 * Generic ownership check: row must exist and belong to userId.
 */
export function assertOwnership<T extends { userId: string }>(
  row: T | null | undefined,
  userId: string,
  notFoundMessage: string,
): T {
  if (!row) throw AppError.notFound(notFoundMessage);
  if (row.userId !== userId) throw AppError.forbidden();
  return row;
}

/**
 * Ownership when the user id field has a custom name.
 */
export function assertOwnershipBy<T>(
  row: T | null | undefined,
  userId: string,
  getOwnerId: (row: T) => string,
  notFoundMessage: string,
): T {
  if (!row) throw AppError.notFound(notFoundMessage);
  if (getOwnerId(row) !== userId) throw AppError.forbidden();
  return row;
}
