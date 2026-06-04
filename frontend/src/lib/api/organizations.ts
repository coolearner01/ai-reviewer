import { apiFetch } from './client';
import type {
  OrganizationRecord,
  OrganizationSettings,
  OrganizationSetupGuide,
  Provider,
  ProviderRepositorySuggestion,
  RepositoryRecord,
} from '@/types';

export interface CreateOrganizationInput {
  name: string;
  provider: Provider;
  apiKey: string;
}

export interface AddRepositoryInput {
  repoIdentifier: string;
  defaultBranch?: string;
  language?: string;
}

export const organizationsApi = {
  list: () =>
    apiFetch<{ organizations: OrganizationRecord[] }>('/organizations'),

  get: (id: string) =>
    apiFetch<{ organization: OrganizationRecord; setupGuide: OrganizationSetupGuide }>(
      `/organizations/${id}`,
    ),

  getBySlug: (slug: string) =>
    apiFetch<{ organization: OrganizationRecord; repositories: RepositoryRecord[] }>(
      `/organizations/by-slug/${encodeURIComponent(slug)}`,
    ),

  create: (input: CreateOrganizationInput) =>
    apiFetch<{ organization: OrganizationRecord; setupGuide: OrganizationSetupGuide }>(
      '/organizations',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    ),

  update: (id: string, patch: { name?: string; apiKey?: string }) =>
    apiFetch<{ organization: OrganizationRecord }>(`/organizations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  remove: (id: string) =>
    apiFetch<void>(`/organizations/${id}`, { method: 'DELETE' }),

  rotateWebhook: (id: string) =>
    apiFetch<{ setupGuide: OrganizationSetupGuide }>(
      `/organizations/${id}/webhook/rotate`,
      { method: 'POST' },
    ),

  addRepository: (id: string, input: AddRepositoryInput | string) =>
    apiFetch<{ repository: RepositoryRecord }>(`/organizations/${id}/repositories`, {
      method: 'POST',
      body: JSON.stringify(typeof input === 'string' ? { repoIdentifier: input } : input),
    }),

  searchProviderRepositories: (
    id: string,
    options: { query?: string; limit?: number } = {},
  ) => {
    const params = new URLSearchParams();
    if (options.query) params.set('q', options.query);
    if (options.limit) params.set('limit', String(options.limit));
    const qs = params.toString();
    return apiFetch<{
      repositories: ProviderRepositorySuggestion[];
      supported: boolean;
      error?: string;
    }>(`/organizations/${id}/provider-repos${qs ? `?${qs}` : ''}`);
  },

  getSettings: (id: string) =>
    apiFetch<{ settings: OrganizationSettings }>(`/organizations/${id}/settings`),

  updateSettings: (id: string, patch: Partial<OrganizationSettings>) =>
    apiFetch<{ settings: OrganizationSettings }>(`/organizations/${id}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
};
