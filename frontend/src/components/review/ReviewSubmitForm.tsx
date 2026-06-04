'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { reviewsApi } from '@/lib/api/reviews';
import { organizationsApi } from '@/lib/api/organizations';
import { Spinner } from '@/components/shared/PageHeader';
import { useActiveOrg } from '@/lib/hooks/useActiveOrg';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Building2, GitBranch, Link as LinkIcon } from 'lucide-react';
import type { AgentType, OrganizationRecord, RepositoryRecord, ReviewDepth } from '@/types';

const FOCUS_OPTIONS: { value: AgentType; label: string }[] = [
  { value: 'security', label: 'Security' },
  { value: 'performance', label: 'Performance' },
  { value: 'architecture', label: 'Architecture' },
  { value: 'concurrency', label: 'Concurrency' },
  { value: 'database', label: 'Database' },
  { value: 'test_quality', label: 'Tests' },
  { value: 'api_contract', label: 'API Contract' },
  { value: 'business_logic', label: 'Business Logic' },
];

function detectProvider(url: string): string | null {
  if (/github\.com/i.test(url)) return 'GitHub';
  if (/gitlab\.com/i.test(url)) return 'GitLab';
  if (/bitbucket\.org/i.test(url)) return 'Bitbucket';
  return null;
}

/**
 * Build a full PR URL from a repo + a "pr ref" (either a full URL or just a
 * numeric PR id like "42").
 */
function resolvePrUrl(repo: RepositoryRecord, prRef: string): string {
  const trimmed = prRef.trim();
  if (!trimmed) return '';
  // Already a full URL? Use as-is.
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Numeric id → construct provider-specific URL.
  const base = repo.repoUrl.replace(/\/$/, '');
  if (!/^\d+$/.test(trimmed)) return trimmed; // unknown format — let backend validate
  switch (repo.provider) {
    case 'gitlab':
      return `${base}/-/merge_requests/${trimmed}`;
    case 'bitbucket':
      return `${base}/pull-requests/${trimmed}`;
    default:
      return `${base}/pull/${trimmed}`;
  }
}

/**
 * If a full PR URL was pasted, try to match it to a repo from the org so the
 * dropdown can auto-select. Returns null when no repo matches.
 */
function findRepoForUrl(repos: RepositoryRecord[], url: string): RepositoryRecord | null {
  if (!/^https?:\/\//i.test(url)) return null;
  const lower = url.toLowerCase();
  return (
    repos.find((r) => lower.startsWith(r.repoUrl.toLowerCase().replace(/\/$/, ''))) ?? null
  );
}

export function ReviewSubmitForm({ defaultPrUrl }: { defaultPrUrl?: string }) {
  const router = useRouter();
  const { organizations, activeOrg, setActiveOrgId, isLoading: orgsLoading } = useActiveOrg();

  const [mode, setMode] = useState<'guided' | 'custom'>('guided');
  const [orgId, setOrgId] = useState<string>('');
  const [repoId, setRepoId] = useState<string>('');
  const [prRef, setPrRef] = useState(defaultPrUrl ?? '');

  // Custom-URL fallback fields.
  const [customRepoUrl, setCustomRepoUrl] = useState('');
  const [customPrUrl, setCustomPrUrl] = useState(defaultPrUrl ?? '');

  const [reviewDepth, setReviewDepth] = useState<ReviewDepth>('standard');
  const [customPrompt, setCustomPrompt] = useState('');
  const [focusAreas, setFocusAreas] = useState<AgentType[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Keep the form's orgId in sync with the global active org.
  useEffect(() => {
    if (!orgId && activeOrg) setOrgId(activeOrg.id);
  }, [activeOrg, orgId]);

  const selectedOrg = useMemo<OrganizationRecord | null>(
    () => organizations.find((o) => o.id === orgId) ?? null,
    [organizations, orgId],
  );

  const reposQuery = useQuery({
    queryKey: ['organization', selectedOrg?.slug],
    queryFn: () => organizationsApi.getBySlug(selectedOrg!.slug),
    enabled: Boolean(selectedOrg?.slug),
  });
  const repos = reposQuery.data?.repositories ?? [];

  // Default the repo dropdown to the first repo whenever the list changes.
  useEffect(() => {
    if (repos.length === 0) {
      if (repoId) setRepoId('');
      return;
    }
    if (!repos.some((r) => r.id === repoId)) {
      setRepoId(repos[0].id);
    }
  }, [repos, repoId]);

  // When the user pastes a full PR URL that matches one of the org's repos,
  // auto-snap the dropdown — saves a click and gives instant visual feedback.
  useEffect(() => {
    if (mode !== 'guided') return;
    const match = findRepoForUrl(repos, prRef);
    if (match && match.id !== repoId) setRepoId(match.id);
  }, [prRef, repos, repoId, mode]);

  const selectedRepo = useMemo<RepositoryRecord | null>(
    () => repos.find((r) => r.id === repoId) ?? null,
    [repos, repoId],
  );

  const resolvedPrUrl = selectedRepo ? resolvePrUrl(selectedRepo, prRef) : '';
  const provider =
    mode === 'guided'
      ? selectedRepo
        ? detectProvider(selectedRepo.repoUrl) ??
          selectedRepo.provider.charAt(0).toUpperCase() + selectedRepo.provider.slice(1)
        : null
      : detectProvider(customPrUrl);

  const guidedReady = Boolean(selectedRepo && resolvedPrUrl && /^https?:\/\//i.test(resolvedPrUrl));
  const customReady =
    /^https?:\/\//i.test(customRepoUrl) && /^https?:\/\//i.test(customPrUrl);
  const canSubmit = mode === 'guided' ? guidedReady : customReady;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload =
        mode === 'guided'
          ? {
              repositoryUrl: selectedRepo!.repoUrl,
              pullRequestUrl: resolvedPrUrl,
            }
          : {
              repositoryUrl: customRepoUrl.trim(),
              pullRequestUrl: customPrUrl.trim(),
            };
      const res = await reviewsApi.submit({
        ...payload,
        reviewDepth,
        customPrompt: customPrompt.trim() || undefined,
        focusAreas: focusAreas.length ? focusAreas : undefined,
      });
      toast.success('Review started');
      router.push(`/review/${res.reviewId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start review');
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Empty / loading states for the guided path
  // -------------------------------------------------------------------------
  const noOrgs = !orgsLoading && organizations.length === 0;

  return (
    <form onSubmit={onSubmit} className="space-y-5 w-full">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>PR Details</CardTitle>
          <button
            type="button"
            onClick={() => setMode(mode === 'guided' ? 'custom' : 'guided')}
            className="text-xs text-gh-blue-muted hover:underline whitespace-nowrap"
          >
            {mode === 'guided' ? 'Use custom URLs instead' : 'Pick from my organizations'}
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === 'guided' ? (
            <GuidedFields
              organizations={organizations}
              orgId={orgId}
              onOrgChange={(id) => {
                setOrgId(id);
                setActiveOrgId(id);
              }}
              repos={repos}
              reposLoading={reposQuery.isLoading}
              repoId={repoId}
              onRepoChange={setRepoId}
              prRef={prRef}
              onPrRefChange={setPrRef}
              selectedRepo={selectedRepo}
              resolvedPrUrl={resolvedPrUrl}
              provider={provider}
              noOrgs={noOrgs}
            />
          ) : (
            <CustomFields
              repoUrl={customRepoUrl}
              onRepoUrlChange={setCustomRepoUrl}
              prUrl={customPrUrl}
              onPrUrlChange={setCustomPrUrl}
              provider={provider}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Review Depth</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {(['light', 'standard', 'deep'] as ReviewDepth[]).map((depth) => (
              <button
                key={depth}
                type="button"
                onClick={() => setReviewDepth(depth)}
                className={cn(
                  'flex-1 rounded-md border px-4 py-2 text-sm capitalize transition-colors',
                  reviewDepth === depth
                    ? 'border-gh-blue bg-gh-blue/10 text-gh-blue-muted'
                    : 'border-gh-border bg-gh-surface text-gh-text-muted hover:border-gh-text-subtle hover:text-gh-text',
                )}
              >
                {depth}
              </button>
            ))}
          </div>
          <p className="text-xs text-gh-text-muted mt-3">
            Light = 3 agents · Standard = all 10 · Deep = all 10 + extended context
          </p>
        </CardContent>
      </Card>

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-sm text-gh-blue-muted hover:underline"
      >
        {showAdvanced ? 'Hide' : 'Show'} advanced options
      </button>

      {showAdvanced && (
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div>
              <Label htmlFor="customPrompt">Custom Instructions</Label>
              <textarea
                id="customPrompt"
                rows={4}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-gh-border bg-gh-surface px-3 py-2 text-sm text-gh-text placeholder:text-gh-text-subtle focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Focus on database transaction safety…"
              />
            </div>
            <div>
              <Label>Focus Areas</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {FOCUS_OPTIONS.map(({ value, label }) => (
                  <label
                    key={value}
                    className="flex items-center gap-2 text-sm text-gh-text"
                  >
                    <input
                      type="checkbox"
                      checked={focusAreas.includes(value)}
                      onChange={(e) =>
                        setFocusAreas((prev) =>
                          e.target.checked
                            ? [...prev, value]
                            : prev.filter((v) => v !== value),
                        )
                      }
                      className="accent-gh-blue"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Button type="submit" disabled={submitting || !canSubmit} className="w-full">
        {submitting ? <Spinner /> : 'Start AI Review →'}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Guided mode: org picker + repo dropdown + smart PR input
// ---------------------------------------------------------------------------

function GuidedFields({
  organizations,
  orgId,
  onOrgChange,
  repos,
  reposLoading,
  repoId,
  onRepoChange,
  prRef,
  onPrRefChange,
  selectedRepo,
  resolvedPrUrl,
  provider,
  noOrgs,
}: {
  organizations: OrganizationRecord[];
  orgId: string;
  onOrgChange: (id: string) => void;
  repos: RepositoryRecord[];
  reposLoading: boolean;
  repoId: string;
  onRepoChange: (id: string) => void;
  prRef: string;
  onPrRefChange: (v: string) => void;
  selectedRepo: RepositoryRecord | null;
  resolvedPrUrl: string;
  provider: string | null;
  noOrgs: boolean;
}) {
  if (noOrgs) {
    return (
      <div className="rounded-md border border-dashed border-gh-border bg-gh-surface/40 p-5 text-sm text-gh-text-muted">
        You don&apos;t have any organizations yet. Create one to start reviewing PRs from your
        repos.{' '}
        <a href="/organizations/new" className="text-gh-blue-muted hover:underline">
          Create organization →
        </a>
      </div>
    );
  }

  return (
    <>
      <div>
        <Label className="flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" />
          Organization
        </Label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {organizations.map((org) => (
            <button
              key={org.id}
              type="button"
              onClick={() => onOrgChange(org.id)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm transition-colors',
                org.id === orgId
                  ? 'border-gh-blue bg-gh-blue/10 text-gh-blue-muted'
                  : 'border-gh-border bg-gh-surface text-gh-text-muted hover:border-gh-text-subtle hover:text-gh-text',
              )}
            >
              {org.name}
              <span className="ml-2 text-[10px] uppercase text-gh-text-subtle">
                {org.provider}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="repo" className="flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5" />
          Repository
        </Label>
        {reposLoading ? (
          <div className="mt-1.5">
            <Spinner />
          </div>
        ) : repos.length === 0 ? (
          <p className="mt-1.5 text-xs text-gh-text-muted">
            No repos in this organization yet.{' '}
            <a
              href={orgId ? `/organizations/${organizations.find((o) => o.id === orgId)?.slug ?? ''}` : '/organizations'}
              className="text-gh-blue-muted hover:underline"
            >
              Add one →
            </a>
          </p>
        ) : (
          <select
            id="repo"
            value={repoId}
            onChange={(e) => onRepoChange(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-gh-border bg-gh-surface px-3 py-2 text-sm text-gh-text focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {repos.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.orgOrWorkspace}/{repo.repoName}
                {repo.language ? ` · ${repo.language}` : ''}
              </option>
            ))}
          </select>
        )}
        {selectedRepo && (
          <p className="mt-1.5 text-xs text-gh-text-muted font-mono break-all">
            {selectedRepo.repoUrl}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="prRef" className="flex items-center gap-1.5">
          <LinkIcon className="h-3.5 w-3.5" />
          Pull Request
        </Label>
        <Input
          id="prRef"
          placeholder="42  or  https://github.com/org/repo/pull/42"
          value={prRef}
          onChange={(e) => onPrRefChange(e.target.value)}
          className="mt-1.5"
        />
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {provider && (
            <Badge variant="default">
              {provider} ✓
            </Badge>
          )}
          {selectedRepo && resolvedPrUrl && resolvedPrUrl !== prRef && (
            <span className="text-xs text-gh-text-muted font-mono break-all">
              → {resolvedPrUrl}
            </span>
          )}
          {!resolvedPrUrl && prRef && (
            <span className="text-xs text-[#e3b341]">
              Enter a PR number (e.g. <code className="font-mono">42</code>) or a full PR URL.
            </span>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Custom mode: legacy two-URL fields (kept as an escape hatch)
// ---------------------------------------------------------------------------

function CustomFields({
  repoUrl,
  onRepoUrlChange,
  prUrl,
  onPrUrlChange,
  provider,
}: {
  repoUrl: string;
  onRepoUrlChange: (v: string) => void;
  prUrl: string;
  onPrUrlChange: (v: string) => void;
  provider: string | null;
}) {
  return (
    <>
      <div>
        <Label htmlFor="repositoryUrl">Repository URL</Label>
        <Input
          id="repositoryUrl"
          placeholder="https://github.com/org/repo"
          className="mt-1.5"
          value={repoUrl}
          onChange={(e) => onRepoUrlChange(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="pullRequestUrl">Pull Request URL</Label>
        <Input
          id="pullRequestUrl"
          placeholder="https://github.com/org/repo/pull/42"
          className="mt-1.5"
          value={prUrl}
          onChange={(e) => onPrUrlChange(e.target.value)}
        />
        {provider && (
          <Badge variant="default" className="mt-2">
            {provider} detected ✓
          </Badge>
        )}
      </div>
    </>
  );
}
