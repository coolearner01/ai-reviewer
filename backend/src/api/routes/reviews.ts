import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { reviewSubmitLimiter } from '../middleware/rateLimit';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import { idParamSchema, focusAreasSchema, reviewDepthSchema, reviewStatusSchema } from '../schemas';
import { slugLookupParamsSchema } from '../schemas/slugLookup';
import { reviewService } from '../../modules/reviews/reviewService';
import { postToProviderService } from '../../modules/reviews/postToProviderService';
import { startReview } from '../../modules/reviews/reviewEnqueueService';
import { jobQueue, JOB_NAMES, type RunReviewPayload } from '../../infrastructure/jobs/jobQueue';
import { AppError } from '../../errors/AppError';

const router: Router = Router();

const submitSchema = z.object({
  repositoryUrl: z.string().url(),
  pullRequestUrl: z.string().url(),
  reviewDepth: reviewDepthSchema.default('standard'),
  customPrompt: z.string().max(4000).optional(),
  focusAreas: focusAreasSchema.optional(),
  ignoredPaths: z.array(z.string()).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  status: reviewStatusSchema.optional(),
  repoId: z.string().uuid().optional(),
});

router.use(requireAuth);

router.post(
  '/',
  reviewSubmitLimiter,
  validateBody(submitSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof submitSchema>;
    const { reviewId } = await startReview({
      userId: req.user!.id,
      pullRequestUrl: body.pullRequestUrl,
      reviewDepth: body.reviewDepth,
      customPrompt: body.customPrompt,
      logContext: '[reviews]',
    });

    res.status(202).json({
      reviewId,
      status: 'queued',
      message: 'Review queued — connect to /reviews/:id/progress for live updates.',
    });
  }),
);

router.get(
  '/',
  validateQuery(listQuerySchema),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listQuerySchema>;
    const result = await reviewService.listForUser({ userId: req.user!.id, ...q });
    res.json(result);
  }),
);

router.get(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const result = await reviewService.getFullResult(req.params.id, req.user!.id);
    res.json(result);
  }),
);

router.get(
  '/lookup/:orgSlug/:repoName/pulls/:prId',
  validateParams(slugLookupParamsSchema),
  asyncHandler(async (req, res) => {
    const params = req.params as z.infer<typeof slugLookupParamsSchema>;
    const result = await reviewService.lookupBySlug({
      userId: req.user!.id,
      ...params,
    });
    res.json(result);
  }),
);

router.post(
  '/:id/retry',
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    await reviewService.assertOwned(req.params.id, req.user!.id);
    const review = await reviewService.findById(req.params.id);
    if (!review) throw AppError.notFound('Review not found');
    if (review.status !== 'failed' && review.status !== 'completed') {
      throw AppError.badRequest('Review is still running');
    }
    await reviewService.updateStatus({
      reviewId: review.id,
      status: 'queued',
      message: 'Review re-queued',
      progress: 0,
    });
    jobQueue.enqueue<RunReviewPayload>(JOB_NAMES.RUN_REVIEW, { reviewId: review.id });
    res.json({ reviewId: review.id, status: 'queued' });
  }),
);

router.post(
  '/:id/cancel',
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    await reviewService.assertOwned(req.params.id, req.user!.id);
    await reviewService.cancelReview(req.params.id);
    res.json({ reviewId: req.params.id, status: 'cancelled' });
  }),
);

router.delete(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    await reviewService.assertOwned(req.params.id, req.user!.id);
    await reviewService.deleteReview(req.params.id);
    res.status(204).end();
  }),
);

router.post(
  '/:id/post-to-github',
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const result = await postToProviderService.postReview(req.params.id, req.user!.id);
    res.json(result);
  }),
);

const commentParamsSchema = z.object({
  id: z.string().uuid(),
  commentId: z.string().uuid(),
});

async function assertCommentOnReview(
  reviewId: string,
  commentId: string,
  userId: string,
): Promise<void> {
  await reviewService.assertOwned(reviewId, userId);
  const owner = await reviewService.assertCommentOwned(commentId, userId);
  if (owner.reviewId !== reviewId) {
    throw AppError.notFound('Comment not found on this review');
  }
}

router.delete(
  '/:id/comments/:commentId',
  validateParams(commentParamsSchema),
  asyncHandler(async (req, res) => {
    const { id: reviewId, commentId } = req.params as z.infer<typeof commentParamsSchema>;
    await assertCommentOnReview(reviewId, commentId, req.user!.id);
    await reviewService.discardComment(commentId);
    res.status(204).end();
  }),
);

router.post(
  '/:id/comments/:commentId/restore',
  validateParams(commentParamsSchema),
  asyncHandler(async (req, res) => {
    const { id: reviewId, commentId } = req.params as z.infer<typeof commentParamsSchema>;
    await assertCommentOnReview(reviewId, commentId, req.user!.id);
    await reviewService.restoreComment(commentId);
    res.status(204).end();
  }),
);

export default router;
