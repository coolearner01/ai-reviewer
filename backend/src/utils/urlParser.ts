import { AppError } from '../errors/AppError';
import type { ParsedPRUrl, Provider } from '../types';

/**
 * Parse any GitHub, GitLab or Bitbucket Pull Request / Merge Request URL.
 *
 * Examples handled:
 *   https://github.com/org/repo/pull/42
 *   https://gitlab.com/group/project/-/merge_requests/11
 *   https://gitlab.com/group/subgroup/project/-/merge_requests/11   (nested group)
 *   https://bitbucket.org/workspace/project/pull-requests/21
 *
 * Always returns `repoUrl` without a trailing slash so it's safe to use as a
 * unique key in the repositories table.
 */
export function parsePRUrl(rawUrl: string): ParsedPRUrl {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw AppError.badRequest('Invalid URL');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw AppError.badRequest('Only http(s) URLs are allowed');
  }

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);

  if (host === 'github.com' || host === 'www.github.com') {
    return parseGithub(segments, host);
  }
  if (host === 'gitlab.com' || host.endsWith('.gitlab.com')) {
    return parseGitlab(segments, host);
  }
  if (host === 'bitbucket.org' || host === 'www.bitbucket.org') {
    return parseBitbucket(segments, host);
  }
  throw AppError.badRequest(`Unsupported provider: ${host}`);
}

/** Parse a bare repository URL (no PR id). Used for /repos endpoint. */
export function parseRepoUrl(rawUrl: string): {
  provider: Provider;
  org: string;
  repo: string;
  repoUrl: string;
} {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw AppError.badRequest('Invalid URL');
  }
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);

  if (host === 'github.com') {
    if (segments.length < 2) throw AppError.badRequest('Invalid GitHub repo URL');
    const [org, repoRaw] = segments;
    const repo = repoRaw.replace(/\.git$/, '');
    return { provider: 'github', org, repo, repoUrl: `https://github.com/${org}/${repo}` };
  }
  if (host === 'gitlab.com' || host.endsWith('.gitlab.com')) {
    if (segments.length < 2) throw AppError.badRequest('Invalid GitLab repo URL');
    const repo = segments[segments.length - 1].replace(/\.git$/, '');
    const org = segments.slice(0, -1).join('/');
    return { provider: 'gitlab', org, repo, repoUrl: `https://${host}/${org}/${repo}` };
  }
  if (host === 'bitbucket.org') {
    if (segments.length < 2) throw AppError.badRequest('Invalid Bitbucket repo URL');
    const [org, repoRaw] = segments;
    const repo = repoRaw.replace(/\.git$/, '');
    return {
      provider: 'bitbucket',
      org,
      repo,
      repoUrl: `https://bitbucket.org/${org}/${repo}`,
    };
  }
  throw AppError.badRequest(`Unsupported provider: ${host}`);
}

function parseGithub(segments: string[], host: string): ParsedPRUrl {
  // /org/repo/pull/42
  if (segments.length < 4 || segments[2] !== 'pull') {
    throw AppError.badRequest('Invalid GitHub PR URL');
  }
  const [org, repo, , prId] = segments;
  if (!/^\d+$/.test(prId)) throw AppError.badRequest('Invalid GitHub PR id');
  return {
    provider: 'github',
    org,
    repo,
    prId,
    repoUrl: `https://${host}/${org}/${repo}`,
  };
}

function parseGitlab(segments: string[], host: string): ParsedPRUrl {
  // Path: <group>/<...subgroups>/<project>/-/merge_requests/<id>
  const dashIdx = segments.indexOf('-');
  if (dashIdx === -1 || segments[dashIdx + 1] !== 'merge_requests') {
    throw AppError.badRequest('Invalid GitLab MR URL');
  }
  const prId = segments[dashIdx + 2];
  if (!prId || !/^\d+$/.test(prId)) throw AppError.badRequest('Invalid GitLab MR id');
  const pathParts = segments.slice(0, dashIdx);
  if (pathParts.length < 2) throw AppError.badRequest('Invalid GitLab MR URL');
  const repo = pathParts[pathParts.length - 1];
  const org = pathParts.slice(0, -1).join('/');
  return {
    provider: 'gitlab',
    org,
    repo,
    prId,
    repoUrl: `https://${host}/${org}/${repo}`,
  };
}

function parseBitbucket(segments: string[], host: string): ParsedPRUrl {
  // /workspace/project/pull-requests/21
  if (segments.length < 4 || segments[2] !== 'pull-requests') {
    throw AppError.badRequest('Invalid Bitbucket PR URL');
  }
  const [org, repo, , prId] = segments;
  if (!/^\d+$/.test(prId)) throw AppError.badRequest('Invalid Bitbucket PR id');
  return {
    provider: 'bitbucket',
    org,
    repo,
    prId,
    repoUrl: `https://${host}/${org}/${repo}`,
  };
}
