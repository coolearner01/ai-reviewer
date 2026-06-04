'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useReviewView } from '@/lib/hooks/useReviewView';
import { useCancelReview, useDeleteReview } from '@/lib/hooks/useReview';
import { PageHeader, ErrorCard } from '@/components/shared/PageHeader';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ReviewProgress } from '@/components/review/ReviewProgress';
import { MergeRecommendationBanner } from '@/components/review/MergeRecommendationBanner';
import { AgentResultsPanel, FileRiskTable } from '@/components/review/AgentResultsPanel';
import { FilesChangedBrowser } from '@/components/review/FilesChangedBrowser';
import { HolisticSummaryPanel } from '@/components/review/HolisticSummaryPanel';
import { PostToGitHubButton } from '@/components/review/PostToGitHubButton';
import { PrSectionNav, type SectionNavItem } from '@/components/review/PrSectionNav';
import { BackToTop } from '@/components/review/BackToTop';
import { Button } from '@/components/ui/button';
import { ExternalLink, Trash2, XCircle } from 'lucide-react';
import type { ReviewCommentRecord, ReviewResult, Severity } from '@/types';

export function ReviewDetailContent({
  data,
  refetch,
  breadcrumb,
  hidePageHeader = false,
  hideBreadcrumb = false,
}: {
  data: ReviewResult;
  refetch: () => void;
  breadcrumb?: React.ReactNode;
  /** When true, parent owns the PR title block — skip the built-in PageHeader. */
  hidePageHeader?: boolean;
  /** When true, skip the breadcrumb (parent already renders one). */
  hideBreadcrumb?: boolean;
}) {
  const { review, pullRequest, repository, comments, agentSummaries, fileRiskRanking, diff } =
    data;
  const {
    inProgress,
    progressError,
    displayLatest,
    severityCounts,
  } = useReviewView(data, refetch);
  const findingsPanelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const cancelReview = useCancelReview();
  const deleteReview = useDeleteReview();
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | null>(null);

  const handleCancel = () => {
    cancelReview.mutate(review.id, {
      onSuccess: () => {
        setConfirm(null);
        refetch();
      },
    });
  };

  const handleDelete = () => {
    deleteReview.mutate(review.id, { onSuccess: () => router.push('/ai-reviews') });
  };

  const confirmDialog = (
    <>
      {confirm === 'cancel' && (
        <ConfirmDialog
          title="Cancel review?"
          description="This stops the review before it finishes. You can re-run it later."
          confirmLabel="Cancel review"
          pendingLabel="Cancelling…"
          cancelLabel="Keep running"
          tone="danger"
          pending={cancelReview.isPending}
          onConfirm={handleCancel}
          onClose={() => !cancelReview.isPending && setConfirm(null)}
        />
      )}
      {confirm === 'delete' && (
        <ConfirmDialog
          title="Delete review?"
          description="This permanently removes the review and all of its findings from the database. This cannot be undone."
          confirmLabel="Delete review"
          pendingLabel="Deleting…"
          tone="danger"
          pending={deleteReview.isPending}
          onConfirm={handleDelete}
          onClose={() => !deleteReview.isPending && setConfirm(null)}
        />
      )}
    </>
  );

  // Shared file-selection state. Clicking a file in any of the panels below
  // filters the Agent Findings, switches the diff browser to that file, and
  // highlights it in the Changed Files Analysis + File Risk Ranking tables.
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  // Sticky-nav severity chip → filters the findings panel.
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | null>(null);

  // Default the filter once we know which files have findings. We pick the
  // first file in the diff that actually has comments so opening the page
  // immediately shows useful filtered context. Users can clear at any time.
  const defaultFile = useMemo(() => {
    if (comments.length === 0) return null;
    const firstWithFindings = comments[0]?.file ?? null;
    return firstWithFindings;
  }, [comments]);

  useEffect(() => {
    if (selectedFile == null && defaultFile) setSelectedFile(defaultFile);
  }, [selectedFile, defaultFile]);

  const handleSelectFile = (file: string) => {
    setSelectedFile((prev) => (prev === file ? null : file));
    const el = document.getElementById('files-changed-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const clearFileFilter = () => setSelectedFile(null);

  // Top priority fix → scroll/flash the closest matching finding. We do a
  // simple bag-of-words overlap so users can pivot from "what to fix" to
  // "where in the code" without leaving the page.
  const handleFixClick = (fix: string) => {
    const target = findBestCommentMatch(fix, comments);
    if (target) {
      const el = document.getElementById(`finding-${target.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-gh-blue');
        setTimeout(() => el.classList.remove('ring-2', 'ring-gh-blue'), 1500);
        return;
      }
    }
    // Fallback: at least drop the user at the findings section.
    document.getElementById('findings-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  if (inProgress) {
    return (
      <div className="px-6 py-6 lg:px-8">
        {!hideBreadcrumb && breadcrumb}
        {progressError && (
          <div className="mb-4 max-w-xl mx-auto rounded-md border border-gh-yellow/50 bg-gh-yellow/10 px-4 py-3 text-sm text-[#e3b341]">
            Live progress stream unavailable ({progressError}). Status still updates
            every few seconds via polling.
          </div>
        )}
        <ReviewProgress
          prTitle={pullRequest.title}
          repoUrl={repository.repoUrl}
          prUrl={pullRequest.prUrl}
          latest={displayLatest}
        />
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirm('cancel')}
            disabled={cancelReview.isPending}
          >
            <XCircle className="h-3.5 w-3.5" />
            Cancel review
          </Button>
        </div>
        {confirmDialog}
      </div>
    );
  }

  if (review.status === 'cancelled') {
    return (
      <div className={hidePageHeader ? 'space-y-4' : 'px-6 py-8 max-w-xl mx-auto space-y-4'}>
        {!hideBreadcrumb && breadcrumb}
        <div className="rounded-md border border-gh-border bg-gh-surface p-6 text-sm">
          <p className="font-semibold text-gh-text mb-1">Review cancelled</p>
          <p className="text-gh-text-muted">
            This review was cancelled before it finished. You can run it again or delete it.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Refresh
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-gh-red hover:text-gh-red"
              onClick={() => setConfirm('delete')}
              disabled={deleteReview.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete review
            </Button>
          </div>
        </div>
        {confirmDialog}
      </div>
    );
  }

  if (review.status === 'failed') {
    // When embedded under a parent that owns the page header, render the error
    // inline (so the workflow + tabs remain visible). When standalone, keep the
    // legacy centered card so the original /review/:id page still works.
    if (hidePageHeader) {
      return (
        <ErrorBoundary>
          <ReviewFailedBanner
            message={review.errorMessage ?? 'AI review failed'}
            onRetry={refetch}
          />
        </ErrorBoundary>
      );
    }
    return (
      <div className="px-6 py-8 max-w-xl mx-auto">
        {!hideBreadcrumb && breadcrumb}
        <ErrorCard
          message={review.errorMessage ?? 'Review failed'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const scrollToFinding = (c: ReviewCommentRecord) => {
    const el = document.getElementById(`finding-${c.id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-gh-blue');
      setTimeout(() => el.classList.remove('ring-2', 'ring-gh-blue'), 1500);
    }
  };

  const outerClass = hidePageHeader
    ? 'space-y-6'
    : 'px-6 py-6 lg:px-8 max-w-7xl mx-auto space-y-6';

  const navSections: SectionNavItem[] = [
    { id: 'summary-section', label: 'Summary', icon: 'summary' },
    {
      id: 'changed-files-section',
      label: 'Files',
      icon: 'files',
      count: pullRequest.filesChanged || undefined,
    },
    {
      id: 'findings-section',
      label: 'Findings',
      icon: 'findings',
      count: comments.length,
    },
    ...(fileRiskRanking.length > 0
      ? [{ id: 'risk-section', label: 'Risk', icon: 'risk' as const, count: fileRiskRanking.length }]
      : []),
  ];

  return (
    <div className={outerClass}>
      {!hideBreadcrumb && breadcrumb}
      {!hidePageHeader && (
        <PageHeader
          title={pullRequest.title}
          description={`${repository.repoUrl} · by ${pullRequest.author || 'unknown'}`}
          action={
            <div className="flex flex-wrap gap-2">
              <PostToGitHubButton
                reviewId={review.id}
                provider={repository.provider}
                postedAt={review.postedToProviderAt}
                commentCount={comments.length}
              />
              <Button asChild variant="outline" size="sm">
                <a href={pullRequest.prUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  View on {repository.provider}
                </a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-gh-red hover:text-gh-red"
                onClick={() => setConfirm('delete')}
                disabled={deleteReview.isPending}
                title="Delete review"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          }
        />
      )}

      <PrSectionNav
        sections={navSections}
        severityCounts={severityCounts}
        selectedSeverity={selectedSeverity}
        onSelectSeverity={setSelectedSeverity}
        activeFileFilter={selectedFile}
        onClearFileFilter={clearFileFilter}
      />

      <ErrorBoundary>
        {review.mergeRecommendation && review.riskScore !== null && (
          <MergeRecommendationBanner
            recommendation={review.mergeRecommendation}
            riskScore={review.riskScore}
            commentCount={comments.length}
            deploymentRisk={review.deploymentRisk}
          />
        )}
      </ErrorBoundary>

      <section id="summary-section" className="scroll-mt-20">
        <ErrorBoundary>
          <HolisticSummaryPanel
            health={review.health}
            overview={review.executiveSummary}
            topPriorityFixes={review.topPriorityFixes}
            onFixClick={comments.length > 0 ? handleFixClick : undefined}
          />
        </ErrorBoundary>
      </section>

      <section id="changed-files-section" className="scroll-mt-20 space-y-6">
        <ErrorBoundary>
          <div id="files-changed-section" className="scroll-mt-20">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gh-text-subtle mb-3">
              Files changed ({pullRequest.filesChanged || '—'})
            </h3>
            {diff ? (
              <FilesChangedBrowser
                diff={diff}
                comments={comments}
                onCommentClick={scrollToFinding}
                selectedFile={selectedFile}
                onSelectFile={(f) => setSelectedFile(f)}
              />
            ) : (
              <div className="rounded-md border border-gh-border bg-gh-surface p-6 text-sm text-gh-text-muted text-center">
                Diff not available for this review.
              </div>
            )}
          </div>
        </ErrorBoundary>
      </section>

      <ErrorBoundary>
        <section id="findings-section" ref={findingsPanelRef} className="scroll-mt-20">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gh-text-subtle mb-3">
            Agent Findings
          </h3>
          {comments.length === 0 ? (
            <p className="text-xs text-gh-text-muted">
              No findings — see the recommendation banner above.
            </p>
          ) : (
            <AgentResultsPanel
              agentSummaries={agentSummaries}
              comments={comments}
              fileFilter={selectedFile}
              onClearFileFilter={clearFileFilter}
              severityFilter={selectedSeverity}
              onClearSeverityFilter={() => setSelectedSeverity(null)}
            />
          )}
        </section>
      </ErrorBoundary>

      {fileRiskRanking.length > 0 && (
        <ErrorBoundary>
          <section id="risk-section" className="scroll-mt-20">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gh-text-subtle mb-3">
              File Risk Ranking
            </h3>
            <FileRiskTable
              files={fileRiskRanking}
              selectedFile={selectedFile}
              onSelectFile={handleSelectFile}
            />
          </section>
        </ErrorBoundary>
      )}

      <BackToTop />
      {confirmDialog}
    </div>
  );
}

/**
 * Tiny bag-of-words matcher: pick the comment whose title+issue text shares
 * the most word stems with the priority-fix sentence. Good enough to wire
 * the "click a fix → jump to the relevant finding" UX without an embedding.
 */
function findBestCommentMatch(
  fix: string,
  comments: ReviewCommentRecord[],
): ReviewCommentRecord | null {
  if (comments.length === 0) return null;
  const tokens = tokenize(fix);
  if (tokens.length === 0) return null;
  let best: ReviewCommentRecord | null = null;
  let bestScore = 0;
  for (const c of comments) {
    const haystack = tokenize(`${c.title} ${c.issue} ${c.recommendation} ${c.file}`);
    const haystackSet: Record<string, true> = {};
    for (const t of haystack) haystackSet[t] = true;
    let score = 0;
    for (const t of tokens) if (haystackSet[t]) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore >= 2 ? best : null;
}

function tokenize(s: string): string[] {
  const seen: Record<string, true> = {};
  const out: string[] = [];
  const words = s
    .toLowerCase()
    .replace(/[^a-z0-9_/.\s-]/g, ' ')
    .split(/\s+/);
  for (const w of words) {
    if (w.length <= 3 || seen[w]) continue;
    seen[w] = true;
    out.push(w);
  }
  return out;
}

export function ReviewBreadcrumb({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav className="text-sm text-gh-text-muted mb-4 flex flex-wrap items-center gap-1">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-gh-text-subtle">/</span>}
          {item.href ? (
            <Link href={item.href} className="hover:text-gh-blue-muted hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="text-gh-text font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/**
 * Compact, inline failure banner — used when the parent page owns the layout
 * and we don't want a failed AI review to wipe out the rest of the UI
 * (workflow controls, timeline, etc.).
 */
function ReviewFailedBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const isUpstreamMissing = /not found|404/i.test(message);

  return (
    <div className="rounded-md border border-gh-red/40 bg-gh-red/10 p-4 text-sm">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#f85149] mb-1">AI review failed</p>
          <p className="text-gh-text break-words">{message}</p>
          {isUpstreamMissing && (
            <p className="mt-2 text-gh-text-muted text-xs">
              The upstream PR couldn&apos;t be fetched. Double-check the PR number exists
              in the repository, or simulate against a real PR URL.
            </p>
          )}
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="shrink-0 text-xs font-medium text-[#f85149] underline hover:no-underline"
          >
            Refresh
          </button>
        )}
      </div>
    </div>
  );
}
