'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { reviewsApi } from '@/lib/api/reviews';
import { reviewPath } from '@/lib/routes';
import { queryKeys } from '@/lib/queryKeys';
import { useMutationToast } from './useMutationToast';
import type { RepositoryRecord, ReviewDepth } from '@/types';

export function useStartReview() {
  const router = useRouter();
  const { onSuccess, onError } = useMutationToast();

  return useMutation({
    mutationFn: (input: {
      repository: RepositoryRecord;
      pullRequestUrl: string;
      pullRequestExternalId: string;
      reviewDepth?: ReviewDepth;
    }) =>
      reviewsApi.submit({
        repositoryUrl: input.repository.repoUrl,
        pullRequestUrl: input.pullRequestUrl,
        reviewDepth: input.reviewDepth ?? 'standard',
      }),
    onSuccess: (res, vars) => {
      onSuccess('Review started', [queryKeys.repositoryPRs(vars.repository.id, 'open')]);
      router.push(
        reviewPath({
          reviewId: res.reviewId,
          pullRequestExternalId: vars.pullRequestExternalId,
          repository: vars.repository,
        }),
      );
    },
    onError,
  });
}
