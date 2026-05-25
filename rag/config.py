"""Config central do RAG FlirtAI: env, paths, registry canonico de minds.

Tudo que o resto do pipeline precisa saber sobre "quem e quem" e "onde estao
as coisas" vive aqui. Sem efeitos colaterais alem de ler .env.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# rag/ e KB ----------------------------------------------------------------
RAG_DIR = Path(__file__).resolve().parent
REPO_ROOT = RAG_DIR.parent
KB_DIR = REPO_ROOT / "kb"
SYNTHESIS_DIR = KB_DIR / "synthesis"
CACHE_DIR = RAG_DIR / ".cache"
CONCEPT_CACHE_DIR = CACHE_DIR / "concepts"
MIGRATIONS_DIR = RAG_DIR / "migrations"

load_dotenv(RAG_DIR / ".env")
load_dotenv(REPO_ROOT / ".env", override=False)  # reaproveita ANTHROPIC_API_KEY do app
# .env raiz do MeresClaude (L2): GEMINI_API_KEY vive la. So preenche o que faltar.
_MERESCLAUDE_ENV = REPO_ROOT.parents[1] / ".env"  # projetos/flirtai -> projetos -> MeresClaude
if _MERESCLAUDE_ENV.exists():
    load_dotenv(_MERESCLAUDE_ENV, override=False)

# Env ----------------------------------------------------------------------
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://flirtai:flirtai_dev_pass@localhost:5433/flirtai_kb",
)
GRAPH_NAME = "flirtai_graph"   # nome do grafo AGE (cria schema homonimo)
SCHEMA = "flirtai_kb"          # schema relacional (kb_items / synthesis_items)

EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "local").lower()  # local|voyage|openai
EMBEDDING_DIMS = int(os.getenv("EMBEDDING_DIMS", "1024"))
EMBEDDING_BATCH = int(os.getenv("EMBEDDING_BATCH", "32"))
LOCAL_EMBEDDING_MODEL = os.getenv("LOCAL_EMBEDDING_MODEL", "intfloat/multilingual-e5-large")
VOYAGE_API_KEY = os.getenv("VOYAGE_API_KEY", "")
VOYAGE_MODEL = os.getenv("EMBEDDING_MODEL", "voyage-3-large")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-large")

# LLM p/ concept extraction (Stage 2) + antidote (Stage 4).
# CONCEPT_PROVIDER = gemini (default, barato) | anthropic
CONCEPT_PROVIDER = os.getenv("CONCEPT_PROVIDER", "gemini").lower()
CONCEPT_MAX_PER_ITEM = int(os.getenv("CONCEPT_MAX_PER_ITEM", "10"))

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL_LLM = os.getenv("CONCEPT_EXTRACTOR_MODEL", "claude-sonnet-4-6")

# Gemini lido do .env do rag OU do .env raiz do MeresClaude (L2), nessa ordem.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# modelo efetivo do provider escolhido
CONCEPT_EXTRACTOR_MODEL = GEMINI_MODEL if CONCEPT_PROVIDER == "gemini" else ANTHROPIC_MODEL_LLM


# Registry canonico de minds ----------------------------------------------
@dataclass(frozen=True)
class Mind:
    id: str            # id canonico (igual ao mind_id dos YAML autorais)
    name: str
    origin: str        # usa | br
    tier: str          # foundation | depth | flavor
    alignment: str     # greene_axis | glover_axis | hybrid
    aliases: tuple[str, ...] = field(default_factory=tuple)


MINDS: list[Mind] = [
    Mind("robert_greene", "Robert Greene", "usa", "foundation", "greene_axis", ("greene",)),
    Mind("neil_strauss",  "Neil Strauss",  "usa", "foundation", "hybrid",      ("strauss",)),
    Mind("robert_glover", "Robert Glover", "usa", "foundation", "glover_axis", ("glover",)),
    Mind("krausche",      "Lucas Krausche (Desenrolado)", "br", "depth",  "greene_axis"),
    Mind("vilaverde",     "Vilaverde",      "br", "depth",  "greene_axis"),
    Mind("donadelli",     "Donadelli",      "br", "flavor", "glover_axis"),
    Mind("pedrinho_uol",  "Pedrinho UOL",   "br", "flavor", "hybrid"),
    Mind("erick_ronaldo", "Erick Ronaldo",  "br", "flavor", "greene_axis"),
]

_MIND_BY_KEY: dict[str, Mind] = {}
for _m in MINDS:
    _MIND_BY_KEY[_m.id] = _m
    for _a in _m.aliases:
        _MIND_BY_KEY[_a] = _m


def canonical_mind(key: str) -> str:
    """Resolve 'greene'->'robert_greene', 'robert_greene'->'robert_greene'.

    Refs nos YAML misturam forma curta (situations) e longa (confirmed_by).
    Desconhecido retorna o proprio (lower) — nao explode, so nao linka.
    """
    if not key:
        return ""
    k = key.strip().lower()
    m = _MIND_BY_KEY.get(k)
    return m.id if m else k


def mind(key: str) -> Mind | None:
    return _MIND_BY_KEY.get(canonical_mind(key))


# Categorias autorais (BR distribuido + chave dentro do single-file gringo)
CONTENT_CATEGORIES = [
    "frameworks", "heuristics", "techniques", "anti_patterns",
    "scripts", "diagnostics", "case_studies",
]
# nome de pasta BR -> chave canonica (anti-patterns/ -> anti_patterns, case-studies/ -> case_studies)
DIR_TO_CATEGORY = {
    "frameworks": "frameworks", "heuristics": "heuristics", "techniques": "techniques",
    "anti-patterns": "anti_patterns", "scripts": "scripts",
    "diagnostics": "diagnostics", "case-studies": "case_studies",
}
META_CATEGORIES = ["signature_phrases", "paradoxes", "obsessions", "blindspots"]

# categoria autoral -> label de no no grafo
CATEGORY_TO_LABEL = {
    "frameworks": "Framework",
    "heuristics": "Heuristic",
    "techniques": "Technique",
    "anti_patterns": "AntiPattern",
    "scripts": "Script",
    "diagnostics": "Diagnostic",
    "case_studies": "CaseStudy",
    "signature_phrases": "SignaturePhrase",
    "paradoxes": "Paradox",
    "obsessions": "Obsession",
    "blindspots": "Blindspot",
}

GRINGOS = ["robert_greene", "neil_strauss", "robert_glover"]
BR_MINDS = ["krausche", "vilaverde", "donadelli", "pedrinho_uol", "erick_ronaldo"]
