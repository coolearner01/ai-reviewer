import type { AgentType } from './types';

/**
 * Specialist agents a user can pick as review focus areas.
 *
 * Excludes `holistic_review` — that pass always runs and is not user-selectable.
 * This is the single source of truth; route validation schemas derive from it
 * instead of re-declaring the list.
 */
export const SPECIALIST_AGENT_TYPES = [
  'security',
  'performance',
  'architecture',
  'concurrency',
  'scalability',
  'business_logic',
  'test_quality',
  'api_contract',
  'database',
  'frontend_quality',
] as const satisfies readonly AgentType[];
