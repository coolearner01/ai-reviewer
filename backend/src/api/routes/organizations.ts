import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import { idParamSchema as idParam, providerSchema, reviewPreferencesSchema as settingsSchema } from '../schemas';
import { organizationService } from '../../modules/organizations/organizationService';
import { organizationSettingsService } from '../../modules/organizations/organizationSettingsService';
import { repositoryService } from '../../modules/repositories/repositoryService';
import { buildProvider } from '../../providers';
import { getBitbucketCredentialIssue } from '../../providers/bitbucket';
import { AppError } from '../../errors/AppError';
import { logger } from '../../utils/logger';
import type { Provider } from '../../types';

const router: Router = Router();

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  provider: providerSchema,
  apiKey: z.string().min(8, 'API key looks too short'),
});

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  apiKey: z.string().min(8).optional(),
});

const addRepoSchema = z.object({
  // Accept either a full URL ("https://github.com/org/repo"), an "owner/repo"
  // pair, or a bare repo name. The service resolves the canonical URL.
  repoIdentifier: z.string().min(1, 'Repository name is required').max(200),
  defaultBranch: z.string().max(120).optional(),
  language: z.string().max(60).optional(),
});

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const orgs = await organizationService.list(req.user!.id);
    res.json({ organizations: orgs });
  }),
);

router.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    const { organization, setupGuide } = await organizationService.create({
      userId: req.user!.id,
      name: body.name,
      provider: body.provider,
      apiKey: body.apiKey,
    });
    res.status(201).json({ organization, setupGuide });
  }),
);

router.get(
  '/:id',
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const row = await organizationService.assertOwned(req.params.id, req.user!.id);
    const organization = organizationService.toPublic(row);
    const setupGuide = organizationService.buildSetupGuide(row);
    res.json({ organization, setupGuide });
  }),
);

router.patch(
  '/:id',
  validateParams(idParam),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof updateSchema>;
    const org = await organizationService.update({
      id: req.params.id,
      userId: req.user!.id,
      name: body.name,
      apiKey: body.apiKey,
    });
    res.json({ organization: org });
  }),
);

router.delete(
  '/:id',
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    await organizationService.remove(req.params.id, req.user!.id);
    res.status(204).end();
  }),
);

// ---------- per-org settings ----------

router.get(
  '/:id/settings',
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const org = await organizationService.assertOwned(req.params.id, req.user!.id);
    const settings = await organizationSettingsService.getForOrganization(org.id);
    res.json({ settings });
  }),
);

router.patch(
  '/:id/settings',
  validateParams(idParam),
  validateBody(settingsSchema),
  asyncHandler(async (req, res) => {
    const org = await organizationService.assertOwned(req.params.id, req.user!.id);
    const settings = await organizationSettingsService.upsert(org.id, req.body);
    res.json({ settings });
  }),
);

router.post(
  '/:id/webhook/rotate',
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const setupGuide = await organizationService.rotateWebhookSecret(req.params.id, req.user!.id);
    res.json({ setupGuide });
  }),
);

// ---------- nested repositories ----------

router.get(
  '/:id/repositories',
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    await organizationService.assertOwned(req.params.id, req.user!.id);
    const repositories = await repositoryService.listForOrganization(req.user!.id, req.params.id);
    res.json({ repositories });
  }),
);

router.post(
  '/:id/repositories',
  validateParams(idParam),
  validateBody(addRepoSchema),
  asyncHandler(async (req, res) => {
    const orgRow = await organizationService.assertOwned(req.params.id, req.user!.id);
    const body = req.body as z.infer<typeof addRepoSchema>;
    const repository = await repositoryService.addToOrganization({
      userId: req.user!.id,
      organizationId: orgRow.id,
      provider: orgRow.provider as Provider,
      orgSlug: orgRow.slug,
      repoIdentifier: body.repoIdentifier,
      defaultBranch: body.defaultBranch,
      language: body.language,
    });
    res.status(201).json({ repository });
  }),
);

/**
 * Autocomplete suggestions for the "Add repository" UI.
 * Uses the organization's stored PAT to ask the provider for repos the token
 * can access. Falls back to an empty list (with a logged warning) on failure
 * so the UI degrades gracefully to manual entry.
 */
router.get(
  '/:id/provider-repos',
  validateParams(idParam),
  asyncHandler(async (req, res) => {
    const orgRow = await organizationService.assertOwned(req.params.id, req.user!.id);
    const { apiKey } = organizationService.getCredentials(orgRow);

    if (orgRow.provider === 'bitbucket') {
      const credentialIssue = getBitbucketCredentialIssue(apiKey);
      if (credentialIssue) {
        res.json({ repositories: [], supported: true, error: credentialIssue });
        return;
      }
    }

    const adapter = buildProvider({ provider: orgRow.provider as Provider, token: apiKey });
    if (!adapter.listAccessibleRepositories) {
      res.json({ repositories: [], supported: false });
      return;
    }
    const rawQuery = typeof req.query.q === 'string' ? req.query.q : undefined;
    const rawLimit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    try {
      const repositories = await adapter.listAccessibleRepositories({
        hintOwner: orgRow.slug,
        query: rawQuery,
        limit: Number.isFinite(rawLimit) ? rawLimit : undefined,
      });
      res.json({ repositories, supported: true });
    } catch (err) {
      logger.warn('[organizations] listAccessibleRepositories failed', {
        orgId: orgRow.id,
        provider: orgRow.provider,
        error: (err as Error).message,
      });
      res.json({ repositories: [], supported: true, error: (err as Error).message });
    }
  }),
);

// Lookup by slug — powers the GitHub-style URL /:org/:repo/pulls/:prId.
router.get(
  '/by-slug/:slug',
  asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    if (!slug) throw AppError.badRequest('Slug is required');
    const row = await organizationService.findBySlug(req.user!.id, slug);
    if (!row) throw AppError.notFound('Organization not found');
    const repositories = await repositoryService.listForOrganization(req.user!.id, row.id);
    res.json({
      organization: organizationService.toPublic(row),
      repositories,
    });
  }),
);

export default router;
