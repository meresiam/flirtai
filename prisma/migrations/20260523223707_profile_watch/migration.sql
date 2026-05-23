-- CreateEnum
CREATE TYPE "ProfileSource" AS ENUM ('self', 'competitor', 'influencer');

-- CreateEnum
CREATE TYPE "ProfilePlatform" AS ENUM ('instagram');

-- CreateEnum
CREATE TYPE "ProfileWatchStatus" AS ENUM ('active', 'paused', 'error');

-- CreateEnum
CREATE TYPE "ProfilePostType" AS ENUM ('image', 'carousel', 'reel', 'video');

-- CreateEnum
CREATE TYPE "CoachingDimension" AS ENUM ('bio', 'grid', 'cadence', 'pillars', 'engagement');

-- CreateEnum
CREATE TYPE "CoachingSeverity" AS ENUM ('info', 'suggestion', 'critical');

-- CreateTable
CREATE TABLE "monitored_profile" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source" "ProfileSource" NOT NULL,
    "platform" "ProfilePlatform" NOT NULL DEFAULT 'instagram',
    "handle" TEXT NOT NULL,
    "display_name" TEXT,
    "status" "ProfileWatchStatus" NOT NULL DEFAULT 'active',
    "last_error_message" TEXT,
    "cadence_hours" INTEGER NOT NULL DEFAULT 24,
    "last_scan_at" TIMESTAMP(3),
    "next_scan_at" TIMESTAMP(3),
    "consent_accepted_at" TIMESTAMP(3) NOT NULL,
    "consent_version" TEXT NOT NULL,
    "graph_access_token" TEXT,
    "graph_user_id" TEXT,
    "graph_token_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitored_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_snapshot" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "followers_count" INTEGER NOT NULL,
    "following_count" INTEGER NOT NULL,
    "posts_count" INTEGER NOT NULL,
    "bio" TEXT,
    "avatar_url" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "external_url" TEXT,
    "category" TEXT,
    "raw_payload" JSONB NOT NULL,

    CONSTRAINT "profile_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_post" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "shortcode" TEXT NOT NULL,
    "media_type" "ProfilePostType" NOT NULL,
    "caption" TEXT,
    "thumbnail_url" TEXT,
    "permalink" TEXT NOT NULL,
    "posted_at" TIMESTAMP(3),
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_detected_at" TIMESTAMP(3),
    "last_metrics" JSONB,

    CONSTRAINT "profile_post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_report" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "new_posts_count" INTEGER NOT NULL DEFAULT 0,
    "deleted_posts_count" INTEGER NOT NULL DEFAULT 0,
    "followers_delta" INTEGER NOT NULL DEFAULT 0,
    "engagement_avg" DOUBLE PRECISION,
    "ai_summary" TEXT NOT NULL,
    "ai_highlights" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coaching_suggestion" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "dimension" "CoachingDimension" NOT NULL,
    "severity" "CoachingSeverity" NOT NULL DEFAULT 'suggestion',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "action_items" JSONB NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coaching_suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monitored_profile_user_id_idx" ON "monitored_profile"("user_id");

-- CreateIndex
CREATE INDEX "monitored_profile_next_scan_at_status_idx" ON "monitored_profile"("next_scan_at", "status");

-- CreateIndex
CREATE UNIQUE INDEX "monitored_profile_user_id_platform_handle_key" ON "monitored_profile"("user_id", "platform", "handle");

-- CreateIndex
CREATE INDEX "profile_snapshot_profile_id_captured_at_idx" ON "profile_snapshot"("profile_id", "captured_at" DESC);

-- CreateIndex
CREATE INDEX "profile_post_profile_id_posted_at_idx" ON "profile_post"("profile_id", "posted_at" DESC);

-- CreateIndex
CREATE INDEX "profile_post_profile_id_is_deleted_idx" ON "profile_post"("profile_id", "is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "profile_post_profile_id_shortcode_key" ON "profile_post"("profile_id", "shortcode");

-- CreateIndex
CREATE INDEX "profile_report_profile_id_window_end_idx" ON "profile_report"("profile_id", "window_end" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "profile_report_profile_id_window_start_window_end_key" ON "profile_report"("profile_id", "window_start", "window_end");

-- CreateIndex
CREATE INDEX "coaching_suggestion_profile_id_acknowledged_created_at_idx" ON "coaching_suggestion"("profile_id", "acknowledged", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "monitored_profile" ADD CONSTRAINT "monitored_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_snapshot" ADD CONSTRAINT "profile_snapshot_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "monitored_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_post" ADD CONSTRAINT "profile_post_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "monitored_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_report" ADD CONSTRAINT "profile_report_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "monitored_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaching_suggestion" ADD CONSTRAINT "coaching_suggestion_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "monitored_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
