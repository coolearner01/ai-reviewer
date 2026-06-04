'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { reviewPath } from '@/lib/routes';
import {
  Bot,
  X,
  Zap,
  ArrowRight,
  GitPullRequest,
  Loader2,
} from 'lucide-react';
import { queryKeys } from '@/lib/queryKeys';
import { useStartReview } from '@/lib/hooks/useStartReview';
import { Button } from '@/components/ui/button';
import type { PullRequestListItem } from '@/lib/api/repositories';
import type { RepositoryRecord } from '@/types';
import { cn } from '@/lib/utils';

interface ReviewConfirmDialogProps {
  item: PullRequestListItem;
  repository: RepositoryRecord;
  onClose: () => void;
}

/**
 * Confirmation modal shown when a user clicks a pull request row.
 *
 * It asks the user to confirm before spending an AI review run. When the PR
 * already has a review we offer a quick "View review" shortcut alongside the
 * option to re-run a fresh analysis.
 */
export function ReviewConfirmDialog({
  item,
  repository,
  onClose,
}: ReviewConfirmDialogProps) {
  const router = useRouter();
  const { pullRequest, latestReview } = item;
  const hasReview = Boolean(latestReview);

  // Close on Escape and lock background scroll while the modal is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const startReview = useStartReview();

  const viewExisting = () => {
    if (!latestReview) return;
    onClose();
    router.push(
      reviewPath({
        reviewId: latestReview.id,
        pullRequestExternalId: pullRequest.externalId,
        repository,
      }),
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-confirm-title"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
        aria-hidden
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-gh-border bg-gh-canvas shadow-2xl">
        <div className="flex items-start gap-3 border-b border-gh-border px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gh-purple to-gh-blue text-white">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="review-confirm-title"
              className="text-sm font-semibold text-gh-text"
            >
              {hasReview ? 'Re-run AI review?' : 'Start AI review?'}
            </h2>
            <p className="mt-0.5 text-xs text-gh-text-muted">
              ReviewBot will analyse this pull request and post its findings.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gh-text-subtle transition-colors hover:bg-gh-surface-2 hover:text-gh-text"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="rounded-lg border border-gh-border bg-gh-surface p-3">
            <div className="flex items-center gap-2">
              <GitPullRequest className="h-4 w-4 shrink-0 text-gh-text-muted" />
              <span className="truncate text-[13px] font-medium text-gh-text">
                {pullRequest.title || `PR #${pullRequest.externalId}`}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-gh-text-subtle">
              <span className="font-mono">#{pullRequest.externalId}</span>
              {' · '}
              <span className="text-gh-blue-muted">
                {pullRequest.author || 'unknown'}
              </span>
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gh-text-muted">
              <span className="font-mono truncate">{pullRequest.sourceBranch}</span>
              <span className="text-gh-text-subtle">→</span>
              <span className="font-mono truncate">{pullRequest.targetBranch}</span>
            </div>
          </div>

          {hasReview && (
            <p className="mt-3 text-xs text-gh-text-muted">
              This PR already has a review. You can open the existing results or
              run a fresh analysis on the latest changes.
            </p>
          )}
        </div>

        <div
          className={cn(
            'flex items-center gap-2 border-t border-gh-border bg-gh-surface/40 px-5 py-3',
            hasReview ? 'justify-between' : 'justify-end',
          )}
        >
          {hasReview && (
            <Button variant="outline" size="sm" onClick={viewExisting}>
              View review
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={startReview.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() =>
                startReview.mutate(
                  {
                    repository,
                    pullRequestUrl: pullRequest.prUrl,
                    pullRequestExternalId: pullRequest.externalId,
                  },
                  { onSuccess: () => onClose() },
                )
              }
              disabled={startReview.isPending}
            >
              {startReview.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              {startReview.isPending
                ? 'Queuing…'
                : hasReview
                  ? 'Re-run review'
                  : 'Continue'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
