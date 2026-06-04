import { BaseAgent } from './baseAgent';
import { AGENT_PROMPTS } from './prompts';
import type { AgentType, ReviewContext } from '../types';

/**
 * The 10 specialist agents.
 *
 * Each subclass is intentionally tiny — every interesting thing lives in
 * BaseAgent or the prompts file. Adding an 11th agent: add the prompt to
 * prompts.ts, declare a subclass here, register it in `AGENT_REGISTRY`.
 */

export class SecurityAgent extends BaseAgent {
  readonly agentType: AgentType = 'security';
  readonly systemPrompt = AGENT_PROMPTS.security;
}

export class PerformanceAgent extends BaseAgent {
  readonly agentType: AgentType = 'performance';
  readonly systemPrompt = AGENT_PROMPTS.performance;
}

export class ArchitectureAgent extends BaseAgent {
  readonly agentType: AgentType = 'architecture';
  readonly systemPrompt = AGENT_PROMPTS.architecture;
}

export class ConcurrencyAgent extends BaseAgent {
  readonly agentType: AgentType = 'concurrency';
  readonly systemPrompt = AGENT_PROMPTS.concurrency;
}

export class ScalabilityAgent extends BaseAgent {
  readonly agentType: AgentType = 'scalability';
  readonly systemPrompt = AGENT_PROMPTS.scalability;
}

export class BusinessLogicAgent extends BaseAgent {
  readonly agentType: AgentType = 'business_logic';
  readonly systemPrompt = AGENT_PROMPTS.business_logic;
}

export class TestQualityAgent extends BaseAgent {
  readonly agentType: AgentType = 'test_quality';
  readonly systemPrompt = AGENT_PROMPTS.test_quality;
}

export class DatabaseAgent extends BaseAgent {
  readonly agentType: AgentType = 'database';
  readonly systemPrompt = AGENT_PROMPTS.database;
}

export class ApiContractAgent extends BaseAgent {
  readonly agentType: AgentType = 'api_contract';
  readonly systemPrompt = AGENT_PROMPTS.api_contract;
}

const FRONTEND_EXTENSIONS = ['.tsx', '.jsx', '.vue', '.svelte', '.css', '.scss', '.html'];

export class FrontendQualityAgent extends BaseAgent {
  readonly agentType: AgentType = 'frontend_quality';
  readonly systemPrompt = AGENT_PROMPTS.frontend_quality;

  override shouldRun(ctx: ReviewContext): boolean {
    return ctx.changedFiles.some((f) =>
      FRONTEND_EXTENSIONS.some((ext) => f.toLowerCase().endsWith(ext)),
    );
  }
}

/**
 * Registry of available agents keyed by type. The orchestrator iterates this
 * — never instantiates agents directly — so depth/focus filtering stays in
 * one place.
 *
 * Note: `holistic_review` is intentionally NOT registered here. It uses a
 * different output shape (JSON object, not array) and is invoked directly
 * from the pipeline so its summary block can be persisted on the review row.
 */
export const AGENT_REGISTRY: Partial<Record<AgentType, BaseAgent>> = {
  security:         new SecurityAgent(),
  performance:      new PerformanceAgent(),
  database:         new DatabaseAgent(),
  concurrency:      new ConcurrencyAgent(),
  architecture:     new ArchitectureAgent(),
  business_logic:   new BusinessLogicAgent(),
  api_contract:     new ApiContractAgent(),
  scalability:      new ScalabilityAgent(),
  test_quality:     new TestQualityAgent(),
  frontend_quality: new FrontendQualityAgent(),
};

/** When reviewDepth = 'light', only run the agents users care about most. */
export const LIGHT_AGENTS: AgentType[] = ['security', 'performance', 'business_logic'];
