import type { ReviewProgressEvent, ReviewRecord, ReviewStatus } from '@/types';

/**
 * Review status → progress/message helpers. Mirrors the backend's SSE
 * `progressForStatus` / `messageForStatus` so the polled fallback shows the
 * same wording as the live stream. Shared by every review view.
 */

export function progressPercent(status: ReviewStatus): number {
  switch (status) {
    case 'queued':
      return 0;
    case 'fetching':
      return 10;
    case 'analyzing':
      return 50;
    case 'commenting':
      return 85;
    case 'completed':
    case 'failed':
      return 100;
    default:
      return 0;
  }
}

export function progressMessage(review: ReviewRecord): string {
  switch (review.status) {
    case 'queued':
      return 'Review queued…';
    case 'fetching':
      return 'Fetching PR diff and file contents…';
    case 'analyzing':
      return 'Running AI review agents…';
    case 'commenting':
      return 'Saving review findings…';
    case 'completed':
      return 'Review complete';
    case 'failed':
      return review.errorMessage ?? 'Review failed';
    default:
      return 'Processing…';
  }
}

/** Build a progress event from polled review data (fallback when SSE drops). */
export function progressFromReview(review: ReviewRecord): ReviewProgressEvent {
  return {
    reviewId: review.id,
    status: review.status,
    message: progressMessage(review),
    progress: progressPercent(review.status),
    timestamp: review.completedAt ?? new Date().toISOString(),
  };
}
