'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Filter, FolderGit2, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ErrorCard, EmptyState, Spinner } from '@/components/shared/PageHeader';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  TopBarActions,
  TopBarBreadcrumb,
} from '@/components/layout/TopBarActions';
import { useActiveOrg } from '@/lib/hooks/useActiveOrg';
import { repositoriesApi, type PullRequestListItem } from '@/lib/api/repositories';
import { LivePullRequestList } from '@/components/dashboard/LivePullRequestList';
import { RepoPicker } from '@/components/dashboard/RepoPicker';
import { ReviewConfirmDialog } from '@/components/dashboard/ReviewConfirmDialog';

const LAST_REPO_KEY = 'dashboard:lastRepoId';

/**
 * Dashboard = "Pull Requests" page.
 *
 * Flow:
 *   1. Load the user's connected repositories.
 *   2. Repo picker chooses which repo to view; the choice is sticky via
 *      localStorage so reloads land back on the same repo.
 *   3. <LivePullRequestList> fetches PRs from /repositories/:id/pull-requests
 *      (with a one-shot sync=1 the first time it loads, plus a manual Sync
 *      button). Clicking a PR opens a confirmation dialog that kicks off (or
 *      re-runs) the AI review for it.
 */
export default function DashboardPage() {
  const { activeOrg } = useActiveOrg();

  const {
    data: reposData,
    isLoading: reposLoading,
    error: reposError,
    refetch: refetchRepos,
  } = useQuery({
    queryKey: ['repositories'],
    queryFn: () => repositoriesApi.list(),
  });
  const repositories = reposData?.repositories ?? [];

  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  // PR awaiting review confirmation in the modal (null = no modal open).
  const [pendingItem, setPendingItem] = useState<PullRequestListItem | null>(null);

  // Hydrate the last-used repo from localStorage. We can't read it during
  // initial state (we'd hit a hydration mismatch), so we do it once on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(LAST_REPO_KEY);
    if (stored) setSelectedRepoId(stored);
  }, []);

  // When repos load, default to the stored one or the first available, and
  // gracefully recover if the stored repo was deleted.
  useEffect(() => {
    if (repositories.length === 0) {
      if (selectedRepoId !== null) setSelectedRepoId(null);
      return;
    }
    const stillExists =
      selectedRepoId && repositories.some((r) => r.id === selectedRepoId);
    if (!stillExists) {
      setSelectedRepoId(repositories[0].id);
    }
  }, [repositories, selectedRepoId]);

  // Persist any user-driven repo change.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedRepoId) {
      window.localStorage.setItem(LAST_REPO_KEY, selectedRepoId);
    }
  }, [selectedRepoId]);

  const selectedRepo =
    repositories.find((r) => r.id === selectedRepoId) ?? null;

  return (
    <div className="px-6 py-6 lg:px-8 w-full">
      <TopBarBreadcrumb>
        <nav className="flex items-center gap-1.5 text-[13px] text-gh-text-muted min-w-0">
          <Link
            href={activeOrg ? `/organizations/${activeOrg.slug}` : '/organizations'}
            className="text-gh-blue-muted hover:underline"
          >
            {activeOrg?.name ?? 'workspace'}
          </Link>
          <span className="text-gh-text-subtle">/</span>
          <span className="truncate text-gh-text">Pull Requests</span>
          {selectedRepo && (
            <>
              <span className="text-gh-text-subtle">/</span>
              <span className="truncate text-gh-text">{selectedRepo.repoName}</span>
            </>
          )}
        </nav>
      </TopBarBreadcrumb>

      <TopBarActions>
        <Button size="sm" variant="outline" disabled title="Saved filter presets coming soon">
          <Filter className="h-3.5 w-3.5" />
          Filter
        </Button>
        <Button asChild size="sm">
          <Link href="/organizations/new">
            <Plus className="h-3.5 w-3.5" />
            New org
          </Link>
        </Button>
      </TopBarActions>

      {/* Repo picker row */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <RepoPicker
          repositories={repositories}
          selectedId={selectedRepoId}
          onSelect={(repo) => {
            setPendingItem(null);
            setSelectedRepoId(repo.id);
          }}
        />
        {selectedRepo && (
          <a
            href={selectedRepo.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1.5 text-xs text-gh-blue-muted hover:underline truncate max-w-[360px]"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{selectedRepo.repoUrl.replace(/^https?:\/\//, '')}</span>
          </a>
        )}
      </div>

      {reposLoading && (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6" />
        </div>
      )}
      {reposError && (
        <ErrorCard
          message={(reposError as Error).message}
          onRetry={() => refetchRepos()}
        />
      )}

      {!reposLoading && !reposError && repositories.length === 0 && (
        <EmptyState
          title="No repositories connected"
          description="Add a repository to start syncing pull requests from your provider."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button asChild>
                <Link href={activeOrg ? `/organizations/${activeOrg.slug}` : '/organizations'}>
                  <FolderGit2 className="h-3.5 w-3.5" />
                  Add a repository
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/organizations/new">
                  <Plus className="h-3.5 w-3.5" />
                  New organization
                </Link>
              </Button>
            </div>
          }
        />
      )}

      {!reposLoading && !reposError && repositories.length > 0 && (
        <div className="min-w-0">
          <ErrorBoundary>
            {selectedRepo ? (
              <LivePullRequestList
                repository={selectedRepo}
                selectedId={pendingItem?.pullRequest.id ?? null}
                onSelect={setPendingItem}
              />
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-sm text-gh-text-muted">
                  Pick a repository above to see its pull requests.
                </CardContent>
              </Card>
            )}
          </ErrorBoundary>
        </div>
      )}

      {pendingItem && selectedRepo && (
        <ReviewConfirmDialog
          item={pendingItem}
          repository={selectedRepo}
          onClose={() => setPendingItem(null)}
        />
      )}
    </div>
  );
}
