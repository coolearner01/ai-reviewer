'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, FolderGit2, Plus, RefreshCw, Trash2, Zap } from 'lucide-react';
import { organizationsApi } from '@/lib/api/organizations';
import { reviewsApi } from '@/lib/api/reviews';
import { SetupGuide } from '@/components/organizations/SetupGuide';
import { OrganizationSettingsForm } from '@/components/organizations/OrganizationSettingsForm';
import { RepositoryCombobox } from '@/components/organizations/RepositoryCombobox';
import {
  PageHeader,
  Spinner,
  ErrorCard,
  EmptyState,
} from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatRelative, mergeColors, riskScoreClass, cn } from '@/lib/utils';
import { orgPullsPath, prPullPath } from '@/lib/routes';

const LANGUAGE_OPTIONS = [
  '',
  'TypeScript',
  'JavaScript',
  'Python',
  'Go',
  'Rust',
  'Java',
  'Kotlin',
  'Swift',
  'Ruby',
  'PHP',
  'C#',
  'C++',
  'Other',
];

export default function OrganizationDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const qc = useQueryClient();

  const [repoInput, setRepoInput] = useState('');
  const [repoBranch, setRepoBranch] = useState('main');
  const [repoLanguage, setRepoLanguage] = useState('');
  const [showWebhook, setShowWebhook] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['organization', slug],
    queryFn: () => organizationsApi.getBySlug(slug),
    enabled: Boolean(slug),
  });

  const { data: setupData } = useQuery({
    queryKey: ['organization-setup', data?.organization.id],
    queryFn: () => organizationsApi.get(data!.organization.id),
    enabled: Boolean(data?.organization.id) && showWebhook,
  });

  const { data: reviewsData } = useQuery({
    queryKey: ['reviews', 'org', slug],
    queryFn: () => reviewsApi.list({ limit: 50 }),
    enabled: Boolean(data?.organization.id),
  });

  const addRepo = useMutation({
    mutationFn: () =>
      organizationsApi.addRepository(data!.organization.id, {
        repoIdentifier: repoInput.trim(),
        defaultBranch: repoBranch.trim() || undefined,
        language: repoLanguage.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Repository added');
      setRepoInput('');
      setRepoBranch('main');
      setRepoLanguage('');
      void qc.invalidateQueries({ queryKey: ['organization', slug] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rotateWebhook = useMutation({
    mutationFn: () => organizationsApi.rotateWebhook(data!.organization.id),
    onSuccess: (res) => {
      toast.success('Webhook secret rotated — update your provider');
      qc.setQueryData(['organization-setup', data!.organization.id], {
        organization: data!.organization,
        setupGuide: res.setupGuide,
      });
      setShowWebhook(true);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeOrg = useMutation({
    mutationFn: () => organizationsApi.remove(data!.organization.id),
    onSuccess: () => {
      toast.success('Organization removed');
      window.location.href = '/organizations';
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <ErrorCard message={error.message} onRetry={() => refetch()} />
      </div>
    );
  }
  if (!data) return null;

  const { organization, repositories } = data;
  const repoIds = new Set(repositories.map((r) => r.id));
  const orgReviews =
    reviewsData?.reviews.filter((r) => repoIds.has(r.repository.id)) ?? [];

  const providerLabel =
    organization.provider.charAt(0).toUpperCase() + organization.provider.slice(1);

  return (
    <div className="px-6 py-6 lg:px-8 max-w-7xl mx-auto">
      <Link
        href="/organizations"
        className="inline-flex items-center gap-1 text-sm text-gh-text-muted hover:text-gh-text mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Organizations
      </Link>

      <PageHeader
        title={organization.name}
        description={`${providerLabel} · API key ${organization.apiKeyMasked} · webhook configured per repo below`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/simulate">
                <Zap className="h-3.5 w-3.5" />
                Simulate PR
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowWebhook((v) => !v)}>
              {showWebhook ? 'Hide' : 'Show'} webhook setup
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => rotateWebhook.mutate()}
              disabled={rotateWebhook.isPending}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Rotate secret
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-[#f85149] border-gh-red/50 hover:bg-gh-red/10"
              onClick={() => {
                if (confirm('Delete this organization? Repositories will be unlinked.')) {
                  removeOrg.mutate();
                }
              }}
              disabled={removeOrg.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        }
      />

      {showWebhook && setupData?.setupGuide && (
        <div className="mb-8">
          <SetupGuide guide={setupData.setupGuide} secretIsNew={rotateWebhook.isSuccess} />
        </div>
      )}

      <Tabs defaultValue="repos">
        <TabsList>
          <TabsTrigger value="repos">Repositories ({repositories.length})</TabsTrigger>
          <TabsTrigger value="reviews">Recent reviews ({orgReviews.length})</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="repos">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Add repository</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gh-text-muted">
                Enter a repo name (e.g.{' '}
                <code className="text-xs bg-gh-border-muted px-1.5 py-0.5 rounded font-mono text-gh-text">
                  my-app
                </code>
                ) or{' '}
                <code className="text-xs bg-gh-border-muted px-1.5 py-0.5 rounded font-mono text-gh-text">
                  owner/repo
                </code>
                . The {providerLabel} base URL is inherited from this organization.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_auto] gap-2">
                <RepositoryCombobox
                  organizationId={data?.organization.id}
                  value={repoInput}
                  onChange={setRepoInput}
                  onSelect={(repo) => {
                    if (repo.defaultBranch) setRepoBranch(repo.defaultBranch);
                    if (repo.language && LANGUAGE_OPTIONS.includes(repo.language)) {
                      setRepoLanguage(repo.language);
                    }
                  }}
                />
                <Input
                  placeholder="main"
                  value={repoBranch}
                  onChange={(e) => setRepoBranch(e.target.value)}
                />
                <select
                  value={repoLanguage}
                  onChange={(e) => setRepoLanguage(e.target.value)}
                  className="rounded-md border border-gh-border bg-gh-surface px-3 py-2 text-sm text-gh-text focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt || 'unspecified'} value={opt}>
                      {opt || 'Language…'}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={() => addRepo.mutate()}
                  disabled={!repoInput.trim() || addRepo.isPending}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gh-text-muted">
                <Label className="text-[11px] uppercase tracking-wider">Identifier</Label>
                <Label className="text-[11px] uppercase tracking-wider">Default branch</Label>
                <Label className="text-[11px] uppercase tracking-wider">Language</Label>
              </div>
            </CardContent>
          </Card>

          {repositories.length === 0 ? (
            <EmptyState
              title="No repositories yet"
              description="Add a repository above. Then configure the webhook on your git provider so PRs are reviewed automatically."
            />
          ) : (
            <Card className="overflow-hidden mb-10">
              <table className="w-full text-sm">
                <thead className="bg-gh-surface-2 border-b border-gh-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-gh-text-muted text-xs uppercase tracking-wider">
                      Repository
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-gh-text-muted text-xs uppercase tracking-wider">
                      Branch / language
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-gh-text-muted text-xs uppercase tracking-wider">
                      Open PRs
                    </th>
                    <th className="text-right px-4 py-2.5 font-medium text-gh-text-muted text-xs uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {repositories.map((repo) => (
                    <tr
                      key={repo.id}
                      className="border-b border-gh-border-muted last:border-0 hover:bg-gh-surface-2 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FolderGit2 className="h-4 w-4 text-gh-text-subtle" />
                          <span className="font-medium text-gh-text">{repo.repoName}</span>
                        </div>
                        <p className="text-xs text-gh-text-muted">{repo.repoUrl}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gh-text-muted">
                        <span className="font-mono">{repo.defaultBranch ?? 'main'}</span>
                        {repo.language && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            {repo.language}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={repo.openPrCount ? 'default' : 'secondary'}>
                          {repo.openPrCount ?? 0}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={orgPullsPath(organization.slug, repo.repoName)}>
                            View PRs
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reviews">
          {orgReviews.length === 0 ? (
            <p className="text-sm text-gh-text-muted py-10 text-center">
              No reviews for this organization yet.
            </p>
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gh-surface-2 border-b border-gh-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-gh-text-muted text-xs uppercase tracking-wider">
                      PR
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-gh-text-muted text-xs uppercase tracking-wider">
                      Risk
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-gh-text-muted text-xs uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orgReviews.slice(0, 15).map(({ review, pullRequest, repository: repo }) => (
                    <tr
                      key={review.id}
                      className="border-b border-gh-border-muted last:border-0 hover:bg-gh-surface-2 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={prPullPath(organization.slug, repo.repoName, pullRequest.externalId)}
                          className="font-medium text-gh-text hover:text-gh-blue-muted hover:underline"
                        >
                          {pullRequest.title || `PR #${pullRequest.externalId}`}
                        </Link>
                        <p className="text-xs text-gh-text-muted">{repo.repoName}</p>
                      </td>
                      <td className="px-4 py-3">
                        {review.riskScore !== null ? (
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-xs font-semibold border',
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
                        <Badge variant="outline" className="capitalize">
                          {review.status.replace(/_/g, ' ')}
                        </Badge>
                        {review.mergeRecommendation && (
                          <span
                            className={cn(
                              'ml-2 inline-flex text-xs px-2 py-0.5 rounded-full border',
                              mergeColors[review.mergeRecommendation].bg,
                              mergeColors[review.mergeRecommendation].border,
                              mergeColors[review.mergeRecommendation].text,
                            )}
                          >
                            {mergeColors[review.mergeRecommendation].label}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="settings">
          <OrganizationSettingsForm organization={organization} />
        </TabsContent>
      </Tabs>

      <p className="text-xs text-gh-text-subtle mt-6">
        Webhook URL:{' '}
        <code className="font-mono text-gh-text-muted">{organization.webhookUrl}</code>
        {' · '}
        Added {formatRelative(organization.createdAt)}
      </p>
    </div>
  );
}
