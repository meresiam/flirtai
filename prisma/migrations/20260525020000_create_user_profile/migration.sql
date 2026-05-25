-- CreateTable
CREATE TABLE "user_profile" (
    "user_id" TEXT NOT NULL,
    "tone" "CoachTone",
    "age" INTEGER,
    "location_city" TEXT,
    "context_life" TEXT,
    "demographics" JSONB,
    "win_samples" JSONB NOT NULL DEFAULT '[]',
    "red_patterns_raw" JSONB NOT NULL DEFAULT '[]',
    "red_patterns" JSONB NOT NULL DEFAULT '[]',
    "onboarding_done" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profile_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
