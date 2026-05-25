-- 002_add_age.sql — Apache AGE: grafo flirtai_graph + labels pre-criados.
-- Idempotente: guards via ag_catalog. LOAD 'age' eh por-sessao; este arquivo
-- precisa rodar inteiro numa unica conexao (psql -f / migrate.py faz isso).

CREATE EXTENSION IF NOT EXISTS age;
LOAD 'age';
SET search_path = ag_catalog, "$user", public;

-- grafo (create_graph nao eh idempotente -> guard)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM ag_catalog.ag_graph WHERE name = 'flirtai_graph') THEN
        PERFORM ag_catalog.create_graph('flirtai_graph');
    END IF;
END $$;

-- Pre-cria vertex labels (evita "label does not exist" em MATCH antes do 1o insert).
-- create_vlabel falha se ja existe -> guard por catalogo.
DO $$
DECLARE
    lbl text;
    vlabels text[] := ARRAY[
        'Mind','Framework','Heuristic','Technique','AntiPattern','Script',
        'Diagnostic','CaseStudy','SignaturePhrase','Paradox','Obsession',
        'Blindspot','UniversalPrinciple','Disagreement','Position',
        'Situation','Concept'
    ];
    gid oid;
BEGIN
    SELECT graphid INTO gid FROM ag_catalog.ag_graph WHERE name = 'flirtai_graph';
    FOREACH lbl IN ARRAY vlabels LOOP
        IF NOT EXISTS (
            SELECT 1 FROM ag_catalog.ag_label
            WHERE name = lbl AND graph = gid AND kind = 'v'
        ) THEN
            EXECUTE format('SELECT ag_catalog.create_vlabel(%L, %L)', 'flirtai_graph', lbl);
        END IF;
    END LOOP;
END $$;

-- Pre-cria edge labels.
DO $$
DECLARE
    lbl text;
    elabels text[] := ARRAY[
        'AUTHORED_BY','CONFIRMS','HOLDS_POSITION_IN','APPLIES_TO_SITUATION',
        'ANTIDOTE_FOR','CONTRADICTS','RELATED_TO','MENTIONS_CONCEPT',
        'EVOLUTION_OF','PRIMARY_MIND_FOR'
    ];
    gid oid;
BEGIN
    SELECT graphid INTO gid FROM ag_catalog.ag_graph WHERE name = 'flirtai_graph';
    FOREACH lbl IN ARRAY elabels LOOP
        IF NOT EXISTS (
            SELECT 1 FROM ag_catalog.ag_label
            WHERE name = lbl AND graph = gid AND kind = 'e'
        ) THEN
            EXECUTE format('SELECT ag_catalog.create_elabel(%L, %L)', 'flirtai_graph', lbl);
        END IF;
    END LOOP;
END $$;
