export const AI_PROVIDERS = ['anthropic', 'gemini', 'openai', 'openrouter'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: 'Anthropic (Claude)',
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
};

export const AI_PROVIDER_SUBLABELS: Record<AiProvider, string> = {
  anthropic: 'Claude family models',
  gemini: 'Gemini family models',
  openai: 'GPT & o-series models',
  openrouter: 'Access 200+ models via one key',
};

export const DEFAULT_MODEL_HINTS: Record<AiProvider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o',
  openrouter: 'google/gemini-2.5-flash',
};

/** Per-provider model options shown in the dropdowns. */
export const PROVIDER_MODEL_OPTIONS: Record<AiProvider, string[]> = {
  anthropic: [
    'claude-opus-4-20250514',
    'claude-sonnet-4-20250514',
    'claude-sonnet-4-6',
    'claude-haiku-4-5',
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
  ],
  gemini: [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
  ],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3', 'o4-mini'],
  openrouter: [
    'google/gemini-2.5-flash',
    'google/gemini-2.0-flash-exp:free',
    'anthropic/claude-sonnet-4',
    'openai/gpt-4o',
    'google/gemini-2.5-pro',
    'meta-llama/llama-3.3-70b',
    'mistralai/mistral-large',
    'qwen/qwen3-coder:free',
    'openrouter/free',
  ],
};

export const OPENROUTER_MODEL_PRESETS = [
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (free)' },
  { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4' },
  { id: 'openai/gpt-4o', label: 'GPT-4o' },
  { id: 'qwen/qwen3-coder:free', label: 'Qwen3 Coder (free)' },
  { id: 'openrouter/free', label: 'OpenRouter Free (auto)' },
] as const;
