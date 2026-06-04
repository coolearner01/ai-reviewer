import type { Finding, MergeRecommendation } from '../../../types';
import { orchestrator } from '../../../agents/orchestrator';

export function isIgnored(file: string, ignoredPaths: string[]): boolean {
  return ignoredPaths.some((p) => file.startsWith(p));
}

export function buildExecutiveSummary(
  findings: Finding[],
  rec: MergeRecommendation,
  riskScore: number,
): string {
  const critical = findings.filter((f) => f.severity === 'critical').length;
  const high = findings.filter((f) => f.severity === 'high').length;
  return `Risk score ${riskScore}/100 — ${rec}. ${critical} critical, ${high} high-severity findings.`;
}

export function deploymentRiskFromScore(score: number): string {
  if (score >= 80) return 'High — block deployment until critical findings are resolved.';
  if (score >= 60) return 'Elevated — review required before merging to main.';
  if (score >= 30) return 'Moderate — safe to merge with minor follow-ups.';
  return 'Low — no deployment-blocking concerns detected.';
}

export type OrchestratorResult = Awaited<ReturnType<typeof orchestrator.runAllAgents>>;
