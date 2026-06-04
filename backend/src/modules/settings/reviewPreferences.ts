import type { AgentType, ReviewDepth } from '../../types';

/**
 * Review-preference fields shared by user-level and organization-level
 * settings. Both surfaces store the same editable configuration; only the
 * owning column (user_id vs organization_id) and the prompt-addition labels
 * differ. Centralising the shape, defaults, row mapping and prompt builder
 * keeps the two services in lock-step.
 */
export interface ReviewPreferenceFields {
  defaultReviewDepth: ReviewDepth;
  defaultFocusAreas: AgentType[];
  ignoredPaths: string[];
  customInstructions: string;
  securityPolicies: string;
  architectureRules: string;
  codingGuidelines: string;
}

/** snake_case DB columns common to user_settings and organization_settings. */
export interface ReviewPreferenceRow {
  default_review_depth: ReviewDepth;
  default_focus_areas: AgentType[];
  ignored_paths: string[];
  custom_instructions: string;
  security_policies: string;
  architecture_rules: string;
  coding_guidelines: string;
}

export const REVIEW_PREFERENCE_DEFAULTS: ReviewPreferenceFields = {
  defaultReviewDepth: 'standard',
  defaultFocusAreas: [],
  ignoredPaths: [],
  customInstructions: '',
  securityPolicies: '',
  architectureRules: '',
  codingGuidelines: '',
};

/**
 * Pick the shared preference fields off a Prisma settings model (already
 * camelCase) — used to translate `UserSettings` / `OrganizationSettings` rows
 * back into the editable {@link ReviewPreferenceFields} shape.
 */
export function pickReviewPreferenceFields(row: {
  defaultReviewDepth: string;
  defaultFocusAreas: string[];
  ignoredPaths: string[];
  customInstructions: string;
  securityPolicies: string;
  architectureRules: string;
  codingGuidelines: string;
}): ReviewPreferenceFields {
  return {
    defaultReviewDepth: row.defaultReviewDepth as ReviewDepth,
    defaultFocusAreas: row.defaultFocusAreas as AgentType[],
    ignoredPaths: row.ignoredPaths,
    customInstructions: row.customInstructions,
    securityPolicies: row.securityPolicies,
    architectureRules: row.architectureRules,
    codingGuidelines: row.codingGuidelines,
  };
}

/** Map the shared snake_case columns to their camelCase API representation. */
export function mapReviewPreferenceRow(row: ReviewPreferenceRow): ReviewPreferenceFields {
  return {
    defaultReviewDepth: row.default_review_depth,
    defaultFocusAreas: row.default_focus_areas,
    ignoredPaths: row.ignored_paths,
    customInstructions: row.custom_instructions,
    securityPolicies: row.security_policies,
    architectureRules: row.architecture_rules,
    codingGuidelines: row.coding_guidelines,
  };
}

/**
 * Build the "system additions" string prepended to a review's custom prompt.
 * `labelPrefix` distinguishes org-wide policies ("ORG ") from user defaults.
 */
export function buildPromptAdditions(
  prefs: ReviewPreferenceFields,
  labelPrefix = '',
): string {
  const parts: string[] = [];
  if (prefs.securityPolicies.trim())
    parts.push(`${labelPrefix}SECURITY POLICIES:\n${prefs.securityPolicies}`);
  if (prefs.architectureRules.trim())
    parts.push(`${labelPrefix}ARCHITECTURE RULES:\n${prefs.architectureRules}`);
  if (prefs.codingGuidelines.trim())
    parts.push(`${labelPrefix}CODING GUIDELINES:\n${prefs.codingGuidelines}`);
  if (prefs.customInstructions.trim()) parts.push(prefs.customInstructions);
  return parts.join('\n\n');
}
