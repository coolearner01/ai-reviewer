import { reviewService } from './reviewService';
import { resolveProviderFor } from '../providers/providerResolver';
import { loadReviewRepoContext } from './reviewQueries';
import { buildInlineCommentBody, buildSummaryMarkdown } from '../comments/summaryBuilder';
import { logger } from '../../utils/logger';
import { AppError } from '../../errors/AppError';
import type { Finding, Provider } from '../../types';

interface PostContext {
  reviewId: string;
  prUrl: string;
  provider: Provider;
  organizationId: string | null;
}

interface PostOutcome {
  reviewId: string;
  postedInline: number;
  postedSummary: boolean;
  failedInline: number;
  errors: string[];
}

/**
 * Manually re-post an existing review's inline + summary comments to the
 * upstream provider (GitHub/GitLab/Bitbucket).
 *
 * The pipeline already does this on first review run, but a re-post is useful
 * when:
 *   - The first attempt failed (e.g. PAT was missing scopes)
 *   - The user wants to push an old review to a freshly-reopened PR
 *   - The user manually toggled provider credentials
 */
export const postToProviderService = {
  async postReview(reviewId: string, userId: string): Promise<PostOutcome> {
    await reviewService.assertOwned(reviewId, userId);
    const ctx = await loadContext(reviewId);
    const review = await reviewService.findById(reviewId);
    if (!review) throw AppError.notFound('Review not found');
    if (review.status !== 'completed') {
      throw AppError.badRequest(
        `Review is in status "${review.status}" — only completed reviews can be re-posted.`,
      );
    }

    const comments = await reviewService.listComments(reviewId);
    const findings: Finding[] = comments.map((c) => ({
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

    const provider = await resolveProviderFor({
      organizationId: ctx.organizationId,
      provider: ctx.provider,
      logContext: '[post-to-provider]',
    });

    const errors: string[] = [];
    let postedInline = 0;
    let failedInline = 0;

    for (const f of findings) {
      try {
        await provider.postInlineComment(ctx.prUrl, {
          file: f.file,
          line: f.line,
          body: buildInlineCommentBody(f, ctx.provider),
        });
        postedInline += 1;
      } catch (err) {
        failedInline += 1;
        const msg = (err as Error).message;
        errors.push(`inline ${f.file}:${f.line} — ${msg}`);
        logger.warn('[post-to-provider] inline failed', {
          reviewId,
          file: f.file,
          line: f.line,
          error: msg,
        });
      }
    }

    let postedSummary = false;
    try {
      await provider.postSummaryComment(
        ctx.prUrl,
        buildSummaryMarkdown({
          provider: ctx.provider,
          findings,
          riskScore: review.riskScore ?? 0,
          mergeRecommendation: review.mergeRecommendation ?? 'NEEDS_CHANGES',
          overview: review.executiveSummary ?? undefined,
          topPriorityFixes: review.topPriorityFixes,
        }),
      );
      postedSummary = true;
    } catch (err) {
      const msg = (err as Error).message;
      errors.push(`summary — ${msg}`);
      logger.warn('[post-to-provider] summary failed', { reviewId, error: msg });
    }

    if (postedSummary || postedInline > 0) {
      await reviewService.markPostedToProvider(reviewId).catch(() => undefined);
    }

    return {
      reviewId,
      postedInline,
      postedSummary,
      failedInline,
      errors,
    };
  },
};

async function loadContext(reviewId: string): Promise<PostContext> {
  const row = await loadReviewRepoContext(reviewId);
  if (!row) throw AppError.notFound('Review not found');
  return {
    reviewId,
    prUrl: row.prUrl,
    provider: row.provider,
    organizationId: row.organizationId,
  };
}
