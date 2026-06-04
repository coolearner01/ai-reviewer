import { loadPipelineStateRow } from '../reviewQueries';
import { settingsService } from '../../settings/settingsService';
import { organizationSettingsService } from '../../organizations/organizationSettingsService';
import { reviewPromptService } from '../../prompts/reviewPromptService';
import { resolveAiConfig } from '../../settings/aiConfigResolver';
import type { AgentType, ReviewDepth } from '../../../types';
import type { PipelineState } from './types';

export async function loadPipelineState(reviewId: string): Promise<PipelineState | null> {
  const row = await loadPipelineStateRow(reviewId);
  if (!row) return null;

  const settings = await settingsService.getForUser(row.userId).catch(() => null);
  const userAdditions = settings ? settingsService.buildPromptAdditions(settings) : '';

  // Enabled custom prompts (Settings → Prompts checkboxes) are injected too.
  const customPromptAdditions = await reviewPromptService
    .getEnabledPromptText(row.userId)
    .catch(() => '');

  let orgAdditions = '';
  let orgFocusAreas: AgentType[] = [];
  let orgIgnoredPaths: string[] = [];
  if (row.organizationId) {
    const orgSettings = await organizationSettingsService
      .getForOrganization(row.organizationId)
      .catch(() => null);
    if (orgSettings) {
      orgAdditions = organizationSettingsService.buildPromptAdditions(orgSettings);
      orgFocusAreas = orgSettings.defaultFocusAreas;
      orgIgnoredPaths = orgSettings.ignoredPaths;
    }
  }

  const customPrompt = [orgAdditions, userAdditions, customPromptAdditions, row.customPrompt]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join('\n\n');

  const focusAreas = orgFocusAreas.length > 0 ? orgFocusAreas : settings?.defaultFocusAreas ?? [];
  const ignoredPaths = [
    ...new Set([...(orgIgnoredPaths ?? []), ...(settings?.ignoredPaths ?? [])]),
  ];

  const aiCredentials = await resolveAiConfig({
    userId: row.userId,
    organizationId: row.organizationId,
  }).catch(() => undefined);

  return {
    reviewId,
    provider: row.provider,
    prUrl: row.prUrl,
    repoUrl: row.repoUrl,
    reviewDepth: row.reviewDepth as ReviewDepth,
    customPrompt,
    focusAreas,
    ignoredPaths,
    startedAt: Date.now(),
    organizationId: row.organizationId,
    userId: row.userId,
    aiCredentials,
  };
}
