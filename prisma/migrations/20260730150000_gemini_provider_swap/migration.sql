-- Troca de provider LLM: Anthropic -> Gemini.
-- Renomeia as colunas de override per-user e zera os valores antigos:
-- chaves Anthropic criptografadas e nomes de modelo claude-* nao servem
-- pra API Gemini.

ALTER TABLE "user" RENAME COLUMN "anthropic_api_key_encrypted" TO "gemini_api_key_encrypted";
ALTER TABLE "user" RENAME COLUMN "anthropic_model" TO "gemini_model";

UPDATE "user"
SET "gemini_api_key_encrypted" = NULL,
    "gemini_model" = NULL
WHERE "gemini_api_key_encrypted" IS NOT NULL
   OR "gemini_model" IS NOT NULL;
