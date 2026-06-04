'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Building2, Plus } from 'lucide-react';
import { organizationsApi } from '@/lib/api/organizations';
import { PageHeader, Spinner, ErrorCard, EmptyState } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TopBarActions } from '@/components/layout/TopBarActions';
import { formatRelative } from '@/lib/utils';

const PROVIDER_BADGE: Record<string, string> = {
  github: 'bg-gh-text/10 text-gh-text border-gh-border',
  gitlab: 'bg-gh-orange/20 text-[#f0883e] border-gh-orange/60',
  bitbucket: 'bg-gh-blue/20 text-gh-blue-muted border-gh-blue/60',
};

export default function OrganizationsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizationsApi.list(),
  });

  return (
    <div className="px-6 py-6 lg:px-8 max-w-7xl mx-auto">
      <TopBarActions>
        <Button asChild size="sm">
          <Link href="/organizations/new">
            <Plus className="h-3.5 w-3.5" />
            New org
          </Link>
        </Button>
      </TopBarActions>

      <PageHeader
        title="Organizations"
        description="Group your repositories under organizations, each with its own provider API key and auto-generated webhook URL."
      />

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6" />
        </div>
      )}
      {error && <ErrorCard message={error.message} onRetry={() => refetch()} />}

      {data?.organizations.length === 0 && (
        <EmptyState
          title="No organizations yet"
          description="Create an organization to attach a git provider API key and start receiving PRs from all of its repos in one place."
          action={
            <Button asChild>
              <Link href="/organizations/new">
                <Plus className="h-3.5 w-3.5" />
                Create your first organization
              </Link>
            </Button>
          }
        />
      )}

      {data && data.organizations.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.organizations.map((org) => (
            <Link key={org.id} href={`/organizations/${org.slug}`} className="block group">
              <Card className="transition-all group-hover:border-gh-text-subtle group-hover:shadow-md">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-md bg-gh-canvas border border-gh-border flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5 text-gh-text-muted" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gh-text truncate">
                          {org.name}
                        </p>
                        <p className="text-xs text-gh-text-muted truncate">/{org.slug}</p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`capitalize ${PROVIDER_BADGE[org.provider] ?? ''}`}
                    >
                      {org.provider}
                    </Badge>
                  </div>

                  <div className="text-xs text-gh-text-muted space-y-1">
                    <p>
                      API key:{' '}
                      <code className="font-mono text-gh-text">{org.apiKeyMasked}</code>
                    </p>
                    <p>Created {formatRelative(org.createdAt)}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
