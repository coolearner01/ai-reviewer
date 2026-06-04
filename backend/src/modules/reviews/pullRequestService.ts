import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/client';
import { AppError } from '../../errors/AppError';
import type {
  PRMetadata,
  PullRequestRecord,
  PullRequestState,
  ReviewDecision,
  ReviewStatus,
  MergeRecommendation,
} from '../../types';
import { prToRecord } from './reviewMappers';

export interface PullRequestListRow {
  pullRequest: PullRequestRecord;
  latestReview: {
    id: string;
    status: ReviewStatus;
    mergeRecommendation: MergeRecommendation | null;
    createdAt: string;
  } | null;
}

export const pullRequestService = {
  /** Insert if new, otherwise update mutable fields (title/desc/stats can change). */
  async upsert(input: {
    repositoryId: string;
    prUrl: string;
    metadata: PRMetadata;
    state?: PullRequestState;
  }): Promise<PullRequestRecord> {
    const { repositoryId, prUrl, metadata: m, state } = input;
    const pr = await prisma.pullRequest.upsert({
      where: { prUrl },
      create: {
        repositoryId,
        externalId: m.externalId,
        prUrl,
        title: m.title,
        description: m.description,
        author: m.author,
        sourceBranch: m.sourceBranch,
        targetBranch: m.targetBranch,
        filesChanged: m.filesChanged,
        additions: m.additions,
        deletions: m.deletions,
        state: state ?? 'open',
      },
      update: {
        title: m.title,
        description: m.description,
        author: m.author,
        sourceBranch: m.sourceBranch,
        targetBranch: m.targetBranch,
        filesChanged: m.filesChanged,
        additions: m.additions,
        deletions: m.deletions,
        // Only move state when the caller supplied one.
        ...(state ? { state } : {}),
      },
    });
    return prToRecord(pr);
  },

  async createPlaceholder(input: {
    repositoryId: string;
    prUrl: string;
    externalId: string;
  }): Promise<PullRequestRecord> {
    const pr = await prisma.pullRequest.upsert({
      where: { prUrl: input.prUrl },
      create: {
        repositoryId: input.repositoryId,
        externalId: input.externalId,
        prUrl: input.prUrl,
        title: '(pending)',
      },
      update: {},
    });
    return prToRecord(pr);
  },

  async findById(id: string): Promise<PullRequestRecord | null> {
    const pr = await prisma.pullRequest.findUnique({ where: { id } });
    return pr ? prToRecord(pr) : null;
  },

  /**
   * Assert the requesting user owns the PR (via the owning repository) and
   * return it. Throws 404 when missing, 403 when owned by someone else.
   */
  async assertOwned(prId: string, userId: string): Promise<PullRequestRecord> {
    const pr = await prisma.pullRequest.findUnique({
      where: { id: prId },
      include: { repository: { select: { userId: true } } },
    });
    if (!pr) throw AppError.notFound('Pull request not found');
    if (pr.repository.userId !== userId) throw AppError.forbidden();
    return prToRecord(pr);
  },

  async findByRepoAndExternalId(input: {
    repositoryId: string;
    externalId: string;
  }): Promise<PullRequestRecord | null> {
    const pr = await prisma.pullRequest.findFirst({
      where: { repositoryId: input.repositoryId, externalId: input.externalId },
    });
    return pr ? prToRecord(pr) : null;
  },

  /**
   * Page through a repository's PRs. Ordered by `createdAt` desc at the DB
   * level so pagination is stable and cheap (the old in-memory sort by latest
   * review timestamp can't survive skip/take). Returns the page plus the total
   * matching count so callers can compute page counts.
   */
  async listForRepository(input: {
    repositoryId: string;
    userId: string;
    state?: PullRequestState;
    page?: number;
    limit?: number;
  }): Promise<{ items: PullRequestListRow[]; total: number }> {
    const where: Prisma.PullRequestWhereInput = {
      repositoryId: input.repositoryId,
      repository: { userId: input.userId },
      ...(input.state ? { state: input.state } : {}),
    };

    const limit = input.limit && input.limit > 0 ? input.limit : undefined;
    const page = input.page && input.page > 0 ? input.page : 1;
    const skip = limit ? (page - 1) * limit : undefined;

    const [rows, total] = await Promise.all([
      prisma.pullRequest.findMany({
        where,
        include: {
          // The single most-recent review stands in for the old LATERAL join.
          reviews: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, status: true, mergeRecommendation: true, createdAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        ...(skip !== undefined ? { skip } : {}),
        ...(limit !== undefined ? { take: limit } : {}),
      }),
      prisma.pullRequest.count({ where }),
    ]);

    const items = rows.map((row) => {
      const latest = row.reviews[0];
      return {
        pullRequest: prToRecord(row),
        latestReview: latest
          ? {
              id: latest.id,
              status: latest.status as ReviewStatus,
              mergeRecommendation: latest.mergeRecommendation as MergeRecommendation | null,
              createdAt: latest.createdAt.toISOString(),
            }
          : null,
      };
    });

    return { items, total };
  },

  async countByState(
    repositoryId: string,
    userId: string,
  ): Promise<Record<PullRequestState, number>> {
    const groups = await prisma.pullRequest.groupBy({
      by: ['state'],
      where: { repositoryId, repository: { userId } },
      _count: { _all: true },
    });
    const out: Record<PullRequestState, number> = { open: 0, merged: 0, closed: 0 };
    for (const g of groups) {
      out[g.state as PullRequestState] = g._count._all;
    }
    return out;
  },

  async updateState(input: {
    pullRequestId: string;
    state?: PullRequestState;
    reviewDecision?: ReviewDecision;
  }): Promise<PullRequestRecord> {
    const current = await prisma.pullRequest.findUnique({
      where: { id: input.pullRequestId },
    });
    if (!current) throw AppError.notFound('Pull request not found');

    const data: Prisma.PullRequestUpdateInput = {};
    if (input.state !== undefined) {
      data.state = input.state;
      if (input.state === 'closed') {
        data.closedAt = current.closedAt ?? new Date();
      } else if (input.state === 'merged') {
        data.mergedAt = current.mergedAt ?? new Date();
        data.closedAt = current.closedAt ?? new Date();
      } else if (input.state === 'open') {
        data.closedAt = null;
        data.mergedAt = null;
      }
    }
    if (input.reviewDecision !== undefined) {
      data.reviewDecision = input.reviewDecision;
    }

    if (Object.keys(data).length === 0) return prToRecord(current);

    const updated = await prisma.pullRequest.update({
      where: { id: input.pullRequestId },
      data,
    });
    return prToRecord(updated);
  },
};
