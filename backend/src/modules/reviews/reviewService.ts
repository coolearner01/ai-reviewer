import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/client';
import { reviewEventBus } from '../../infrastructure/events/eventBus';
import { assertOwnershipBy } from '../shared/ownership';
import type {
  ChangedFileAnalysis,
  MergeRecommendation,
  ReviewDepth,
  ReviewHealth,
  ReviewProgressEvent,
  ReviewRecord,
  ReviewStatus,
} from '../../types';
import { toRecord } from './reviewMappers';
import { reviewCommentService } from './reviewCommentService';
import { reviewReadService } from './reviewReadService';

const reviewCoreService = {
  async create(input: {
    pullRequestId: string;
    reviewDepth: ReviewDepth;
    customPrompt?: string;
  }): Promise<ReviewRecord> {
    const review = await prisma.review.create({
      data: {
        pullRequestId: input.pullRequestId,
        status: 'queued',
        reviewDepth: input.reviewDepth,
        customPrompt: input.customPrompt ?? null,
      },
    });
    return toRecord(review);
  },

  async findById(id: string): Promise<ReviewRecord | null> {
    const review = await prisma.review.findUnique({ where: { id } });
    return review ? toRecord(review) : null;
  },

  async failStuckReviews(): Promise<number> {
    // Per-row COALESCE (keep existing error_message/completed_at when present)
    // can't be expressed with updateMany, so use raw SQL here.
    const count = await prisma.$executeRaw`
      UPDATE reviews
         SET status = 'failed',
             error_message = COALESCE(error_message,
               'Review interrupted by a server restart before it finished. Please run it again.'),
             completed_at = COALESCE(completed_at, NOW())
       WHERE status IN ('queued','fetching','analyzing','commenting')`;
    return count;
  },

  async updateStatus(input: {
    reviewId: string;
    status: ReviewStatus;
    message: string;
    progress: number;
    errorMessage?: string;
    durationMs?: number;
  }): Promise<void> {
    const { reviewId, status, message, progress, errorMessage, durationMs } = input;
    const completedAt = status === 'completed' || status === 'failed' ? new Date() : null;

    const data: Prisma.ReviewUpdateManyMutationInput = { status };
    if (errorMessage !== undefined && errorMessage !== null) data.errorMessage = errorMessage;
    if (durationMs !== undefined && durationMs !== null) data.durationMs = durationMs;
    if (completedAt !== null) data.completedAt = completedAt;

    await prisma.review.updateMany({ where: { id: reviewId }, data });

    const event: ReviewProgressEvent = {
      reviewId,
      status,
      message,
      progress,
      timestamp: new Date().toISOString(),
    };
    reviewEventBus.publish(reviewId, event);
  },

  async finalize(input: {
    reviewId: string;
    riskScore: number;
    mergeRecommendation: MergeRecommendation;
    executiveSummary: string;
    technicalSummary: string;
    deploymentRisk: string;
  }): Promise<void> {
    await prisma.review.update({
      where: { id: input.reviewId },
      data: {
        riskScore: input.riskScore,
        mergeRecommendation: input.mergeRecommendation,
        executiveSummary: input.executiveSummary,
        technicalSummary: input.technicalSummary,
        deploymentRisk: input.deploymentRisk,
      },
    });
  },

  async saveHolisticSummary(
    reviewId: string,
    input: {
      health: ReviewHealth | null;
      topPriorityFixes: string[];
      changedFilesAnalysis: ChangedFileAnalysis[];
      overviewMarkdown?: string;
    },
  ): Promise<void> {
    const data: Prisma.ReviewUpdateInput = {
      health: input.health,
      topPriorityFixes: input.topPriorityFixes as unknown as Prisma.InputJsonValue,
      changedFilesAnalysis: input.changedFilesAnalysis as unknown as Prisma.InputJsonValue,
    };
    if (input.overviewMarkdown !== undefined && input.overviewMarkdown !== null) {
      data.executiveSummary = input.overviewMarkdown;
    }
    await prisma.review.update({ where: { id: reviewId }, data });
  },

  async markPostedToProvider(reviewId: string): Promise<void> {
    await prisma.review.update({
      where: { id: reviewId },
      data: { postedToProviderAt: new Date() },
    });
  },

  async assertOwned(reviewId: string, userId: string): Promise<void> {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        pullRequest: { select: { repository: { select: { userId: true } } } },
      },
    });
    assertOwnershipBy(
      review,
      userId,
      (r) => r.pullRequest.repository.userId,
      'Review not found',
    );
  },
};

/** Unified review service — core lifecycle + reads + comments. */
export const reviewService = {
  ...reviewCoreService,
  ...reviewCommentService,
  ...reviewReadService,
};
