import { apiFetch } from './client';
import type { PullRequestRecord, PullRequestState, RepositoryRecord, ReviewStatus, MergeRecommendation } from '@/types';

export interface PullRequestListItem {
  pullRequest: PullRequestRecord;
  latestReview: {
    id: string;
    status: ReviewStatus;
    mergeRecommendation: MergeRecommendation | null;
    createdAt: string;
  } | null;
}

export interface PullRequestPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PullRequestListResponse {
  pullRequests: PullRequestListItem[];
  counts: Record<PullRequestState, number>;
  pagination: PullRequestPagination;
  syncing: boolean;
}

/** How many PRs we show per page. */
export const PR_PAGE_SIZE = 10;

export const repositoriesApi = {
  list: () => apiFetch<{ repositories: RepositoryRecord[] }>('/repositories'),

  listPullRequests: (
    repositoryId: string,
    opts?: {
      state?: PullRequestState;
      /** `true` blocks on the provider sync; `'async'` syncs in the background. */
      sync?: boolean | 'async';
      page?: number;
      limit?: number;
    },
  ) => {
    const params = new URLSearchParams();
    if (opts?.state) params.set('state', opts.state);
    if (opts?.sync) params.set('sync', opts.sync === 'async' ? 'async' : '1');
    if (opts?.page) params.set('page', String(opts.page));
    params.set('limit', String(opts?.limit ?? PR_PAGE_SIZE));
    const q = params.toString();
    return apiFetch<PullRequestListResponse>(
      `/repositories/${repositoryId}/pull-requests${q ? `?${q}` : ''}`,
    );
  },

  create: (repositoryUrl: string) =>
    apiFetch<{ repository: RepositoryRecord }>('/repositories', {
      method: 'POST',
      body: JSON.stringify({ repositoryUrl }),
    }),
};
