import type { Finding, Severity } from '../types';

/**
 * Severity weights — tuned so a single critical (40 * 0.95 = 38) is enough
 * to lift the score into the "danger" band on its own.
 */
const WEIGHTS: Record<Severity, number> = {
  critical: 40,
  high: 20,
  medium: 8,
  low: 2,
};

/**
 * 0-100 risk score from a flat list of findings.
 *
 * Each finding contributes weight(severity) * confidence, then we cap at 100.
 * The cap acts as the "diminishing returns above 60" rule from the spec —
 * spamming low-severity findings can never push the score above the band that
 * a single critical achieves on its own.
 */
export function calculateRiskScore(findings: Finding[]): number {
  let raw = 0;
  for (const f of findings) {
    raw += WEIGHTS[f.severity] * f.confidence;
  }
  return Math.min(100, Math.round(raw));
}
