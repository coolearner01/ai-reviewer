'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Search, Filter, Plus, Tag, X } from 'lucide-react';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { useRepositoryPRs } from '@/lib/hooks/useRepositoryPRs';
import { statusPillMeta, reviewBadgeMeta, type PrTab } from '@/components/pr/prBadges';
import { queryKeys } from '@/lib/queryKeys';
import {
  PageHeader,
  Spinner,
  ErrorCard,
  EmptyState,
} from '@/components/shared/PageHeader';
import {
  MultiSelectFilter,
  FilterChip,
  buildCountedOptions,
} from '@/components/shared/MultiSelectFilter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  TopBarActions,
  TopBarBreadcrumb,
} from '@/components/layout/TopBarActions';
import { formatRelative, cn } from '@/lib/utils';
import { prPullPath } from '@/lib/routes';
export default function RepoPullsPage() {
  const { org, repo } = useParams<{ org: string; repo: string }>();
  const [activeTab, setActiveTab] = useState<PrTab>('open');
  const [search, setSearch] = useState('');
  const [authorFilter, setAuthorFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setSearch('');
    setAuthorFilter([]);
    setPage(1);
  }, [activeTab]);

  const { data: orgData, isLoading: orgLoading, error: orgError, refetch } = useOrganization(org);

  const repository = orgData?.repositories.find(
    (r) => r.repoName.toLowerCase() === repo.toLowerCase(),
  );

  const {
    data: prData,
    isLoading: prLoading,
    isFetching: prFetching,
    error: prError,
    refetch: refetchPrs,
  } = useRepositoryPRs(repository?.id, activeTab, {
    sync: activeTab === 'open',
    page,
  });

  const items = prData?.pullRequests ?? [];
  const tabCounts = prData?.counts ?? { open: 0, merged: 0, closed: 0 };
  const pagination = prData?.pagination ?? { page: 1, limit: 10, total: 0, totalPages: 1 };

  const authorOptions = useMemo(
    () => buildCountedOptions(items, ({ pullRequest }) => pullRequest.author),
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // strip a leading "#" so the user can type either "42" or "#42"
    const numericQuery = q.startsWith('#') ? q.slice(1) : q;
    const authorSet = new Set(authorFilter.map((a) => a.toLowerCase()));

    return items.filter(({ pullRequest }) => {
      if (authorSet.size > 0) {
        const author = (pullRequest.author ?? '').toLowerCase();
        if (!authorSet.has(author)) return false;
      }
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
      // numeric-only query → match the PR id even without the `#`
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

  // Keep the page index in range when the total shrinks (e.g. after a sync).
  useEffect(() => {
    if (page > pagination.totalPages) setPage(pagination.totalPages);
  }, [page, pagination.totalPages]);

  if (orgLoading || prLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (orgError || prError) {
    return (
      <div className="px-6 py-8 max-w-4xl mx-auto">
        <ErrorCard
          message={(orgError ?? prError)!.message}
          onRetry={() => {
            refetch();
            refetchPrs();
          }}
        />
      </div>
    );
  }

  if (!orgData) return null;

  return (
    <div className="px-6 py-6 lg:px-8 max-w-6xl mx-auto">
      <TopBarBreadcrumb>
        <nav className="flex items-center gap-1.5 text-[13px] text-gh-text-muted min-w-0">
          <Link
            href={`/organizations/${org}`}
            className="text-gh-blue-muted hover:underline"
          >
            {orgData?.organization.name ?? org}
          </Link>
          <span className="text-gh-text-subtle">/</span>
          <span className="truncate text-gh-text">{repo}</span>
          <span className="text-gh-text-subtle">/</span>
          <span className="truncate text-gh-text">Pull Requests</span>
        </nav>
      </TopBarBreadcrumb>
      <TopBarActions>
        <Button variant="outline" size="sm">
          <Filter className="h-3.5 w-3.5" />
          Filter
        </Button>
        <Button size="sm" asChild>
          <Link href="/review/new">
            <Plus className="h-3.5 w-3.5" />
            New review
          </Link>
        </Button>
      </TopBarActions>

      <PageHeader
        title={repository?.repoName ?? repo}
        description={
          repository
            ? `${repository.repoUrl} — pull requests`
            : `Repository "${repo}" is not connected under organization "${org}".`
        }
      />

      {!repository && (
        <EmptyState
          title="Repository not found"
          description="Add this repository from the organization dashboard."
          action={
            <Link
              href={`/organizations/${org}`}
              className="text-sm font-medium text-gh-blue-muted hover:underline"
            >
              Go to organization →
            </Link>
          }
        />
      )}

      {repository && (
        <>
          <div className="mb-4 flex items-center justify-between">
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
                      {tabCounts[t]}
                    </span>
                  </button>
                );
              })}
            </div>
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
                Showing{' '}
                <span className="font-medium text-gh-text">{filtered.length}</span> of{' '}
                <span className="font-medium text-gh-text">{items.length}</span> {activeTab} PR
                {items.length === 1 ? '' : 's'}
              </span>
              {authorFilter.map((name) => (
                <FilterChip
                  key={name}
                  label="Author"
                  value={name}
                  onRemove={() =>
                    setAuthorFilter((prev) => prev.filter((a) => a !== name))
                  }
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

          {filtered.length === 0 ? (
            filtersActive ? (
              <EmptyState
                title="No matches"
                description={`No ${activeTab} pull requests match your filters.`}
                action={
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-sm font-medium text-gh-blue-muted hover:underline"
                  >
                    Clear filters
                  </button>
                }
              />
            ) : (
              <EmptyState
                title={`No ${activeTab} pull requests`}
                description={
                  activeTab === 'open'
                    ? 'Open PRs are synced from your git provider when you view this tab. If you still see nothing, check that the org API key can read this repo.'
                    : 'Merged and closed PRs appear after a review or after syncing from your git provider on the Open tab.'
                }
              />
            )
          ) : (
            <Card className="overflow-hidden flex flex-col">
              <div className="grid grid-cols-[1fr_120px_120px_110px_70px] gap-4 px-4 py-2 bg-gh-surface-2 border-b border-gh-border text-[11px] uppercase tracking-wider text-gh-text-muted shrink-0">
                <div>Pull request</div>
                <div>Repository</div>
                <div>AI Review</div>
                <div>Checks</div>
                <div>Updated</div>
              </div>
              <div className="h-[540px] overflow-y-auto">
              {filtered.map(({ pullRequest, latestReview }) => {
                const pill = statusPillMeta(pullRequest.state);
                const badge = reviewBadgeMeta(
                  latestReview?.status ?? null,
                  latestReview?.mergeRecommendation ?? null,
                );
                const updatedAt = latestReview?.createdAt ?? pullRequest.createdAt;
                return (
                  <Link
                    key={pullRequest.id}
                    href={prPullPath(org, repo, pullRequest.externalId)}
                    className="grid grid-cols-[1fr_120px_120px_110px_70px] gap-4 items-center px-4 py-3 border-b border-gh-border-muted last:border-b-0 hover:bg-gh-surface-2 transition-colors"
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
                      <p className="mt-1 text-xs text-gh-text-subtle">
                        <span className="font-mono">#{pullRequest.externalId}</span>
                        {' · '}
                        opened {formatRelative(pullRequest.createdAt)} by{' '}
                        <span className="text-gh-blue-muted">{pullRequest.author || 'unknown'}</span>
                      </p>
                    </div>
                    <div>
                      <span className="rounded-full bg-gh-border-muted px-2 py-0.5 text-[11px] text-gh-text-muted truncate max-w-[100px] inline-block">
                        {repo}
                      </span>
                    </div>
                    <div>
                      <span className={badge.cls}>
                        <badge.icon className="h-3 w-3" />
                        {badge.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className={cn(
                            'h-2 w-2 rounded-full',
                            !latestReview
                              ? 'bg-gh-border'
                              : latestReview.status === 'completed'
                                ? latestReview.mergeRecommendation === 'BLOCK_MERGE'
                                  ? i === 0
                                    ? 'bg-[#f85149]'
                                    : 'bg-[#3fb950]'
                                  : 'bg-[#3fb950]'
                                : 'bg-[#e3b341]',
                          )}
                        />
                      ))}
                    </div>
                    <div className="text-xs text-gh-text-subtle">
                      {formatRelative(updatedAt).replace(' ago', '')}
                    </div>
                  </Link>
                );
              })}
              </div>
            </Card>
          )}

          {!filtersActive && pagination.total > 0 && (
            <PaginationFooter
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              busy={prFetching}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            />
          )}
        </>
      )}
    </div>
  );
}

function PaginationFooter({
  page,
  totalPages,
  total,
  limit,
  busy,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  busy: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  return (
    <div className="mt-3 flex items-center justify-between text-xs text-gh-text-muted">
      <span>
        Showing <span className="font-medium text-gh-text">{start}</span>–
        <span className="font-medium text-gh-text">{end}</span> of{' '}
        <span className="font-medium text-gh-text">{total}</span>
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPrev} disabled={page <= 1 || busy}>
          Previous
        </Button>
        <span>
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={page >= totalPages || busy}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
