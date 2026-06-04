'use client';

import { useQuery } from '@tanstack/react-query';
import { reviewsApi } from '@/lib/api/reviews';
import type { ReviewStatus } from '@/types';

export function useReview(id: string) {
  return useQuery({
    queryKey: ['review', id],
    queryFn: () => reviewsApi.get(id),
    staleTime: 30_000,
    refetchInterval: (query) => {
      const status = query.state.data?.review.status;
      if (status === 'completed' || status === 'failed') return false;
      return 5_000;
    },
  });
}

export function useReviews(params?: { page?: number; status?: ReviewStatus }) {
  return useQuery({
    queryKey: ['reviews', params],
    queryFn: () => reviewsApi.list(params),
    staleTime: 60_000,
  });
}
