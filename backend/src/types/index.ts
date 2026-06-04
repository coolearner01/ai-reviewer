/**
 * Shared domain types used across services, routes, providers and agents.
 * Keep this file framework-agnostic — no Express, no DB types here.
 */

import type { ResolvedAiCallConfig } from '../modules/settings/aiConfigResolver';
import type { AiProviderSettingsPublic } from '../modules/settings/aiProviderSettings';
import type { ReviewPreferenceFields } from '../modules/settings/reviewPreferences';

export type { ReviewPreferenceFields };

// ---------- Providers ----------

export type Provider = 'github' | 'gitlab' | 'bitbucket';

export interface ParsedPRUrl {
  provider: Provider;
  org: string;
  repo: string;
  prId: string;
  repoUrl: string;
}

export interface PRMetadata {
  externalId: string;
  title: string;
  description: string;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  filesChanged: number;
  additions: number;
  deletions: number;
}

export interface InlineCommentPayload {
  file: string;
  line: number;
  body: string;
}

// ---------- Reviews ----------

export type ReviewDepth = 'light' | 'standard' | 'deep';

export type ReviewStatus =
  | 'queued'
  | 'fetching'
  | 'analyzing'
  | 'commenting'
  | 'completed'
  | 'failed'
  | 'cancelled';

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

/**
 * Holistic-review category — mirrors the dimensions the holistic agent checks.
 * Specialist agents leave this null.
 */
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

export type OverallVerdict = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';

export type MergeRecommendation =
  | 'APPROVE'
  | 'APPROVE_WITH_MINOR_SUGGESTIONS'
  | 'NEEDS_CHANGES'
  | 'BLOCK_MERGE';

/** Raw finding returned by an agent (pre-deduplication). */
export interface Finding {
  agentType: AgentType;
  /** Holistic-review category. Specialist agents leave this null. */
  category?: ReviewCategory | null;
  file: string;
  line: number;
  endLine?: number;
  /** Diff side — RIGHT for new code, LEFT for deleted code. Defaults to RIGHT. */
  side?: ReviewSide;
  title: string;
  issue: string;
  impact: string;
  recommendation: string;
  suggestedFix?: string;
  severity: Severity;
  confidence: number;
}

/** Input passed to every agent. */
export interface ReviewContext {
  diff: string;
  changedFiles: string[];
  fileContents: Record<string, string>;
  prMeta: PRMetadata & { repoUrl: string };
  customPrompt: string;
  reviewDepth: ReviewDepth;
  focusAreas: AgentType[];
  /** Resolved AI credentials for this review (user → org → env). */
  aiCredentials?: ResolvedAiCallConfig;
}

// ---------- API responses ----------

export interface AuthUser {
  id: string;
  email: string;
  name: string;
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
  /** Holistic-review structured payload (populated by the holistic agent). */
  health: ReviewHealth | null;
  topPriorityFixes: string[];
  changedFilesAnalysis: ChangedFileAnalysis[];
  postedToProviderAt: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ChangedFileAnalysis {
  file: string;
  whatChanged: string;
  whyItMatters: string;
  riskLevel: 'low' | 'medium' | 'high';
  dependenciesAffected: string[];
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
  /** Present when the repo is linked to an organization — used for clean URLs. */
  organizationSlug?: string | null;
  provider: Provider;
  orgOrWorkspace: string;
  repoName: string;
  repoUrl: string;
  defaultBranch: string | null;
  language: string | null;
  webhookId: string | null;
  createdAt: string;
  /** Live counts populated by list endpoints — undefined on plain `get` calls. */
  openPrCount?: number;
}

export interface OrganizationSettings extends ReviewPreferenceFields, AiProviderSettingsPublic {
  organizationId: string;
  updatedAt: string;
}

/**
 * Organization record (returned by /organizations endpoints).
 *
 * Secret material (`apiKey`, `webhookSecret`) is never sent to the client. It's
 * only available server-side via organizationService.getWithCredentials().
 */
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

/** Setup instructions shown after creating an org so the user can wire up webhooks. */
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
  /** Raw unified diff, fetched lazily on first GET. Optional — older reviews may not have it. */
  diff?: string | null;
}

export interface ReviewProgressEvent {
  reviewId: string;
  status: ReviewStatus;
  message: string;
  progress: number;
  timestamp: string;
}
