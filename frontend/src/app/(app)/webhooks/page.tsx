'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, RefreshCw, Webhook } from 'lucide-react';
import { PageHeader, EmptyState, Spinner, ErrorCard } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TopBarActions } from '@/components/layout/TopBarActions';
import { useActiveOrg } from '@/lib/hooks/useActiveOrg';
import { organizationsApi } from '@/lib/api/organizations';
import { SetupGuide } from '@/components/organizations/SetupGuide';
import { formatRelative } from '@/lib/utils';

const PROVIDER_BADGE: Record<string, string> = {
  github: 'bg-gh-text/10 text-gh-text border-gh-border',
  gitlab: 'bg-gh-orange/20 text-[#f0883e] border-gh-orange/60',
  bitbucket: 'bg-gh-blue/20 text-gh-blue-muted border-gh-blue/60',
};

/**
 * Webhooks page (per the mockup's ORGANIZATION section).
 *
 * Shows the active organization's webhook URL, secret, and setup instructions.
 * Lets the user rotate the secret on demand. Repositories without an org are
 * surfaced as a list at the bottom with a clear upgrade path.
 */
export default function WebhooksPage() {
  const { activeOrg, organizations } = useActiveOrg();
  const qc = useQueryClient();
  const [secretIsNew, setSecretIsNew] = useState(false);

  const setupQuery = useQuery({
    queryKey: ['organization-setup', activeOrg?.id],
    queryFn: () => organizationsApi.get(activeOrg!.id),
    enabled: Boolean(activeOrg?.id),
  });

  const orgQuery = useQuery({
    queryKey: ['organization', activeOrg?.slug],
    queryFn: () => organizationsApi.getBySlug(activeOrg!.slug),
    enabled: Boolean(activeOrg?.slug),
  });

  const rotate = useMutation({
    mutationFn: () => organizationsApi.rotateWebhook(activeOrg!.id),
    onSuccess: ({ setupGuide }) => {
      toast.success('Webhook secret rotated');
      setSecretIsNew(true);
      qc.setQueryData(['organization-setup', activeOrg!.id], (prev: unknown) => {
        if (!prev || typeof prev !== 'object') return prev;
        return { ...(prev as Record<string, unknown>), setupGuide };
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const topActions = (
    <TopBarActions>
      <Button
        size="sm"
        variant="outline"
        onClick={() => rotate.mutate()}
        disabled={!activeOrg || rotate.isPending}
      >
        <RefreshCw className={'h-3.5 w-3.5' + (rotate.isPending ? ' animate-spin' : '')} />
        Rotate secret
      </Button>
      <Button asChild size="sm">
        <Link href="/organizations/new">
          <Plus className="h-3.5 w-3.5" />
          New org
        </Link>
      </Button>
    </TopBarActions>
  );

  if (organizations.length === 0) {
    return (
      <div className="px-6 py-6 lg:px-8 max-w-5xl mx-auto">
        {topActions}
        <PageHeader
          title="Webhooks"
          description="Webhook URLs live on organizations. Create an organization to receive PR events."
        />
        <EmptyState
          title="No organization configured"
          description="Each organization gets one webhook URL that you share across every repo it owns."
          action={
            <Button asChild>
              <Link href="/organizations/new">
                <Plus className="h-3.5 w-3.5" />
                Create your first organization
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!activeOrg || setupQuery.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (setupQuery.error) {
    return (
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <ErrorCard message={setupQuery.error.message} onRetry={() => setupQuery.refetch()} />
      </div>
    );
  }

  const guide = setupQuery.data?.setupGuide;
  const repositories = orgQuery.data?.repositories ?? [];

  return (
    <div className="px-6 py-6 lg:px-8 max-w-5xl mx-auto space-y-6">
      {topActions}
      <PageHeader
        title="Webhooks"
        description={`One webhook URL for the entire ${activeOrg.name} organization. Configure it once on your provider and every connected repo starts auto-reviewing.`}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-4 w-4 text-gh-blue-muted" />
            {activeOrg.name}
          </CardTitle>
          <Badge
            variant="outline"
            className={'capitalize ' + (PROVIDER_BADGE[activeOrg.provider] ?? '')}
          >
            {activeOrg.provider}
          </Badge>
        </CardHeader>
        <CardContent>
          {guide && <SetupGuide guide={guide} secretIsNew={secretIsNew} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Repositories receiving events</CardTitle>
        </CardHeader>
        {repositories.length === 0 ? (
          <CardContent className="py-8 text-center text-sm text-gh-text-muted">
            No repositories attached to this organization yet.{' '}
            <Link
              href={`/organizations/${activeOrg.slug}`}
              className="text-gh-blue-muted hover:underline"
            >
              Add one
            </Link>
            .
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gh-surface-2 border-y border-gh-border">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gh-text-muted text-xs uppercase tracking-wider">
                    Repository
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-gh-text-muted text-xs uppercase tracking-wider">
                    Webhook
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-gh-text-muted text-xs uppercase tracking-wider">
                    Connected
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-gh-text-muted text-xs uppercase tracking-wider">
                    Open PRs
                  </th>
                </tr>
              </thead>
              <tbody>
                {repositories.map((repo) => (
                  <tr
                    key={repo.id}
                    className="border-b border-gh-border-muted last:border-0 hover:bg-gh-surface-2 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gh-text">
                      {repo.repoName}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={repo.webhookId ? 'default' : 'secondary'}>
                        {repo.webhookId ? 'Active' : 'Pending setup'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gh-text-subtle text-xs">
                      {formatRelative(repo.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-gh-text-muted text-xs">
                      {repo.openPrCount ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
