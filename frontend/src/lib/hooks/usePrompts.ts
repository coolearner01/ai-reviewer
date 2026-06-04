'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  promptsApi,
  type CreateReviewPromptInput,
  type ReviewPrompt,
  type UpdateReviewPromptInput,
} from '@/lib/api/prompts';
import { queryKeys } from '@/lib/queryKeys';

export function usePrompts() {
  return useQuery({
    queryKey: queryKeys.prompts,
    queryFn: () => promptsApi.list(),
  });
}

export function useCreatePrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReviewPromptInput) => promptsApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.prompts });
      toast.success('Prompt added');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdatePrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateReviewPromptInput }) =>
      promptsApi.update(id, patch),
    // Optimistically toggle so the checkbox feels instant.
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: queryKeys.prompts });
      const previous = qc.getQueryData<{ prompts: ReviewPrompt[] }>(queryKeys.prompts);
      if (previous) {
        qc.setQueryData<{ prompts: ReviewPrompt[] }>(queryKeys.prompts, {
          prompts: previous.prompts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        });
      }
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.prompts, ctx.previous);
      toast.error(err.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.prompts });
    },
  });
}

export function useDeletePrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => promptsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.prompts });
      toast.success('Prompt deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
