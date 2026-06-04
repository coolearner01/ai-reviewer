-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "avatar_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "api_key_encrypted" TEXT NOT NULL,
    "webhook_secret_encrypted" TEXT NOT NULL,
    "webhook_slug" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repositories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "provider" TEXT NOT NULL,
    "org_or_workspace" TEXT NOT NULL,
    "repo_name" TEXT NOT NULL,
    "repo_url" TEXT NOT NULL,
    "default_branch" TEXT,
    "language" TEXT,
    "webhook_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pull_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "repository_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "pr_url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "author" TEXT NOT NULL DEFAULT '',
    "source_branch" TEXT NOT NULL DEFAULT '',
    "target_branch" TEXT NOT NULL DEFAULT '',
    "files_changed" INTEGER NOT NULL DEFAULT 0,
    "additions" INTEGER NOT NULL DEFAULT 0,
    "deletions" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT 'open',
    "review_decision" TEXT,
    "closed_at" TIMESTAMPTZ(6),
    "merged_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pull_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pr_commits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pull_request_id" UUID NOT NULL,
    "sha" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "author" TEXT NOT NULL DEFAULT '',
    "committed_at" TIMESTAMPTZ(6),
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pr_commits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pr_checks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pull_request_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "conclusion" TEXT,
    "details_url" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pr_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pr_timeline" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pull_request_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT '',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pr_timeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pull_request_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "review_depth" TEXT NOT NULL,
    "custom_prompt" TEXT,
    "risk_score" INTEGER,
    "merge_recommendation" TEXT,
    "regression_probability" DECIMAL(3,2),
    "executive_summary" TEXT,
    "technical_summary" TEXT,
    "deployment_risk" TEXT,
    "duration_ms" INTEGER,
    "error_message" TEXT,
    "diff_cached" TEXT,
    "top_priority_fixes" JSONB NOT NULL DEFAULT '[]',
    "changed_files_analysis" JSONB NOT NULL DEFAULT '[]',
    "health" TEXT,
    "posted_to_provider_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "review_id" UUID NOT NULL,
    "agent_type" TEXT NOT NULL,
    "category" TEXT,
    "severity" TEXT NOT NULL,
    "confidence" DECIMAL(3,2) NOT NULL,
    "file" TEXT NOT NULL,
    "line" INTEGER NOT NULL,
    "end_line" INTEGER,
    "side" TEXT NOT NULL DEFAULT 'RIGHT',
    "title" TEXT NOT NULL,
    "issue" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "suggested_fix" TEXT,
    "posted_to_provider" BOOLEAN NOT NULL DEFAULT false,
    "discarded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "scopes" TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_settings" (
    "organization_id" UUID NOT NULL,
    "custom_instructions" TEXT NOT NULL DEFAULT '',
    "security_policies" TEXT NOT NULL DEFAULT '',
    "architecture_rules" TEXT NOT NULL DEFAULT '',
    "coding_guidelines" TEXT NOT NULL DEFAULT '',
    "default_review_depth" TEXT NOT NULL DEFAULT 'standard',
    "default_focus_areas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ignored_paths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "user_id" UUID NOT NULL,
    "default_review_depth" TEXT NOT NULL DEFAULT 'standard',
    "default_focus_areas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ignored_paths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "custom_instructions" TEXT NOT NULL DEFAULT '',
    "security_policies" TEXT NOT NULL DEFAULT '',
    "architecture_rules" TEXT NOT NULL DEFAULT '',
    "coding_guidelines" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "organizations_user_id_idx" ON "organizations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_user_id_slug_key" ON "organizations"("user_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_webhook_slug_key" ON "organizations"("webhook_slug");

-- CreateIndex
CREATE INDEX "repositories_user_id_idx" ON "repositories"("user_id");

-- CreateIndex
CREATE INDEX "repositories_organization_id_idx" ON "repositories"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_repo_url_key" ON "repositories"("repo_url");

-- CreateIndex
CREATE INDEX "pull_requests_repository_id_idx" ON "pull_requests"("repository_id");

-- CreateIndex
CREATE INDEX "pull_requests_state_idx" ON "pull_requests"("state");

-- CreateIndex
CREATE UNIQUE INDEX "pull_requests_pr_url_key" ON "pull_requests"("pr_url");

-- CreateIndex
CREATE INDEX "pr_commits_pull_request_id_position_idx" ON "pr_commits"("pull_request_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "pr_commits_pull_request_id_sha_key" ON "pr_commits"("pull_request_id", "sha");

-- CreateIndex
CREATE INDEX "pr_checks_pull_request_id_idx" ON "pr_checks"("pull_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "pr_checks_pull_request_id_name_key" ON "pr_checks"("pull_request_id", "name");

-- CreateIndex
CREATE INDEX "pr_timeline_pull_request_id_created_at_idx" ON "pr_timeline"("pull_request_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "pr_timeline_event_type_idx" ON "pr_timeline"("event_type");

-- CreateIndex
CREATE INDEX "reviews_pull_request_id_idx" ON "reviews"("pull_request_id");

-- CreateIndex
CREATE INDEX "reviews_status_idx" ON "reviews"("status");

-- CreateIndex
CREATE INDEX "reviews_created_at_idx" ON "reviews"("created_at" DESC);

-- CreateIndex
CREATE INDEX "review_comments_review_id_idx" ON "review_comments"("review_id");

-- CreateIndex
CREATE INDEX "review_comments_review_id_file_idx" ON "review_comments"("review_id", "file");

-- CreateIndex
CREATE UNIQUE INDEX "provider_credentials_user_id_provider_key" ON "provider_credentials"("user_id", "provider");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_commits" ADD CONSTRAINT "pr_commits_pull_request_id_fkey" FOREIGN KEY ("pull_request_id") REFERENCES "pull_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_checks" ADD CONSTRAINT "pr_checks_pull_request_id_fkey" FOREIGN KEY ("pull_request_id") REFERENCES "pull_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_timeline" ADD CONSTRAINT "pr_timeline_pull_request_id_fkey" FOREIGN KEY ("pull_request_id") REFERENCES "pull_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_pull_request_id_fkey" FOREIGN KEY ("pull_request_id") REFERENCES "pull_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

