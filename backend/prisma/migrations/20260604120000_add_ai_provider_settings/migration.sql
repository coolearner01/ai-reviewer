-- AI provider configuration on user and organization settings.
-- API keys are stored encrypted at the application layer (tokenCrypto).

ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "ai_provider" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "anthropic_api_key" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "gemini_api_key" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "openai_api_key" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "openrouter_api_key" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "anthropic_model" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "gemini_model" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "openai_model" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "openrouter_model" TEXT NOT NULL DEFAULT '';

ALTER TABLE "organization_settings"
  ADD COLUMN IF NOT EXISTS "ai_provider" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "anthropic_api_key" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "gemini_api_key" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "openai_api_key" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "openrouter_api_key" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "anthropic_model" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "gemini_model" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "openai_model" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "openrouter_model" TEXT NOT NULL DEFAULT '';
