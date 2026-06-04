import axios, { type AxiosInstance } from 'axios';
import { AppError } from '../errors/AppError';
import { logger } from '../utils/logger';
import { parsePRUrl } from '../utils/urlParser';
import { createApiErrorWrapper, verifySecretToken } from './shared';
import type { InlineCommentPayload, PRMetadata, Provider } from '../types';
import type { ProviderAdapter } from './base';

const GITLAB_API = 'https://gitlab.com/api/v4';

const wrap = createApiErrorWrapper('gitlab', 'GitLab');

/**
 * GitLab adapter. Uses the REST API v4 with a Personal Access Token (api scope).
 *
 * Note: GitLab uses "Merge Request" (MR) terminology, not "Pull Request". The
 * adapter speaks PR externally to stay consistent with the rest of the system.
 *
 * Webhook verification: GitLab does not use HMAC. Instead it sends the configured
 * "Secret Token" verbatim in the X-Gitlab-Token header. We compare in constant time.
 */
export class GitLabProvider implements ProviderAdapter {
  readonly provider: Provider = 'gitlab';
  private readonly http: AxiosInstance;
  private readonly token: string;

  constructor(token = '') {
    if (!token) {
      logger.warn('[gitlab] No access token supplied. Authenticated API calls will fail.');
    }
    this.token = token;
    this.http = axios.create({
      baseURL: GITLAB_API,
      timeout: 30_000,
      headers: token ? { 'PRIVATE-TOKEN': token } : {},
    });
  }

  async fetchPRMetadata(prUrl: string): Promise<PRMetadata> {
    const { projectId, mrIid } = parseGitlabPrUrl(prUrl);
    try {
      const { data } = await this.http.get(
        `/projects/${encodeURIComponent(projectId)}/merge_requests/${mrIid}`,
      );
      const stats = data.changes_count
        ? { additions: 0, deletions: 0 } // GitLab doesn't expose totals on this endpoint
        : { additions: 0, deletions: 0 };

      return {
        externalId: String(data.iid),
        title: data.title ?? '',
        description: data.description ?? '',
        author: data.author?.username ?? '',
        sourceBranch: data.source_branch ?? '',
        targetBranch: data.target_branch ?? '',
        filesChanged: parseInt(data.changes_count ?? '0', 10) || 0,
        additions: stats.additions,
        deletions: stats.deletions,
      };
    } catch (err) {
      throw wrap('fetchPRMetadata', err);
    }
  }

  /**
   * Build a unified diff string from GitLab's `/changes` endpoint. GitLab
   * returns per-file diff hunks, so we stitch them into one git-style patch.
   */
  async fetchDiff(prUrl: string): Promise<string> {
    const { projectId, mrIid } = parseGitlabPrUrl(prUrl);
    try {
      const { data } = await this.http.get(
        `/projects/${encodeURIComponent(projectId)}/merge_requests/${mrIid}/changes`,
      );
      const parts: string[] = [];
      for (const change of data.changes ?? []) {
        const oldPath = change.old_path || change.new_path;
        const newPath = change.new_path || change.old_path;
        parts.push(
          `diff --git a/${oldPath} b/${newPath}`,
          change.new_file ? `new file mode 100644` : '',
          change.deleted_file ? `deleted file` : '',
          `--- a/${oldPath}`,
          `+++ b/${newPath}`,
          change.diff ?? '',
        );
      }
      return parts.filter(Boolean).join('\n');
    } catch (err) {
      throw wrap('fetchDiff', err);
    }
  }

  async fetchChangedFiles(prUrl: string): Promise<string[]> {
    const { projectId, mrIid } = parseGitlabPrUrl(prUrl);
    try {
      const { data } = await this.http.get(
        `/projects/${encodeURIComponent(projectId)}/merge_requests/${mrIid}/changes`,
      );
      const files = new Set<string>();
      for (const change of data.changes ?? []) {
        if (change.new_path) files.add(change.new_path);
        else if (change.old_path) files.add(change.old_path);
      }
      return [...files];
    } catch (err) {
      throw wrap('fetchChangedFiles', err);
    }
  }

  async fetchFileContent(repoUrl: string, filePath: string, branch: string): Promise<string> {
    const projectId = projectIdFromRepoUrl(repoUrl);
    try {
      const res = await this.http.get(
        `/projects/${encodeURIComponent(projectId)}/repository/files/${encodeURIComponent(
          filePath,
        )}/raw`,
        {
          params: { ref: branch },
          responseType: 'text',
          transformResponse: (d) => d,
          validateStatus: (s) => s < 500,
        },
      );
      if (res.status >= 400) return '';
      return typeof res.data === 'string' ? res.data : String(res.data);
    } catch (err) {
      logger.warn('[gitlab] file fetch failed', { filePath, error: (err as Error).message });
      return '';
    }
  }

  async postInlineComment(prUrl: string, comment: InlineCommentPayload): Promise<void> {
    const { projectId, mrIid } = parseGitlabPrUrl(prUrl);
    try {
      // GitLab positional discussions need diff refs (base/head/start sha). We
      // skip the full positional API and fall back to a regular MR note that
      // mentions the file/line — keeps things simple and never errors out.
      await this.http.post(
        `/projects/${encodeURIComponent(projectId)}/merge_requests/${mrIid}/notes`,
        {
          body: `**${comment.file}:${comment.line}**\n\n${comment.body}`,
        },
      );
    } catch (err) {
      logger.warn('[gitlab] inline comment failed', {
        file: comment.file,
        line: comment.line,
        error: (err as Error).message,
      });
    }
  }

  async postSummaryComment(prUrl: string, markdown: string): Promise<void> {
    const { projectId, mrIid } = parseGitlabPrUrl(prUrl);
    try {
      await this.http.post(
        `/projects/${encodeURIComponent(projectId)}/merge_requests/${mrIid}/notes`,
        { body: markdown },
      );
    } catch (err) {
      throw wrap('postSummaryComment', err);
    }
  }

  verifyWebhookSignature(
    _payload: Buffer,
    signature: string | undefined,
    secretOverride?: string,
  ): boolean {
    return verifySecretToken(signature, secretOverride);
  }

  extractPRUrlFromWebhook(body: unknown): string | null {
    const event = body as {
      object_kind?: string;
      object_attributes?: { action?: string; url?: string };
    };
    if (event?.object_kind !== 'merge_request') return null;
    const action = event.object_attributes?.action;
    const interesting = new Set(['open', 'reopen', 'update']);
    if (!action || !interesting.has(action)) return null;
    return event.object_attributes?.url ?? null;
  }
}

// ---------------------------------------------------------------------------

function parseGitlabPrUrl(prUrl: string): { projectId: string; mrIid: string } {
  const parsed = parsePRUrl(prUrl);
  if (parsed.provider !== 'gitlab') throw AppError.badRequest('Not a GitLab URL');
  // GitLab API can use the URL-encoded "group/project" path as the project ID.
  return { projectId: `${parsed.org}/${parsed.repo}`, mrIid: parsed.prId };
}

function projectIdFromRepoUrl(repoUrl: string): string {
  const m = /https?:\/\/[^/]+\/(.+?)\/?$/.exec(repoUrl);
  if (!m) throw AppError.badRequest('Invalid GitLab repo URL');
  return m[1].replace(/\.git$/, '');
}
