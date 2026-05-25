# FlirtAI RAG — Hybrid (Vector + Graph)

RAG híbrido que torna o agente FlirtAI um **especialista de domínio** em
sedução/conquista, lastreado em 8 minds de referência (~600 itens autorais +
camada de síntese cross-mind).

```
kb/  (45 YAMLs)  ──ETL──▶  Postgres 16
                            ├─ pgvector   →  busca semântica (recall)
                            └─ Apache AGE →  grafo de relações (precisão + explicabilidade)
                                    ▲
                        retrieve.py (vector | graph | hybrid+RRF)
```

## Por que graph **e** vector, não só vector

Busca vetorial sozinha responde *"o que é semanticamente parecido com a query"*.
Um especialista precisa de mais:

- **Relações entre minds** — "Greene e Glover *discordam* sobre técnica vs.
  substrato" não é semântica solta, é uma aresta `Disagreement`.
- **Autoridade situacional** — "pra abordagem de dia, os minds primários são
  Erick, Vilaverde e Krausche" vem de `PRIMARY_MIND_FOR`, não de cosseno.
- **Antídotos** — "qual técnica neutraliza carência?" é `ANTIDOTE_FOR`,
  uma relação causal que embedding não captura.
- **Consenso** — "isso é unânime entre os 8?" é `CONFIRMS` num `UniversalPrinciple`.
- **Explicabilidade** — o grafo deixa o retrieval mostrar *por que* trouxe um
  item (`--explain`), o que importa quando o agente justifica um conselho.

O vetor dá **recall**; o grafo dá **estrutura, precisão e explicação**. O modo
`hybrid` funde os dois por Reciprocal Rank Fusion.

## Setup local

Pré-requisitos: Docker (compose) + Python 3.11+.

```bash
cd rag/
cp .env.example .env            # preencha ANTHROPIC_API_KEY (concept extraction)
                                # EMBEDDING_PROVIDER=local já é grátis/offline

# 1) sobe Postgres 16 + AGE + pgvector (build na 1a vez, ~3-5 min)
docker compose up -d
#    sem Docker? veja "Runtime sem Docker" no fim.

# 2) ambiente Python
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# 3) schema + ETL
python etl.py --migrate         # cria extensões, tabelas, grafo, labels
python etl.py --dry-run         # valida parse (sem API/DB)
python etl.py                   # ETL completo (~10-15 min na 1a vez)
python etl.py --stats           # confere ~1k nodes + ~3-5k edges

# 4) consultar
python retrieve.py --query "ela sumiu 3 dias" --mode hybrid --k 5 --explain

# 5) validar qualidade
python test_retrieval.py        # golden set das 32 situations
```

### Embedding grátis por default

`EMBEDDING_PROVIDER=local` usa **intfloat/multilingual-e5-large** (1024d, multilingual, forte em
PT-BR) via `fastembed` (ONNX, sem torch, roda em CPU, offline, custo zero).
Para trocar por API paga: `EMBEDDING_PROVIDER=voyage` (+`VOYAGE_API_KEY`) ou
`openai` (+`OPENAI_API_KEY`). A dimensão é fixa em 1024 nos três — trocar exige
editar `migrations/001_initial.sql` (`vector(N)`) e rodar `--force-reembed`.

## ETL — os 6 stages

| Stage | O que faz | Custo |
|-------|-----------|-------|
| 1 parse | YAMLs (multi-doc) → itens canônicos + relações estruturais | grátis |
| 2 concepts | LLM extrai `Concept`s canônicos (cache local) → `MENTIONS_CONCEPT` + `RELATED_TO` | Gemini Flash (ou Anthropic) |
| 3 cross-mind | `UniversalPrinciple`/`Disagreement`/`Position`/`Situation` + `CONFIRMS`/`HOLDS_POSITION_IN`/`APPLIES_TO_SITUATION`/`PRIMARY_MIND_FOR`/`CONTRADICTS` | grátis |
| 4 antidote | LLM mapeia `AntiPattern.antidote` → Technique/Heuristic → `ANTIDOTE_FOR` | Gemini Flash (ou Anthropic) |
| 5 embed | vetoriza itens sem embedding (idempotente; `--force-reembed` re-faz) | local/grátis |
| 6 persist | upsert relacional (`kb_items`/`synthesis_items`) + `MERGE` no grafo | grátis |

**Idempotência:** relações via `MERGE` (Cypher), linhas via `ON CONFLICT DO UPDATE`,
embeddings pulam itens já vetorizados, conceitos têm cache em `.cache/concepts/`.
Rodar o ETL 2x não duplica nada.

```bash
python etl.py --stage 2            # só concepts
python etl.py --mind krausche      # só 1 mind
python etl.py --force-reembed      # re-vetoriza tudo
python etl.py --no-llm             # pula stages 2 e 4 (só vetor+grafo estrutural)
```

**LLM (concepts/antidote):** default `CONCEPT_PROVIDER=gemini` (`gemini-2.5-flash`,
barato). Alternativa `anthropic`. Sem chave de LLM disponível, rode `--no-llm`:
o sistema fica vetor+grafo estrutural (perde só `MENTIONS_CONCEPT`/`RELATED_TO`/
`ANTIDOTE_FOR`; a expansão por `Situation` no retrieval continua funcionando).

## Retrieval — 3 modos

```bash
# semântico puro (baseline)
python retrieve.py --query "primeira mensagem no Tinder" --mode vector

# expansão por grafo (concepts + situations compartilhados), re-rank vetorial
python retrieve.py --query "ela me chamou de amigo" --mode graph --explain

# híbrido (default): vetor top-10 + expansão grafo, fundidos por RRF
python retrieve.py --query "ela sumiu 3 dias" --mode hybrid --k 5

# filtro por eixo filosófico
python retrieve.py --query "abordagem fria" --filter-axis greene_axis
```

## Schema do grafo

```
                         ┌───────────────┐
            AUTHORED_BY   │     Mind      │   PRIMARY_MIND_FOR
        ┌────────────────▶│ greene/...    │──────────────────┐
        │                 └───────────────┘                  │
        │                   │   │   │                         ▼
        │           CONFIRMS│   │   │HOLDS_POSITION_IN   ┌───────────┐
        │                   ▼   │   ▼                    │ Situation │
   ┌──────────┐   ┌──────────────────┐  ┌──────────┐    └───────────┘
   │ Framework│   │UniversalPrinciple│  │ Position │          ▲
   │ Heuristic│   └──────────────────┘  └────┬─────┘          │ APPLIES_TO_SITUATION
   │ Technique│                              │ disagreement_id│
   │ Script   │◀── ANTIDOTE_FOR ──┐          ▼                │
   │ Diagnostic│                  │   ┌─────────────┐         │
   │ CaseStudy│───────────────────┼──▶│ Disagreement│         │
   └────┬─────┘                   │   └─────────────┘         │
        │ MENTIONS_CONCEPT        │                           │
        ▼                    ┌────┴──────┐                    │
   ┌──────────┐  CONTRADICTS │AntiPattern│────────────────────┘
   │ Concept  │◀────────────▶└───────────┘
   │  ▲ RELATED_TO (self)                    (+ SignaturePhrase, Paradox,
   └──┘                                       Obsession, Blindspot → Mind)
```

**Node labels:** Mind · Framework · Heuristic · Technique · AntiPattern ·
Script · Diagnostic · CaseStudy · SignaturePhrase · Paradox · Obsession ·
Blindspot · UniversalPrinciple · Disagreement · Position · Situation · Concept

**Edge types:** AUTHORED_BY · CONFIRMS · HOLDS_POSITION_IN ·
APPLIES_TO_SITUATION · ANTIDOTE_FOR · CONTRADICTS · RELATED_TO ·
MENTIONS_CONCEPT · EVOLUTION_OF · PRIMARY_MIND_FOR

Espelho relacional (otimizado p/ vector search): tabelas `flirtai_kb.kb_items`
e `flirtai_kb.synthesis_items` (id, mind_id, category, name, body,
`embedding vector(1024)`, `raw_metadata jsonb`).

## Cypher cheatsheet

Conecte: `docker compose exec flirtai-kb-db psql -U flirtai -d flirtai_kb`,
depois `LOAD 'age'; SET search_path = ag_catalog, "$user", public;`

```sql
-- todos os disagreements onde greene e glover divergem
SELECT * FROM cypher('flirtai_graph', $$
  MATCH (g:Mind {id:'robert_greene'})-[:HOLDS_POSITION_IN]->(p1:Position),
        (gl:Mind {id:'robert_glover'})-[:HOLDS_POSITION_IN]->(p2:Position)
  WHERE p1.disagreement_id = p2.disagreement_id
  RETURN DISTINCT p1.disagreement_id
$$) AS (disagreement agtype);

-- techniques que são antídoto de carência (neediness)
SELECT * FROM cypher('flirtai_graph', $$
  MATCH (t)-[:ANTIDOTE_FOR]->(ap:AntiPattern)-[:MENTIONS_CONCEPT]->(c:Concept)
  WHERE c.name CONTAINS 'caren' OR c.name CONTAINS 'neediness'
  RETURN t.name, ap.name
$$) AS (technique agtype, antipattern agtype);

-- minds que mencionam o conceito 'frame'
SELECT * FROM cypher('flirtai_graph', $$
  MATCH (m:Mind)<-[:AUTHORED_BY]-(i)-[:MENTIONS_CONCEPT]->(c:Concept {name:'frame'})
  RETURN DISTINCT m.id
$$) AS (mind agtype);

-- itens primários pra uma situação
SELECT * FROM cypher('flirtai_graph', $$
  MATCH (i)-[:APPLIES_TO_SITUATION]->(s:Situation)
  WHERE s.id = 'sit:abordagem_dia_publico'
  RETURN i.mind_id, i.name
$$) AS (mind agtype, item agtype);
```

## Adicionar um novo mind

1. Coleta: rode os scripts em `../scripts/` (download → transcribe) sobre as
   novas fontes; registre URLs em `../manifests/<mind>-sources.yaml`.
2. Gere os YAMLs estruturados em `../kb/` seguindo `../docs/schema-kb.yaml`
   (BR: distribuído em `kb/<categoria>/<mind>.yaml` + `kb/<mind>-meta.yaml`;
   gringo: single-file `kb/<mind>.yaml`).
3. Registre o mind em `config.py` → lista `MINDS` (id, origin, tier, alignment,
   aliases) e em `GRINGOS`/`BR_MINDS`.
4. (Opcional) adicione às `synthesis/*.yaml` se ele participa de princípios,
   disagreements ou situations.
5. ETL incremental:
   ```bash
   python etl.py --mind <novo_mind>   # parse+persist+concepts+embed só dele
   python etl.py --stage 3            # re-sincroniza cross-mind (synthesis)
   python test_retrieval.py           # confere que não regrediu
   ```

## Runtime sem Docker

Se não houver Docker, use qualquer Postgres 16 com as duas extensões
(`vector` + `age`) instaladas e aponte `DATABASE_URL` pra ele. Sem AGE, o ETL e
o retrieval **ainda funcionam** em modo vetorial/relacional (o grafo vira no-op
com aviso) — você perde a expansão por grafo e os modos `graph`/`hybrid`
degradam pra vetor.

## Layout

```
rag/
├── migrations/001_initial.sql   vector + pg_trgm + tabelas + índices
├── migrations/002_add_age.sql   AGE + grafo flirtai_kb + labels
├── schema.sql                   aplica as migrations (psql -f)
├── migrate.py                   idem via psycopg (1 sessão, p/ AGE)
├── config.py                    env + registry canônico de minds + aliases
├── db.py                        conexão psycopg + pgvector + bootstrap AGE
├── embeddings.py                adapter local|voyage|openai (1024d)
├── kb_parser.py                 Stage 1: multi-doc YAML → itens + relações
├── concepts.py                  Stage 2: extração de conceitos (LLM + cache)
├── graph.py                     helpers Cypher idempotentes (MERGE)
├── etl.py                       orquestrador 6 stages + CLI
├── retrieve.py                  vector | graph | hybrid + RRF + --explain
└── test_retrieval.py            golden set (32 situations)
```
