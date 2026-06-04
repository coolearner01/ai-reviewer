import { resolveProviderFor } from '../providers/providerResolver';
import { logger } from '../../utils/logger';
import { repositoryService } from '../repositories/repositoryService';
import { pullRequestService } from './pullRequestService';
import type { ListedPullRequest } from '../../providers/base';
import type { PullRequestState } from '../../types';

/**
 * How many provider PRs we upsert into the DB concurrently. Upserts are
 * independent so we fan them out in bounded batches instead of awaiting each
 * one serially — the previous one-at-a-time loop was the main reason a sync of
 * a large repo took minutes.
 */
const UPSERT_CONCURRENCY = 10;

export async function syncRepositoryPullRequests(input: {
  repositoryId: string;
  userId: string;
  /**
   * Limit the sync to a single lifecycle state. When omitted we sync the full
   * history (open + closed/merged) which is dramatically more expensive — a
   * repo's closed/merged history can be thousands of PRs. Callers that only
   * need the Open tab should always pass `state: 'open'`.
   */
  state?: PullRequestState;
}): Promise<{ synced: number }> {
  const repo = await repositoryService.assertOwned(input.repositoryId, input.userId);
  const adapter = await resolveProviderFor({
    organizationId: repo.organizationId,
    provider: repo.provider,
    logContext: '[pr-sync]',
  });
  if (!adapter.listPullRequests) {
    logger.info('[pr-sync] provider does not support listPullRequests', {
      provider: repo.provider,
      repositoryId: repo.id,
    });
    return { synced: 0 };
  }

  // Map our internal lifecycle state onto the provider's open/closed buckets.
  // "merged" and "closed" both live in the provider's "closed" set, so either
  // tab only needs the closed scan — never the (potentially huge) open one.
  const providerStates: Array<'open' | 'closed'> =
    input.state === 'open'
      ? ['open']
      : input.state === 'merged' || input.state === 'closed'
        ? ['closed']
        : ['open', 'closed'];

  let synced = 0;
  for (const ghState of providerStates) {
    const listed = await adapter.listPullRequests(repo.repoUrl, ghState);
    synced += await upsertInBatches(repo.id, listed);
  }
  return { synced };
}

/** Upsert listed PRs in bounded-concurrency batches. */
async function upsertInBatches(
  repositoryId: string,
  listed: ListedPullRequest[],
): Promise<number> {
  let count = 0;
  for (let i = 0; i < listed.length; i += UPSERT_CONCURRENCY) {
    const batch = listed.slice(i, i + UPSERT_CONCURRENCY);
    await Promise.all(
      batch.map((item) =>
        pullRequestService.upsert({
          repositoryId,
          prUrl: item.prUrl,
          metadata: item.metadata,
          state: item.state,
        }),
      ),
    );
    count += batch.length;
  }
  return count;
}
