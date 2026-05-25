-- CreateEnum
CREATE TYPE "CoachTone" AS ENUM ('low_key', 'direto', 'provocador');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "coach_tone" "CoachTone",
ADD COLUMN     "locale" TEXT,
ADD COLUMN     "notification_prefs" JSONB,
ADD COLUMN     "timezone" TEXT;
