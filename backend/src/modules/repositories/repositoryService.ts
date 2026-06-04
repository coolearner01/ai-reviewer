import type { Repository } from '@prisma/client';
import { prisma } from '../../infrastructure/database/client';
import { parseRepoUrl } from '../../utils/urlParser';
import type { Provider, RepositoryRecord } from '../../types';
import { AppError } from '../../errors/AppError';

/** Filtered relation count of open PRs, attached by the list endpoints. */
const OPEN_PR_COUNT = {
  _count: { select: { pullRequests: { where: { state: 'open' } } } },
} as const;

export const repositoryService = {
  /**
   * Upsert a repository row from a URL.
   *
   * @param organizationId  Optional org to attach this repo to. If null we keep
   *                        the legacy "loose" behaviour where repos live under
   *                        the user only.
   */
  async upsertFromRepoUrl(
    userId: string,
    repoUrl: string,
    organizationId: string | null = null,
  ): Promise<RepositoryRecord> {
    const parsed = parseRepoUrl(repoUrl);
    const existing = await prisma.repository.findUnique({
      where: { repoUrl: parsed.repoUrl },
    });
    if (existing) {
      // Backfill org link if the caller now knows it but the row didn't.
      if (organizationId && !existing.organizationId) {
        const updated = await prisma.repository.update({
          where: { id: existing.id },
          data: { organizationId },
        });
        return toRecord(updated);
      }
      return toRecord(existing);
    }

    const inserted = await prisma.repository.create({
      data: {
        userId,
        organizationId,
        provider: parsed.provider,
        orgOrWorkspace: parsed.org,
        repoName: parsed.repo,
        repoUrl: parsed.repoUrl,
      },
    });
    return toRecord(inserted);
  },

  /**
   * Add a repo using just the repo name (or full URL) within an existing org.
   * The org's provider determines the URL prefix — the user never has to
   * re-enter "https://github.com/myorg" for every repo they connect.
   *
   * Optional `defaultBranch` and `language` are stored verbatim — used by the
   * "richer repo form" so users can record metadata up front.
   */
  async addToOrganization(input: {
    userId: string;
    organizationId: string;
    provider: Provider;
    orgSlug: string;
    repoIdentifier: string;
    defaultBranch?: string;
    language?: string;
  }): Promise<RepositoryRecord> {
    const repoUrl = resolveRepoUrl({
      provider: input.provider,
      orgSlug: input.orgSlug,
      identifier: input.repoIdentifier,
    });
    const parsed = parseRepoUrl(repoUrl);
    // Provider safety: don't let a user pass a GitLab URL into a GitHub org.
    if (parsed.provider !== input.provider) {
      throw AppError.badRequest(
        `Repository URL is a ${parsed.provider} repo, but the organization uses ${input.provider}`,
      );
    }
    const repo = await this.upsertFromRepoUrl(
      input.userId,
      parsed.repoUrl,
      input.organizationId,
    );
    // Apply optional metadata. We do this with a follow-up UPDATE so the
    // upsert path stays simple.
    if (input.defaultBranch?.trim() || input.language?.trim()) {
      const updated = await prisma.repository.update({
        where: { id: repo.id },
        data: {
          ...(input.defaultBranch?.trim() ? { defaultBranch: input.defaultBranch.trim() } : {}),
          ...(input.language?.trim() ? { language: input.language.trim() } : {}),
        },
      });
      return toRecord(updated);
    }
    return repo;
  },

  /** Patch repo metadata after creation (language, default branch, etc). */
  async updateMetadata(input: {
    userId: string;
    repositoryId: string;
    defaultBranch?: string;
    language?: string;
  }): Promise<RepositoryRecord> {
    const repo = await this.assertOwned(input.repositoryId, input.userId);
    const updated = await prisma.repository.update({
      where: { id: repo.id },
      data: {
        ...(input.defaultBranch !== undefined ? { defaultBranch: input.defaultBranch } : {}),
        ...(input.language !== undefined ? { language: input.language } : {}),
      },
    });
    return toRecord(updated);
  },

  async listForUser(userId: string): Promise<RepositoryRecord[]> {
    const rows = await prisma.repository.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: OPEN_PR_COUNT,
    });
    return rows.map((r) => toRecord(r, r._count.pullRequests));
  },

  async listForOrganization(userId: string, organizationId: string): Promise<RepositoryRecord[]> {
    const rows = await prisma.repository.findMany({
      where: { userId, organizationId },
      orderBy: { createdAt: 'desc' },
      include: OPEN_PR_COUNT,
    });
    return rows.map((r) => toRecord(r, r._count.pullRequests));
  },

  async findById(id: string): Promise<RepositoryRecord | null> {
    const repo = await prisma.repository.findUnique({ where: { id } });
    return repo ? toRecord(repo) : null;
  },

  async findByOrgAndName(input: {
    userId: string;
    orgSlug: string;
    repoName: string;
  }): Promise<RepositoryRecord | null> {
    // Resolve via the owning organization so we can match by org slug.
    const repo = await prisma.repository.findFirst({
      where: {
        repoName: input.repoName,
        organization: { userId: input.userId, slug: input.orgSlug },
      },
    });
    return repo ? toRecord(repo) : null;
  },

  async assertOwned(id: string, userId: string): Promise<RepositoryRecord> {
    const repo = await this.findById(id);
    if (!repo) throw AppError.notFound('Repository not found');
    if (repo.userId !== userId) throw AppError.forbidden();
    return repo;
  },

  async remove(id: string, userId: string): Promise<void> {
    const repo = await this.assertOwned(id, userId);
    await prisma.repository.delete({ where: { id: repo.id } });
  },
};

/**
 * Turn a user-provided "repo identifier" into a canonical repo URL given the
 * org's provider + org slug. Accepts a full URL or any of:
 *   - "owner/repo"
 *   - "repo" (assumes the org slug as owner)
 */
function resolveRepoUrl(input: {
  provider: Provider;
  orgSlug: string;
  identifier: string;
}): string {
  const id = input.identifier.trim().replace(/\.git$/, '');
  if (!id) throw AppError.badRequest('Repository name is required');
  // Already a URL? Trust the caller — we'll re-parse to validate.
  if (/^https?:\/\//i.test(id)) return id;
  // "owner/repo"
  if (id.includes('/')) {
    return buildRepoUrlFromParts(input.provider, id);
  }
  // Bare repo name — slot it under the org slug.
  return buildRepoUrlFromParts(input.provider, `${input.orgSlug}/${id}`);
}

function buildRepoUrlFromParts(provider: Provider, path: string): string {
  // Strip any leading slash and re-validate via parseRepoUrl.
  const clean = path.replace(/^\/+/, '');
  switch (provider) {
    case 'github':
      return `https://github.com/${clean}`;
    case 'gitlab':
      return `https://gitlab.com/${clean}`;
    case 'bitbucket':
      return `https://bitbucket.org/${clean}`;
  }
}

function toRecord(row: Repository, openPrCount?: number): RepositoryRecord {
  const base: RepositoryRecord = {
    id: row.id,
    userId: row.userId,
    organizationId: row.organizationId,
    provider: row.provider as Provider,
    orgOrWorkspace: row.orgOrWorkspace,
    repoName: row.repoName,
    repoUrl: row.repoUrl,
    defaultBranch: row.defaultBranch,
    language: row.language ?? null,
    webhookId: row.webhookId,
    createdAt: row.createdAt.toISOString(),
  };
  if (openPrCount !== undefined) {
    base.openPrCount = openPrCount;
  }
  return base;
}
