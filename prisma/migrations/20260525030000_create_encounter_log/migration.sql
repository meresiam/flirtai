-- CreateTable
CREATE TABLE "encounter_log" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "happened_at" TIMESTAMP(3) NOT NULL,
    "raw_text" TEXT NOT NULL,
    "extracted" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encounter_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "encounter_log_contact_id_happened_at_idx" ON "encounter_log"("contact_id", "happened_at" DESC);

-- AddForeignKey
ALTER TABLE "encounter_log" ADD CONSTRAINT "encounter_log_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
