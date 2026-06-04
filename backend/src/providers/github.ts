import { Octokit } from '@octokit/rest';
import axios from 'axios';
import { AppError } from '../errors/AppError';
import { logger } from '../utils/logger';
import { parsePRUrl } from '../utils/urlParser';
import { createApiErrorWrapper, verifyHmacSha256 } from './shared';
import type { InlineCommentPayload, PRMetadata, Provider, PullRequestState } from '../types';
import type {
  ProviderAdapter,
  ProviderCheck,
  ProviderCommit,
  ListedPullRequest,
  ProviderRepositorySuggestion,
} from './base';

const wrap = createApiErrorWrapper('github', 'GitHub');

/**
 * GitHub implementation of ProviderAdapter using @octokit/rest.
 *
 * Auth is a per-tenant access token supplied by the caller — resolved from the
 * organization's encrypted API key (configured in Settings → API Keys). There
 * is no environment-variable fallback: credentials always come from the user.
 */
export class GitHubProvider implements ProviderAdapter {
  readonly provider: Provider = 'github';
  private readonly octokit: Octokit;
  private readonly token: string;

  constructor(token = '') {
    if (!token) {
      // We don't throw here — we only fail when a method is actually called,
      // so the API can boot / verify webhooks even without a token.
      logger.warn('[github] No access token supplied. Authenticated API calls will fail.');
    }
    this.token = token;
    this.octokit = new Octokit({ auth: token || undefined });
  }

  async fetchPRMetadata(prUrl: string): Promise<PRMetadata> {
    const { org, repo, prId } = parsePRUrl(prUrl);
    try {
      const { data } = await this.octokit.pulls.get({
        owner: org,
        repo,
        pull_number: Number(prId),
      });
      return {
        externalId: String(data.number),
        title: data.title ?? '',
        description: data.body ?? '',
        author: data.user?.login ?? '',
        sourceBranch: data.head?.ref ?? '',
        targetBranch: data.base?.ref ?? '',
        filesChanged: data.changed_files ?? 0,
        additions: data.additions ?? 0,
        deletions: data.deletions ?? 0,
      };
    } catch (err) {
      throw wrap('fetchPRMetadata', err);
    }
  }

  async fetchDiff(prUrl: string): Promise<string> {
    const { org, repo, prId } = parsePRUrl(prUrl);
    try {
      // Setting the `diff` media type makes GitHub return raw patch text.
      const res = await this.octokit.pulls.get({
        owner: org,
        repo,
        pull_number: Number(prId),
        mediaType: { format: 'diff' },
      });
      // Octokit returns the raw body string when format=diff.
      return res.data as unknown as string;
    } catch (err) {
      throw wrap('fetchDiff', err);
    }
  }

  async fetchChangedFiles(prUrl: string): Promise<string[]> {
    const { org, repo, prId } = parsePRUrl(prUrl);
    const files: string[] = [];
    try {
      // Paginate to handle PRs with >100 files (GitHub caps each page at 100).
      for await (const response of this.octokit.paginate.iterator(
        this.octokit.pulls.listFiles,
        { owner: org, repo, pull_number: Number(prId), per_page: 100 },
      )) {
        for (const f of response.data) files.push(f.filename);
      }
      return files;
    } catch (err) {
      throw wrap('fetchChangedFiles', err);
    }
  }

  async fetchFileContent(repoUrl: string, filePath: string, branch: string): Promise<string> {
    // repoUrl format: https://github.com/org/repo
    const match = /github\.com\/([^/]+)\/([^/]+)/.exec(repoUrl);
    if (!match) throw AppError.badRequest('Invalid GitHub repo URL');
    const [, org, repo] = match;
    try {
      // Use the raw content endpoint via axios — it's smaller than octokit's
      // contents API for large files and avoids base64 round-trips.
      const url = `https://raw.githubusercontent.com/${org}/${repo}/${encodeURIComponent(branch)}/${filePath
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`;
      const res = await axios.get<string>(url, {
        responseType: 'text',
        transformResponse: (d) => d,
        validateStatus: (s) => s < 500,
        headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      });
      if (res.status === 404) return '';
      if (res.status >= 400) {
        logger.warn('[github] file fetch non-ok', { status: res.status, filePath });
        return '';
      }
      return typeof res.data === 'string' ? res.data : String(res.data);
    } catch (err) {
      logger.warn('[github] file fetch failed', {
        filePath,
        error: (err as Error).message,
      });
      return '';
    }
  }

  async postInlineComment(prUrl: string, comment: InlineCommentPayload): Promise<void> {
    const { org, repo, prId } = parsePRUrl(prUrl);
    try {
      const { data: pr } = await this.octokit.pulls.get({
        owner: org,
        repo,
        pull_number: Number(prId),
      });
      await this.octokit.pulls.createReviewComment({
        owner: org,
        repo,
        pull_number: Number(prId),
        commit_id: pr.head.sha,
        path: comment.file,
        line: comment.line,
        side: 'RIGHT',
        body: comment.body,
      });
    } catch (err) {
      // Inline comments can fail for many benign reasons (file not in diff,
      // line out of range). Log & continue — don't fail the whole review.
      logger.warn('[github] inline comment failed', {
        file: comment.file,
        line: comment.line,
        error: (err as Error).message,
      });
    }
  }

  async postSummaryComment(prUrl: string, markdown: string): Promise<void> {
    const { org, repo, prId } = parsePRUrl(prUrl);
    try {
      await this.octokit.issues.createComment({
        owner: org,
        repo,
        issue_number: Number(prId),
        body: markdown,
      });
    } catch (err) {
      throw wrap('postSummaryComment', err);
    }
  }

  verifyWebhookSignature(
    payload: Buffer,
    signature: string | undefined,
    secretOverride?: string,
  ): boolean {
    return verifyHmacSha256(payload, signature, secretOverride);
  }

  async fetchCommits(prUrl: string): Promise<ProviderCommit[]> {
    const { org, repo, prId } = parsePRUrl(prUrl);
    try {
      const out: ProviderCommit[] = [];
      for await (const response of this.octokit.paginate.iterator(
        this.octokit.pulls.listCommits,
        { owner: org, repo, pull_number: Number(prId), per_page: 100 },
      )) {
        for (const c of response.data) {
          out.push({
            sha: c.sha,
            message: c.commit.message?.split('\n')[0] ?? '',
            author: c.commit.author?.name ?? c.author?.login ?? '',
            committedAt: c.commit.author?.date ? new Date(c.commit.author.date) : null,
          });
        }
      }
      return out;
    } catch (err) {
      logger.warn('[github] fetchCommits failed', { error: (err as Error).message });
      return [];
    }
  }

  async fetchChecks(prUrl: string): Promise<ProviderCheck[]> {
    const { org, repo, prId } = parsePRUrl(prUrl);
    try {
      const { data: pr } = await this.octokit.pulls.get({
        owner: org,
        repo,
        pull_number: Number(prId),
      });
      const headSha = pr.head?.sha;
      if (!headSha) return [];

      // Check runs (GitHub Actions, etc).
      const out: ProviderCheck[] = [];
      try {
        const { data: checks } = await this.octokit.checks.listForRef({
          owner: org,
          repo,
          ref: headSha,
          per_page: 100,
        });
        for (const run of checks.check_runs ?? []) {
          out.push({
            name: run.name,
            status: run.status ?? 'completed',
            conclusion: run.conclusion ?? null,
            detailsUrl: run.html_url ?? null,
          });
        }
      } catch (err) {
        logger.warn('[github] checks.listForRef failed', { error: (err as Error).message });
      }

      // Legacy commit statuses (Travis, Circle, etc).
      try {
        const { data: statuses } = await this.octokit.repos.listCommitStatusesForRef({
          owner: org,
          repo,
          ref: headSha,
          per_page: 100,
        });
        const seen = new Set(out.map((c) => c.name));
        for (const s of statuses) {
          if (s.context && !seen.has(s.context)) {
            out.push({
              name: s.context,
              status: 'completed',
              conclusion: s.state,
              detailsUrl: s.target_url ?? null,
            });
            seen.add(s.context);
          }
        }
      } catch (err) {
        logger.warn('[github] listCommitStatusesForRef failed', {
          error: (err as Error).message,
        });
      }
      return out;
    } catch (err) {
      logger.warn('[github] fetchChecks failed', { error: (err as Error).message });
      return [];
    }
  }

  extractPRUrlFromWebhook(body: unknown): string | null {
    const event = body as {
      action?: string;
      pull_request?: { html_url?: string };
    };
    const interesting = new Set(['opened', 'synchronize', 'reopened', 'ready_for_review']);
    if (!event?.action || !interesting.has(event.action)) return null;
    return event.pull_request?.html_url ?? null;
  }

  /**
   * List repos the configured PAT can access. We try, in order:
   *   1. repos under `hintOwner` (org slug interpreted as a GitHub org)
   *   2. repos under `hintOwner` interpreted as a user
   *   3. repos the authenticated token has access to (`listForAuthenticatedUser`)
   * Results are merged, de-duped by full_name, optionally filtered by query,
   * and capped at `limit` (default 50). Failures of any individual call are
   * swallowed — autocomplete should be best-effort, never block the UI.
   */
  async listAccessibleRepositories(input: {
    hintOwner?: string;
    query?: string;
    limit?: number;
  }): Promise<ProviderRepositorySuggestion[]> {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const seen = new Map<string, ProviderRepositorySuggestion>();

    const push = (raw: {
      name?: string | null;
      full_name?: string | null;
      owner?: { login?: string | null } | null;
      default_branch?: string | null;
      language?: string | null;
      private?: boolean | null;
      description?: string | null;
      html_url?: string | null;
    }) => {
      const fullName = raw.full_name ?? '';
      if (!fullName || seen.has(fullName.toLowerCase())) return;
      const owner = raw.owner?.login ?? fullName.split('/')[0] ?? '';
      const name = raw.name ?? fullName.split('/')[1] ?? '';
      if (!owner || !name) return;
      seen.set(fullName.toLowerCase(), {
        owner,
        name,
        fullName,
        defaultBranch: raw.default_branch ?? null,
        language: raw.language ?? null,
        isPrivate: Boolean(raw.private),
        description: raw.description ?? null,
        htmlUrl: raw.html_url ?? `https://github.com/${fullName}`,
      });
    };

    if (input.hintOwner) {
      try {
        const { data } = await this.octokit.repos.listForOrg({
          org: input.hintOwner,
          per_page: 100,
          sort: 'updated',
        });
        for (const r of data) push(r);
      } catch (err) {
        // 404 is expected when `hintOwner` is a personal account rather than an org.
        logger.debug?.('[github] listForOrg miss', {
          owner: input.hintOwner,
          error: (err as Error).message,
        });
      }

      if (seen.size === 0) {
        try {
          const { data } = await this.octokit.repos.listForUser({
            username: input.hintOwner,
            per_page: 100,
            sort: 'updated',
          });
          for (const r of data) push(r);
        } catch (err) {
          logger.debug?.('[github] listForUser miss', {
            owner: input.hintOwner,
            error: (err as Error).message,
          });
        }
      }
    }

    try {
      const { data } = await this.octokit.repos.listForAuthenticatedUser({
        per_page: 100,
        sort: 'updated',
        affiliation: 'owner,collaborator,organization_member',
      });
      for (const r of data) push(r);
    } catch (err) {
      logger.warn('[github] listForAuthenticatedUser failed', {
        error: (err as Error).message,
      });
    }

    const q = input.query?.trim().toLowerCase() ?? '';
    let out = Array.from(seen.values());
    if (q) {
      out = out.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.fullName.toLowerCase().includes(q) ||
          (r.description?.toLowerCase().includes(q) ?? false),
      );
    }
    return out.slice(0, limit);
  }

  /**
   * Submit a formal GitHub pull-request review. This flips the PR's review
   * status (Approved / Changes requested / Commented) — unlike
   * postSummaryComment which only adds a regular issue comment.
   *
   * GitHub disallows approving your own PR. We surface that as a typed error
   * so callers can show a useful message instead of a generic 5xx.
   */
  async submitPullRequestReview(input: {
    prUrl: string;
    decision: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
    body?: string;
  }): Promise<{ providerReviewId: string }> {
    const { org, repo, prId } = parsePRUrl(input.prUrl);
    try {
      const { data } = await this.octokit.pulls.createReview({
        owner: org,
        repo,
        pull_number: Number(prId),
        event: input.decision,
        body: input.body ?? undefined,
      });
      return { providerReviewId: String(data.id) };
    } catch (err) {
      const msg = (err as Error).message;
      if (/can not approve|own pull request/i.test(msg)) {
        throw AppError.badRequest(
          'GitHub does not let you approve your own PR — sign in with a different account or use Request changes.',
        );
      }
      throw wrap('submitPullRequestReview', err);
    }
  }

  async listPullRequests(
    repoUrl: string,
    state: 'open' | 'closed',
  ): Promise<ListedPullRequest[]> {
    const match = /github\.com\/([^/]+)\/([^/]+)/.exec(repoUrl);
    if (!match) throw AppError.badRequest('Invalid GitHub repo URL');
    const [, owner, repoName] = match;
    const out: ListedPullRequest[] = [];
    try {
      for await (const response of this.octokit.paginate.iterator(
        this.octokit.pulls.list,
        { owner, repo: repoName, state, per_page: 100 },
      )) {
        for (const pr of response.data) {
          const prState: PullRequestState = pr.merged_at
            ? 'merged'
            : pr.state === 'open'
              ? 'open'
              : 'closed';
          out.push({
            prUrl: pr.html_url ?? `https://github.com/${owner}/${repoName}/pull/${pr.number}`,
            metadata: {
              externalId: String(pr.number),
              title: pr.title ?? '',
              description: pr.body ?? '',
              author: pr.user?.login ?? '',
              sourceBranch: pr.head?.ref ?? '',
              targetBranch: pr.base?.ref ?? '',
              filesChanged: 0,
              additions: 0,
              deletions: 0,
            },
            state: prState,
          });
        }
      }
      return out;
    } catch (err) {
      throw wrap('listPullRequests', err);
    }
  }
}
