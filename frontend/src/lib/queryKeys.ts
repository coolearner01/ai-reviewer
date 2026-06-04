/** Centralized React Query keys — keeps invalidation consistent. */
export const queryKeys = {
  organizations: ['organizations'] as const,
  organization: (slug: string) => ['organization', slug] as const,
  repositories: ['repositories'] as const,
  repositoryPRs: (repoId: string, tab: string, syncKey?: string, page?: number) =>
    ['repository-prs', repoId, tab, syncKey ?? 'cached', page ?? 1] as const,
  reviewLookup: (org: string, repo: string, prId: string) =>
    ['review-lookup', org, repo, prId] as const,
  review: (id: string) => ['review', id] as const,
  reviews: (params?: Record<string, unknown>) => ['reviews', params] as const,
  settings: ['settings'] as const,
  prompts: ['prompts'] as const,
  orgSettings: (orgId: string) => ['org-settings', orgId] as const,
  insights: (days: number) => ['insights', days] as const,
};
