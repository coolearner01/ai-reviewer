import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import { idParamSchema as idParam } from '../schemas';
import { pullRequestService } from '../../modules/reviews/pullRequestService';
import { prDetailService } from '../../modules/reviews/prDetailService';
import { repositoryService } from '../../modules/repositories/repositoryService';
import { resolveProviderFor } from '../../modules/providers/providerResolver';
import { loadPullRequestRepoContext } from '../../modules/reviews/reviewQueries';
import { slugLookupParamsSchema } from '../schemas/slugLookup';
import { AppError } from '../../errors/AppError';
import { logger } from '../../utils/logger';
import type {
  Provider,
  PullRequestState,
  ReviewDecision,
  TimelineEventType,
} from '../../types';

const router: Router = Router();

router.use(requireAuth);

router.get(
  '/:id',
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const pr = await pullRequestService.assertOwned(req.params.id, req.user!.id);
    res.json({ pullRequest: pr });
  }),
);

router.get(
  '/:id/detail',
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const pr = await pullRequestService.assertOwned(req.params.id, req.user!.id);
    const [commits, checks, timeline] = await Promise.all([
      prDetailService.listCommits(pr.id),
      prDetailService.listChecks(pr.id),
      prDetailService.listTimeline(pr.id),
    ]);
    res.json({ pullRequest: pr, commits, checks, timeline });
  }),
);

const reviewSchema = z.object({
  decision: z.enum(['APPROVED', 'CHANGES_REQUESTED']),
  comment: z.string().max(2000).optional(),
  /**
   * When true (default), the API also tries to submit a *formal* review on
   * the upstream provider (GitHub createReview with event=APPROVE/
   * REQUEST_CHANGES). When false, only the local DB row is updated.
   */
  submitToProvider: z.boolean().default(true),
});

/**
 * Record a review decision (APPROVED or CHANGES_REQUESTED) on a PR.
 *
 * By default this submits a *formal* review to the upstream provider so the
 * PR's review status changes on GitHub. Set `submitToProvider: false` to
 * keep it local-only. If the provider call fails we still persist the local
 * decision and surface the failure in the response so the UI can show it.
 */
router.post(
  '/:id/review',
  validateParams(idParam),
  validateBody(reviewSchema),
  asyncHandler(async (req, res) => {
    const pr = await pullRequestService.assertOwned(req.params.id, req.user!.id);
    const body = req.body as z.infer<typeof reviewSchema>;
    const decision: ReviewDecision = body.decision;

    // Submit to provider FIRST so the recorded timeline event can mention
    // whether the upstream call succeeded. Failures here don't roll back
    // the local update — the user explicitly asked to record this.
    let providerResult: ProviderSubmitOutcome = { attempted: false };
    if (body.submitToProvider) {
      providerResult = await trySubmitToProvider({
        pullRequestId: pr.id,
        decision,
        body: body.comment,
      });
    }

    const updated = await pullRequestService.updateState({
      pullRequestId: pr.id,
      reviewDecision: decision,
    });
    const eventType: TimelineEventType =
      decision === 'APPROVED' ? 'approved' : 'changes_requested';
    const event = await prDetailService.appendEvent({
      pullRequestId: pr.id,
      eventType,
      actor: req.user!.name || req.user!.email,
      payload: {
        ...(body.comment ? { comment: body.comment } : {}),
        ...(providerResult.attempted
          ? {
              provider: {
                posted: providerResult.posted,
                providerReviewId: providerResult.providerReviewId,
                error: providerResult.error,
              },
            }
          : {}),
      },
    });
    res.json({
      pullRequest: updated,
      event,
      provider: providerResult,
    });
  }),
);

type ProviderSubmitOutcome =
  | { attempted: false }
  | {
      attempted: true;
      posted: boolean;
      providerReviewId?: string;
      error?: string;
    };

/**
 * Best-effort: submit a formal review to the upstream provider using the
 * organization's PAT (if any). Falls back to the global env-var token when
 * the repo isn't linked to an org. Never throws — the local update should
 * always succeed even if GitHub is unreachable.
 */
async function trySubmitToProvider(input: {
  pullRequestId: string;
  decision: ReviewDecision;
  body?: string;
}): Promise<ProviderSubmitOutcome> {
  const row = await loadPullRequestRepoContext(input.pullRequestId);
  if (!row) return { attempted: true, posted: false, error: 'PR not found' };

  const adapter = await resolveProviderFor({
    organizationId: row.organizationId,
    provider: row.provider,
    logContext: '[pull-requests]',
  });

  if (!adapter.submitPullRequestReview) {
    return {
      attempted: true,
      posted: false,
      error: `${row.provider} provider does not support formal review submission yet.`,
    };
  }

  try {
    const result = await adapter.submitPullRequestReview({
      prUrl: row.prUrl,
      decision: input.decision === 'APPROVED' ? 'APPROVE' : 'REQUEST_CHANGES',
      body: input.body,
    });
    return {
      attempted: true,
      posted: true,
      providerReviewId: result.providerReviewId,
    };
  } catch (err) {
    const msg = (err as Error).message;
    logger.warn('[pull-requests] submitPullRequestReview failed', {
      prId: input.pullRequestId,
      error: msg,
    });
    return { attempted: true, posted: false, error: msg };
  }
}

const stateSchema = z.object({
  state: z.enum(['open', 'merged', 'closed']),
  comment: z.string().max(2000).optional(),
});

router.post(
  '/:id/state',
  validateParams(idParam),
  validateBody(stateSchema),
  asyncHandler(async (req, res) => {
    const pr = await pullRequestService.assertOwned(req.params.id, req.user!.id);
    const body = req.body as z.infer<typeof stateSchema>;
    const nextState: PullRequestState = body.state;
    const updated = await pullRequestService.updateState({
      pullRequestId: pr.id,
      state: nextState,
    });
    const eventType: TimelineEventType =
      nextState === 'merged' ? 'merged' : nextState === 'closed' ? 'closed' : 'reopened';
    const event = await prDetailService.appendEvent({
      pullRequestId: pr.id,
      eventType,
      actor: req.user!.name || req.user!.email,
      payload: body.comment ? { comment: body.comment } : {},
    });
    res.json({ pullRequest: updated, event });
  }),
);

const commentSchema = z.object({
  comment: z.string().min(1).max(4000),
});

router.post(
  '/:id/comments',
  validateParams(idParam),
  validateBody(commentSchema),
  asyncHandler(async (req, res) => {
    const pr = await pullRequestService.assertOwned(req.params.id, req.user!.id);
    const body = req.body as z.infer<typeof commentSchema>;
    const event = await prDetailService.appendEvent({
      pullRequestId: pr.id,
      eventType: 'commented',
      actor: req.user!.name || req.user!.email,
      payload: { comment: body.comment },
    });
    res.json({ event });
  }),
);

/**
 * Lookup-by-slug: resolves an org-style URL (`/:orgSlug/:repoName/pulls/:prId`)
 * to the canonical PR id. Used by the PR detail page to fetch commits/checks/
 * timeline without first hitting the review-lookup endpoint.
 */
router.get(
  '/lookup/:orgSlug/:repoName/:prId',
  validateParams(slugLookupParamsSchema),
  asyncHandler(async (req, res) => {
    const { orgSlug, repoName, prId } = req.params as z.infer<typeof slugLookupParamsSchema>;
    const repo = await repositoryService.findByOrgAndName({
      userId: req.user!.id,
      orgSlug,
      repoName,
    });
    if (!repo) throw AppError.notFound('Repository not connected under this organization');
    const pr = await pullRequestService.findByRepoAndExternalId({
      repositoryId: repo.id,
      externalId: prId,
    });
    if (!pr) {
      return res.json({ pullRequest: null, repository: repo });
    }
    const [commits, checks, timeline] = await Promise.all([
      prDetailService.listCommits(pr.id),
      prDetailService.listChecks(pr.id),
      prDetailService.listTimeline(pr.id),
    ]);
    res.json({ pullRequest: pr, repository: repo, commits, checks, timeline });
  }),
);

export default router;
