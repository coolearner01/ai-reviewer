'use client';

import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, GitPullRequest, RefreshCw, Search, Tag, X } from 'lucide-react';
import { statusPillMeta, reviewBadgeMeta, type PrTab } from '@/components/pr/prBadges';
import { queryKeys } from '@/lib/queryKeys';
import { repositoriesApi, type PullRequestListItem } from '@/lib/api/repositories';
import {
  buildCountedOptions,
  FilterChip,
  MultiSelectFilter,
} from '@/components/shared/MultiSelectFilter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/shared/PageHeader';
import { cn, formatRelative } from '@/lib/utils';
import type {
  MergeRecommendation,
  PullRequestState,
  RepositoryRecord,
  ReviewStatus,
} from '@/types';

interface LivePullRequestListProps {
  repository: RepositoryRecord;
  selectedId: string | null;
  onSelect: (item: PullRequestListItem | null) => void;
}

/**
 * Live PR list for one repository. Fetches from /repositories/:id/pull-requests
 * which (when `sync=1`) refreshes the local DB from the upstream provider.
 *
 * Designed to be drop-in for the dashboard or any per-repo PR view. The
 * caller controls `selectedId`/`onSelect` so the AI Review side panel
 * can stay in sync.
 */
export function LivePullRequestList({
  repository,
  selectedId,
  onSelect,
}: LivePullRequestListProps) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<PrTab>('open');
  const [search, setSearch] = useState('');
  const [authorFilter, setAuthorFilter] = useState<string[]>([]);
  const [hasSynced, setHasSynced] = useState(false);
  const [page, setPage] = useState(1);

  // Auto-sync on first visit / repo switch so the Open tab isn't blank
  // when the user has never opened this repo in our app before.
  useEffect(() => {
    setHasSynced(false);
    setSearch('');
    setAuthorFilter([]);
    setPage(1);
    onSelect(null);
  }, [repository.id, onSelect]);

  useEffect(() => {
    setSearch('');
    setAuthorFilter([]);
    setPage(1);
  }, [activeTab]);

  // Background sync on first load: only on page 1 of the Open tab. The request
  // returns cached rows immediately and the sync runs server-side.
  const shouldSync = !hasSynced && activeTab === 'open' && page === 1;

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: queryKeys.repositoryPRs(
      repository.id,
      activeTab,
      hasSynced ? 'live' : 'first-load',
      page,
    ),
    queryFn: () =>
      repositoriesApi.listPullRequests(repository.id, {
        state: activeTab,
        sync: shouldSync ? 'async' : undefined,
        page,
      }),
    enabled: Boolean(repository.id),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!hasSynced && data && !isFetching) {
      setHasSynced(true);
    }
  }, [data, hasSynced, isFetching]);

  // The server kicked off a background sync — pull the fresh rows in shortly.
  useEffect(() => {
    if (!data?.syncing) return;
    const t = setTimeout(() => {
      qc.invalidateQueries({ queryKey: ['repository-prs', repository.id, activeTab] });
    }, 4000);
    return () => clearTimeout(t);
  }, [data?.syncing, repository.id, activeTab, qc]);

  const items = useMemo(() => data?.pullRequests ?? [], [data]);
  const counts = data?.counts ?? { open: 0, merged: 0, closed: 0 };
  const pagination = data?.pagination ?? { page: 1, limit: 10, total: 0, totalPages: 1 };

  useEffect(() => {
    if (page > pagination.totalPages) setPage(pagination.totalPages);
  }, [page, pagination.totalPages]);

  const authorOptions = useMemo(
    () => buildCountedOptions(items, ({ pullRequest }) => pullRequest.author),
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const numericQuery = q.startsWith('#') ? q.slice(1) : q;
    const authorSet = new Set(authorFilter.map((a) => a.toLowerCase()));

    return items.filter(({ pullRequest }) => {
      if (authorSet.size > 0 && !authorSet.has((pullRequest.author ?? '').toLowerCase()))
        return false;
      if (!q) return true;
      const haystack = [
        pullRequest.title ?? '',
        pullRequest.author ?? '',
        pullRequest.sourceBranch ?? '',
        pullRequest.targetBranch ?? '',
        `#${pullRequest.externalId}`,
      ]
        .join('\n')
        .toLowerCase();
      if (haystack.includes(q)) return true;
      if (numericQuery && /^\d+$/.test(numericQuery)) {
        return String(pullRequest.externalId) === numericQuery;
      }
      return false;
    });
  }, [items, search, authorFilter]);

  const filtersActive = Boolean(search.trim()) || authorFilter.length > 0;

  const clearFilters = () => {
    setSearch('');
    setAuthorFilter([]);
  };

  const syncNow = async () => {
    // Force a fresh sync on the next fetch by flipping `hasSynced` back so the
    // queryKey changes for one tick. Jump to page 1 so the synced PRs are visible.
    setPage(1);
    setHasSynced(false);
    await qc.invalidateQueries({ queryKey: ['repository-prs', repository.id] });
    await refetch();
    setHasSynced(true);
  };

  return (
    <div className="flex flex-col min-w-0">
      {/* Tabs + sync */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="inline-flex gap-1 rounded-lg border border-gh-border bg-gh-surface-2 p-[3px]">
          {(['open', 'merged', 'closed'] as PrTab[]).map((t) => {
            const meta = statusPillMeta(t);
            const isActive = activeTab === t;
            return (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] transition-colors',
                  isActive
                    ? 'bg-[#1c2c3a] text-[#7ab8f5]'
                    : 'text-gh-text-muted hover:text-gh-text',
                )}
              >
                <meta.icon className="h-3.5 w-3.5" />
                <span className="capitalize">{t}</span>
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[10px]',
                    isActive ? 'bg-[#1a3a5a] text-[#7ab8f5]' : 'bg-gh-surface text-gh-text-muted',
                  )}
                >
                  {counts[t]}
                </span>
              </button>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={syncNow}
          disabled={isFetching}
          title="Re-fetch pull requests from the provider"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
          {isFetching ? 'Syncing…' : 'Sync'}
        </Button>
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        <div className="flex-1 min-w-[240px] flex items-center gap-2 rounded-md border border-gh-border bg-gh-surface px-2.5 py-1.5 focus-within:border-gh-blue focus-within:ring-2 focus-within:ring-ring">
          <Search className="h-3.5 w-3.5 text-gh-text-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, author, branch or #number…"
            className="flex-1 bg-transparent text-[13px] text-gh-text placeholder:text-gh-text-subtle outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="text-gh-text-subtle hover:text-gh-text"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <MultiSelectFilter
          label="Author"
          options={authorOptions}
          selected={authorFilter}
          onChange={setAuthorFilter}
          emptyHint={`No authors in ${activeTab} PRs.`}
        />
        <Button
          variant="outline"
          size="sm"
          disabled
          title="Label filtering will land once labels are synced from your provider."
        >
          <Tag className="h-3 w-3" />
          Label
        </Button>
      </div>

      {filtersActive && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gh-text-muted">
          <span>
            Showing <span className="font-medium text-gh-text">{filtered.length}</span> of{' '}
            <span className="font-medium text-gh-text">{items.length}</span> {activeTab} PR
            {items.length === 1 ? '' : 's'}
          </span>
          {authorFilter.map((name) => (
            <FilterChip
              key={name}
              label="Author"
              value={name}
              onRemove={() => setAuthorFilter((prev) => prev.filter((a) => a !== name))}
            />
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="ml-auto text-gh-blue-muted hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <Card className="flex-1 flex items-center justify-center min-h-[280px]">
          <Spinner className="h-6 w-6" />
        </Card>
      ) : error ? (
        <Card className="flex-1">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <AlertCircle className="h-6 w-6 text-[#f85149]" />
            <p className="text-sm font-medium text-gh-text">Failed to load pull requests</p>
            <p className="text-xs text-gh-text-muted">{(error as Error).message}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="flex-1 flex flex-col">
          <CardContent className="flex-1 flex min-h-[280px] flex-col items-center justify-center gap-2 text-center">
            <GitPullRequest className="h-6 w-6 text-gh-text-subtle" />
            <p className="text-sm font-medium text-gh-text">
              {filtersActive ? 'No matches' : `No ${activeTab} pull requests`}
            </p>
            <p className="text-xs text-gh-text-muted max-w-xs">
              {filtersActive
                ? 'No PRs match your current filters.'
                : activeTab === 'open'
                  ? `No open PRs on ${repository.repoName}. Click Sync to refresh from GitHub.`
                  : `No ${activeTab} PRs on ${repository.repoName}.`}
            </p>
            {filtersActive ? (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-medium text-gh-blue-muted hover:underline"
              >
                Clear filters
              </button>
            ) : (
              <Button variant="outline" size="sm" onClick={syncNow} disabled={isFetching}>
                <RefreshCw className={cn('h-3 w-3', isFetching && 'animate-spin')} />
                Sync from GitHub
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden flex flex-col">
          <div className="grid grid-cols-[1fr_180px_130px_80px] gap-3 px-4 py-2 bg-gh-surface-2 border-b border-gh-border text-[10px] uppercase tracking-[0.06em] text-gh-text-subtle shrink-0">
            <div>Pull request</div>
            <div>Branches</div>
            <div>AI Review</div>
            <div className="text-right">Updated</div>
          </div>
          <div className="h-[500px] overflow-y-auto">
          {filtered.map((item) => {
            const { pullRequest, latestReview } = item;
            const pill = statusPillMeta(pullRequest.state);
            const badge = reviewBadgeMeta(
              latestReview?.status ?? null,
              latestReview?.mergeRecommendation ?? null,
            );
            const isSelected = pullRequest.id === selectedId;
            const updatedAt = latestReview?.createdAt ?? pullRequest.createdAt;
            return (
              <button
                key={pullRequest.id}
                type="button"
                onClick={() => onSelect(item)}
                className={cn(
                  'grid grid-cols-[1fr_180px_130px_80px] gap-3 items-center px-4 py-3 w-full text-left border-b border-gh-border-muted last:border-b-0 transition-colors',
                  isSelected
                    ? 'bg-gh-blue/10 hover:bg-gh-blue/15'
                    : 'hover:bg-gh-surface-2',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={pill.cls}>
                      <pill.icon className="h-3 w-3" />
                      {pill.label}
                    </span>
                    <span className="truncate text-[13px] font-medium text-gh-text">
                      {pullRequest.title || `PR #${pullRequest.externalId}`}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gh-text-subtle truncate">
                    <span className="font-mono">#{pullRequest.externalId}</span>
                    {' · '}
                    opened {formatRelative(pullRequest.createdAt)} by{' '}
                    <span className="text-gh-blue-muted">
                      {pullRequest.author || 'unknown'}
                    </span>
                  </p>
                </div>
                <div className="text-[11px] text-gh-text-muted truncate" title={`${pullRequest.sourceBranch} → ${pullRequest.targetBranch}`}>
                  <span className="font-mono truncate">{pullRequest.sourceBranch}</span>
                  <span className="mx-1 text-gh-text-subtle">→</span>
                  <span className="font-mono truncate">{pullRequest.targetBranch}</span>
                </div>
                <div>
                  <span className={badge.cls}>
                    <badge.icon className="h-3 w-3" />
                    {badge.label}
                  </span>
                </div>
                <div className="text-xs text-gh-text-subtle truncate text-right">
                  {formatRelative(updatedAt).replace('about ', '').replace(' ago', '')}
                </div>
              </button>
            );
          })}
          </div>
        </Card>
      )}

      {!filtersActive && pagination.total > 0 && (
        <div className="mt-3 flex items-center justify-between text-xs text-gh-text-muted">
          <span>
            Showing{' '}
            <span className="font-medium text-gh-text">
              {pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}
            </span>
            –
            <span className="font-medium text-gh-text">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{' '}
            of <span className="font-medium text-gh-text">{pagination.total}</span>
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1 || isFetching}
            >
              Previous
            </Button>
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages || isFetching}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
