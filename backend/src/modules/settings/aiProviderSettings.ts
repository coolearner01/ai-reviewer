import { config, isUsableKey } from '../../config';
import { tokenCrypto } from '../../utils/crypto';

/**
 * AI provider configuration stored on user_settings and organization_settings.
 * API keys are encrypted at rest; the API never returns plaintext keys.
 */

export const AI_PROVIDERS = ['anthropic', 'gemini', 'openai', 'openrouter'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export interface AiProviderSettingsFields {
  /** Active provider for reviews. Empty = inherit (org) or auto-detect from env. */
  aiProvider: AiProvider | '';
  anthropicModel: string;
  geminiModel: string;
  openaiModel: string;
  openrouterModel: string;
}

/** Masked key status returned by GET settings — never includes the full secret. */
export interface AiKeyStatus {
  configured: boolean;
  masked: string | null;
}

export interface AiProviderSettingsPublic extends AiProviderSettingsFields {
  keys: {
    anthropic: AiKeyStatus;
    gemini: AiKeyStatus;
    openai: AiKeyStatus;
    openrouter: AiKeyStatus;
  };
}

/** Writable patch — plaintext keys only on PATCH, never on GET. */
export interface AiProviderSettingsPatch extends Partial<AiProviderSettingsFields> {
  anthropicApiKey?: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  openrouterApiKey?: string;
}

export const AI_PROVIDER_DEFAULTS: AiProviderSettingsFields = {
  aiProvider: '',
  anthropicModel: '',
  geminiModel: '',
  openaiModel: '',
  openrouterModel: '',
};

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: config.ANTHROPIC_MODEL,
  gemini: config.GEMINI_MODEL,
  openai: config.OPENAI_MODEL,
  openrouter: config.OPENROUTER_MODEL,
};

/** Curated OpenRouter models shown in the UI picker. */
export const OPENROUTER_MODEL_PRESETS = [
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (free)' },
  { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4' },
  { id: 'openai/gpt-4o', label: 'GPT-4o' },
  { id: 'qwen/qwen3-coder:free', label: 'Qwen3 Coder (free)' },
  { id: 'openrouter/free', label: 'OpenRouter Free (auto)' },
] as const;

const KEY_FIELDS = [
  'anthropicApiKey',
  'geminiApiKey',
  'openaiApiKey',
  'openrouterApiKey',
] as const;

type EncryptedKeyField = (typeof KEY_FIELDS)[number];

export interface AiProviderSettingsRow {
  aiProvider: string;
  anthropicApiKey: string;
  geminiApiKey: string;
  openaiApiKey: string;
  openrouterApiKey: string;
  anthropicModel: string;
  geminiModel: string;
  openaiModel: string;
  openrouterModel: string;
}

export function isAiProvider(v: string): v is AiProvider {
  return (AI_PROVIDERS as readonly string[]).includes(v);
}

export function pickAiProviderFields(row: AiProviderSettingsRow): AiProviderSettingsFields {
  const provider = row.aiProvider && isAiProvider(row.aiProvider) ? row.aiProvider : '';
  return {
    aiProvider: provider,
    anthropicModel: row.anthropicModel,
    geminiModel: row.geminiModel,
    openaiModel: row.openaiModel,
    openrouterModel: row.openrouterModel,
  };
}

export function toPublicAiSettings(row: AiProviderSettingsRow): AiProviderSettingsPublic {
  const fields = pickAiProviderFields(row);
  return {
    ...fields,
    keys: {
      anthropic: keyStatus(row.anthropicApiKey),
      gemini: keyStatus(row.geminiApiKey),
      openai: keyStatus(row.openaiApiKey),
      openrouter: keyStatus(row.openrouterApiKey),
    },
  };
}

function keyStatus(encrypted: string): AiKeyStatus {
  const plain = decryptKeySafe(encrypted);
  if (!plain || !isUsableKey(plain)) {
    return { configured: false, masked: null };
  }
  return { configured: true, masked: maskApiKey(plain) };
}

export function maskApiKey(key: string): string {
  const t = key.trim();
  if (t.length <= 8) return '••••••••';
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

/** Decrypt a stored key column; returns '' if empty or corrupt. */
export function decryptKeySafe(encrypted: string): string {
  if (!encrypted?.trim()) return '';
  try {
    return tokenCrypto.decrypt(encrypted);
  } catch {
    return '';
  }
}

export function encryptKey(plaintext: string): string {
  return tokenCrypto.encrypt(plaintext.trim());
}

/**
 * Merge a settings patch into encrypted DB columns.
 * - Omitted key fields → unchanged
 * - Empty string key → clear that key
 * - Non-empty key → encrypt and store
 */
export function applyAiKeyPatch(
  current: AiProviderSettingsRow,
  patch: AiProviderSettingsPatch,
): Pick<
  AiProviderSettingsRow,
  EncryptedKeyField | keyof AiProviderSettingsFields
> {
  const out: Record<string, string> = {
    ...pickAiProviderFields(current),
    aiProvider:
      patch.aiProvider !== undefined
        ? patch.aiProvider
        : pickAiProviderFields(current).aiProvider,
  };

  for (const field of KEY_FIELDS) {
    if (patch[field] === undefined) continue;
    const value = patch[field]!.trim();
    out[field] = value ? encryptKey(value) : '';
  }

  if (patch.anthropicModel !== undefined) out.anthropicModel = patch.anthropicModel;
  if (patch.geminiModel !== undefined) out.geminiModel = patch.geminiModel;
  if (patch.openaiModel !== undefined) out.openaiModel = patch.openaiModel;
  if (patch.openrouterModel !== undefined) out.openrouterModel = patch.openrouterModel;

  return out as Pick<AiProviderSettingsRow, EncryptedKeyField | keyof AiProviderSettingsFields>;
}

/** Resolve the model string for a provider from settings + env defaults. */
export function modelForProvider(
  provider: AiProvider,
  fields: AiProviderSettingsFields,
): string {
  const stored =
    provider === 'anthropic'
      ? fields.anthropicModel
      : provider === 'gemini'
        ? fields.geminiModel
        : provider === 'openai'
          ? fields.openaiModel
          : fields.openrouterModel;
  return stored.trim() || DEFAULT_MODELS[provider];
}

/** Read decrypted API key for a provider from a settings row. */
export function keyForProvider(provider: AiProvider, row: AiProviderSettingsRow): string {
  const col =
    provider === 'anthropic'
      ? row.anthropicApiKey
      : provider === 'gemini'
        ? row.geminiApiKey
        : provider === 'openai'
          ? row.openaiApiKey
          : row.openrouterApiKey;
  const plain = decryptKeySafe(col);
  return isUsableKey(plain) ? plain : '';
}

/** First provider that has a usable key in the given settings row. */
export function firstConfiguredProvider(
  order: AiProvider[],
  row: AiProviderSettingsRow | null,
): AiProvider | null {
  for (const p of order) {
    if (row && keyForProvider(p, row)) return p;
  }
  return null;
}
