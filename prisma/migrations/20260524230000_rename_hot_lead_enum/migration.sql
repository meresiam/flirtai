-- Wave 0 / C9 — Naming Lock para ContactStatus enum.
-- Antes: o literal de DB era 'hot lead' (com espaço) e o app mapeava via Prisma @map.
-- Agora: enum literal vira 'hot_lead' (sem @map), batendo com TS/coach-schema/UI.
-- Postgres 10+ suporta rename atômico de enum value sem rewrite de dados.
ALTER TYPE "ContactStatus" RENAME VALUE 'hot lead' TO 'hot_lead';
