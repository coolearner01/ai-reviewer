import {
  AlertCircle,
  Check,
  Clock,
  GitMerge,
  GitPullRequest,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MergeRecommendation, PullRequestState, ReviewStatus } from '@/types';

export type PrTab = PullRequestState;

export function statusPillMeta(tab: PrTab): {
  cls: string;
  icon: LucideIcon;
  label: string;
} {
  if (tab === 'open')
    return { cls: 'gh-status-pill gh-status-pill--open', icon: GitPullRequest, label: 'Open' };
  if (tab === 'merged')
    return { cls: 'gh-status-pill gh-status-pill--merged', icon: GitMerge, label: 'Merged' };
  return { cls: 'gh-status-pill gh-status-pill--closed', icon: X, label: 'Closed' };
}

export function reviewBadgeMeta(
  status: ReviewStatus | null,
  merge: MergeRecommendation | null,
): { cls: string; icon: LucideIcon; label: string } {
  if (!status || status === 'queued' || status === 'fetching' || status === 'analyzing')
    return { cls: 'gh-review-badge gh-review-badge--pending', icon: Clock, label: 'Pending' };
  if (status === 'failed')
    return { cls: 'gh-review-badge gh-review-badge--changes', icon: AlertCircle, label: 'Failed' };
  if (merge === 'BLOCK_MERGE' || merge === 'NEEDS_CHANGES')
    return { cls: 'gh-review-badge gh-review-badge--changes', icon: AlertCircle, label: 'Changes' };
  if (merge === 'APPROVE' || merge === 'APPROVE_WITH_MINOR_SUGGESTIONS')
    return { cls: 'gh-review-badge gh-review-badge--approved', icon: Check, label: 'Approved' };
  return { cls: 'gh-review-badge gh-review-badge--none', icon: Clock, label: 'No review' };
}
