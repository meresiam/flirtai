"""Stage 2 — extracao de conceitos canonicos via Sonnet (tool_use forcado).

Prompt caching: o system prompt (schema + vocabulario) eh estavel entre todas
as chamadas -> marcado com cache_control. Reduz custo/latencia ~90% apos a 1a.

Idempotente: cada item tem cache em .cache/concepts/<item_id_sanitizado>.json.
Re-rodar nao re-chama a API; use clear=True ou apague o cache p/ forcar.
"""
from __future__ import annotations

import hashlib
import json
import re

import config
import llm
from logging_setup import get_logger

log = get_logger("concepts")

# Vocabulario canonico — guia o modelo a normalizar termos (nao limita a ele).
VOCABULARY = [
    "frame", "frame control", "abordagem", "cold approach", "calibragem",
    "vulnerabilidade", "kino", "escalada", "picos de emocao", "transmutacao",
    "campo", "field", "neediness", "carencia", "valor", "demonstracao de valor",
    "qualificacao", "tease", "push-pull", "rapport", "conexao", "storytelling",
    "presenca", "aura", "substrato", "proposito", "nofap", "abundancia",
    "escassez", "mistero", "antecipacao", "social proof", "lideranca",
    "masculinidade", "autenticidade", "nice guy", "rejeicao", "rebote",
    "leitura de sinais", "linguagem corporal", "fechamento", "close", "date",
]

_SYSTEM = (
    "Voce extrai CONCEITOS canonicos de seducao/conquista de um trecho de "
    "conhecimento. Use o vocabulario abaixo como guia de normalizacao (prefira "
    "esses termos quando aplicavel), mas pode emitir conceitos fora dele se forem "
    "claramente centrais. Maximo 10 conceitos por trecho. Importancia: high "
    "(o trecho e sobre isso), medium (aparece com peso), low (mencao lateral).\n\n"
    "VOCABULARIO CANONICO:\n" + ", ".join(VOCABULARY) + "\n\n"
    "Sempre responda chamando a tool extract_concepts. Nao escreva texto livre."
)

_SCHEMA = {
    "type": "object",
    "properties": {
        "concepts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "concept": {"type": "string", "description": "termo canonico, minusculo"},
                    "importance": {"type": "string", "enum": ["high", "medium", "low"]},
                },
                "required": ["concept", "importance"],
            },
        }
    },
    "required": ["concepts"],
}


def _cache_path(item_id: str):
    h = hashlib.sha1(item_id.encode()).hexdigest()[:16]
    safe = re.sub(r"[^a-z0-9_]+", "_", item_id.lower())[:60]
    return config.CONCEPT_CACHE_DIR / f"{safe}.{h}.json"


def canonical_concept(name: str) -> str:
    return re.sub(r"\s+", " ", str(name).strip().lower())


class ConceptExtractor:
    def __init__(self, dry_run: bool = False) -> None:
        self.dry_run = dry_run
        config.CONCEPT_CACHE_DIR.mkdir(parents=True, exist_ok=True)

    def extract(self, item_id: str, category: str, text: str) -> list[dict]:
        """Retorna [{concept, importance}]. Usa cache local. dry_run -> [] sem chamar."""
        cp = _cache_path(item_id)
        if cp.exists():
            try:
                return json.loads(cp.read_text())["concepts"]
            except Exception:
                pass
        if self.dry_run:
            return []
        out = llm.json_call(
            _SYSTEM,
            f"Categoria: {category}\n\nTrecho:\n{text[:4000]}",
            _SCHEMA,
            max_tokens=512,
        )
        concepts = (out or {}).get("concepts", [])[: config.CONCEPT_MAX_PER_ITEM]
        for c in concepts:
            c["concept"] = canonical_concept(c.get("concept", ""))
        cp.write_text(json.dumps({"item_id": item_id, "concepts": concepts}, ensure_ascii=False))
        return concepts
