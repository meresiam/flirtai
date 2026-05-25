"""Cliente LLM unificado p/ structured output (Stages 2 e 4).

Providers: gemini (default, barato — REST via stdlib, sem dep nova) | anthropic (SDK).
Ambos retornam um dict ja parseado conforme o schema JSON passado.

Gemini usa responseSchema + responseMimeType=application/json (JSON mode).
Anthropic usa tool_use forcado. A chamada eh a mesma pra quem chama: json_call().
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request

from tenacity import retry, stop_after_attempt, wait_exponential

import config
from logging_setup import get_logger

log = get_logger("llm")

_GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
)


def available() -> tuple[bool, str]:
    """(ok, motivo) — se o provider configurado tem chave."""
    if config.CONCEPT_PROVIDER == "gemini":
        return (bool(config.GEMINI_API_KEY), "GEMINI_API_KEY ausente")
    if config.CONCEPT_PROVIDER == "anthropic":
        return (bool(config.ANTHROPIC_API_KEY), "ANTHROPIC_API_KEY ausente")
    return (False, f"CONCEPT_PROVIDER desconhecido: {config.CONCEPT_PROVIDER}")


@retry(stop=stop_after_attempt(4), wait=wait_exponential(multiplier=1, max=20))
def json_call(system_text: str, user_text: str, schema: dict, max_tokens: int = 512) -> dict:
    """Retorna dict conforme `schema` (JSON Schema simples: object/array/enum)."""
    if config.CONCEPT_PROVIDER == "gemini":
        return _gemini(system_text, user_text, schema, max_tokens)
    return _anthropic(system_text, user_text, schema, max_tokens)


# --- Gemini (REST, stdlib) -------------------------------------------------
def _gemini(system_text: str, user_text: str, schema: dict, max_tokens: int) -> dict:
    if not config.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY ausente")
    body = {
        "system_instruction": {"parts": [{"text": system_text}]},
        "contents": [{"role": "user", "parts": [{"text": user_text}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": _to_gemini_schema(schema),
            "maxOutputTokens": max_tokens,
            "temperature": 0,
        },
    }
    url = _GEMINI_URL.format(model=config.GEMINI_MODEL, key=config.GEMINI_API_KEY)
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="ignore")[:300]
        raise RuntimeError(f"Gemini HTTP {e.code}: {detail}") from e
    parts = data["candidates"][0]["content"]["parts"]
    text = "".join(p.get("text", "") for p in parts)
    return json.loads(text)


def _to_gemini_schema(schema: dict) -> dict:
    """JSON Schema -> subset aceito pelo Gemini (type maiusculo nao necessario na v1beta)."""
    # a v1beta aceita type minusculo + properties/items/enum/required; passa direto.
    return schema


# --- Anthropic (SDK, tool_use) ---------------------------------------------
def _anthropic(system_text: str, user_text: str, schema: dict, max_tokens: int) -> dict:
    import anthropic

    if not config.ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY ausente")
    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
    tool = {"name": "emit", "description": "Emite a resposta estruturada.", "input_schema": schema}
    msg = client.messages.create(
        model=config.ANTHROPIC_MODEL_LLM,
        max_tokens=max_tokens,
        system=[{"type": "text", "text": system_text, "cache_control": {"type": "ephemeral"}}],
        tools=[tool],
        tool_choice={"type": "tool", "name": "emit"},
        messages=[{"role": "user", "content": user_text}],
    )
    for block in msg.content:
        if block.type == "tool_use":
            return block.input
    return {}
