'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { reviewsApi } from '@/lib/api/reviews';
import { ReviewView } from '@/components/review/ReviewView';
import { ReviewBreadcrumb } from '@/components/review/ReviewDetailContent';
import { ReviewResultSkeleton } from '@/components/shared/Skeleton';
import { ErrorCard, Spinner, EmptyState } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { TopBarBreadcrumb } from '@/components/layout/TopBarActions';
import { PrPageHeader } from '@/components/pr/PrPageHeader';
import { PostToGitHubButton } from '@/components/review/PostToGitHubButton';
import { orgPullsPath } from '@/lib/routes';
import { toast } from 'sonner';
import { Bot } from 'lucide-react';
import type { ReviewResult } from '@/types';

function isFullReview(
  data: Awaited<ReturnType<typeof reviewsApi.lookupBySlug>>,
): data is ReviewResult {
  return data.review != null && 'pullRequest' in data && data.pullRequest != undefined;
}

export default function OrgRepoPullPage() {
  const { org, repo, prId } = useParams<{ org: string; repo: string; prId: string }>();
  const router = useRouter();

  const reviewLookup = useQuery({
    queryKey: ['review-lookup', org, repo, prId],
    queryFn: () => reviewsApi.lookupBySlug(org, repo, prId),
    enabled: Boolean(org && repo && prId),
  });

  const startReview = useMutation({
    mutationFn: async () => {
      const repository = reviewLookup.data?.repository;
      if (!repository) throw new Error('Repository not loaded');
      const prUrl = isFullReview(reviewLookup.data!)
        ? reviewLookup.data!.pullRequest.prUrl
        : buildPrUrl(repository, prId);
      return reviewsApi.submit({
        repositoryUrl: repository.repoUrl,
        pullRequestUrl: prUrl,
        reviewDepth: 'standard',
      });
    },
    onSuccess: (res) => {
      toast.success('Review started');
      router.push(`/review/${res.reviewId}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (reviewLookup.isLoading) {
    return (
      <div className="px-6 py-6 lg:px-8 max-w-7xl mx-auto">
        <ReviewResultSkeleton />
      </div>
    );
  }

  if (reviewLookup.error) {
    return (
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <ErrorCard message={reviewLookup.error.message} onRetry={() => reviewLookup.refetch()} />
      </div>
    );
  }

  if (!reviewLookup.data) return null;

  const breadcrumb = (
    <ReviewBreadcrumb
      items={[
        { label: org, href: `/organizations/${org}` },
        { label: repo, href: orgPullsPath(org, repo) },
        { label: `PR #${prId}` },
      ]}
    />
  );

  const pullRequest = isFullReview(reviewLookup.data) ? reviewLookup.data.pullRequest : null;
  const repositoryRecord = reviewLookup.data.repository ?? null;

  // ---- Build the action slot on the PR header ----
  // Show "Post to GitHub" only when a successful review exists.
  const headerAction =
    isFullReview(reviewLookup.data) && reviewLookup.data.review.status === 'completed' ? (
      <PostToGitHubButton
        reviewId={reviewLookup.data.review.id}
        provider={reviewLookup.data.repository.provider}
        postedAt={reviewLookup.data.review.postedToProviderAt}
        commentCount={reviewLookup.data.comments.length}
      />
    ) : !isFullReview(reviewLookup.data) ? (
      <Button onClick={() => startReview.mutate()} disabled={startReview.isPending} size="sm">
        {startReview.isPending ? <Spinner /> : <Bot className="h-3.5 w-3.5" />}
        Run AI review
      </Button>
    ) : null;

  return (
    <PrPageBody
      breadcrumb={breadcrumb}
      org={org}
      repo={repo}
      prId={prId}
    >
      <PrPageHeader
        prId={prId}
        pullRequest={pullRequest}
        repository={repositoryRecord}
        action={headerAction}
      />

      {/* AI review content (full width). */}
      {isFullReview(reviewLookup.data) ? (
        <div className="mb-6">
          <ReviewView
            layout="sections"
            data={reviewLookup.data}
            refetch={() => void reviewLookup.refetch()}
            hidePageHeader
            hideBreadcrumb
          />
        </div>
      ) : (
        <div className="mb-6">
          <EmptyState
            title="No AI review yet"
            description={`Run a review on this PR to surface security, performance, and architecture findings from ${repositoryRecord?.provider ?? 'the provider'}.`}
            action={
              <Button onClick={() => startReview.mutate()} disabled={startReview.isPending}>
                {startReview.isPending ? <Spinner /> : <Bot className="h-3.5 w-3.5" />}
                Run AI review
              </Button>
            }
          />
        </div>
      )}

      <div className="mt-8 text-sm text-gh-text-muted">
        <Link href={orgPullsPath(org, repo)} className="hover:text-gh-blue-muted hover:underline">
          ← All PRs in {repo}
        </Link>
      </div>
    </PrPageBody>
  );
}

/**
 * Wraps the PR detail page in a layout that mirrors its breadcrumb into the
 * sticky top bar via the TopBarActions slot. Keeping this in a child component
 * keeps the hook call order stable across early `return null` branches above.
 */
function PrPageBody({
  breadcrumb,
  org,
  repo,
  prId,
  children,
}: {
  breadcrumb: React.ReactNode;
  org: string;
  repo: string;
  prId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-6 py-6 lg:px-8 max-w-7xl mx-auto">
      <TopBarBreadcrumb>
        <nav className="flex items-center gap-1.5 text-[13px] text-gh-text-muted min-w-0">
          <Link href={`/organizations/${org}`} className="text-gh-blue-muted hover:underline">
            {org}
          </Link>
          <span className="text-gh-text-subtle">/</span>
          <Link href={orgPullsPath(org, repo)} className="text-gh-blue-muted hover:underline">
            {repo}
          </Link>
          <span className="text-gh-text-subtle">/</span>
          <span className="truncate text-gh-text">PR #{prId}</span>
        </nav>
      </TopBarBreadcrumb>
      {breadcrumb}
      {children}
    </div>
  );
}

function buildPrUrl(
  repository: { provider: string; repoUrl: string; orgOrWorkspace: string; repoName: string },
  prId: string,
): string {
  const base = repository.repoUrl.replace(/\/$/, '');
  switch (repository.provider) {
    case 'gitlab':
      return `${base}/-/merge_requests/${prId}`;
    case 'bitbucket':
      return `${base}/pull-requests/${prId}`;
    default:
      return `${base}/pull/${prId}`;
  }
}
