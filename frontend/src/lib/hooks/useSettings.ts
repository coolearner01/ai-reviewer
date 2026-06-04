'use client';

import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/lib/api/settings';
import { queryKeys } from '@/lib/queryKeys';

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => settingsApi.get(),
  });
}
