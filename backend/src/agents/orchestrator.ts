import { AGENT_REGISTRY, LIGHT_AGENTS } from './agents';
import { calculateRiskScore } from '../utils/riskScorer';
import { decideMerge } from '../utils/mergeDecider';
import {
  postProcessFindings,
  summarizeByAgent,
  rankFilesByRisk,
} from '../utils/findingProcessor';
import { logger } from '../utils/logger';
import type {
  AgentSummary,
  AgentType,
  FileRisk,
  Finding,
  MergeRecommendation,
  ReviewContext,
} from '../types';

export interface OrchestratorResult {
  findings: Finding[];
  riskScore: number;
  mergeRecommendation: MergeRecommendation;
  agentSummaries: AgentSummary[];
  fileRiskRanking: FileRisk[];
  agentsRun: AgentType[];
}

/**
 * Fan out → collect → merge.
 *
 * Concurrency is bounded by Anthropic's own per-key rate limit; for typical
 * accounts running all 10 agents in parallel is fine. If you hit 429s, wrap
 * the Promise.allSettled in a small p-limit (3-5 in flight).
 */
export const orchestrator = {
  async runAllAgents(
    ctx: ReviewContext,
    onAgentDone?: (done: number, total: number) => void,
  ): Promise<OrchestratorResult> {
    const selected = pickAgents(ctx);
    const agentInstances = selected
      .map((type) => AGENT_REGISTRY[type])
      .filter((a): a is NonNullable<typeof a> => Boolean(a));

    logger.info('[orchestrator] starting', {
      depth: ctx.reviewDepth,
      agents: selected,
      filesChanged: ctx.changedFiles.length,
    });

    let done = 0;
    const total = agentInstances.length;

    const settled = await Promise.allSettled(
      agentInstances.map((agent) =>
        agent
          .analyze(ctx)
          .finally(() => {
            done++;
            onAgentDone?.(done, total);
          }),
      ),
    );

    const rawFindings: Finding[] = [];
    settled.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        rawFindings.push(...r.value);
      } else {
        logger.warn('[orchestrator] agent rejected', {
          agent: selected[idx],
          reason: String(r.reason),
        });
      }
    });

    const findings = postProcessFindings(rawFindings);
    const riskScore = calculateRiskScore(findings);
    const mergeRecommendation = decideMerge(findings, riskScore);
    const agentSummaries = summarizeByAgent(findings);
    const fileRiskRanking = rankFilesByRisk(findings);

    logger.info('[orchestrator] done', {
      rawCount: rawFindings.length,
      filteredCount: findings.length,
      riskScore,
      mergeRecommendation,
    });

    return {
      findings,
      riskScore,
      mergeRecommendation,
      agentSummaries,
      fileRiskRanking,
      agentsRun: selected,
    };
  },
};

function pickAgents(ctx: ReviewContext): AgentType[] {
  if (ctx.focusAreas?.length) return ctx.focusAreas;
  if (ctx.reviewDepth === 'light') return LIGHT_AGENTS;
  return Object.keys(AGENT_REGISTRY) as AgentType[];
}
