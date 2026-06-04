-- User-managed custom review prompts. Enabled prompts are injected into every
-- review's instructions so the AI considers all selected prompts when reviewing.

-- CreateTable
CREATE TABLE IF NOT EXISTS "review_prompts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "review_prompts_user_id_idx" ON "review_prompts"("user_id");

-- AddForeignKey
ALTER TABLE "review_prompts"
  ADD CONSTRAINT "review_prompts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
