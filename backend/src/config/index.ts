import 'dotenv/config';
import { z } from 'zod';

/**
 * Centralised, type-safe configuration loaded from environment variables.
 *
 * Validated ONCE at process startup. If anything is missing or malformed, the
 * process exits immediately with a clear error — we never want to discover a
 * misconfigured env var inside a request handler.
 */
const ConfigSchema = z.object({
  // Server
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  // Public URL of this API as reachable from git providers (used to build the
  // webhook URL shown to the user in the setup guide). Falls back to
  // http://localhost:<PORT> for local development.
  PUBLIC_API_URL: z.string().url().optional(),

  // Auth
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // AI provider API keys (Anthropic / OpenRouter / Gemini / OpenAI) are NOT
  // read from env. They are configured per-user / per-org in the app
  // (Settings → Models), stored encrypted, and resolved at request time by
  // `resolveAiConfig`. Only the default *model* names live here as code
  // defaults — used when a settings row doesn't specify one.
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-20250514'),
  OPENROUTER_MODEL: z.string().default('google/gemini-2.5-flash'),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  OPENAI_MODEL: z.string().default('gpt-4o'),

  // Git provider credentials (GitHub / GitLab / Bitbucket) are NOT read from
  // env either. They are configured per-organization in the app
  // (Settings → API Keys), stored encrypted, and resolved at request time by
  // `providerResolver`.

  // Pipeline
  JOB_CONCURRENCY: z.coerce.number().int().positive().default(2),
  JOB_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(2),
  MIN_FINDING_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.75),

  // Token encryption (must be 64 hex chars = 32 bytes for AES-256)
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)')
    .default('0'.repeat(64)),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

function loadConfig(): AppConfig {
  const parsed = ConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    // eslint-disable-next-line no-console
    console.error(`\n[config] Invalid environment variables:\n${issues}\n`);
    process.exit(1);
  }
  // AI provider keys are configured per-user / per-org in Settings → Models,
  // not via env — so there is nothing to validate here at startup.
  return parsed.data;
}

export const config = loadConfig();
export const isProd = config.NODE_ENV === 'production';
export const isDev = config.NODE_ENV === 'development';

/**
 * Treat empty strings, the env-example placeholders ("sk-ant-xxx"), and obvious
 * dummy values as "not configured" so callers don't waste a request on a 401.
 * Shared by the AI client (provider selection) and /health (status reporting).
 */
export function isUsableKey(key: string | undefined): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  if (trimmed.length < 8) return false;
  if (/^(sk-ant-xxx|sk-or-xxx|change_me|replace_me|xxx+)$/i.test(trimmed)) return false;
  return true;
}
