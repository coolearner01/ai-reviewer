import { apiFetch } from './client';

export interface ReviewPrompt {
  id: string;
  label: string;
  content: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReviewPromptInput {
  label: string;
  content: string;
  enabled?: boolean;
}

export interface UpdateReviewPromptInput {
  label?: string;
  content?: string;
  enabled?: boolean;
}

export const promptsApi = {
  list: () => apiFetch<{ prompts: ReviewPrompt[] }>('/prompts'),

  create: (input: CreateReviewPromptInput) =>
    apiFetch<{ prompt: ReviewPrompt }>('/prompts', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  update: (id: string, patch: UpdateReviewPromptInput) =>
    apiFetch<{ prompt: ReviewPrompt }>(`/prompts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  remove: (id: string) =>
    apiFetch<void>(`/prompts/${id}`, {
      method: 'DELETE',
    }),
};
