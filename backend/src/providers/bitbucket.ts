import axios, { type AxiosInstance } from 'axios';
import { AppError } from '../errors/AppError';
import { logger } from '../utils/logger';
import { parsePRUrl } from '../utils/urlParser';
import { createApiErrorWrapper, verifyHmacSha256 } from './shared';
import type { InlineCommentPayload, PRMetadata, Provider, PullRequestState } from '../types';
import type {
  ListedPullRequest,
  ProviderAdapter,
  ProviderRepositorySuggestion,
} from './base';

const BITBUCKET_API = 'https://api.bitbucket.org/2.0';

const wrap = createApiErrorWrapper('bitbucket', 'Bitbucket');

/**
 * Bitbucket Cloud adapter. Uses REST API 2.0 with an "Access Token" / "Repository
 * Access Token" passed as a Bearer token.
 *
 * Bitbucket's "diff" endpoint already returns a unified patch — no stitching
 * needed. Inline comments are posted via the pullrequests/<id>/comments endpoint.
 *
 * Webhook signature: Bitbucket supports HMAC-SHA256 via "Secret" with the
 * X-Hub-Signature header — same shape as GitHub (`sha256=<hex>`).
 */
export class BitbucketProvider implements ProviderAdapter {
  readonly provider: Provider = 'bitbucket';
  private readonly http: AxiosInstance;

  constructor(token = '') {
    if (!token) {
      logger.warn('[bitbucket] No access token supplied. Authenticated API calls will fail.');
    }
    this.http = axios.create({
      baseURL: BITBUCKET_API,
      timeout: 30_000,
      headers: token ? { Authorization: buildBitbucketAuthHeader(token) } : {},
    });
  }

  async fetchPRMetadata(prUrl: string): Promise<PRMetadata> {
    const { workspace, repoSlug, prId } = parseBitbucketPrUrl(prUrl);
    try {
      const { data } = await this.http.get(
        `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}`,
      );
      return {
        externalId: String(data.id),
        title: data.title ?? '',
        description: data.description ?? '',
        author: data.author?.display_name ?? data.author?.nickname ?? '',
        sourceBranch: data.source?.branch?.name ?? '',
        targetBranch: data.destination?.branch?.name ?? '',
        filesChanged: 0,
        additions: 0,
        deletions: 0,
      };
    } catch (err) {
      throw wrap('fetchPRMetadata', err);
    }
  }

  async fetchDiff(prUrl: string): Promise<string> {
    const { workspace, repoSlug, prId } = parseBitbucketPrUrl(prUrl);
    try {
      const res = await this.http.get(
        `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/diff`,
        {
          responseType: 'text',
          transformResponse: (d) => d,
        },
      );
      return typeof res.data === 'string' ? res.data : String(res.data);
    } catch (err) {
      throw wrap('fetchDiff', err);
    }
  }

  async fetchChangedFiles(prUrl: string): Promise<string[]> {
    const { workspace, repoSlug, prId } = parseBitbucketPrUrl(prUrl);
    try {
      const files = new Set<string>();
      let url:
        | string
        | undefined = `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/diffstat`;

      // Paginate via the `next` URL Bitbucket returns.
      while (url) {
        const page = await this.http.get(url);
        const body = page.data as { values?: BitbucketDiffstatEntry[]; next?: string };
        for (const entry of body.values ?? []) {
          if (entry.new?.path) files.add(entry.new.path);
          else if (entry.old?.path) files.add(entry.old.path);
        }
        url = body.next;
      }
      return [...files];
    } catch (err) {
      throw wrap('fetchChangedFiles', err);
    }
  }

  async fetchFileContent(repoUrl: string, filePath: string, branch: string): Promise<string> {
    const { workspace, repoSlug } = parseBitbucketRepoUrl(repoUrl);
    try {
      const res = await this.http.get(
        `/repositories/${workspace}/${repoSlug}/src/${encodeURIComponent(branch)}/${filePath
          .split('/')
          .map(encodeURIComponent)
          .join('/')}`,
        {
          responseType: 'text',
          transformResponse: (d) => d,
          validateStatus: (s) => s < 500,
        },
      );
      if (res.status >= 400) return '';
      return typeof res.data === 'string' ? res.data : String(res.data);
    } catch (err) {
      logger.warn('[bitbucket] file fetch failed', { filePath, error: (err as Error).message });
      return '';
    }
  }

  async postInlineComment(prUrl: string, comment: InlineCommentPayload): Promise<void> {
    const { workspace, repoSlug, prId } = parseBitbucketPrUrl(prUrl);
    try {
      await this.http.post(
        `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`,
        {
          content: { raw: comment.body },
          inline: { path: comment.file, to: comment.line },
        },
      );
    } catch (err) {
      logger.warn('[bitbucket] inline comment failed', {
        file: comment.file,
        line: comment.line,
        error: (err as Error).message,
      });
    }
  }

  async postSummaryComment(prUrl: string, markdown: string): Promise<void> {
    const { workspace, repoSlug, prId } = parseBitbucketPrUrl(prUrl);
    try {
      await this.http.post(
        `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`,
        { content: { raw: markdown } },
      );
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

  extractPRUrlFromWebhook(body: unknown): string | null {
    const event = body as {
      pullrequest?: { links?: { html?: { href?: string } } };
      repository?: { links?: { html?: { href?: string } } };
    };
    return event?.pullrequest?.links?.html?.href ?? null;
  }
  async listAccessibleRepositories(input: {
    hintOwner?: string;
    query?: string;
    limit?: number;
  }): Promise<ProviderRepositorySuggestion[]> {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const seen = new Map<string, ProviderRepositorySuggestion>();

    const push = (raw: BitbucketRepo) => {
      const fullName = raw.full_name ?? '';
      if (!fullName || seen.has(fullName.toLowerCase())) return;
      const [ownerFromFull, nameFromFull] = fullName.split('/');
      const owner = raw.workspace?.slug ?? ownerFromFull ?? '';
      const name = raw.slug ?? raw.name ?? nameFromFull ?? '';
      if (!owner || !name) return;
      seen.set(fullName.toLowerCase(), {
        owner,
        name,
        fullName,
        defaultBranch: raw.mainbranch?.name ?? null,
        language: raw.language || null,
        isPrivate: Boolean(raw.is_private),
        description: raw.description ?? null,
        htmlUrl: raw.links?.html?.href ?? `https://bitbucket.org/${fullName}`,
      });
    };

    const q = input.query?.trim() ?? '';
    const qParam = q ? `name ~ "${q.replace(/"/g, '\\"')}"` : undefined;

    // Workspace-scoped listing — used both for the hintOwner and for every
    // workspace the token can see. We deliberately do NOT pass `role=member`
    // here: that filter requires per-repo membership, which workspace access
    // tokens don't have, and silently returns []. Logging is at warn so the
    // dev terminal shows exactly what Bitbucket returned for each call.
    const listWorkspaceRepos = async (workspace: string): Promise<void> => {
      try {
        const params: Record<string, string | number> = {
          pagelen: 100,
          sort: '-updated_on',
        };
        if (qParam) params.q = qParam;
        const { data } = await this.http.get<BitbucketPaginated<BitbucketRepo>>(
          `/repositories/${encodeURIComponent(workspace)}`,
          { params },
        );
        for (const r of data.values ?? []) push(r);
        logger.info('[bitbucket] listed workspace repos', {
          workspace,
          count: data.values?.length ?? 0,
        });
      } catch (err) {
        const e = err as { response?: { status?: number }; message?: string };
        logger.warn('[bitbucket] /repositories/{workspace} failed', {
          workspace,
          status: e.response?.status,
          error: e.message,
        });
      }
    };

    let discoveredSlugs: string[] = [];
    try {
      const { data } = await this.http.get<
        BitbucketPaginated<{ workspace?: { slug?: string } }>
      >('/user/workspaces', { params: { pagelen: 100 } });
      discoveredSlugs = Array.from(
        new Set(
          (data.values ?? [])
            .map((v) => v.workspace?.slug)
            .filter((s): s is string => Boolean(s)),
        ),
      );
      logger.info('[bitbucket] workspaces visible to token', {
        count: discoveredSlugs.length,
        slugs: discoveredSlugs,
      });
    } catch (err) {
      const e = err as { response?: { status?: number }; message?: string };
      logger.warn('[bitbucket] /user/workspaces failed', {
        status: e.response?.status,
        error: e.message,
      });
    }

    // Order: hintOwner first (if it actually exists), then any other
    // workspace the token can see. If /workspaces was unreachable, still
    // give hintOwner a shot — that path works for workspace-scoped tokens
    // when the slug happens to match.
    const orderedSlugs: string[] = [];
    if (input.hintOwner && discoveredSlugs.includes(input.hintOwner)) {
      orderedSlugs.push(input.hintOwner);
    }
    for (const slug of discoveredSlugs) {
      if (!orderedSlugs.includes(slug)) orderedSlugs.push(slug);
    }
    if (orderedSlugs.length === 0 && input.hintOwner) {
      orderedSlugs.push(input.hintOwner);
    }

    for (const slug of orderedSlugs) {
      if (seen.size >= limit) break;
      await listWorkspaceRepos(slug);
    }

    return Array.from(seen.values()).slice(0, limit);
  }

  /**
   * List PRs for a repo so the sync flow can hydrate our DB. Bitbucket's
   * `state` parameter accepts OPEN / MERGED / DECLINED / SUPERSEDED — we
   * collapse the closed-ish states into our internal "closed" bucket and
   * keep "merged" distinct on the way back out.
   *
   * GitHub's adapter only paginates OPEN/CLOSED (relying on `merged_at` to
   * branch); Bitbucket has no equivalent timestamp on the list payload, so
   * we issue separate calls for MERGED and DECLINED when state==='closed'.
   */
  async listPullRequests(
    repoUrl: string,
    state: 'open' | 'closed',
  ): Promise<ListedPullRequest[]> {
    const { workspace, repoSlug } = parseBitbucketRepoUrl(repoUrl);
    const bitbucketStates = state === 'open' ? (['OPEN'] as const) : (['MERGED', 'DECLINED'] as const);
    const out: ListedPullRequest[] = [];

    for (const bbState of bitbucketStates) {
      let nextUrl: string | undefined = `/repositories/${workspace}/${repoSlug}/pullrequests`;
      let nextParams: Record<string, string | number> | undefined = {
        state: bbState,
        pagelen: 50,
      };
      try {
        while (nextUrl) {
          const page = await this.http.get(nextUrl, { params: nextParams });
          const body = page.data as BitbucketPaginated<BitbucketPullRequest>;
          for (const pr of body.values ?? []) {
            const mappedState: PullRequestState =
              pr.state === 'MERGED' ? 'merged' : pr.state === 'OPEN' ? 'open' : 'closed';
            const prUrl =
              pr.links?.html?.href ??
              `https://bitbucket.org/${workspace}/${repoSlug}/pull-requests/${pr.id}`;
            out.push({
              prUrl,
              metadata: {
                externalId: String(pr.id ?? ''),
                title: pr.title ?? '',
                description: pr.description ?? '',
                author: pr.author?.display_name ?? pr.author?.nickname ?? '',
                sourceBranch: pr.source?.branch?.name ?? '',
                targetBranch: pr.destination?.branch?.name ?? '',
                filesChanged: 0,
                additions: 0,
                deletions: 0,
              },
              state: mappedState,
            });
          }
          nextUrl = body.next;
          nextParams = undefined; // `next` already encodes the query string.
        }
      } catch (err) {
        const e = err as { response?: { status?: number }; message?: string };
        logger.warn('[bitbucket] listPullRequests page failed', {
          workspace,
          repo: repoSlug,
          bbState,
          status: e.response?.status,
          error: e.message,
        });
      }
    }

    return out;
  }
}

// ---------------------------------------------------------------------------

function parseBitbucketPrUrl(prUrl: string): {
  workspace: string;
  repoSlug: string;
  prId: string;
} {
  const parsed = parsePRUrl(prUrl);
  if (parsed.provider !== 'bitbucket') throw AppError.badRequest('Not a Bitbucket URL');
  return { workspace: parsed.org, repoSlug: parsed.repo, prId: parsed.prId };
}

function parseBitbucketRepoUrl(repoUrl: string): { workspace: string; repoSlug: string } {
  const m = /bitbucket\.org\/([^/]+)\/([^/]+)/.exec(repoUrl);
  if (!m) throw AppError.badRequest('Invalid Bitbucket repo URL');
  return { workspace: m[1], repoSlug: m[2].replace(/\.git$/, '') };
}

interface BitbucketDiffstatEntry {
  new?: { path?: string };
  old?: { path?: string };
}

interface BitbucketPaginated<T> {
  values?: T[];
  next?: string;
  pagelen?: number;
}

interface BitbucketRepo {
  slug?: string;
  name?: string;
  full_name?: string;
  description?: string | null;
  is_private?: boolean;
  language?: string | null;
  mainbranch?: { name?: string } | null;
  workspace?: { slug?: string } | null;
  links?: { html?: { href?: string } } | null;
}

interface BitbucketPullRequest {
  id?: number;
  title?: string;
  description?: string | null;
  state?: 'OPEN' | 'MERGED' | 'DECLINED' | 'SUPERSEDED' | string;
  author?: { display_name?: string; nickname?: string } | null;
  source?: { branch?: { name?: string } } | null;
  destination?: { branch?: { name?: string } } | null;
  links?: { html?: { href?: string } } | null;
}

/** Shown in API responses and validation when an ATATT token has no email prefix. */
export const BITBUCKET_ATLASSIAN_API_TOKEN_HINT =
  'Use format email:token — your Atlassian account email, a colon, then the API token (e.g. you@company.com:ATATT…).';

/**
 * Returns a user-facing message when the stored credential cannot work with
 * Bitbucket Cloud, or null when the format looks OK.
 */
export function getBitbucketCredentialIssue(token: string): string | null {
  const t = token.trim();
  if (t.startsWith('ATATT') && !t.includes(':')) {
    return `Atlassian API token is missing your account email. ${BITBUCKET_ATLASSIAN_API_TOKEN_HINT}`;
  }
  return null;
}

/**
 * Build the right Authorization header for whatever the user pasted.
 *
 * Bitbucket Cloud accepts three credential flavours and we have to pick the
 * right scheme for each — getting this wrong returns 401 on every call.
 *
 *   - "email:atlassian_api_token"  → Basic auth.
 *       Atlassian's new scoped API tokens (typically start with `ATATT…`)
 *       are the modern replacement for App Passwords. They MUST be paired
 *       with the user's Atlassian account email and sent as Basic auth.
 *   - "username:app_password"      → Basic auth.
 *       Legacy App Passwords work the same way as API tokens — paired with
 *       a Bitbucket username.
 *   - "<raw_token>"                → Bearer auth.
 *       Workspace Access Tokens, Repository Access Tokens, and OAuth 2.0
 *       access tokens are all plain bearer tokens with no username.
 *
 * Heuristic: if the value contains a colon AND the left side looks like an
 * email or short username (no whitespace), treat it as Basic. Otherwise
 * Bearer. We also warn loudly when we detect an Atlassian API token shape
 * without a username pair, since that's the single most common 401 cause.
 */
export function buildBitbucketAuthHeader(rawToken: string): string {
  const token = rawToken.trim();
  const firstColon = token.indexOf(':');
  if (firstColon > 0 && firstColon < token.length - 1) {
    const username = token.slice(0, firstColon);
    const secret = token.slice(firstColon + 1);
    if (!/\s/.test(username) && username.length > 0 && secret.length > 0) {
      const encoded = Buffer.from(`${username}:${secret}`, 'utf8').toString('base64');
      return `Basic ${encoded}`;
    }
  }
  const issue = getBitbucketCredentialIssue(token);
  if (issue) {
    logger.warn('[bitbucket] invalid credential format', { hint: issue });
  }
  return `Bearer ${token}`;
}
