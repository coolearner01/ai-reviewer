import type { OrganizationSettings as PrismaOrgSettings } from '@prisma/client';
import { prisma } from '../../infrastructure/database/client';
import type { OrganizationSettings } from '../../types';
import { toPublicAiSettings } from '../settings/aiProviderSettings';
import {
  buildPromptAdditions,
  pickReviewPreferenceFields,
  REVIEW_PREFERENCE_DEFAULTS,
} from '../settings/reviewPreferences';
import {
  upsertOrganizationPreferences,
  type OrganizationSettingsUpsert,
} from '../settings/upsertReviewPreferences';

function defaults(organizationId: string): OrganizationSettings {
  return {
    organizationId,
    ...REVIEW_PREFERENCE_DEFAULTS,
    aiProvider: '',
    anthropicModel: '',
    geminiModel: '',
    openaiModel: '',
    openrouterModel: '',
    keys: {
      anthropic: { configured: false, masked: null },
      gemini: { configured: false, masked: null },
      openai: { configured: false, masked: null },
      openrouter: { configured: false, masked: null },
    },
    updatedAt: new Date(0).toISOString(),
  };
}

export const organizationSettingsService = {
  async getForOrganization(organizationId: string): Promise<OrganizationSettings> {
    const row = await prisma.organizationSettings.findUnique({
      where: { organizationId },
    });
    if (!row) return defaults(organizationId);
    return toSettings(row);
  },

  async upsert(
    organizationId: string,
    patch: Partial<OrganizationSettingsUpsert>,
  ): Promise<OrganizationSettings> {
    const current = await this.getForOrganization(organizationId);
    const next = { ...current, ...patch, organizationId };
    const row = await upsertOrganizationPreferences(organizationId, next);
    return toSettings(row);
  },

  buildPromptAdditions(settings: OrganizationSettings): string {
    return buildPromptAdditions(settings, 'ORG ');
  },
};

function toSettings(row: PrismaOrgSettings): OrganizationSettings {
  return {
    organizationId: row.organizationId,
    ...pickReviewPreferenceFields(row),
    ...toPublicAiSettings(row),
    updatedAt: row.updatedAt.toISOString(),
  };
}
