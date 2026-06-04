import type {
  OrganizationSettings as PrismaOrgSettings,
  UserSettings as PrismaUserSettings,
} from '@prisma/client';
import { prisma } from '../../infrastructure/database/client';
import {
  applyAiKeyPatch,
  pickAiProviderFields,
  type AiProviderSettingsPatch,
  type AiProviderSettingsRow,
} from './aiProviderSettings';
import { pickReviewPreferenceFields, type ReviewPreferenceFields } from './reviewPreferences';

export type UserSettingsUpsert = ReviewPreferenceFields & AiProviderSettingsPatch;
export type OrganizationSettingsUpsert = ReviewPreferenceFields & AiProviderSettingsPatch;

function aiRowFromPrisma(row: {
  aiProvider: string;
  anthropicApiKey: string;
  geminiApiKey: string;
  openaiApiKey: string;
  openrouterApiKey: string;
  anthropicModel: string;
  geminiModel: string;
  openaiModel: string;
  openrouterModel: string;
}): AiProviderSettingsRow {
  return row;
}

/**
 * Upsert the shared review-preference columns for a user. Returns the full
 * Prisma row so callers can read back `updatedAt`.
 */
export async function upsertUserPreferences(
  userId: string,
  prefs: UserSettingsUpsert,
  existingRow?: PrismaUserSettings | null,
): Promise<PrismaUserSettings> {
  const reviewFields = pickReviewPreferenceFields(prefs);
  const current =
    existingRow ??
    (await prisma.userSettings.findUnique({ where: { userId } }));
  const aiFields = applyAiKeyPatch(
    current
      ? aiRowFromPrisma(current)
      : emptyAiRow(),
    prefs,
  );

  return prisma.userSettings.upsert({
    where: { userId },
    create: { userId, ...reviewFields, ...aiFields },
    update: { ...reviewFields, ...aiFields, updatedAt: new Date() },
  });
}

/** Upsert the shared review-preference columns for an organization. */
export async function upsertOrganizationPreferences(
  organizationId: string,
  prefs: OrganizationSettingsUpsert,
  existingRow?: PrismaOrgSettings | null,
): Promise<PrismaOrgSettings> {
  const reviewFields = pickReviewPreferenceFields(prefs);
  const current =
    existingRow ??
    (await prisma.organizationSettings.findUnique({ where: { organizationId } }));
  const aiFields = applyAiKeyPatch(
    current
      ? aiRowFromPrisma(current)
      : emptyAiRow(),
    prefs,
  );

  return prisma.organizationSettings.upsert({
    where: { organizationId },
    create: { organizationId, ...reviewFields, ...aiFields },
    update: { ...reviewFields, ...aiFields, updatedAt: new Date() },
  });
}

function emptyAiRow(): AiProviderSettingsRow {
  return {
    aiProvider: '',
    anthropicApiKey: '',
    geminiApiKey: '',
    openaiApiKey: '',
    openrouterApiKey: '',
    anthropicModel: '',
    geminiModel: '',
    openaiModel: '',
    openrouterModel: '',
  };
}
