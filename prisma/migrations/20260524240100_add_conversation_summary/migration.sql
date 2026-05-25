-- W1 / C5 — Rolling conversation summary por Contact.
-- Operação: ADD COLUMN NULLABLE (baixo risco, sem backfill, metadata-only).
-- Uso: gerado via Haiku 4.5 (claude-haiku-4-5-20251001) quando messages.count > 30;
-- injetado no system prompt antes das últimas 20 mensagens do /api/coach.

ALTER TABLE "contact" ADD COLUMN "conversation_summary" TEXT;
