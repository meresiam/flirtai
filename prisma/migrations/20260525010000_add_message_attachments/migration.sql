-- W3 / C6 — Multimodal: anexos persistidos por Message.
-- Operação: ADD COLUMN JSONB NULLABLE (baixo risco, sem backfill, metadata-only).
-- Uso: shell envia print (image/png ou image/jpeg) no POST /api/coach;
-- rota repassa pra Anthropic como image block (base64) e persiste o metadado
-- + base64 inline em `message.attachments` no turno do USUARIO pra replay.
-- Shape esperado: [{ "type": "image", "mediaType": "image/png", "name": "print.png", "data": "<base64>" }]
-- Decisao MVP: base64 inline (sem R2/volume Coolify). Trocar pra URL futura nao exige migration nova.

ALTER TABLE "message" ADD COLUMN "attachments" JSONB;
