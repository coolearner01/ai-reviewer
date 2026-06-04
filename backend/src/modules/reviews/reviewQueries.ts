import { prisma } from '../../infrastructure/database/client';
import type { Provider } from '../../types';

export interface ReviewRepoContext {
  prUrl: string;
  provider: Provider;
  organizationId: string | null;
}

export interface ReviewPipelineStateRow {
  reviewDepth: string;
  customPrompt: string | null;
  prUrl: string;
  repoUrl: string;
  provider: Provider;
  userId: string;
  organizationId: string | null;
}

/** Load provider + PR URL context for a review (post-to-provider, submit, etc.). */
export async function loadReviewRepoContext(
  reviewId: string,
): Promise<ReviewRepoContext | null> {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: {
      pullRequest: {
        select: {
          prUrl: true,
          repository: { select: { provider: true, organizationId: true } },
        },
      },
    },
  });
  if (!review) return null;
  return {
    prUrl: review.pullRequest.prUrl,
    provider: review.pullRequest.repository.provider as Provider,
    organizationId: review.pullRequest.repository.organizationId,
  };
}

/** Load PR URL context by pull_request id (no review row). */
export async function loadPullRequestRepoContext(
  pullRequestId: string,
): Promise<ReviewRepoContext | null> {
  const pr = await prisma.pullRequest.findUnique({
    where: { id: pullRequestId },
    select: {
      prUrl: true,
      repository: { select: { provider: true, organizationId: true } },
    },
  });
  if (!pr) return null;
  return {
    prUrl: pr.prUrl,
    provider: pr.repository.provider as Provider,
    organizationId: pr.repository.organizationId,
  };
}

/** Everything the review pipeline needs in one query. */
export async function loadPipelineStateRow(
  reviewId: string,
): Promise<ReviewPipelineStateRow | null> {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: {
      reviewDepth: true,
      customPrompt: true,
      pullRequest: {
        select: {
          prUrl: true,
          repository: {
            select: {
              repoUrl: true,
              provider: true,
              userId: true,
              organizationId: true,
            },
          },
        },
      },
    },
  });
  if (!review) return null;
  const repo = review.pullRequest.repository;
  return {
    reviewDepth: review.reviewDepth,
    customPrompt: review.customPrompt,
    prUrl: review.pullRequest.prUrl,
    repoUrl: repo.repoUrl,
    provider: repo.provider as Provider,
    userId: repo.userId,
    organizationId: repo.organizationId,
  };
}

/** Latest review id for a repo + external PR id. */
export async function findLatestReviewIdForPr(
  repositoryId: string,
  externalId: string,
): Promise<{ reviewId: string; prUrl: string } | null> {
  const review = await prisma.review.findFirst({
    where: { pullRequest: { repositoryId, externalId } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, pullRequest: { select: { prUrl: true } } },
  });
  if (!review) return null;
  return { reviewId: review.id, prUrl: review.pullRequest.prUrl };
}
