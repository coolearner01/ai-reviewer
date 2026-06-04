import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/client';
import { reviewEventBus } from '../../infrastructure/events/eventBus';
import { AppError } from '../../errors/AppError';
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
    const completedAt =
      status === 'completed' || status === 'failed' || status === 'cancelled' ? new Date() : null;

    const data: Prisma.ReviewUpdateManyMutationInput = { status };
    if (errorMessage !== undefined && errorMessage !== null) data.errorMessage = errorMessage;
    if (durationMs !== undefined && durationMs !== null) data.durationMs = durationMs;
    if (completedAt !== null) data.completedAt = completedAt;

    // Once a review is cancelled it is terminal: a still-running background job
    // must not be able to flip it back to analyzing/completed/failed. The
    // `NOT status = cancelled` guard makes every later write from that job a
    // no-op, so the user's cancel "sticks".
    const updated = await prisma.review.updateMany({
      where: { id: reviewId, NOT: { status: 'cancelled' } },
      data,
    });
    if (updated.count === 0) return;

    const event: ReviewProgressEvent = {
      reviewId,
      status,
      message,
      progress,
      timestamp: new Date().toISOString(),
    };
    reviewEventBus.publish(reviewId, event);
  },

  /** True when the review is in a terminal state and no longer running. */
  async isCancelled(reviewId: string): Promise<boolean> {
    const row = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { status: true },
    });
    return row?.status === 'cancelled';
  },

  /**
   * Cancel an in-flight review (queued / fetching / analyzing / commenting).
   * Marks it terminal so the in-process job's later status writes become
   * no-ops (see `updateStatus`). Completed/failed/cancelled reviews can't be
   * cancelled — delete them instead.
   */
  async cancelReview(reviewId: string): Promise<void> {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { status: true },
    });
    if (!review) throw AppError.notFound('Review not found');
    if (
      review.status === 'completed' ||
      review.status === 'failed' ||
      review.status === 'cancelled'
    ) {
      throw AppError.badRequest('Review is already finished');
    }
    await reviewService.updateStatus({
      reviewId,
      status: 'cancelled',
      message: 'Review cancelled by user',
      progress: 100,
      errorMessage: 'Cancelled by user',
    });
  },

  /** Permanently delete a review and its comments (cascade) from the database. */
  async deleteReview(reviewId: string): Promise<void> {
    await prisma.review.delete({ where: { id: reviewId } });
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
