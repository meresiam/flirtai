-- 001_initial.sql — extensoes vetor/trgm + tabelas relacionais espelho do grafo.
-- Idempotente: roda 2x sem erro (IF NOT EXISTS em tudo).
-- Lock de dimensao: vector(1024) — vale pra voyage-3-large, bge-m3 e openai(dims=1024).
-- Trocar de dim exige editar este arquivo + re-embedar (etl.py --force-reembed).

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE SCHEMA IF NOT EXISTS flirtai_kb;

-- ---------------------------------------------------------------------------
-- kb_items — itens autorais dos minds (frameworks, heuristics, techniques,
-- anti_patterns, scripts, diagnostics, case_studies + meta: signature_phrase,
-- paradox, obsession, blindspot). Espelho relacional do grafo, otimizado pra
-- vector search rapido.
-- id global = "<mind_id>:<category>:<item_id>"  (ex: "krausche:frameworks:metodo_desenrolado")
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flirtai_kb.kb_items (
    id            text PRIMARY KEY,
    mind_id       text NOT NULL,
    category      text NOT NULL,
    name          text NOT NULL DEFAULT '',
    body          text NOT NULL DEFAULT '',     -- texto serializado p/ embedding e leitura
    source_refs   text[] NOT NULL DEFAULT '{}',
    raw_metadata  jsonb  NOT NULL DEFAULT '{}',  -- dict YAML original completo
    embedding     vector(1024),                  -- NULL ate o stage 5
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- synthesis_items — camada cross-mind: universal_principle, disagreement,
-- position, situation, concept. Mesma estrutura de busca vetorial.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flirtai_kb.synthesis_items (
    id            text PRIMARY KEY,
    kind          text NOT NULL,                 -- universal_principle|disagreement|position|situation|concept
    title         text NOT NULL DEFAULT '',
    body          text NOT NULL DEFAULT '',
    raw_metadata  jsonb  NOT NULL DEFAULT '{}',
    embedding     vector(1024),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indices
-- ---------------------------------------------------------------------------
-- Vetorial (cosine). lists=25 conforme spec — bom p/ ~600-1000 linhas.
-- ivfflat exige ANALYZE apos popular p/ planner usar; etl.py roda ANALYZE no fim.
CREATE INDEX IF NOT EXISTS kb_items_embedding_ivf
    ON flirtai_kb.kb_items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 25);
CREATE INDEX IF NOT EXISTS synthesis_items_embedding_ivf
    ON flirtai_kb.synthesis_items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 25);

-- jsonb (filtros por campo do metadata)
CREATE INDEX IF NOT EXISTS kb_items_metadata_gin
    ON flirtai_kb.kb_items USING gin (raw_metadata);
CREATE INDEX IF NOT EXISTS synthesis_items_metadata_gin
    ON flirtai_kb.synthesis_items USING gin (raw_metadata);

-- trigram no titulo/nome (busca lexical / fuzzy)
CREATE INDEX IF NOT EXISTS kb_items_name_trgm
    ON flirtai_kb.kb_items USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS synthesis_items_title_trgm
    ON flirtai_kb.synthesis_items USING gin (title gin_trgm_ops);

-- filtros relacionais frequentes
CREATE INDEX IF NOT EXISTS kb_items_mind_idx     ON flirtai_kb.kb_items (mind_id);
CREATE INDEX IF NOT EXISTS kb_items_category_idx ON flirtai_kb.kb_items (category);
CREATE INDEX IF NOT EXISTS synthesis_items_kind_idx ON flirtai_kb.synthesis_items (kind);
