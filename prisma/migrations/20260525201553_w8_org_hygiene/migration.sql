-- AlterTable
ALTER TABLE "contact" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "folder_id" TEXT,
ADD COLUMN     "pinned_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "message" ADD COLUMN     "sent_irl_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "folder" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_preference" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_preference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "folder_user_id_order_idx" ON "folder"("user_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "folder_user_id_name_key" ON "folder"("user_id", "name");

-- CreateIndex
CREATE INDEX "tag_preference_user_id_idx" ON "tag_preference"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tag_preference_user_id_label_key" ON "tag_preference"("user_id", "label");

-- CreateIndex
CREATE INDEX "contact_user_id_archived_at_pinned_at_updated_at_idx" ON "contact"("user_id", "archived_at", "pinned_at" DESC, "updated_at" DESC);

-- CreateIndex
CREATE INDEX "contact_user_id_folder_id_idx" ON "contact"("user_id", "folder_id");

-- AddForeignKey
ALTER TABLE "contact" ADD CONSTRAINT "contact_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder" ADD CONSTRAINT "folder_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_preference" ADD CONSTRAINT "tag_preference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
