import { prisma } from '../../infrastructure/database/client';
import {
  AI_PROVIDERS,
  type AiProvider,
  type AiProviderSettingsFields,
  AI_PROVIDER_DEFAULTS,
  type AiProviderSettingsRow,
  firstConfiguredProvider,
  isAiProvider,
  keyForProvider,
  modelForProvider,
  pickAiProviderFields,
} from './aiProviderSettings';

export interface ResolvedAiCredentials {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

export interface ResolvedAiCallConfig extends ResolvedAiCredentials {
  fallbacks: ResolvedAiCredentials[];
}

const PROVIDER_ORDER: AiProvider[] = [...AI_PROVIDERS];

/**
 * Resolve effective AI credentials for a review run.
 *
 * Precedence (per field):
 *   1. User settings (if user has a usable key for the active provider)
 *   2. Organization settings
 *
 * There is no environment-variable fallback — keys come only from settings.
 * Active provider: user.aiProvider → org.aiProvider → first provider with any key.
 * Model: per-provider model on the winning settings layer, else code default.
 */
export async function resolveAiConfig(input: {
  userId: string;
  organizationId?: string | null;
}): Promise<ResolvedAiCallConfig> {
  const userRow = await prisma.userSettings.findUnique({
    where: { userId: input.userId },
  });
  const orgRow = input.organizationId
    ? await prisma.organizationSettings.findUnique({
        where: { organizationId: input.organizationId },
      })
    : null;

  const primary = resolvePrimary(userRow, orgRow);
  const fallbacks = buildFallbackChain(primary.provider, userRow, orgRow);

  return { ...primary, fallbacks };
}

/** Primary credentials only (what agents use). */
export function resolvePrimary(
  userRow: AiProviderSettingsRow | null,
  orgRow: AiProviderSettingsRow | null,
): ResolvedAiCredentials {
  const provider = pickActiveProvider(userRow, orgRow);
  const apiKey = resolveKey(provider, userRow, orgRow);
  const model = resolveModel(provider, userRow, orgRow);
  return { provider, apiKey, model };
}

/** Ordered fallbacks when the primary provider fails mid-review. */
export function buildFallbackChain(
  skipProvider: AiProvider,
  userRow: AiProviderSettingsRow | null,
  orgRow: AiProviderSettingsRow | null,
): ResolvedAiCredentials[] {
  const chain: ResolvedAiCredentials[] = [];
  for (const p of PROVIDER_ORDER) {
    if (p === skipProvider) continue;
    const apiKey = resolveKey(p, userRow, orgRow);
    if (!apiKey) continue;
    chain.push({
      provider: p,
      apiKey,
      model: resolveModel(p, userRow, orgRow),
    });
  }
  return chain;
}

function pickActiveProvider(
  userRow: AiProviderSettingsRow | null,
  orgRow: AiProviderSettingsRow | null,
): AiProvider {
  const userProvider = userRow?.aiProvider;
  if (userProvider && isAiProvider(userProvider) && hasKeyFor(userProvider, userRow, orgRow)) {
    return userProvider;
  }
  const orgProvider = orgRow?.aiProvider;
  if (orgProvider && isAiProvider(orgProvider) && hasKeyFor(orgProvider, userRow, orgRow)) {
    return orgProvider;
  }
  const detected = firstConfiguredProvider(PROVIDER_ORDER, userRow) ??
    firstConfiguredProvider(PROVIDER_ORDER, orgRow);
  if (detected) return detected;
  return 'anthropic';
}

function hasKeyFor(
  provider: AiProvider,
  userRow: AiProviderSettingsRow | null,
  orgRow: AiProviderSettingsRow | null,
): boolean {
  return Boolean(resolveKey(provider, userRow, orgRow));
}

function resolveKey(
  provider: AiProvider,
  userRow: AiProviderSettingsRow | null,
  orgRow: AiProviderSettingsRow | null,
): string {
  const fromUser = userRow ? keyForProvider(provider, userRow) : '';
  if (fromUser) return fromUser;
  const fromOrg = orgRow ? keyForProvider(provider, orgRow) : '';
  if (fromOrg) return fromOrg;
  return '';
}

function storedModel(
  provider: AiProvider,
  fields: AiProviderSettingsFields,
): string {
  switch (provider) {
    case 'anthropic':
      return fields.anthropicModel;
    case 'gemini':
      return fields.geminiModel;
    case 'openai':
      return fields.openaiModel;
    case 'openrouter':
      return fields.openrouterModel;
  }
}

function resolveModel(
  provider: AiProvider,
  userRow: AiProviderSettingsRow | null,
  orgRow: AiProviderSettingsRow | null,
): string {
  if (userRow) {
    const fields = pickAiProviderFields(userRow);
    if (storedModel(provider, fields).trim()) return modelForProvider(provider, fields);
  }
  if (orgRow) {
    const fields = pickAiProviderFields(orgRow);
    if (storedModel(provider, fields).trim()) return modelForProvider(provider, fields);
  }
  return modelForProvider(provider, AI_PROVIDER_DEFAULTS_EMPTY);
}

const AI_PROVIDER_DEFAULTS_EMPTY = AI_PROVIDER_DEFAULTS;
