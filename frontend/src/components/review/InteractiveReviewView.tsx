'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Layers,
  ListChecks,
  Search,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { useReviewView } from '@/lib/hooks/useReviewView';
import { severityColors } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { ErrorCard } from '@/components/shared/PageHeader';
import { ReviewProgress } from '@/components/review/ReviewProgress';
import { FilesChangedBrowser } from '@/components/review/FilesChangedBrowser';
import { AgentResultsPanel, FileRiskTable } from '@/components/review/AgentResultsPanel';
import { PostToGitHubButton } from '@/components/review/PostToGitHubButton';
import { cn, mergeColors, riskScoreClass } from '@/lib/utils';
import { HEALTH_META } from '@/lib/reviewHealth';
import type {
  ReviewCommentRecord,
  ReviewHealth,
  ReviewRecord,
  ReviewResult,
  Severity,
} from '@/types';

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];
const SEVERITY_DOT: Record<Severity, string> = {
  critical: severityColors.critical.dot,
  high: severityColors.high.dot,
  medium: severityColors.medium.dot,
  low: severityColors.low.dot,
};
const SEVERITY_TEXT: Record<Severity, string> = {
  critical: severityColors.critical.text,
  high: severityColors.high.text,
  medium: severityColors.medium.text,
  low: severityColors.low.text,
};

type TabKey = 'overview' | 'findings' | 'files' | 'diff' | 'risk';

export function InteractiveReviewView({
  data,
  refetch,
}: {
  data: ReviewResult;
  refetch: () => void;
}) {
  const { review, pullRequest, repository, comments, agentSummaries, fileRiskRanking, diff } = data;

  const {
    inProgress,
    progressError,
    displayLatest,
    severityCounts,
    severityFilter,
    setSeverityFilter,
    findingSearch,
    setFindingSearch,
    filteredComments,
  } = useReviewView(data, refetch);

  const [tab, setTab] = useState<TabKey>('overview');

  const filteredAgentSummaries = useMemo(() => {
    const visibleAgents = new Set(filteredComments.map((c) => c.agentType));
    return agentSummaries.filter((a) => visibleAgents.has(a.agentType) || comments.length === 0);
  }, [agentSummaries, filteredComments, comments.length]);

  // ---- In-progress screen --------------------------------------------------
  if (inProgress) {
    return (
      <div className="px-6 py-6 lg:px-8 space-y-4">
        <BackToPullRequests />
        {progressError && (
          <div className="max-w-xl mx-auto rounded-md border border-gh-yellow/50 bg-gh-yellow/10 px-4 py-3 text-sm text-[#e3b341]">
            Live progress stream unavailable ({progressError}). Status still
            updates every few seconds via polling.
          </div>
        )}
        <ReviewProgress
          prTitle={pullRequest.title}
          repoUrl={repository.repoUrl}
          prUrl={pullRequest.prUrl}
          latest={displayLatest}
        />
      </div>
    );
  }

  // ---- Failed screen -------------------------------------------------------
  if (review.status === 'failed') {
    return (
      <div className="px-6 py-8 max-w-2xl mx-auto space-y-4">
        <BackToPullRequests />
        <ErrorCard
          message={review.errorMessage ?? 'Review failed'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const findingsActive = severityFilter.size > 0 || findingSearch.trim().length > 0;

  const toggleSeverity = (s: Severity) =>
    setSeverityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const clearFindingFilters = () => {
    setSeverityFilter(new Set());
    setFindingSearch('');
  };

  /** Jump to the Findings tab, scoped to a single file. */
  const jumpToFile = (file: string) => {
    setSeverityFilter(new Set());
    setFindingSearch(file);
    setTab('findings');
  };

  /** Scroll to a specific finding within the Findings tab (after the tab is active). */
  const scrollToFinding = (commentId: string) => {
    setTab('findings');
    requestAnimationFrame(() => {
      const el = document.getElementById(`finding-${commentId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-gh-blue');
        setTimeout(() => el.classList.remove('ring-2', 'ring-gh-blue'), 1500);
      }
    });
  };

  const totalFindings = comments.length;

  return (
    <div className="px-6 py-6 lg:px-8 space-y-5 max-w-[1400px] mx-auto">
      <BackToPullRequests />

      <HeaderCard
        title={pullRequest.title}
        repoUrl={repository.repoUrl}
        repoName={`${repository.orgOrWorkspace}/${repository.repoName}`}
        author={pullRequest.author}
        externalId={pullRequest.externalId}
        prUrl={pullRequest.prUrl}
        provider={repository.provider}
        commentCount={comments.length}
        reviewId={review.id}
        postedAt={review.postedToProviderAt}
      />

      <OverviewStrip
        review={review}
        severityCounts={severityCounts}
        totalFindings={totalFindings}
        filesChanged={pullRequest.filesChanged}
        additions={pullRequest.additions}
        deletions={pullRequest.deletions}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="findings" className="gap-1.5">
            <ListChecks className="h-3.5 w-3.5" />
            Findings
            <span className="ml-1 rounded-full bg-gh-border px-1.5 py-0.5 text-[10px] font-semibold text-gh-text-muted">
              {totalFindings}
            </span>
          </TabsTrigger>
          <TabsTrigger value="diff" className="gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            Diff
          </TabsTrigger>
          <TabsTrigger value="risk" className="gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" />
            Risk ranking
            <span className="ml-1 rounded-full bg-gh-border px-1.5 py-0.5 text-[10px] font-semibold text-gh-text-muted">
              {fileRiskRanking.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          <ErrorBoundary>
            <OverviewPanel
              health={review.health}
              overview={review.executiveSummary}
              topPriorityFixes={review.topPriorityFixes}
              deploymentRisk={review.deploymentRisk}
              comments={comments}
              onJumpToFinding={scrollToFinding}
            />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="findings" className="space-y-4">
          <FindingFilters
            severityCounts={severityCounts}
            activeSeverities={severityFilter}
            onToggleSeverity={toggleSeverity}
            search={findingSearch}
            onSearchChange={setFindingSearch}
            filtersActive={findingsActive}
            onClear={clearFindingFilters}
            visibleCount={filteredComments.length}
            totalCount={totalFindings}
          />

          {totalFindings === 0 ? (
            <EmptyFindings />
          ) : filteredComments.length === 0 ? (
            <div className="rounded-md border border-dashed border-gh-border-muted px-4 py-12 text-center text-sm text-gh-text-muted">
              No findings match your filters.{' '}
              <button
                onClick={clearFindingFilters}
                className="text-gh-blue-muted hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <ErrorBoundary>
              <AgentResultsPanel
                agentSummaries={filteredAgentSummaries}
                comments={filteredComments}
              />
            </ErrorBoundary>
          )}
        </TabsContent>

        <TabsContent value="diff">
          <ErrorBoundary>
            {diff ? (
              <FilesChangedBrowser
                diff={diff}
                comments={comments}
                onCommentClick={(c) => scrollToFinding(c.id)}
              />
            ) : (
              <div className="rounded-md border border-dashed border-gh-border-muted px-4 py-12 text-center text-sm text-gh-text-muted">
                Diff not available for this review.
              </div>
            )}
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="risk">
          <ErrorBoundary>
            {fileRiskRanking.length > 0 ? (
              <InteractiveFileRiskTable
                files={fileRiskRanking}
                onSelect={(file) => jumpToFile(file)}
              />
            ) : (
              <div className="rounded-md border border-dashed border-gh-border-muted px-4 py-12 text-center text-sm text-gh-text-muted">
                No file risk ranking is available — likely because the review
                produced no findings.
              </div>
            )}
          </ErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------

function BackToPullRequests() {
  return (
    <Link
      href="/dashboard"
      className="inline-flex items-center gap-1.5 text-xs text-gh-text-muted hover:text-gh-text"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back to pull requests
    </Link>
  );
}

interface HeaderCardProps {
  title: string;
  repoUrl: string;
  repoName: string;
  author: string;
  externalId: string;
  prUrl: string;
  provider: 'github' | 'gitlab' | 'bitbucket';
  commentCount: number;
  reviewId: string;
  postedAt: string | null;
}

function HeaderCard({
  title,
  repoUrl,
  repoName,
  author,
  externalId,
  prUrl,
  provider,
  commentCount,
  reviewId,
  postedAt,
}: HeaderCardProps) {
  return (
    <div className="rounded-md border border-gh-border bg-gh-surface px-5 py-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gh-text-muted flex items-center gap-1.5 flex-wrap">
            <a
              href={repoUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:text-gh-blue-muted hover:underline truncate max-w-[420px]"
            >
              {repoName}
            </a>
            <ChevronRight className="h-3 w-3 text-gh-text-subtle" />
            <span className="font-mono text-gh-text-subtle">#{externalId}</span>
          </p>
          <h1 className="mt-1 text-xl font-semibold text-gh-text break-words">
            {title || `PR #${externalId}`}
          </h1>
          <p className="mt-1.5 text-xs text-gh-text-muted">
            opened by <span className="text-gh-blue-muted">{author || 'unknown'}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <PostToGitHubButton
            reviewId={reviewId}
            provider={provider}
            postedAt={postedAt}
            commentCount={commentCount}
          />
          <Button asChild variant="outline" size="sm">
            <a href={prUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              View on {provider}
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

function OverviewStrip({
  review,
  severityCounts,
  totalFindings,
  filesChanged,
  additions,
  deletions,
}: {
  review: ReviewRecord;
  severityCounts: Record<Severity, number>;
  totalFindings: number;
  filesChanged: number;
  additions: number;
  deletions: number;
}) {
  const recommendation = review.mergeRecommendation;
  const risk = review.riskScore ?? 0;
  const health = review.health;
  const healthMeta = health ? HEALTH_META[health] : null;
  const recColors = recommendation ? mergeColors[recommendation] : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <StatTile
        label="Recommendation"
        valueClass={cn('text-sm font-semibold', recColors?.text)}
        wrapClass={cn(recColors?.bg, recColors?.border, 'border')}
        value={recColors?.label ?? '—'}
      />

      <StatTile
        label="Risk score"
        wrapClass="border border-gh-border bg-gh-surface"
        value={
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-gh-text">{risk}</span>
            <span className="text-xs text-gh-text-subtle">/ 100</span>
            <span
              className={cn(
                'ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                riskScoreClass(risk),
              )}
            >
              {risk >= 70 ? 'High' : risk >= 40 ? 'Medium' : 'Low'}
            </span>
          </div>
        }
      />

      <StatTile
        label="Health"
        wrapClass="border border-gh-border bg-gh-surface"
        value={
          healthMeta ? (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                healthMeta.className,
              )}
            >
              <healthMeta.Icon className="h-3.5 w-3.5" />
              {healthMeta.label}
            </span>
          ) : (
            <span className="text-sm text-gh-text-muted">—</span>
          )
        }
      />

      <StatTile
        label="Findings"
        wrapClass="border border-gh-border bg-gh-surface"
        value={
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gh-text">{totalFindings}</span>
            <div className="flex flex-wrap gap-1.5">
              {SEVERITY_ORDER.map((s) =>
                severityCounts[s] > 0 ? (
                  <span
                    key={s}
                    className={cn(
                      'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-gh-canvas border border-gh-border-muted',
                      SEVERITY_TEXT[s],
                    )}
                    title={`${severityCounts[s]} ${s}`}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', SEVERITY_DOT[s])} />
                    {severityCounts[s]}
                  </span>
                ) : null,
              )}
            </div>
          </div>
        }
      />

      <StatTile
        label="Files"
        wrapClass="border border-gh-border bg-gh-surface"
        value={
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gh-text">{filesChanged || 0}</span>
            <span className="text-xs text-[#3fb950] font-mono">+{additions}</span>
            <span className="text-xs text-gh-red font-mono">-{deletions}</span>
          </div>
        }
      />
    </div>
  );
}

function StatTile({
  label,
  value,
  wrapClass,
  valueClass,
}: {
  label: string;
  value: React.ReactNode;
  wrapClass?: string;
  valueClass?: string;
}) {
  return (
    <div className={cn('rounded-md px-3.5 py-3', wrapClass)}>
      <p className="text-[10px] uppercase tracking-wider text-gh-text-subtle mb-1.5">
        {label}
      </p>
      <div className={cn('text-gh-text', valueClass)}>{value}</div>
    </div>
  );
}

function OverviewPanel({
  health,
  overview,
  topPriorityFixes,
  deploymentRisk,
  comments,
  onJumpToFinding,
}: {
  health: ReviewHealth | null;
  overview: string | null;
  topPriorityFixes: string[];
  deploymentRisk: string | null;
  comments: ReviewCommentRecord[];
  onJumpToFinding: (id: string) => void;
}) {
  const healthMeta = health ? HEALTH_META[health] : null;
  // "Top finding" preview: pick the highest-severity, highest-confidence comment.
  const topFinding = useMemo(() => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    return [...comments].sort((a, b) => {
      const sev = order[a.severity] - order[b.severity];
      if (sev !== 0) return sev;
      return b.confidence - a.confidence;
    })[0];
  }, [comments]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 rounded-md border border-gh-border bg-gh-surface p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gh-text-subtle">
              PR review summary
            </h3>
            {overview ? (
              <p className="mt-2 text-sm text-gh-text leading-relaxed whitespace-pre-line">
                {overview}
              </p>
            ) : (
              <p className="mt-2 text-sm text-gh-text-muted italic">
                No executive summary was generated for this review.
              </p>
            )}
          </div>
          {healthMeta && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium shrink-0',
                healthMeta.className,
              )}
            >
              <healthMeta.Icon className="h-3.5 w-3.5" />
              {healthMeta.label}
            </span>
          )}
        </div>

        {deploymentRisk && (
          <div className="rounded-md border border-gh-yellow/30 bg-gh-yellow/10 px-3 py-2 text-xs text-[#e3b341]">
            <span className="font-semibold">Deployment risk:</span> {deploymentRisk}
          </div>
        )}

        {topPriorityFixes.length > 0 && (
          <div className="border-t border-gh-border pt-4">
            <div className="flex items-center gap-2 mb-2">
              <ListChecks className="h-4 w-4 text-gh-text-subtle" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gh-text-subtle">
                Top priority fixes
              </h4>
            </div>
            <ol className="space-y-1.5">
              {topPriorityFixes.map((fix, i) => (
                <li key={i} className="text-sm text-gh-text flex items-start gap-2">
                  <span className="font-mono text-xs text-gh-text-muted shrink-0 mt-0.5">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>{fix}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Right column: quick links */}
      <div className="space-y-3">
        {topFinding && (
          <button
            type="button"
            onClick={() => onJumpToFinding(topFinding.id)}
            className="w-full text-left rounded-md border border-gh-border bg-gh-surface p-4 hover:border-gh-blue/60 hover:bg-gh-surface-2 transition-colors"
          >
            <p className="text-[10px] uppercase tracking-wider text-gh-text-subtle mb-2">
              Top finding
            </p>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border',
                  topFinding.severity === 'critical'
                    ? 'bg-gh-red/15 border-gh-red/50 text-[#f85149]'
                    : topFinding.severity === 'high'
                      ? 'bg-gh-orange/15 border-gh-orange/50 text-[#f0883e]'
                      : topFinding.severity === 'medium'
                        ? 'bg-gh-yellow/15 border-gh-yellow/40 text-[#e3b341]'
                        : 'bg-gh-blue/15 border-gh-blue/40 text-[#58a6ff]',
                )}
              >
                <span
                  className={cn('h-1.5 w-1.5 rounded-full', SEVERITY_DOT[topFinding.severity])}
                />
                {topFinding.severity}
              </span>
              <span className="text-xs text-gh-text-subtle font-mono truncate">
                {topFinding.file}:{topFinding.line}
              </span>
            </div>
            <p className="text-sm font-medium text-gh-text">{topFinding.title}</p>
            <p className="mt-1 text-xs text-gh-text-muted line-clamp-2">{topFinding.issue}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs text-gh-blue-muted">
              View finding
              <ChevronRight className="h-3 w-3" />
            </span>
          </button>
        )}

        <div className="rounded-md border border-gh-border bg-gh-surface p-4">
          <p className="text-[10px] uppercase tracking-wider text-gh-text-subtle mb-3">
            Quick navigation
          </p>
          <div className="space-y-1.5 text-sm">
            <QuickLink label="Findings" hint={`${comments.length} item${comments.length === 1 ? '' : 's'}`} icon={ListChecks} />
            <QuickLink label="Diff" hint="Code changes" icon={Layers} />
            <QuickLink label="Risk ranking" hint="Riskiest files" icon={ShieldAlert} />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  label,
  hint,
  icon: Icon,
}: {
  label: string;
  hint: string;
  icon: typeof ListChecks;
}) {
  return (
    <div className="flex items-center justify-between text-gh-text-muted">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-gh-text-subtle" />
        <span>{label}</span>
      </div>
      <span className="text-[11px] text-gh-text-subtle">{hint}</span>
    </div>
  );
}

interface FindingFiltersProps {
  severityCounts: Record<Severity, number>;
  activeSeverities: Set<Severity>;
  onToggleSeverity: (s: Severity) => void;
  search: string;
  onSearchChange: (s: string) => void;
  filtersActive: boolean;
  onClear: () => void;
  visibleCount: number;
  totalCount: number;
}

function FindingFilters({
  severityCounts,
  activeSeverities,
  onToggleSeverity,
  search,
  onSearchChange,
  filtersActive,
  onClear,
  visibleCount,
  totalCount,
}: FindingFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {SEVERITY_ORDER.map((s) => {
            const active = activeSeverities.has(s);
            const count = severityCounts[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => onToggleSeverity(s)}
                disabled={count === 0}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  count === 0 && 'opacity-40 cursor-not-allowed',
                  active
                    ? 'border-gh-blue bg-gh-blue/15 text-gh-blue-muted'
                    : 'border-gh-border bg-gh-surface text-gh-text-muted hover:border-gh-text-subtle hover:text-gh-text',
                )}
                title={count === 0 ? `No ${s} findings` : `Toggle ${s} findings`}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', SEVERITY_DOT[s])} />
                <span className="capitalize">{s}</span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px]',
                    active ? 'bg-gh-blue/30 text-gh-blue-muted' : 'bg-gh-border text-gh-text-muted',
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex-1 min-w-[200px] flex items-center gap-2 rounded-md border border-gh-border bg-gh-surface px-2.5 py-1.5 focus-within:border-gh-blue focus-within:ring-2 focus-within:ring-ring">
          <Search className="h-3.5 w-3.5 text-gh-text-subtle" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search findings by title, file, category…"
            className="flex-1 bg-transparent text-[13px] text-gh-text placeholder:text-gh-text-subtle outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="text-gh-text-subtle hover:text-gh-text"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {filtersActive && (
        <div className="flex items-center gap-2 text-xs text-gh-text-muted">
          <span>
            Showing <span className="font-medium text-gh-text">{visibleCount}</span> of{' '}
            <span className="font-medium text-gh-text">{totalCount}</span> finding
            {totalCount === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={onClear}
            className="ml-auto text-gh-blue-muted hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyFindings() {
  return (
    <div className="rounded-md border border-gh-accent/40 bg-gh-accent/10 p-8 text-center">
      <CheckCircle2 className="mx-auto h-8 w-8 text-[#3fb950]" />
      <p className="mt-2 text-sm font-medium text-[#3fb950]">No findings</p>
      <p className="mt-1 text-xs text-gh-text-muted">
        All agents passed without flagging any issues on this PR.
      </p>
    </div>
  );
}

function InteractiveFileRiskTable({
  files,
  onSelect,
}: {
  files: Array<{
    file: string;
    riskScore: number;
    findingCount: number;
    severityBreakdown: Record<string, number>;
  }>;
  onSelect: (file: string) => void;
}) {
  return (
    <div className="rounded-md border border-gh-border bg-gh-surface overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gh-surface-2 border-b border-gh-border">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium text-gh-text-muted text-xs uppercase tracking-wider">
              File
            </th>
            <th className="text-left px-4 py-2.5 font-medium text-gh-text-muted text-xs uppercase tracking-wider">
              Risk
            </th>
            <th className="text-left px-4 py-2.5 font-medium text-gh-text-muted text-xs uppercase tracking-wider">
              Findings
            </th>
            <th className="text-left px-4 py-2.5 font-medium text-gh-text-muted text-xs uppercase tracking-wider">
              Breakdown
            </th>
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => (
            <tr
              key={f.file}
              onClick={() => onSelect(f.file)}
              className="border-b border-gh-border-muted last:border-0 hover:bg-gh-surface-2 transition-colors cursor-pointer group"
            >
              <td className="px-4 py-3 font-mono text-xs text-gh-text">{f.file}</td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-semibold border',
                    riskScoreClass(f.riskScore),
                  )}
                >
                  {f.riskScore}
                </span>
              </td>
              <td className="px-4 py-3 text-gh-text-muted">{f.findingCount}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {SEVERITY_ORDER.map((s) => {
                    const n = f.severityBreakdown[s] ?? 0;
                    if (n === 0) return null;
                    return (
                      <span
                        key={s}
                        className={cn(
                          'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-gh-canvas border border-gh-border-muted',
                          SEVERITY_TEXT[s],
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', SEVERITY_DOT[s])} />
                        {n}
                      </span>
                    );
                  })}
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="inline-flex items-center gap-1 text-xs text-gh-text-subtle group-hover:text-gh-blue-muted">
                  View
                  <ChevronRight className="h-3 w-3" />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
