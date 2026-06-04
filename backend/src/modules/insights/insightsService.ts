import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/client';

export interface InsightsResponse {
  windowDays: number;
  overview: {
    totalReviews: number;
    completedReviews: number;
    failedReviews: number;
    averageRiskScore: number | null;
    averageDurationMs: number | null;
    blockedMergeCount: number;
    openPRs: number;
    mergedPRs: number;
    closedPRs: number;
  };
  severityBreakdown: { severity: string; count: number }[];
  topRepositories: {
    repositoryId: string;
    repoName: string;
    reviewCount: number;
    averageRiskScore: number | null;
    criticalCount: number;
  }[];
  agentBreakdown: { agentType: string; count: number }[];
  riskTrend: { day: string; averageRiskScore: number | null; reviewCount: number }[];
  mergeDecisionBreakdown: { decision: string; count: number }[];
}

const round = (n: number | null | undefined): number | null =>
  n === null || n === undefined ? null : Math.round(n);

const avg = (values: number[]): number | null =>
  values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;

export const insightsService = {
  async getForUser(userId: string, days: number): Promise<InsightsResponse> {
    const since = new Date(Date.now() - days * 86_400_000);

    const reviewScope: Prisma.ReviewWhereInput = {
      pullRequest: { repository: { userId } },
      createdAt: { gte: since },
    };
    const commentScope: Prisma.ReviewCommentWhereInput = {
      discardedAt: null,
      review: { pullRequest: { repository: { userId } }, createdAt: { gte: since } },
    };

    const [
      totalReviews,
      completedReviews,
      failedReviews,
      riskAgg,
      durationAgg,
      blockedMergeCount,
      prStateGroups,
      severityGroups,
      agentGroups,
      decisionGroups,
      reviewRows,
      criticalComments,
      repos,
    ] = await Promise.all([
      prisma.review.count({ where: reviewScope }),
      prisma.review.count({ where: { ...reviewScope, status: 'completed' } }),
      prisma.review.count({ where: { ...reviewScope, status: 'failed' } }),
      prisma.review.aggregate({
        _avg: { riskScore: true },
        where: { ...reviewScope, status: 'completed' },
      }),
      prisma.review.aggregate({
        _avg: { durationMs: true },
        where: { ...reviewScope, durationMs: { not: null } },
      }),
      prisma.review.count({ where: { ...reviewScope, mergeRecommendation: 'BLOCK_MERGE' } }),
      // PR state counts are NOT time-bounded — they reflect the whole account.
      prisma.pullRequest.groupBy({
        by: ['state'],
        where: { repository: { userId } },
        _count: { _all: true },
      }),
      prisma.reviewComment.groupBy({
        by: ['severity'],
        where: commentScope,
        _count: { _all: true },
      }),
      prisma.reviewComment.groupBy({
        by: ['agentType'],
        where: commentScope,
        _count: { _all: true },
        orderBy: { _count: { agentType: 'desc' } },
      }),
      prisma.review.groupBy({
        by: ['mergeRecommendation'],
        where: { ...reviewScope, mergeRecommendation: { not: null } },
        _count: { _all: true },
      }),
      // Rows we fold in JS for the per-day trend + per-repo rollups, which
      // Prisma can't express as a single grouped query.
      prisma.review.findMany({
        where: reviewScope,
        select: {
          createdAt: true,
          riskScore: true,
          status: true,
          pullRequest: { select: { repositoryId: true } },
        },
      }),
      prisma.reviewComment.findMany({
        where: { ...commentScope, severity: { in: ['critical', 'high'] } },
        select: { review: { select: { pullRequest: { select: { repositoryId: true } } } } },
      }),
      prisma.repository.findMany({ where: { userId }, select: { id: true, repoName: true } }),
    ]);

    const prStateCount = (state: string): number =>
      prStateGroups.find((g) => g.state === state)?._count._all ?? 0;

    // ---- riskTrend: bucket reviews by YYYY-MM-DD ----
    type TrendBucket = { risks: number[]; count: number };
    const trendBuckets = new Map<string, TrendBucket>();
    for (const r of reviewRows) {
      const day = r.createdAt.toISOString().slice(0, 10);
      const bucket: TrendBucket = trendBuckets.get(day) ?? { risks: [], count: 0 };
      bucket.count += 1;
      if (r.status === 'completed' && r.riskScore !== null) bucket.risks.push(r.riskScore);
      trendBuckets.set(day, bucket);
    }
    const riskTrend = [...trendBuckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, b]) => ({
        day,
        averageRiskScore: round(avg(b.risks)),
        reviewCount: b.count,
      }));

    // ---- topRepositories: rollup reviews + critical comments per repo ----
    type RepoStat = { reviewCount: number; risks: number[]; critical: number };
    const repoStats = new Map<string, RepoStat>();
    const ensureRepo = (id: string): RepoStat => {
      const existing = repoStats.get(id);
      if (existing) return existing;
      const fresh: RepoStat = { reviewCount: 0, risks: [], critical: 0 };
      repoStats.set(id, fresh);
      return fresh;
    };
    for (const r of reviewRows) {
      const stat = ensureRepo(r.pullRequest.repositoryId);
      stat.reviewCount += 1;
      if (r.status === 'completed' && r.riskScore !== null) stat.risks.push(r.riskScore);
    }
    for (const c of criticalComments) {
      ensureRepo(c.review.pullRequest.repositoryId).critical += 1;
    }
    const topRepositories = repos
      .map((repo) => {
        const stat: RepoStat = repoStats.get(repo.id) ?? { reviewCount: 0, risks: [], critical: 0 };
        return {
          repositoryId: repo.id,
          repoName: repo.repoName,
          reviewCount: stat.reviewCount,
          averageRiskScore: round(avg(stat.risks)),
          criticalCount: stat.critical,
        };
      })
      .sort((a, b) => b.reviewCount - a.reviewCount)
      .slice(0, 10);

    return {
      windowDays: days,
      overview: {
        totalReviews,
        completedReviews,
        failedReviews,
        averageRiskScore: round(riskAgg._avg.riskScore),
        averageDurationMs: round(durationAgg._avg.durationMs),
        blockedMergeCount,
        openPRs: prStateCount('open'),
        mergedPRs: prStateCount('merged'),
        closedPRs: prStateCount('closed'),
      },
      severityBreakdown: severityGroups.map((g) => ({
        severity: g.severity,
        count: g._count._all,
      })),
      topRepositories,
      agentBreakdown: agentGroups.map((g) => ({
        agentType: g.agentType,
        count: g._count._all,
      })),
      riskTrend,
      mergeDecisionBreakdown: decisionGroups.map((g) => ({
        decision: g.mergeRecommendation ?? 'UNKNOWN',
        count: g._count._all,
      })),
    };
  },
};
