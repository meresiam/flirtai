-- W6+ — contextLife vira multi-seleção (String[]).
-- Converte o valor único existente em array de 1 elemento; NULL vira array vazio.
-- Preserva dados em produção (expand: muda o tipo da coluna sem perder respostas).
ALTER TABLE "user_profile"
  ALTER COLUMN "context_life" DROP DEFAULT,
  ALTER COLUMN "context_life" TYPE text[] USING (
    CASE
      WHEN "context_life" IS NULL THEN ARRAY[]::text[]
      ELSE ARRAY["context_life"]
    END
  ),
  ALTER COLUMN "context_life" SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN "context_life" SET NOT NULL;
