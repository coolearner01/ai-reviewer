import { config } from '../config';
import type { Finding, Severity, AgentSummary, FileRisk, AgentType } from '../types';

const PROXIMITY_LINES = 3;

const EMPTY_BREAKDOWN: Record<Severity, number> = {
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
};

/**
 * Deduplicate, filter and post-process findings returned by the orchestrator.
 *
 *  - Findings with confidence < MIN_FINDING_CONFIDENCE (default 0.75) are dropped
 *  - Two findings on the same file within PROXIMITY_LINES lines are treated as
 *    duplicates; only the higher-confidence one survives (ties broken by severity)
 */
export function postProcessFindings(raw: Finding[]): Finding[] {
  const filtered = raw.filter((f) => f.confidence >= config.MIN_FINDING_CONFIDENCE);

  const buckets = new Map<string, Finding[]>();
  for (const f of filtered) {
    const list = buckets.get(f.file) ?? [];
    list.push(f);
    buckets.set(f.file, list);
  }

  const deduped: Finding[] = [];
  for (const [, list] of buckets) {
    list.sort((a, b) => a.line - b.line);
    for (const candidate of list) {
      const nearby = deduped.find(
        (existing) =>
          existing.file === candidate.file &&
          Math.abs(existing.line - candidate.line) <= PROXIMITY_LINES,
      );
      if (!nearby) {
        deduped.push(candidate);
        continue;
      }
      if (shouldReplace(nearby, candidate)) {
        const idx = deduped.indexOf(nearby);
        deduped[idx] = candidate;
      }
    }
  }
  return deduped;
}

function shouldReplace(existing: Finding, candidate: Finding): boolean {
  if (candidate.confidence > existing.confidence) return true;
  if (candidate.confidence === existing.confidence) {
    return severityRank(candidate.severity) > severityRank(existing.severity);
  }
  return false;
}

function severityRank(s: Severity): number {
  return { low: 0, medium: 1, high: 2, critical: 3 }[s];
}

export function summarizeByAgent(findings: Finding[]): AgentSummary[] {
  const groups = new Map<AgentType, Finding[]>();
  for (const f of findings) {
    const list = groups.get(f.agentType) ?? [];
    list.push(f);
    groups.set(f.agentType, list);
  }
  return [...groups.entries()].map(([agentType, list]) => ({
    agentType,
    findingCount: list.length,
    severityBreakdown: countBySeverity(list),
  }));
}

export function rankFilesByRisk(findings: Finding[]): FileRisk[] {
  const groups = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = groups.get(f.file) ?? [];
    list.push(f);
    groups.set(f.file, list);
  }
  const out: FileRisk[] = [];
  for (const [file, list] of groups) {
    out.push({
      file,
      findingCount: list.length,
      riskScore: fileRiskScore(list),
      severityBreakdown: countBySeverity(list),
    });
  }
  return out.sort((a, b) => b.riskScore - a.riskScore);
}

function countBySeverity(list: Finding[]): Record<Severity, number> {
  const out = { ...EMPTY_BREAKDOWN };
  for (const f of list) out[f.severity]++;
  return out;
}

function fileRiskScore(list: Finding[]): number {
  const weights: Record<Severity, number> = { critical: 40, high: 20, medium: 8, low: 2 };
  let raw = 0;
  for (const f of list) raw += weights[f.severity] * f.confidence;
  return Math.min(100, Math.round(raw));
}
