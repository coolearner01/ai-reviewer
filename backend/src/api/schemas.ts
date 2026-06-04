import { z } from 'zod';
import { SPECIALIST_AGENT_TYPES } from '../constants';
import { AI_PROVIDERS } from '../modules/settings/aiProviderSettings';

/**
 * Reusable Zod schemas shared across route modules.
 *
 * Centralising these keeps validation consistent (one definition of "what a
 * valid review depth / focus area / id looks like") and avoids the same enums
 * being re-declared in every router.
 */

/** `:id` path param — a UUID. */
export const idParamSchema = z.object({ id: z.string().uuid() });

export const reviewDepthSchema = z.enum(['light', 'standard', 'deep']);

export const providerSchema = z.enum(['github', 'gitlab', 'bitbucket']);

export const reviewStatusSchema = z.enum([
  'queued',
  'fetching',
  'analyzing',
  'commenting',
  'completed',
  'failed',
]);

/** Array of user-selectable specialist agents. */
export const focusAreasSchema = z.array(z.enum(SPECIALIST_AGENT_TYPES));

/**
 * Review-preference fields shared by the user-settings and organization-settings
 * endpoints. Both surfaces accept exactly the same editable shape.
 */
const aiProviderSchema = z.enum(AI_PROVIDERS);

const apiKeyPatchSchema = z
  .string()
  .max(500)
  .optional()
  .transform((v) => v);

export const aiProviderSettingsSchema = z.object({
  aiProvider: z.union([aiProviderSchema, z.literal('')]).optional(),
  anthropicApiKey: apiKeyPatchSchema,
  geminiApiKey: apiKeyPatchSchema,
  openaiApiKey: apiKeyPatchSchema,
  openrouterApiKey: apiKeyPatchSchema,
  anthropicModel: z.string().max(120).optional(),
  geminiModel: z.string().max(120).optional(),
  openaiModel: z.string().max(120).optional(),
  openrouterModel: z.string().max(200).optional(),
});

/** Create a custom review prompt (label = checkbox, content = injected text). */
export const reviewPromptCreateSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(120),
  content: z.string().trim().min(1, 'Prompt content is required').max(8000),
  enabled: z.boolean().optional(),
});

/** Patch a custom review prompt — any subset of fields. */
export const reviewPromptUpdateSchema = z
  .object({
    label: z.string().trim().min(1).max(120).optional(),
    content: z.string().trim().min(1).max(8000).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const reviewPreferencesSchema = z
  .object({
    customInstructions: z.string().max(4000).optional(),
    securityPolicies: z.string().max(4000).optional(),
    architectureRules: z.string().max(4000).optional(),
    codingGuidelines: z.string().max(4000).optional(),
    defaultReviewDepth: reviewDepthSchema.optional(),
    defaultFocusAreas: focusAreasSchema.optional(),
    ignoredPaths: z.array(z.string().max(200)).max(50).optional(),
  })
  .merge(aiProviderSettingsSchema);
