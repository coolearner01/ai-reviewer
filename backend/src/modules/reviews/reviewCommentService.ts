import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/client';
import { assertOwnershipBy } from '../shared/ownership';
import type { Finding, Severity } from '../../types';
import { toCommentRecord } from './reviewMappers';

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const reviewCommentService = {
  async saveComments(reviewId: string, findings: Finding[]): Promise<void> {
    if (findings.length === 0) return;
    await prisma.reviewComment.createMany({
      data: findings.map((f) => ({
        reviewId,
        agentType: f.agentType,
        category: f.category ?? null,
        severity: f.severity,
        confidence: new Prisma.Decimal(f.confidence),
        file: f.file,
        line: f.line,
        endLine: f.endLine ?? null,
        side: f.side ?? 'RIGHT',
        title: f.title,
        issue: f.issue,
        impact: f.impact,
        recommendation: f.recommendation,
        suggestedFix: f.suggestedFix ?? null,
      })),
    });
  },

  async markCommentPosted(commentId: string): Promise<void> {
    await prisma.reviewComment.update({
      where: { id: commentId },
      data: { postedToProvider: true },
    });
  },

  async listComments(
    reviewId: string,
    options: { includeDiscarded?: boolean } = {},
  ) {
    const rows = await prisma.reviewComment.findMany({
      where: {
        reviewId,
        ...(options.includeDiscarded ? {} : { discardedAt: null }),
      },
    });
    // Sort by severity rank, then file, then line — mirrors the original
    // CASE-based ORDER BY (Prisma can't express it in the query).
    rows.sort(
      (a, b) =>
        SEVERITY_RANK[a.severity as Severity] - SEVERITY_RANK[b.severity as Severity] ||
        a.file.localeCompare(b.file) ||
        a.line - b.line,
    );
    return rows.map(toCommentRecord);
  },

  async assertCommentOwned(commentId: string, userId: string): Promise<{ reviewId: string }> {
    const comment = await prisma.reviewComment.findUnique({
      where: { id: commentId },
      select: {
        reviewId: true,
        review: {
          select: { pullRequest: { select: { repository: { select: { userId: true } } } } },
        },
      },
    });
    const row = assertOwnershipBy(
      comment,
      userId,
      (c) => c.review.pullRequest.repository.userId,
      'Comment not found',
    );
    return { reviewId: row.reviewId };
  },

  async discardComment(commentId: string): Promise<void> {
    await prisma.reviewComment.updateMany({
      where: { id: commentId, discardedAt: null },
      data: { discardedAt: new Date() },
    });
  },

  async restoreComment(commentId: string): Promise<void> {
    await prisma.reviewComment.update({
      where: { id: commentId },
      data: { discardedAt: null },
    });
  },
};
