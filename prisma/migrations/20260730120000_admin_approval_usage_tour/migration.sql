-- Gate de aprovação manual de cadastros.
ALTER TABLE "user" ADD COLUMN "approved_at" TIMESTAMP(3);

-- Backfill: usuários já existentes (criados antes do gate) ficam aprovados.
UPDATE "user" SET "approved_at" = CURRENT_TIMESTAMP;

-- Tracking de tokens por chamada LLM (monitoramento de gasto em /admin).
ALTER TABLE "usage_log" ADD COLUMN "model" TEXT;
ALTER TABLE "usage_log" ADD COLUMN "input_tokens" INTEGER;
ALTER TABLE "usage_log" ADD COLUMN "output_tokens" INTEGER;
ALTER TABLE "usage_log" ADD COLUMN "cache_read_tokens" INTEGER;
ALTER TABLE "usage_log" ADD COLUMN "cache_creation_tokens" INTEGER;

-- Tour guiado de UI.
ALTER TABLE "user_profile" ADD COLUMN "tour_seen_at" TIMESTAMP(3);
