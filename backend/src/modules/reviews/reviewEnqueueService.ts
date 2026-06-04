import { jobQueue, JOB_NAMES, type RunReviewPayload } from '../../infrastructure/jobs/jobQueue';
import { parsePRUrl } from '../../utils/urlParser';
import { logger } from '../../utils/logger';
import { repositoryService } from '../repositories/repositoryService';
import { pullRequestService } from './pullRequestService';
import { reviewService } from './reviewService';
import type { ReviewDepth } from '../../types';

export interface StartReviewInput {
  userId: string;
  pullRequestUrl: string;
  organizationId?: string | null;
  reviewDepth?: ReviewDepth;
  customPrompt?: string;
  logContext?: string;
}

export interface StartReviewResult {
  reviewId: string;
  pullRequestId: string;
  repositoryId: string;
}

export async function startReview(input: StartReviewInput): Promise<StartReviewResult> {
  const parsed = parsePRUrl(input.pullRequestUrl);
  const repository = await repositoryService.upsertFromRepoUrl(
    input.userId,
    parsed.repoUrl,
    input.organizationId ?? null,
  );
  const pullRequest = await pullRequestService.createPlaceholder({
    repositoryId: repository.id,
    prUrl: input.pullRequestUrl,
    externalId: parsed.prId,
  });
  const review = await reviewService.create({
    pullRequestId: pullRequest.id,
    reviewDepth: input.reviewDepth ?? 'standard',
    customPrompt: input.customPrompt,
  });
  jobQueue.enqueue<RunReviewPayload>(JOB_NAMES.RUN_REVIEW, { reviewId: review.id });

  const ctx = input.logContext ?? '[enqueue]';
  logger.info(`${ctx} queued review`, {
    reviewId: review.id,
    prUrl: input.pullRequestUrl,
    organizationId: input.organizationId ?? null,
  });

  return {
    reviewId: review.id,
    pullRequestId: pullRequest.id,
    repositoryId: repository.id,
  };
}
