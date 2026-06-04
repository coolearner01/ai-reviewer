'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { reviewsApi } from '@/lib/api/reviews';
import type { ReviewStatus } from '@/types';

export function useReview(id: string) {
  return useQuery({
    queryKey: ['review', id],
    queryFn: () => reviewsApi.get(id),
    staleTime: 30_000,
    refetchInterval: (query) => {
      const status = query.state.data?.review.status;
      if (status === 'completed' || status === 'failed' || status === 'cancelled') return false;
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

/** Cancel an in-progress review. Invalidates the review + list caches. */
export function useCancelReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reviewsApi.cancel(id),
    onSuccess: (_data, id) => {
      toast.success('Review cancelled');
      void qc.invalidateQueries({ queryKey: ['review', id] });
      void qc.invalidateQueries({ queryKey: ['reviews'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/** Permanently delete a review from the database. */
export function useDeleteReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reviewsApi.remove(id),
    onSuccess: (_data, id) => {
      toast.success('Review deleted');
      void qc.invalidateQueries({ queryKey: ['review', id] });
      void qc.invalidateQueries({ queryKey: ['reviews'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
