'use client';

import { useEffect } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { repositoriesApi } from '@/lib/api/repositories';
import { queryKeys } from '@/lib/queryKeys';
import type { PullRequestState } from '@/types';

export function useRepositoryPRs(
  repositoryId: string | undefined,
  tab: PullRequestState,
  options?: { sync?: boolean; page?: number },
) {
  const qc = useQueryClient();
  const page = options?.page ?? 1;
  // Background sync: don't block the request on the provider. Page 1 kicks off
  // the async sync; deeper pages just read the cache.
  const sync = options?.sync && page === 1 ? 'async' : undefined;
  const syncKey = sync ? 'sync' : 'cached';

  const query = useQuery({
    queryKey: queryKeys.repositoryPRs(repositoryId ?? '', tab, syncKey, page),
    queryFn: () =>
      repositoriesApi.listPullRequests(repositoryId!, { state: tab, sync, page }),
    enabled: Boolean(repositoryId),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  // When the server reports a background sync was started, refetch the cached
  // rows a few seconds later so the freshly-synced PRs show up without the
  // user waiting on the original request.
  useEffect(() => {
    if (!repositoryId || !query.data?.syncing) return;
    const t = setTimeout(() => {
      qc.invalidateQueries({ queryKey: ['repository-prs', repositoryId, tab] });
    }, 4000);
    return () => clearTimeout(t);
  }, [repositoryId, tab, query.data?.syncing, qc]);

  return query;
}
