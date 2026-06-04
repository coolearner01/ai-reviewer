import { describe, it, expect } from 'vitest';
import { queryKeys } from './queryKeys';

describe('queryKeys', () => {
  it('uses consistent repository PR keys', () => {
    expect(queryKeys.repositoryPRs('repo-1', 'open', 'live')).toEqual([
      'repository-prs',
      'repo-1',
      'open',
      'live',
    ]);
  });

  it('builds review lookup keys', () => {
    expect(queryKeys.reviewLookup('acme', 'api', '42')).toEqual([
      'review-lookup',
      'acme',
      'api',
      '42',
    ]);
  });
});
