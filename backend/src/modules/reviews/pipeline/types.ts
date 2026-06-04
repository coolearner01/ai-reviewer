import type { AgentType, Provider, ReviewDepth } from '../../../types';
import type { ResolvedAiCallConfig } from '../../settings/aiConfigResolver';

export interface PipelineState {
  reviewId: string;
  provider: Provider;
  prUrl: string;
  repoUrl: string;
  reviewDepth: ReviewDepth;
  customPrompt: string;
  focusAreas: AgentType[];
  ignoredPaths: string[];
  startedAt: number;
  organizationId: string | null;
  userId: string;
  aiCredentials?: ResolvedAiCallConfig;
  pullRequestId?: string;
}

export interface Fetched {
  metadata: {
    externalId: string;
    title: string;
    description: string;
    author: string;
    sourceBranch: string;
    targetBranch: string;
    filesChanged: number;
    additions: number;
    deletions: number;
  };
  diff: string;
  changedFiles: string[];
  fileContents: Record<string, string>;
}
