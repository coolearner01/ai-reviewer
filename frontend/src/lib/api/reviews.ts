import { apiFetch, buildQuery } from './client';
import type {
  RepositoryRecord,
  ReviewResult,
  ReviewsListResponse,
  SubmitReviewPayload,
  SubmitReviewResponse,
} from '@/types';

/** Response from the slug-based review lookup endpoint. */
export interface LookupResponse {
  // When a review exists for this PR we return the full review result.
  // When no review exists yet, the backend returns `{ review: null, repository, externalId }`.
  review?: ReviewResult['review'] | null;
  pullRequest?: ReviewResult['pullRequest'];
  repository: RepositoryRecord;
  comments?: ReviewResult['comments'];
  agentSummaries?: ReviewResult['agentSummaries'];
  fileRiskRanking?: ReviewResult['fileRiskRanking'];
  diff?: ReviewResult['diff'];
  externalId?: string;
}

export interface PostToProviderResponse {
  reviewId: string;
  postedInline: number;
  postedSummary: boolean;
  failedInline: number;
  errors: string[];
}

export const reviewsApi = {
  submit: (payload: SubmitReviewPayload) =>
    apiFetch<SubmitReviewResponse>('/reviews', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  get: (id: string) => apiFetch<ReviewResult>(`/reviews/${id}`),

  list: (params?: { page?: number; limit?: number; status?: string; repoId?: string }) =>
    apiFetch<ReviewsListResponse>(`/reviews${buildQuery(params ?? {})}`),

  retry: (id: string) =>
    apiFetch<{ reviewId: string; status: string }>(`/reviews/${id}/retry`, {
      method: 'POST',
    }),

  /** Manually push this review's findings + summary to the upstream provider. */
  postToProvider: (id: string) =>
    apiFetch<PostToProviderResponse>(`/reviews/${id}/post-to-github`, {
      method: 'POST',
    }),

  /** Resolve a GitHub-style URL (org/repo/pulls/:prId) to the latest review. */
  lookupBySlug: (orgSlug: string, repoName: string, prId: string) =>
    apiFetch<LookupResponse>(
      `/reviews/lookup/${encodeURIComponent(orgSlug)}/${encodeURIComponent(repoName)}/pulls/${encodeURIComponent(prId)}`,
    ),

  /**
   * Soft-delete a single reviewer-suggested comment. The backend stops
   * surfacing it in the review result and skips it when re-posting to the
   * upstream provider. Can be undone via {@link restoreComment}.
   */
  discardComment: (reviewId: string, commentId: string) =>
    apiFetch<void>(`/reviews/${reviewId}/comments/${commentId}`, {
      method: 'DELETE',
    }),

  /** Reverse a previous discard. */
  restoreComment: (reviewId: string, commentId: string) =>
    apiFetch<void>(`/reviews/${reviewId}/comments/${commentId}/restore`, {
      method: 'POST',
    }),
};
