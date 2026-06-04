/** Mirror of backend/src/types/index.ts — keep in sync manually. */

export type Provider = 'github' | 'gitlab' | 'bitbucket';
export type ReviewDepth = 'light' | 'standard' | 'deep';
export type ReviewStatus =
  | 'queued'
  | 'fetching'
  | 'analyzing'
  | 'commenting'
  | 'completed'
  | 'failed';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type AgentType =
  | 'security'
  | 'performance'
  | 'architecture'
  | 'concurrency'
  | 'scalability'
  | 'business_logic'
  | 'test_quality'
  | 'api_contract'
  | 'database'
  | 'frontend_quality'
  | 'holistic_review';

export type ReviewCategory =
  | 'DRY'
  | 'Modularity'
  | 'Utils'
  | 'Core Change'
  | 'Design'
  | 'Naming'
  | 'Folder Structure'
  | 'Styling'
  | 'Constants'
  | 'Typing'
  | 'Regex'
  | 'Security'
  | 'Performance'
  | 'Other';

export type ReviewSide = 'LEFT' | 'RIGHT';
export type ReviewHealth = 'good' | 'needs_work' | 'critical';
export type MergeRecommendation =
  | 'APPROVE'
  | 'APPROVE_WITH_MINOR_SUGGESTIONS'
  | 'NEEDS_CHANGES'
  | 'BLOCK_MERGE';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface ChangedFileAnalysis {
  file: string;
  whatChanged: string;
  whyItMatters: string;
  riskLevel: 'low' | 'medium' | 'high';
  dependenciesAffected: string[];
}

export interface ReviewRecord {
  id: string;
  pullRequestId: string;
  status: ReviewStatus;
  reviewDepth: ReviewDepth;
  customPrompt: string | null;
  riskScore: number | null;
  mergeRecommendation: MergeRecommendation | null;
  regressionProbability: number | null;
  executiveSummary: string | null;
  technicalSummary: string | null;
  deploymentRisk: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  health: ReviewHealth | null;
  topPriorityFixes: string[];
  changedFilesAnalysis: ChangedFileAnalysis[];
  postedToProviderAt: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ReviewCommentRecord {
  id: string;
  reviewId: string;
  agentType: AgentType;
  category: ReviewCategory | null;
  severity: Severity;
  confidence: number;
  file: string;
  line: number;
  endLine: number | null;
  side: ReviewSide;
  title: string;
  issue: string;
  impact: string;
  recommendation: string;
  suggestedFix: string | null;
  postedToProvider: boolean;
  /**
   * ISO timestamp set when the reviewer manually discarded this comment.
   * The backend hides discarded comments from list endpoints by default, so
   * this is generally `null` on the wire — kept here for completeness and
   * for any future "show discarded" admin views.
   */
  discardedAt: string | null;
  createdAt: string;
}

export interface AgentSummary {
  agentType: AgentType;
  findingCount: number;
  severityBreakdown: Record<Severity, number>;
}

export interface FileRisk {
  file: string;
  riskScore: number;
  findingCount: number;
  severityBreakdown: Record<Severity, number>;
}

export type PullRequestState = 'open' | 'merged' | 'closed';
export type ReviewDecision = 'APPROVED' | 'CHANGES_REQUESTED' | null;

export interface PullRequestRecord {
  id: string;
  repositoryId: string;
  externalId: string;
  prUrl: string;
  title: string;
  description: string;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  filesChanged: number;
  additions: number;
  deletions: number;
  state: PullRequestState;
  reviewDecision: ReviewDecision;
  closedAt: string | null;
  mergedAt: string | null;
  createdAt: string;
}

export interface PRCommitRecord {
  id: string;
  pullRequestId: string;
  sha: string;
  message: string;
  author: string;
  committedAt: string | null;
  position: number;
}

export interface PRCheckRecord {
  id: string;
  pullRequestId: string;
  name: string;
  status: string;
  conclusion: string | null;
  detailsUrl: string | null;
  updatedAt: string;
}

export type TimelineEventType =
  | 'opened'
  | 'reopened'
  | 'synchronized'
  | 'commented'
  | 'reviewed'
  | 'approved'
  | 'changes_requested'
  | 'merged'
  | 'closed'
  | 'ai_review_started'
  | 'ai_review_completed'
  | 'ai_review_failed';

export interface PRTimelineEventRecord {
  id: string;
  pullRequestId: string;
  eventType: TimelineEventType;
  actor: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface RepositoryRecord {
  id: string;
  userId: string;
  organizationId: string | null;
  organizationSlug?: string | null;
  provider: Provider;
  orgOrWorkspace: string;
  repoName: string;
  repoUrl: string;
  defaultBranch: string | null;
  language: string | null;
  webhookId: string | null;
  createdAt: string;
  openPrCount?: number;
}

import type { AiProviderSettingsValues, AiProviderSettingsPatch } from '@/components/settings/AiProviderSettingsForm';

export type { AiProviderSettingsPatch };

export interface OrganizationSettings extends AiProviderSettingsValues {
  organizationId: string;
  customInstructions: string;
  securityPolicies: string;
  architectureRules: string;
  codingGuidelines: string;
  defaultReviewDepth: ReviewDepth;
  defaultFocusAreas: AgentType[];
  ignoredPaths: string[];
  updatedAt: string;
}

export interface OrganizationRecord {
  id: string;
  userId: string;
  name: string;
  slug: string;
  provider: Provider;
  webhookSlug: string;
  webhookUrl: string;
  apiKeyMasked: string;
  createdAt: string;
}

export interface ProviderRepositorySuggestion {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string | null;
  language: string | null;
  isPrivate: boolean;
  description: string | null;
  htmlUrl: string;
}

export interface OrganizationSetupGuide {
  provider: Provider;
  webhookUrl: string;
  webhookSecret: string;
  contentType: string;
  events: string[];
  steps: string[];
  docsUrl: string;
}

export interface ReviewResult {
  review: ReviewRecord;
  pullRequest: PullRequestRecord;
  repository: RepositoryRecord;
  comments: ReviewCommentRecord[];
  agentSummaries: AgentSummary[];
  fileRiskRanking: FileRisk[];
  diff?: string | null;
}

export interface ReviewProgressEvent {
  reviewId: string;
  status: ReviewStatus;
  message: string;
  progress: number;
  timestamp: string;
}

export interface SubmitReviewPayload {
  repositoryUrl: string;
  pullRequestUrl: string;
  reviewDepth: ReviewDepth;
  customPrompt?: string;
  focusAreas?: AgentType[];
  ignoredPaths?: string[];
}

export interface SubmitReviewResponse {
  reviewId: string;
  status: 'queued';
  message: string;
}

export interface ReviewsListResponse {
  reviews: Array<{
    review: ReviewRecord;
    pullRequest: PullRequestRecord;
    repository: RepositoryRecord;
  }>;
  total: number;
  page: number;
  limit: number;
}
