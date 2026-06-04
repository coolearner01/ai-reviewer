import type { AgentType } from '@/types';

export const AGENT_OPTIONS: { value: AgentType; label: string }[] = [
  { value: 'security', label: 'Security' },
  { value: 'performance', label: 'Performance' },
  { value: 'architecture', label: 'Architecture' },
  { value: 'concurrency', label: 'Concurrency' },
  { value: 'scalability', label: 'Scalability' },
  { value: 'business_logic', label: 'Business Logic' },
  { value: 'test_quality', label: 'Test Quality' },
  { value: 'database', label: 'Database' },
  { value: 'api_contract', label: 'API Contract' },
  { value: 'frontend_quality', label: 'Frontend Quality' },
];

export const REVIEW_DEPTH_OPTIONS = [
  { value: 'light' as const, label: 'Light' },
  { value: 'standard' as const, label: 'Standard' },
  { value: 'deep' as const, label: 'Deep' },
];
