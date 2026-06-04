import { jobQueue, JOB_NAMES } from '../../infrastructure/jobs/jobQueue';
import { aiHealth } from '../../infrastructure/ai/aiClient';
import { reviewService } from './reviewService';
import { prDetailService } from './prDetailService';
import { logger } from '../../utils/logger';
import { AppError } from '../../errors/AppError';
import { loadPipelineState } from './pipeline/loadState';
import {
  step1Fetch,
  step2Analyze,
  step3Comment,
  step5Complete,
} from './pipeline/steps';

interface PipelineJobData {
  reviewId: string;
}

/**
 * The review pipeline (fetch → analyze → persist comments → complete). Wired
 * into the in-process job queue at startup. Comments are persisted only; the
 * user pushes them to the PR explicitly from the dashboard.
 */
export function registerReviewPipeline(): void {
  jobQueue.register<PipelineJobData>(JOB_NAMES.RUN_REVIEW, async ({ reviewId }) => {
    const state = await loadPipelineState(reviewId);
    if (!state) {
      logger.warn('[pipeline] review missing — aborting', { reviewId });
      return;
    }

    try {
      aiHealth.reset();
      const fetched = await step1Fetch(state);
      const orchestrated = await step2Analyze(state, fetched);
      await step3Comment(
        state,
        orchestrated.findings,
        orchestrated.riskScore,
        orchestrated.mergeRecommendation,
        orchestrated.holistic,
      );
      await step5Complete(state);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('[pipeline] failed', { reviewId, error: message });
      await reviewService.updateStatus({
        reviewId,
        status: 'failed',
        message: `Pipeline failed: ${message}`,
        progress: 100,
        errorMessage: message,
        durationMs: Date.now() - state.startedAt,
      });
      if (state.pullRequestId) {
        await prDetailService
          .appendEvent({
            pullRequestId: state.pullRequestId,
            eventType: 'ai_review_failed',
            actor: 'reviewbot',
            payload: { reviewId, error: message },
          })
          .catch(() => undefined);
      }
    }
  });
}

export { AppError };
