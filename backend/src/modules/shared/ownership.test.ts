import { describe, it, expect } from 'vitest';
import { assertOwnership, assertOwnershipBy } from './ownership';
import { AppError } from '../../errors/AppError';

describe('assertOwnership', () => {
  it('returns row when user matches', () => {
    const row = { userId: 'u1', name: 'Org' };
    expect(assertOwnership(row, 'u1', 'Not found')).toEqual(row);
  });

  it('throws not found when row is missing', () => {
    expect(() => assertOwnership(null, 'u1', 'Missing')).toThrow(AppError);
    try {
      assertOwnership(undefined, 'u1', 'Missing');
    } catch (e) {
      expect((e as AppError).statusCode).toBe(404);
    }
  });

  it('throws forbidden when user mismatches', () => {
    try {
      assertOwnership({ userId: 'other' }, 'u1', 'Missing');
    } catch (e) {
      expect((e as AppError).statusCode).toBe(403);
    }
  });
});

describe('assertOwnershipBy', () => {
  it('uses custom owner field', () => {
    const row = { owner_id: 'u2' };
    expect(
      assertOwnershipBy(row, 'u2', (r) => r.owner_id, 'PR not found'),
    ).toEqual(row);
  });
});
