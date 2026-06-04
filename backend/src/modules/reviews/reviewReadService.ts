import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/client';
import { AppError } from '../../errors/AppError';
import { summarizeByAgent, rankFilesByRisk } from '../../utils/findingProcessor';
import type {
  AgentSummary,
  FileRisk,
  Finding,
  ReviewResult,
  ReviewStatus,
} from '../../types';
import { repositoryService } from '../repositories/repositoryService';
import { findLatestReviewIdForPr } from './reviewQueries';
import { reviewCommentService } from './reviewCommentService';
import { toRecord, prToRecord, repoToRecord } from './reviewMappers';

/** Pull the PR + repository (+ org slug) alongside every review row. */
const REVIEW_INCLUDE = {
  pullRequest: {
    include: { repository: { include: { organization: { select: { slug: true } } } } },
  },
} satisfies Prisma.ReviewInclude;

type ReviewWithRelations = Prisma.ReviewGetPayload<{ include: typeof REVIEW_INCLUDE }>;

function toBundle(review: ReviewWithRelations) {
  const repo = review.pullRequest.repository;
  return {
    review: toRecord(review),
    pullRequest: prToRecord(review.pullRequest),
    repository: repoToRecord(repo, repo.organization?.slug ?? null),
  };
}

export const reviewReadService = {
  async getFullResult(reviewId: string, userId: string): Promise<ReviewResult> {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: REVIEW_INCLUDE,
    });

    if (!review) throw AppError.notFound('Review not found');
    if (review.pullRequest.repository.userId !== userId) throw AppError.forbidden();

    const comments = await reviewCommentService.listComments(reviewId);
    const findingsLike: Finding[] = comments.map((c) => ({
      agentType: c.agentType,
      category: c.category,
      file: c.file,
      line: c.line,
      endLine: c.endLine ?? undefined,
      side: c.side,
      title: c.title,
      issue: c.issue,
      impact: c.impact,
      recommendation: c.recommendation,
      suggestedFix: c.suggestedFix ?? undefined,
      severity: c.severity,
      confidence: c.confidence,
    }));

    const agentSummaries: AgentSummary[] = summarizeByAgent(findingsLike);
    const fileRiskRanking: FileRisk[] = rankFilesByRisk(findingsLike);

    return {
      ...toBundle(review),
      comments,
      agentSummaries,
      fileRiskRanking,
      diff: review.diffCached ?? null,
    };
  },

  async listForUser(input: {
    userId: string;
    page: number;
    limit: number;
    status?: ReviewStatus;
    repoId?: string;
  }) {
    const where: Prisma.ReviewWhereInput = {
      pullRequest: {
        repository: {
          userId: input.userId,
          ...(input.repoId ? { id: input.repoId } : {}),
        },
      },
      ...(input.status ? { status: input.status } : {}),
    };

    const offset = (input.page - 1) * input.limit;

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: input.limit,
      }),
      prisma.review.count({ where }),
    ]);

    return {
      reviews: items.map(toBundle),
      total,
      page: input.page,
      limit: input.limit,
    };
  },

  async lookupBySlug(input: {
    userId: string;
    orgSlug: string;
    repoName: string;
    prId: string;
  }): Promise<
    | ReviewResult
    | {
        review: null;
        repository: NonNullable<
          Awaited<ReturnType<typeof repositoryService.findByOrgAndName>>
        >;
        externalId: string;
      }
  > {
    const repo = await repositoryService.findByOrgAndName({
      userId: input.userId,
      orgSlug: input.orgSlug,
      repoName: input.repoName,
    });
    if (!repo) throw AppError.notFound('Repository not connected under this organization');

    const latest = await findLatestReviewIdForPr(repo.id, input.prId);
    if (!latest) {
      return { review: null, repository: repo, externalId: input.prId };
    }
    return this.getFullResult(latest.reviewId, input.userId);
  },
};
