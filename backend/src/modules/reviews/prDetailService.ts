import { Prisma, type PrCommit, type PrCheck, type PrTimeline } from '@prisma/client';
import { prisma } from '../../infrastructure/database/client';
import type {
  PRCheckRecord,
  PRCommitRecord,
  PRTimelineEventRecord,
  TimelineEventType,
} from '../../types';

/**
 * Persistence layer for the supplementary PR detail — commits, checks, and the
 * unified timeline feed. Kept in its own module so the review pipeline and
 * workflow endpoints share one place to read/write these rows.
 */

export const prDetailService = {
  // ---------- commits ----------
  async listCommits(pullRequestId: string): Promise<PRCommitRecord[]> {
    const rows = await prisma.prCommit.findMany({
      where: { pullRequestId },
      orderBy: [{ position: 'asc' }, { committedAt: { sort: 'asc', nulls: 'last' } }],
    });
    return rows.map(toCommit);
  },

  async replaceCommits(
    pullRequestId: string,
    commits: Array<{
      sha: string;
      message: string;
      author: string;
      committedAt: Date | null;
    }>,
  ): Promise<void> {
    await prisma.$transaction([
      prisma.prCommit.deleteMany({ where: { pullRequestId } }),
      prisma.prCommit.createMany({
        data: commits.map((c, i) => ({
          pullRequestId,
          sha: c.sha,
          message: c.message,
          author: c.author,
          committedAt: c.committedAt,
          position: i,
        })),
        skipDuplicates: true,
      }),
    ]);
  },

  // ---------- checks ----------
  async listChecks(pullRequestId: string): Promise<PRCheckRecord[]> {
    const rows = await prisma.prCheck.findMany({
      where: { pullRequestId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(toCheck);
  },

  async upsertCheck(input: {
    pullRequestId: string;
    name: string;
    status?: string;
    conclusion?: string | null;
    detailsUrl?: string | null;
  }): Promise<void> {
    await prisma.prCheck.upsert({
      where: {
        pullRequestId_name: { pullRequestId: input.pullRequestId, name: input.name },
      },
      create: {
        pullRequestId: input.pullRequestId,
        name: input.name,
        status: input.status ?? 'completed',
        conclusion: input.conclusion ?? null,
        detailsUrl: input.detailsUrl ?? null,
        updatedAt: new Date(),
      },
      update: {
        status: input.status ?? 'completed',
        conclusion: input.conclusion ?? null,
        detailsUrl: input.detailsUrl ?? null,
        updatedAt: new Date(),
      },
    });
  },

  async replaceChecks(
    pullRequestId: string,
    checks: Array<{
      name: string;
      status?: string;
      conclusion?: string | null;
      detailsUrl?: string | null;
    }>,
  ): Promise<void> {
    await prisma.$transaction([
      prisma.prCheck.deleteMany({ where: { pullRequestId } }),
      prisma.prCheck.createMany({
        data: checks.map((c) => ({
          pullRequestId,
          name: c.name,
          status: c.status ?? 'completed',
          conclusion: c.conclusion ?? null,
          detailsUrl: c.detailsUrl ?? null,
        })),
      }),
    ]);
  },

  // ---------- timeline ----------
  async appendEvent(input: {
    pullRequestId: string;
    eventType: TimelineEventType;
    actor: string;
    payload?: Record<string, unknown>;
  }): Promise<PRTimelineEventRecord> {
    const row = await prisma.prTimeline.create({
      data: {
        pullRequestId: input.pullRequestId,
        eventType: input.eventType,
        actor: input.actor,
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
      },
    });
    return toTimelineEvent(row);
  },

  async listTimeline(pullRequestId: string): Promise<PRTimelineEventRecord[]> {
    const rows = await prisma.prTimeline.findMany({
      where: { pullRequestId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toTimelineEvent);
  },
};

function toCommit(row: PrCommit): PRCommitRecord {
  return {
    id: row.id,
    pullRequestId: row.pullRequestId,
    sha: row.sha,
    message: row.message,
    author: row.author,
    committedAt: row.committedAt ? row.committedAt.toISOString() : null,
    position: row.position,
  };
}

function toCheck(row: PrCheck): PRCheckRecord {
  return {
    id: row.id,
    pullRequestId: row.pullRequestId,
    name: row.name,
    status: row.status,
    conclusion: row.conclusion,
    detailsUrl: row.detailsUrl,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toTimelineEvent(row: PrTimeline): PRTimelineEventRecord {
  return {
    id: row.id,
    pullRequestId: row.pullRequestId,
    eventType: row.eventType as TimelineEventType,
    actor: row.actor,
    payload: (row.payload as Record<string, unknown>) ?? {},
    createdAt: row.createdAt.toISOString(),
  };
}
