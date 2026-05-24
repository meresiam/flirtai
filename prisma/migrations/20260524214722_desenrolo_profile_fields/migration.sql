-- CreateEnum
CREATE TYPE "ContactKind" AS ENUM ('desenrolo', 'agent chat');

-- AlterTable
ALTER TABLE "contact" ADD COLUMN     "kind" "ContactKind" NOT NULL DEFAULT 'desenrolo',
ADD COLUMN     "location" TEXT,
ADD COLUMN     "met_context" TEXT,
ADD COLUMN     "rating" DECIMAL(3,1);

-- CreateIndex
CREATE INDEX "contact_user_id_kind_updated_at_idx" ON "contact"("user_id", "kind", "updated_at" DESC);
