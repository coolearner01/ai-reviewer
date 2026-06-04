import { z } from 'zod';

/** Shared params for org/repo/pr slug lookups (reviews + pull-requests routes). */
export const slugLookupParamsSchema = z.object({
  orgSlug: z.string().min(1),
  repoName: z.string().min(1),
  prId: z.string().regex(/^\d+$/, 'PR id must be numeric'),
});

export type SlugLookupParams = z.infer<typeof slugLookupParamsSchema>;
