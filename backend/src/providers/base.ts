import type {
  PRMetadata,
  Provider,
  InlineCommentPayload,
} from '../types';

export interface ProviderCommit {
  sha: string;
  message: string;
  author: string;
  committedAt: Date | null;
}

export interface ProviderCheck {
  name: string;
  status: string;
  conclusion: string | null;
  detailsUrl: string | null;
}

/** Summary row when listing PRs from a provider (e.g. GitHub pulls.list). */
export interface ListedPullRequest {
  prUrl: string;
  metadata: PRMetadata;
  state: import('../types').PullRequestState;
}

/**
 * Lightweight repo summary used to power the "Add repository" autocomplete
 * on the organization page. Intentionally tiny — only the fields the UI needs.
 */
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

export interface ProviderAdapter {
  readonly provider: Provider;

  /** PR title, author, branches, line/file stats. */
  fetchPRMetadata(prUrl: string): Promise<PRMetadata>;

  /** Full unified diff as a single string (the same format you'd see in `git show`). */
  fetchDiff(prUrl: string): Promise<string>;

  /** List of changed file paths in the PR (relative to repo root). */
  fetchChangedFiles(prUrl: string): Promise<string[]>;

  /** Full current content of a file at the given branch. Empty string if not found. */
  fetchFileContent(repoUrl: string, filePath: string, branch: string): Promise<string>;

  /** Post an inline review comment on a specific file/line. */
  postInlineComment(prUrl: string, comment: InlineCommentPayload): Promise<void>;

  /** Post a top-level summary comment on the PR. */
  postSummaryComment(prUrl: string, markdown: string): Promise<void>;

  /**
   * Validate a webhook payload's HMAC/secret. Should be constant-time.
   * If `secretOverride` is supplied (e.g. from an org-scoped webhook), it's
   * used instead of the environment-default secret.
   */
  verifyWebhookSignature(
    payload: Buffer,
    signature: string | undefined,
    secretOverride?: string,
  ): boolean;

  /** Pull a PR URL out of a raw webhook body. Returns null if event is not PR-related. */
  extractPRUrlFromWebhook(body: unknown): string | null;

  /**
   * Optional: list of commits on the PR. Providers that don't implement this
   * yet should return an empty array — callers fall back to whatever's already
   * persisted in pr_commits.
   */
  fetchCommits?(prUrl: string): Promise<ProviderCommit[]>;

  /**
   * Optional: CI / status checks on the PR's head commit. Empty array when
   * the provider doesn't surface checks.
   */
  fetchChecks?(prUrl: string): Promise<ProviderCheck[]>;

  /**
   * Optional: list PRs for a repository URL. Used to sync open/closed PRs into the DB.
   */
  listPullRequests?(
    repoUrl: string,
    state: 'open' | 'closed',
  ): Promise<ListedPullRequest[]>;

  listAccessibleRepositories?(input: {
    hintOwner?: string;
    query?: string;
    limit?: number;
  }): Promise<ProviderRepositorySuggestion[]>;

  submitPullRequestReview?(input: {
    prUrl: string;
    decision: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
    body?: string;
  }): Promise<{ providerReviewId: string }>;
}
