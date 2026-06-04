import type { UserSettings as PrismaUserSettings } from '@prisma/client';
import { prisma } from '../../infrastructure/database/client';
import { toPublicAiSettings, type AiProviderSettingsPublic } from './aiProviderSettings';
import {
  buildPromptAdditions,
  pickReviewPreferenceFields,
  REVIEW_PREFERENCE_DEFAULTS,
  type ReviewPreferenceFields,
} from './reviewPreferences';
import { upsertUserPreferences, type UserSettingsUpsert } from './upsertReviewPreferences';

export interface UserSettings extends ReviewPreferenceFields, AiProviderSettingsPublic {
  updatedAt: string;
}

const DEFAULTS: UserSettings = {
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

export const settingsService = {
  async getForUser(userId: string): Promise<UserSettings> {
    const row = await prisma.userSettings.findUnique({ where: { userId } });
    if (!row) return DEFAULTS;
    return toSettings(row);
  },

  async upsertForUser(userId: string, patch: Partial<UserSettingsUpsert>): Promise<UserSettings> {
    const current = await this.getForUser(userId);
    const next = { ...current, ...patch };
    const row = await upsertUserPreferences(userId, next);
    return toSettings(row);
  },

  buildPromptAdditions(settings: UserSettings): string {
    return buildPromptAdditions(settings);
  },
};

function toSettings(row: PrismaUserSettings): UserSettings {
  return {
    ...pickReviewPreferenceFields(row),
    ...toPublicAiSettings(row),
    updatedAt: row.updatedAt.toISOString(),
  };
}
