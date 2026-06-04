import type { Finding, MergeRecommendation } from '../types';

/**
 * Decides what status the PR should land in based on the findings and risk
 * score. Logic mirrors the spec exactly — kept dependency-free so the rules
 * are obvious at a glance.
 */
export function decideMerge(
  findings: Finding[],
  riskScore: number,
): MergeRecommendation {
  const hasCritical = findings.some(
    (f) => f.severity === 'critical' && f.confidence >= 0.9,
  );
  const highCount = findings.filter(
    (f) => f.severity === 'high' && f.confidence >= 0.85,
  ).length;
  const mediumCount = findings.filter((f) => f.severity === 'medium').length;

  if (hasCritical || riskScore >= 80) return 'BLOCK_MERGE';
  if (highCount >= 3 || riskScore >= 60) return 'NEEDS_CHANGES';
  if (highCount >= 1 || mediumCount >= 3) return 'APPROVE_WITH_MINOR_SUGGESTIONS';
  return 'APPROVE';
}
