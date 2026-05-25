-- W1 / C2 — Encrypt anthropic api key per-user override.
-- Antes: anthropic_api_key TEXT (plaintext) — vazamento direto se DB leakar.
-- Agora: anthropic_api_key_encrypted TEXT — AES-256-GCM via
-- src/lib/profile-watch/token-crypto.ts (chave SHA-256(BETTER_AUTH_SECRET),
-- formato base64(iv(12) || ciphertext || tag(16))).
--
-- EXPAND-CONTRACT empacotado em 1 migration porque a tabela "user" está
-- vazia em dev (nenhum registro). Em produção com dados, esta migration
-- DEVE ser splitada em 3 etapas + script de backfill:
--   1) ADD COLUMN anthropic_api_key_encrypted TEXT;
--   2) script: SELECT id, anthropic_api_key FROM "user" WHERE anthropic_api_key IS NOT NULL;
--      pra cada linha → UPDATE "user" SET anthropic_api_key_encrypted = encryptToken(plaintext);
--   3) ALTER TABLE "user" DROP COLUMN anthropic_api_key;
-- Validar coverage do backfill ANTES do DROP (count nulos vs originais).

ALTER TABLE "user" ADD COLUMN "anthropic_api_key_encrypted" TEXT;
ALTER TABLE "user" DROP COLUMN "anthropic_api_key";
