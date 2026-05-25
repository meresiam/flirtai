-- schema.sql — schema canonico completo (aplica as migrations em ordem).
-- Uso manual:   psql "$DATABASE_URL" -f schema.sql
-- Uso program.: rag/migrate.py (psycopg, mesma ordem) — preferido, garante 1 sessao p/ AGE.
--
-- As migrations sao a fonte da verdade versionada. Este arquivo so as encadeia
-- via \ir (include relative) p/ quem quiser aplicar tudo de uma vez com psql.

\echo 'Aplicando 001_initial.sql (vector + pg_trgm + tabelas)...'
\ir migrations/001_initial.sql

\echo 'Aplicando 002_add_age.sql (Apache AGE + grafo flirtai_kb)...'
\ir migrations/002_add_age.sql

\echo 'Schema flirtai_kb pronto.'
