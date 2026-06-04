import type {
  Review as PrismaReview,
  ReviewComment as PrismaReviewComment,
  PullRequest as PrismaPullRequest,
  Repository as PrismaRepository,
} from '@prisma/client';
import type {
  Finding,
  ReviewHealth,
  ReviewRecord,
  ReviewCategory,
  ReviewDepth,
  ReviewSide,
  ReviewStatus,
  MergeRecommendation,
  Severity,
  ChangedFileAnalysis,
  PullRequestRecord,
  PullRequestState,
  ReviewDecision,
  RepositoryRecord,
  Provider,
} from '../../types';

/** Map a Prisma `Review` row to the API record (snake→camel handled by Prisma). */
export function toRecord(row: PrismaReview): ReviewRecord {
  return {
    id: row.id,
    pullRequestId: row.pullRequestId,
    status: row.status as ReviewStatus,
    reviewDepth: row.reviewDepth as ReviewDepth,
    customPrompt: row.customPrompt,
    riskScore: row.riskScore,
    mergeRecommendation: (row.mergeRecommendation as MergeRecommendation | null) ?? null,
    regressionProbability:
      row.regressionProbability !== null ? row.regressionProbability.toNumber() : null,
    executiveSummary: row.executiveSummary,
    technicalSummary: row.technicalSummary,
    deploymentRisk: row.deploymentRisk,
    durationMs: row.durationMs,
    errorMessage: row.errorMessage,
    health: (row.health as ReviewHealth | null) ?? null,
    topPriorityFixes: Array.isArray(row.topPriorityFixes)
      ? (row.topPriorityFixes as string[])
      : [],
    changedFilesAnalysis: Array.isArray(row.changedFilesAnalysis)
      ? (row.changedFilesAnalysis as unknown as ChangedFileAnalysis[])
      : [],
    postedToProviderAt: row.postedToProviderAt
      ? row.postedToProviderAt.toISOString()
      : null,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

export function toCommentRecord(row: PrismaReviewComment) {
  return {
    id: row.id,
    reviewId: row.reviewId,
    agentType: row.agentType as Finding['agentType'],
    category: (row.category as ReviewCategory | null) ?? null,
    severity: row.severity as Severity,
    confidence: row.confidence.toNumber(),
    file: row.file,
    line: row.line,
    endLine: row.endLine,
    side: (row.side as ReviewSide) ?? 'RIGHT',
    title: row.title,
    issue: row.issue,
    impact: row.impact,
    recommendation: row.recommendation,
    suggestedFix: row.suggestedFix,
    postedToProvider: row.postedToProvider,
    discardedAt: row.discardedAt ? row.discardedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Map a Prisma `PullRequest` row to the API record. */
export function prToRecord(pr: PrismaPullRequest): PullRequestRecord {
  return {
    id: pr.id,
    repositoryId: pr.repositoryId,
    externalId: pr.externalId,
    prUrl: pr.prUrl,
    title: pr.title,
    description: pr.description,
    author: pr.author,
    sourceBranch: pr.sourceBranch,
    targetBranch: pr.targetBranch,
    filesChanged: pr.filesChanged,
    additions: pr.additions,
    deletions: pr.deletions,
    state: pr.state as PullRequestState,
    reviewDecision: (pr.reviewDecision as ReviewDecision) ?? null,
    closedAt: pr.closedAt ? pr.closedAt.toISOString() : null,
    mergedAt: pr.mergedAt ? pr.mergedAt.toISOString() : null,
    createdAt: pr.createdAt.toISOString(),
  };
}

/** Map a Prisma `Repository` row (+ optional org slug) to the API record. */
export function repoToRecord(
  repo: PrismaRepository,
  organizationSlug: string | null = null,
): RepositoryRecord {
  return {
    id: repo.id,
    userId: repo.userId,
    organizationId: repo.organizationId,
    organizationSlug,
    provider: repo.provider as Provider,
    orgOrWorkspace: repo.orgOrWorkspace,
    repoName: repo.repoName,
    repoUrl: repo.repoUrl,
    defaultBranch: repo.defaultBranch,
    language: repo.language ?? null,
    webhookId: repo.webhookId,
    createdAt: repo.createdAt.toISOString(),
  };
}
