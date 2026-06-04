import type { RepositoryRecord } from '@/types';

/** GitHub-style path: /:orgSlug/:repoName/pulls/:prId */
export function prPullPath(orgSlug: string, repoName: string, prId: string | number): string {
  return `/${encodeURIComponent(orgSlug)}/${encodeURIComponent(repoName)}/pulls/${encodeURIComponent(String(prId))}`;
}

export function orgPullsPath(orgSlug: string, repoName: string): string {
  return `/${encodeURIComponent(orgSlug)}/${encodeURIComponent(repoName)}/pulls`;
}

/** Prefer clean URL when the repo belongs to an organization. */
export function reviewPath(input: {
  reviewId: string;
  pullRequestExternalId: string;
  repository: RepositoryRecord;
}): string {
  const orgSlug = input.repository.organizationSlug;
  if (orgSlug && input.repository.organizationId) {
    return prPullPath(orgSlug, input.repository.repoName, input.pullRequestExternalId);
  }
  return `/review/${input.reviewId}`;
}
