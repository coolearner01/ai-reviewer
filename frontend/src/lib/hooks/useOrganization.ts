'use client';

import { useQuery } from '@tanstack/react-query';
import { organizationsApi } from '@/lib/api/organizations';
import { queryKeys } from '@/lib/queryKeys';

export function useOrganization(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.organization(slug ?? ''),
    queryFn: () => organizationsApi.getBySlug(slug!),
    enabled: Boolean(slug),
  });
}
