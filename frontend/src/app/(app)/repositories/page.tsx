'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus } from 'lucide-react';
import { repositoriesApi } from '@/lib/api/repositories';
import { PageHeader, Spinner, ErrorCard, EmptyState } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TopBarActions } from '@/components/layout/TopBarActions';
import { toast } from 'sonner';
import { formatRelative } from '@/lib/utils';

export default function RepositoriesPage() {
  const qc = useQueryClient();
  const [url, setUrl] = useState('');
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['repositories'],
    queryFn: () => repositoriesApi.list(),
  });

  const create = useMutation({
    mutationFn: (repositoryUrl: string) => repositoriesApi.create(repositoryUrl),
    onSuccess: () => {
      toast.success('Repository connected');
      setUrl('');
      void qc.invalidateQueries({ queryKey: ['repositories'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="px-6 py-6 lg:px-8 max-w-7xl mx-auto">
      <TopBarActions>
        <Button asChild size="sm" variant="outline">
          <Link href="/organizations">
            <Building2 className="h-3.5 w-3.5" />
            Manage organizations
          </Link>
        </Button>
      </TopBarActions>

      <PageHeader
        title="Repositories"
        description="Legacy per-user repo list. For new setups, use Organizations to share one API key and webhook across many repos."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Add Repository</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="https://github.com/org/repo"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button onClick={() => create.mutate(url)} disabled={!url || create.isPending}>
            <Plus className="h-3.5 w-3.5" />
            Connect
          </Button>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6" />
        </div>
      )}
      {error && <ErrorCard message={error.message} onRetry={() => refetch()} />}

      {data?.repositories.length === 0 && (
        <EmptyState
          title="No repositories connected"
          description="Add a repository URL above to get started with automated reviews."
        />
      )}

      {data && data.repositories.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gh-surface-2 border-b border-gh-border">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gh-text-muted text-xs uppercase tracking-wider">
                  Repository
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-gh-text-muted text-xs uppercase tracking-wider">
                  Provider
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-gh-text-muted text-xs uppercase tracking-wider">
                  Webhook
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-gh-text-muted text-xs uppercase tracking-wider">
                  Added
                </th>
              </tr>
            </thead>
            <tbody>
              {data.repositories.map((repo) => (
                <tr
                  key={repo.id}
                  className="border-b border-gh-border-muted last:border-0 hover:bg-gh-surface-2 transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gh-text">{repo.repoName}</p>
                    <p className="text-xs text-gh-text-muted">{repo.orgOrWorkspace}</p>
                  </td>
                  <td className="px-4 py-3 capitalize text-gh-text-muted">{repo.provider}</td>
                  <td className="px-4 py-3">
                    <Badge variant={repo.webhookId ? 'default' : 'secondary'}>
                      {repo.webhookId ? 'Active' : 'Not configured'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gh-text-subtle text-xs">
                    {formatRelative(repo.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
