import { apiFetch } from './client';
import type { PullRequestRecord } from '@/types';

export interface SimulateInput {
  organizationId: string;
  repositoryId?: string;
  pullRequestUrl?: string;
}

export interface SimulateResponse {
  reviewId: string;
  pullRequest: PullRequestRecord;
  simulated: boolean;
}

export const simulateApi = {
  fire: (input: SimulateInput) =>
    apiFetch<SimulateResponse>('/simulate', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
