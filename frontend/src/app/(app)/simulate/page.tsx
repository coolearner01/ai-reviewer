'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowRight,
  ExternalLink,
  GitPullRequest,
  Link2,
  RefreshCw,
  Search,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { PageHeader, Spinner, EmptyState } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useActiveOrg } from '@/lib/hooks/useActiveOrg';
import { organizationsApi } from '@/lib/api/organizations';
import { repositoriesApi, type PullRequestListItem } from '@/lib/api/repositories';
import { simulateApi } from '@/lib/api/simulate';
import { cn, formatRelative } from '@/lib/utils';

type SourceMode = 'github' | 'url';

/**
 * Dev-friendly "Simulate PR" page. Lets the user trigger a full review run
 * exactly the way an inbound webhook would — useful for demos and local
 * environments where no real provider events are arriving.
 *
 * The page has two source modes:
 *  - **From GitHub** (default): list open PRs for the selected repo and pick one.
 *  - **Custom URL / synthetic**: paste any PR URL, or leave blank for a fake id.
 */
export default function SimulatePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { organizations, activeOrg, setActiveOrgId } = useActiveOrg();

  const [orgId, setOrgId] = useState<string | null>(null);
  const [repoId, setRepoId] = useState<string>('');
  const [mode, setMode] = useState<SourceMode>('github');
  const [selectedPrUrl, setSelectedPrUrl] = useState<string>('');
  const [customUrl, setCustomUrl] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!orgId && activeOrg) setOrgId(activeOrg.id);
  }, [activeOrg, orgId]);

  const selectedOrg = useMemo(
    () => organizations.find((o) => o.id === orgId) ?? null,
    [organizations, orgId],
  );

  const reposQuery = useQuery({
    queryKey: ['organization', selectedOrg?.slug],
    queryFn: () => organizationsApi.getBySlug(selectedOrg!.slug),
    enabled: Boolean(selectedOrg?.slug),
  });

  const repos = reposQuery.data?.repositories ?? [];
  const selectedRepo = useMemo(
    () => repos.find((r) => r.id === repoId) ?? null,
    [repos, repoId],
  );

  useEffect(() => {
    if (repos.length > 0 && !repos.some((r) => r.id === repoId)) {
      setRepoId(repos[0].id);
    }
  }, [repos, repoId]);

  // Reset PR selection when repo changes.
  useEffect(() => {
    setSelectedPrUrl('');
    setSearch('');
  }, [repoId]);

  // Live PR list for the selected repo. Sync=true on first load per repo so
  // the user doesn't see a stale or empty list.
  const prsQuery = useQuery({
    queryKey: ['simulate-prs', repoId],
    queryFn: () =>
      repositoriesApi.listPullRequests(repoId, { state: 'open', sync: true, limit: 50 }),
    enabled: Boolean(repoId) && mode === 'github',
    staleTime: 30_000,
  });

  const prs = useMemo<PullRequestListItem[]>(
    () => prsQuery.data?.pullRequests ?? [],
    [prsQuery.data],
  );

  const filteredPrs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return prs;
    const numericQuery = q.startsWith('#') ? q.slice(1) : q;
    return prs.filter(({ pullRequest }) => {
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
  }, [prs, search]);

  const fire = useMutation({
    mutationFn: () =>
      simulateApi.fire({
        organizationId: orgId!,
        repositoryId: repoId || undefined,
        pullRequestUrl: resolvePrUrl(mode, selectedPrUrl, customUrl),
      }),
    onSuccess: (res) => {
      toast.success(
        res.simulated
          ? 'Simulated PR queued for review'
          : 'Review queued — running on the real PR',
      );
      void qc.invalidateQueries({ queryKey: ['reviews'] });
      router.push(`/review/${res.reviewId}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canFire = (() => {
    if (!orgId || fire.isPending) return false;
    if (mode === 'github') return Boolean(selectedPrUrl) || prs.length === 0;
    return true;
  })();

  const fireLabel = (() => {
    if (fire.isPending) return 'Firing webhook…';
    if (mode === 'github' && selectedPrUrl) return 'Fire webhook → review this PR';
    if (mode === 'url' && customUrl.trim()) return 'Fire webhook → review pasted PR';
    return 'Fire webhook → run synthetic review';
  })();

  if (organizations.length === 0) {
    return (
      <div className="px-6 py-6 lg:px-8">
        <PageHeader
          title="Simulate PR"
          description="Trigger an end-to-end AI review without waiting for a real webhook."
        />
        <EmptyState
          title="No organizations yet"
          description="Create an organization first — Simulate PR fires a webhook against one of its repos."
          action={
            <Button onClick={() => router.push('/organizations/new')}>
              Create organization
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="px-6 py-6 lg:px-8 space-y-5">
      <PageHeader
        title="Simulate PR"
        description="Fires a realistic webhook event against the selected org/repo and auto-triggers the AI review engine."
      />

      <Card>
        <CardHeader className="border-b border-gh-border-muted">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-gh-yellow" />
            Webhook payload
          </CardTitle>
          <p className="text-xs text-gh-text-muted">
            Pick where to run the review and which PR to feed it. Real PRs are
            fetched live — title, author and diff come straight from the provider.
          </p>
        </CardHeader>

        <CardContent className="space-y-6 pt-5">
          {/* Org + repo: side-by-side on lg, stacked on smaller widths. */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5">
            <div>
              <Label className="text-xs uppercase tracking-wider text-gh-text-muted">
                Organization
              </Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => {
                      setOrgId(org.id);
                      setActiveOrgId(org.id);
                    }}
                    className={cn(
                      'group inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors',
                      org.id === orgId
                        ? 'border-gh-blue bg-gh-blue/10 text-gh-blue-muted'
                        : 'border-gh-border bg-gh-surface text-gh-text-muted hover:border-gh-text-subtle hover:text-gh-text',
                    )}
                  >
                    <span className="font-medium">{org.name}</span>
                    <span className="rounded-sm bg-gh-border/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-gh-text-subtle">
                      {org.provider}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label
                htmlFor="repo"
                className="text-xs uppercase tracking-wider text-gh-text-muted"
              >
                Repository
              </Label>
              {reposQuery.isLoading ? (
                <div className="mt-2"><Spinner /></div>
              ) : repos.length === 0 ? (
                <p className="mt-2 text-xs text-gh-text-muted">
                  No repos in this organization yet. Add one from the org page.
                </p>
              ) : (
                <select
                  id="repo"
                  value={repoId}
                  onChange={(e) => setRepoId(e.target.value)}
                  className="mt-2 w-full rounded-md border border-gh-border bg-gh-surface px-3 py-2 text-sm text-gh-text focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {repos.map((repo) => (
                    <option key={repo.id} value={repo.id}>
                      {repo.repoName}
                      {repo.language ? ` · ${repo.language}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="h-px bg-gh-border-muted" />

          {/* PR source mode */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as SourceMode)}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <Label className="text-xs uppercase tracking-wider text-gh-text-muted">
                  Pull request
                </Label>
                <p className="mt-1 text-xs text-gh-text-subtle">
                  {mode === 'github'
                    ? 'Pick one of the live open PRs on this repo.'
                    : 'Paste any PR URL, or leave blank to run on a synthetic PR id.'}
                </p>
              </div>
              <TabsList>
                <TabsTrigger value="github" className="gap-1.5">
                  <GitPullRequest className="h-3.5 w-3.5" />
                  From GitHub
                </TabsTrigger>
                <TabsTrigger value="url" className="gap-1.5">
                  <Link2 className="h-3.5 w-3.5" />
                  URL / synthetic
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="github" className="mt-4">
              <LivePrPicker
                items={filteredPrs}
                totalCount={prs.length}
                isLoading={prsQuery.isLoading}
                isFetching={prsQuery.isFetching}
                error={prsQuery.error as Error | null}
                onRefetch={() => void prsQuery.refetch()}
                selectedPrUrl={selectedPrUrl}
                onSelect={setSelectedPrUrl}
                search={search}
                onSearch={setSearch}
                repoEmpty={!selectedRepo}
              />
            </TabsContent>

            <TabsContent value="url" className="mt-4 space-y-2">
              <Input
                id="customUrl"
                placeholder="https://github.com/org/repo/pull/142"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                data-1p-ignore
                data-lpignore="true"
                name="simulate-pr-url"
              />
              <p className="text-xs text-gh-text-muted">
                Leave blank to generate a synthetic PR id (review will fail at the
                fetch step with a clear error — useful for testing the pipeline
                without a real PR).
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-md border border-gh-border bg-gh-surface px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-gh-text-muted">
          <Sparkles className="h-3.5 w-3.5 text-gh-yellow" />
          <span>
            {mode === 'github' && selectedPrUrl
              ? 'Real PR selected — the review pipeline will fetch its diff from GitHub.'
              : mode === 'url' && customUrl.trim()
                ? 'Custom URL — the review pipeline will fetch its diff from the provider.'
                : 'No PR selected — a synthetic id will be used.'}
          </span>
        </div>
        <Button
          onClick={() => fire.mutate()}
          disabled={!canFire}
          className="w-full sm:w-auto sm:min-w-[280px]"
        >
          <GitPullRequest className="h-3.5 w-3.5" />
          {fireLabel}
        </Button>
      </div>
    </div>
  );
}

function resolvePrUrl(
  mode: SourceMode,
  selectedPrUrl: string,
  customUrl: string,
): string | undefined {
  if (mode === 'github') return selectedPrUrl || undefined;
  return customUrl.trim() || undefined;
}

interface LivePrPickerProps {
  items: PullRequestListItem[];
  totalCount: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  onRefetch: () => void;
  selectedPrUrl: string;
  onSelect: (url: string) => void;
  search: string;
  onSearch: (q: string) => void;
  repoEmpty: boolean;
}

function LivePrPicker({
  items,
  totalCount,
  isLoading,
  isFetching,
  error,
  onRefetch,
  selectedPrUrl,
  onSelect,
  search,
  onSearch,
  repoEmpty,
}: LivePrPickerProps) {
  if (repoEmpty) {
    return (
      <div className="rounded-md border border-dashed border-gh-border-muted px-4 py-8 text-center text-xs text-gh-text-muted">
        Pick a repository above to load its open PRs.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-md border border-gh-border-muted px-4 py-10 flex items-center justify-center">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-gh-border-muted px-4 py-8 text-center space-y-2">
        <AlertCircle className="mx-auto h-5 w-5 text-[#f85149]" />
        <p className="text-sm font-medium text-gh-text">Couldn&apos;t load PRs</p>
        <p className="text-xs text-gh-text-muted">{error.message}</p>
        <Button variant="outline" size="sm" onClick={onRefetch}>
          <RefreshCw className="h-3 w-3" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 rounded-md border border-gh-border bg-gh-surface px-2.5 py-1.5 focus-within:border-gh-blue focus-within:ring-2 focus-within:ring-ring">
          <Search className="h-3.5 w-3.5 text-gh-text-subtle" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search by title, author, branch or #number…"
            className="flex-1 bg-transparent text-[13px] text-gh-text placeholder:text-gh-text-subtle outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearch('')}
              className="text-gh-text-subtle hover:text-gh-text"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefetch}
          disabled={isFetching}
          title="Re-fetch open PRs from the provider"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
          {isFetching ? 'Syncing…' : 'Sync'}
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-gh-border-muted px-4 py-8 text-center text-xs text-gh-text-muted">
          {totalCount === 0
            ? 'No open PRs on this repo. Click Sync or switch to URL / synthetic mode.'
            : 'No PRs match your search.'}
        </div>
      ) : (
        <div className="max-h-[420px] overflow-y-auto rounded-md border border-gh-border-muted divide-y divide-gh-border-muted">
          {items.map(({ pullRequest }) => {
            const isSelected = pullRequest.prUrl === selectedPrUrl;
            return (
              <button
                key={pullRequest.id}
                type="button"
                onClick={() => onSelect(pullRequest.prUrl)}
                className={cn(
                  'w-full text-left px-4 py-3 flex items-start gap-3 transition-colors',
                  isSelected
                    ? 'bg-gh-blue/10 hover:bg-gh-blue/15'
                    : 'hover:bg-gh-surface-2',
                )}
              >
                <span
                  className={cn(
                    'mt-1 inline-flex h-4 w-4 flex-none items-center justify-center rounded-full border',
                    isSelected
                      ? 'border-gh-blue bg-gh-blue'
                      : 'border-gh-border bg-gh-canvas',
                  )}
                >
                  {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <GitPullRequest className="h-3.5 w-3.5 flex-none text-[#3fb950]" />
                    <span className="truncate text-[13px] font-medium text-gh-text">
                      {pullRequest.title || `PR #${pullRequest.externalId}`}
                    </span>
                    <a
                      href={pullRequest.prUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-gh-text-subtle hover:text-gh-text"
                      title="Open on provider"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <p className="mt-1 text-xs text-gh-text-subtle truncate">
                    <span className="font-mono">#{pullRequest.externalId}</span>
                    {' · '}
                    opened {formatRelative(pullRequest.createdAt)} by{' '}
                    <span className="text-gh-blue-muted">
                      {pullRequest.author || 'unknown'}
                    </span>
                    {' · '}
                    <span className="font-mono">{pullRequest.sourceBranch}</span>
                    <span className="mx-1 text-gh-text-subtle">→</span>
                    <span className="font-mono">{pullRequest.targetBranch}</span>
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
