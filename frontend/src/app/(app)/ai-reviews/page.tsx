'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Bot, Plus, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader, EmptyState, Spinner, ErrorCard } from '@/components/shared/PageHeader';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TopBarActions } from '@/components/layout/TopBarActions';
import { useReviews } from '@/lib/hooks/useReview';
import { reviewsApi } from '@/lib/api/reviews';
import { cn, formatRelative, mergeColors, riskScoreClass } from '@/lib/utils';
import { reviewPath } from '@/lib/routes';
import { StatsRow } from '@/components/dashboard/DashboardWidgets';
import type { ReviewStatus, ReviewsListResponse } from '@/types';

type ReviewItem = ReviewsListResponse['reviews'][number];

const STATUS_TABS: { id: 'all' | ReviewStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'completed', label: 'Completed' },
  { id: 'analyzing', label: 'Running' },
  { id: 'queued', label: 'Queued' },
  { id: 'failed', label: 'Failed' },
];

/**
 * AI Reviews page — full history view that used to clutter the dashboard.
 *
 * Surfaces the StatsRow + RiskTrend + every completed/in-flight review with
 * retry controls. Designed to match the same dark GitHub palette as the
 * Pull Requests dashboard.
 */
export default function AiReviewsPage() {
  const [status, setStatus] = useState<'all' | ReviewStatus>('all');
  const qc = useQueryClient();
  const { data, isLoading, error, refetch, isFetching } = useReviews({ page: 1 });
  const reviews = useMemo(() => data?.reviews ?? [], [data]);

  const retry = useMutation({
    mutationFn: (id: string) => reviewsApi.retry(id),
    onSuccess: () => {
      toast.success('Review re-queued');
      void qc.invalidateQueries({ queryKey: ['reviews'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = useMemo(
    () => (status === 'all' ? reviews : reviews.filter((r) => r.review.status === status)),
    [reviews, status],
  );

  return (
    <div className="px-6 py-6 lg:px-8 max-w-7xl mx-auto">
      <TopBarActions>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
          Refresh
        </Button>
        <Button asChild size="sm">
          <Link href="/review/new">
            <Plus className="h-3.5 w-3.5" />
            New review
          </Link>
        </Button>
      </TopBarActions>

      <PageHeader
        title="AI Reviews"
        description="Every Claude-powered review run, with risk scores, merge calls, and quick replay actions."
      />

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6" />
        </div>
      )}
      {error && <ErrorCard message={error.message} onRetry={() => refetch()} />}

      {data && reviews.length === 0 && (
        <EmptyState
          title="No reviews yet"
          description="Submit a PR or fire a Simulate run to see Claude-powered findings here."
          action={
            <Button asChild>
              <Link href="/review/new">
                <Plus className="h-3.5 w-3.5" />
                Submit your first review
              </Link>
            </Button>
          }
        />
      )}

      {data && reviews.length > 0 && (
        <div className="space-y-6">
          <ErrorBoundary>
            <StatsRow reviews={reviews} />
          </ErrorBoundary>

          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-gh-purple" />
                Review history
              </CardTitle>
              <div className="inline-flex gap-1 rounded-lg border border-gh-border bg-gh-surface-2 p-[3px]">
                {STATUS_TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setStatus(t.id)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                      status === t.id
                        ? 'bg-[#1c2c3a] text-[#7ab8f5]'
                        : 'text-gh-text-muted hover:text-gh-text',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <ReviewHistoryTable
              reviews={filtered}
              onRetry={(id) => retry.mutate(id)}
              retrying={retry.isPending ? retry.variables ?? null : null}
            />
          </Card>
        </div>
      )}
    </div>
  );
}

function ReviewHistoryTable({
  reviews,
  onRetry,
  retrying,
}: {
  reviews: ReviewItem[];
  onRetry: (id: string) => void;
  retrying: string | null;
}) {
  if (reviews.length === 0) {
    return (
      <CardContent className="py-12 text-center text-sm text-gh-text-muted">
        No reviews in this view.
      </CardContent>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gh-surface-2 border-y border-gh-border">
          <tr>
            <Th>PR</Th>
            <Th>Risk</Th>
            <Th>Decision</Th>
            <Th>Status</Th>
            <Th>Date</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {reviews.map(({ review, pullRequest, repository }) => (
            <tr
              key={review.id}
              className="border-b border-gh-border-muted last:border-0 hover:bg-gh-surface-2 transition-colors"
            >
              <td className="px-4 py-3">
                <Link
                  href={reviewPath({
                    reviewId: review.id,
                    pullRequestExternalId: pullRequest.externalId,
                    repository,
                  })}
                  className="block"
                >
                  <p className="font-medium text-gh-text truncate max-w-xs hover:text-gh-blue-muted">
                    {pullRequest.title || `PR #${pullRequest.externalId}`}
                  </p>
                  <p className="text-xs text-gh-text-muted">{repository.repoName}</p>
                </Link>
              </td>
              <td className="px-4 py-3">
                {review.riskScore !== null ? (
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border',
                      riskScoreClass(review.riskScore),
                    )}
                  >
                    {review.riskScore}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-4 py-3">
                {review.mergeRecommendation ? (
                  <span
                    className={cn(
                      'inline-flex text-xs px-2 py-0.5 rounded-full border',
                      mergeColors[review.mergeRecommendation].bg,
                      mergeColors[review.mergeRecommendation].border,
                      mergeColors[review.mergeRecommendation].text,
                    )}
                  >
                    {mergeColors[review.mergeRecommendation].label}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-4 py-3 capitalize text-gh-text-muted">
                {review.status.replace('_', ' ')}
              </td>
              <td className="px-4 py-3 text-gh-text-subtle text-xs">
                {formatRelative(review.createdAt)}
              </td>
              <td className="px-4 py-3 text-right">
                {review.status === 'failed' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRetry(review.id)}
                    disabled={retrying === review.id}
                  >
                    <RefreshCw className="h-3 w-3" />
                    {retrying === review.id ? 'Retrying…' : 'Retry'}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'text-left px-4 py-2.5 font-medium text-gh-text-muted text-xs uppercase tracking-wider',
        className,
      )}
    >
      {children}
    </th>
  );
}
