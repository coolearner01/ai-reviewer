import { describe, it, expect } from 'vitest';
import { reviewBadgeMeta, statusPillMeta } from './prBadges';

describe('prBadges', () => {
  it('maps open tab to open pill', () => {
    expect(statusPillMeta('open').label).toBe('Open');
  });

  it('maps failed review to failed badge', () => {
    expect(reviewBadgeMeta('failed', null).label).toBe('Failed');
  });

  it('maps approve merge to approved badge', () => {
    expect(reviewBadgeMeta('completed', 'APPROVE').label).toBe('Approved');
  });
});
