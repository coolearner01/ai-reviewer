import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import { idParamSchema as idParam } from '../schemas';
import { repositoryService } from '../../modules/repositories/repositoryService';
import { pullRequestService } from '../../modules/reviews/pullRequestService';
import { syncRepositoryPullRequests } from '../../modules/reviews/pullRequestSyncService';
import { logger } from '../../utils/logger';
import type { PullRequestState } from '../../types';

const router: Router = Router();

const createSchema = z.object({
  repositoryUrl: z.string().url(),
});

const patchSchema = z.object({
  defaultBranch: z.string().max(120).optional(),
  language: z.string().max(60).optional(),
});

const listPullRequestsQuery = z.object({
  state: z.enum(['open', 'merged', 'closed']).optional(),
  /**
   * `1`/`true`  → sync from the provider before responding (blocking).
   * `async`     → kick off the sync in the background and return cached rows
   *               immediately, so the request never blocks on the provider.
   * `0`/`false` → don't sync; serve cached rows.
   */
  sync: z
    .union([
      z.literal('true'),
      z.literal('false'),
      z.literal('1'),
      z.literal('0'),
      z.literal('async'),
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const repos = await repositoryService.listForUser(req.user!.id);
    res.json({ repositories: repos });
  }),
);

router.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const repo = await repositoryService.upsertFromRepoUrl(req.user!.id, req.body.repositoryUrl);
    res.status(201).json({ repository: repo });
  }),
);

router.get(
  '/:id',
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const repo = await repositoryService.assertOwned(req.params.id, req.user!.id);
    res.json({ repository: repo });
  }),
);

router.get(
  '/:id/pull-requests',
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const query = listPullRequestsQuery.parse(req.query);
    const repositoryId = req.params.id;
    const userId = req.user!.id;
    const state = query.state as PullRequestState | undefined;
    const { page, limit } = query;

    await repositoryService.assertOwned(repositoryId, userId);

    // Scope the sync to the requested state so the Open tab never pays for the
    // full closed/merged history.
    let syncing = false;
    if (query.sync === 'true' || query.sync === '1') {
      await syncRepositoryPullRequests({ repositoryId, userId, state });
    } else if (query.sync === 'async') {
      syncing = true;
      void syncRepositoryPullRequests({ repositoryId, userId, state }).catch((err) => {
        logger.error('[repositories] background PR sync failed', {
          repositoryId,
          error: (err as Error).message,
        });
      });
    }

    const [list, counts] = await Promise.all([
      pullRequestService.listForRepository({ repositoryId, userId, state, page, limit }),
      pullRequestService.countByState(repositoryId, userId),
    ]);

    res.json({
      pullRequests: list.items,
      counts,
      pagination: {
        page,
        limit,
        total: list.total,
        totalPages: Math.max(1, Math.ceil(list.total / limit)),
      },
      syncing,
    });
  }),
);

router.patch(
  '/:id',
  validateParams(idParam),
  validateBody(patchSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof patchSchema>;
    const repo = await repositoryService.updateMetadata({
      userId: req.user!.id,
      repositoryId: req.params.id,
      defaultBranch: body.defaultBranch,
      language: body.language,
    });
    res.json({ repository: repo });
  }),
);

export default router;
