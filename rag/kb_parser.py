"""Stage 1 — parse de toda a KB para itens canonicos + relacoes estruturais.

Formatos cobertos:
  - BR distribuido: kb/<categoria>/<mind>.yaml  (multi-doc: header + lista)
  - Gringos single-file: kb/<mind>.yaml         (1 doc, varias categorias)
  - Meta: kb/<mind>-meta.yaml                    (signature_phrases/paradoxes/...)
  - Synthesis: kb/synthesis/{universal_principles,disagreements,situation_index}.yaml

Saida: ParsedKB com items (autorais+meta), synth (cross-mind) e relations
estruturais ja inferidas (AUTHORED_BY, CONFIRMS, HOLDS_POSITION_IN,
APPLIES_TO_SITUATION, PRIMARY_MIND_FOR, EVOLUTION_OF).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml

import config
from logging_setup import get_logger

log = get_logger("parser")


# ---------------------------------------------------------------------------
# Modelos
# ---------------------------------------------------------------------------
@dataclass
class Item:
    id: str                      # "<mind>:<category>:<item_id>"
    mind_id: str
    category: str                # frameworks|...|signature_phrases|paradoxes|...
    label: str                   # node label (Framework, Heuristic, ...)
    name: str
    body: str                    # texto serializado p/ embedding + leitura
    source_refs: list[str] = field(default_factory=list)
    raw: dict = field(default_factory=dict)
    local_id: str = ""           # id "cru" dentro do mind (p/ resolver refs)


@dataclass
class SynthItem:
    id: str
    kind: str                    # universal_principle|disagreement|position|situation
    title: str
    body: str
    raw: dict = field(default_factory=dict)


@dataclass
class Relation:
    edge: str                    # AUTHORED_BY|CONFIRMS|...
    src_label: str
    src_key: str
    dst_label: str
    dst_key: str
    props: dict = field(default_factory=dict)


@dataclass
class ParsedKB:
    items: list[Item] = field(default_factory=list)
    synth: list[SynthItem] = field(default_factory=list)
    relations: list[Relation] = field(default_factory=list)
    # indice (mind_id, local_id) -> global item id, p/ resolver refs de situations
    _ref_index: dict[tuple[str, str], str] = field(default_factory=dict)

    def resolve_ref(self, ref: str) -> tuple[str, str] | None:
        """Resolve 'mind:item' ou 'mind:categoria:item' -> (label, global_id).

        Retorna None se nao achar o item carregado.
        """
        parts = ref.split(":")
        if len(parts) == 2:
            mind, local = config.canonical_mind(parts[0]), parts[1]
        elif len(parts) >= 3:
            mind, local = config.canonical_mind(parts[0]), parts[-1]
        else:
            return None
        gid = self._ref_index.get((mind, local))
        if not gid:
            return None
        # acha label do item
        for it in self.items:
            if it.id == gid:
                return it.label, gid
        return None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _load_merged(path: Path) -> dict:
    """safe_load_all + merge de dicts; concatena listas de mesma chave."""
    merged: dict = {}
    with open(path, encoding="utf-8") as fh:
        for doc in yaml.safe_load_all(fh):
            if isinstance(doc, dict):
                for k, v in doc.items():
                    if k in merged and isinstance(merged[k], list) and isinstance(v, list):
                        merged[k] += v
                    else:
                        merged[k] = v
    return merged


def _slug(text: str, maxlen: int = 48) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", str(text).lower()).strip("_")
    return s[:maxlen] or "x"


def _as_text(v) -> str:
    if v is None:
        return ""
    if isinstance(v, str):
        return v.strip()
    if isinstance(v, list):
        return "\n".join(f"- {_as_text(x)}" for x in v)
    if isinstance(v, dict):
        return "\n".join(f"{k}: {_as_text(val)}" for k, val in v.items())
    return str(v)


# campos que NAO entram na contagem de itens nem viram body principal
_NON_ITEM_KEYS = {
    "mind_id", "display_name", "origin", "tier", "philosophical_alignment",
    "philosophical_axis", "schema_version", "generated", "source_material",
    "category", "notes", "priority",
}


def _build_body(category: str, mind_name: str, d: dict) -> tuple[str, str]:
    """Retorna (name, body_text) serializado p/ embedding."""
    name = (
        d.get("name") or d.get("title") or d.get("rule")
        or d.get("situation") or d.get("quote") or d.get("paradox")
        or d.get("theme") or d.get("gap") or d.get("id") or ""
    )
    name = _as_text(name)[:160]
    lines = [f"[{config.CATEGORY_TO_LABEL.get(category, category)}] {mind_name}", f"{name}"]
    # ordem de campos ricos por categoria
    for k in ("description", "rationale", "rule", "structure", "when", "when_to_use",
              "script_examples", "scripts", "variants", "symptoms", "consequence",
              "antidote", "signals_to_read", "interpretation_options", "narrative",
              "lessons", "examples", "counter_example", "risk", "mastery_signal",
              "context", "explanation"):
        if k in d and d[k]:
            lines.append(f"{k}: {_as_text(d[k])}")
    return name, "\n".join(l for l in lines if l).strip()


# ---------------------------------------------------------------------------
# Parsers por fonte
# ---------------------------------------------------------------------------
def _parse_authorial(kb: ParsedKB, mind_id: str, category: str, items_list: list, mind_name: str) -> None:
    for i, raw in enumerate(items_list):
        if not isinstance(raw, dict):
            # script/lista de strings solta -> embrulha
            raw = {"id": f"{category}_{i}", "description": raw}
        local = _slug(raw.get("id") or raw.get("name") or raw.get("title") or f"{category}_{i}")
        gid = f"{mind_id}:{category}:{local}"
        name, body = _build_body(category, mind_name, raw)
        label = config.CATEGORY_TO_LABEL[category]
        kb.items.append(Item(
            id=gid, mind_id=mind_id, category=category, label=label,
            name=name, body=body, source_refs=list(raw.get("source_refs") or []),
            raw=raw, local_id=local,
        ))
        kb._ref_index[(mind_id, local)] = gid
        kb.relations.append(Relation("AUTHORED_BY", label, gid, "Mind", mind_id))
        # EVOLUTION_OF best-effort (campos opcionais que possam existir)
        for ev_field in ("evolution_of", "supersedes", "evolves"):
            tgt = raw.get(ev_field)
            if isinstance(tgt, str) and tgt:
                kb.relations.append(Relation(
                    "EVOLUTION_OF", label, gid, label, f"{mind_id}:{category}:{_slug(tgt)}"
                ))


def _parse_meta(kb: ParsedKB, path: Path) -> None:
    d = _load_merged(path)
    mind_id = config.canonical_mind(d.get("mind_id", path.stem.replace("-meta", "")))
    m = config.mind(mind_id)
    mind_name = m.name if m else mind_id
    for meta_cat in config.META_CATEGORIES:
        for i, raw in enumerate(d.get(meta_cat, []) or []):
            if isinstance(raw, dict):
                text = raw.get("quote") or raw.get("paradox") or raw.get("theme") or raw.get("gap") or _as_text(raw)
            else:
                text = _as_text(raw)
                raw = {meta_cat[:-1]: text}
            local = f"{meta_cat}_{i}_{_slug(text, 24)}"
            gid = f"{mind_id}:{meta_cat}:{local}"
            label = config.CATEGORY_TO_LABEL[meta_cat]
            name, body = _build_body(meta_cat, mind_name, raw if isinstance(raw, dict) else {"text": text})
            name = name or _as_text(text)[:160]
            kb.items.append(Item(
                id=gid, mind_id=mind_id, category=meta_cat, label=label,
                name=name, body=body or text, raw=raw if isinstance(raw, dict) else {"text": text},
                local_id=local,
            ))
            kb._ref_index[(mind_id, local)] = gid
            kb.relations.append(Relation("AUTHORED_BY", label, gid, "Mind", mind_id))


def _parse_gringo(kb: ParsedKB, path: Path) -> None:
    d = _load_merged(path)
    mind_id = config.canonical_mind(d.get("mind_id", path.stem))
    m = config.mind(mind_id)
    mind_name = m.name if m else mind_id
    for category in config.CONTENT_CATEGORIES:
        items_list = d.get(category) or []
        if items_list:
            _parse_authorial(kb, mind_id, category, items_list, mind_name)
    # meta embutido no single-file gringo
    for meta_cat in config.META_CATEGORIES:
        for i, raw in enumerate(d.get(meta_cat, []) or []):
            if isinstance(raw, dict):
                text = raw.get("quote") or raw.get("paradox") or raw.get("theme") or raw.get("gap") or _as_text(raw)
            else:
                text = _as_text(raw); raw = {meta_cat[:-1]: text}
            local = f"{meta_cat}_{i}_{_slug(text, 24)}"
            gid = f"{mind_id}:{meta_cat}:{local}"
            label = config.CATEGORY_TO_LABEL[meta_cat]
            name, body = _build_body(meta_cat, mind_name, raw)
            kb.items.append(Item(
                id=gid, mind_id=mind_id, category=meta_cat, label=label,
                name=name or text[:160], body=body or text, raw=raw, local_id=local,
            ))
            kb._ref_index[(mind_id, local)] = gid
            kb.relations.append(Relation("AUTHORED_BY", label, gid, "Mind", mind_id))


def _parse_synthesis(kb: ParsedKB) -> None:
    # --- universal principles -> CONFIRMS ---
    up = _load_merged(config.SYNTHESIS_DIR / "universal_principles.yaml")
    for p in up.get("universal_principles", []) or []:
        pid = f"up:{_slug(p.get('id', p.get('principle', '')))}"
        body = f"{p.get('principle','')}\nforca: {p.get('strength','')}\nconfirmado por: {', '.join(p.get('confirmed_by', []))}"
        kb.synth.append(SynthItem(pid, "universal_principle", _as_text(p.get("principle"))[:200], body, p))
        for mid in p.get("confirmed_by", []) or []:
            cm = config.canonical_mind(mid)
            kb.relations.append(Relation(
                "CONFIRMS", "Mind", cm, "UniversalPrinciple", pid,
                {"strength": p.get("strength", "")},
            ))

    # --- disagreements -> Position nodes + HOLDS_POSITION_IN + CONTRADICTS ---
    dis = _load_merged(config.SYNTHESIS_DIR / "disagreements.yaml")
    for d in dis.get("disagreements", []) or []:
        did = f"dis:{_slug(d.get('id', d.get('topic', '')))}"
        dbody = f"{d.get('topic','')}\nflirtai_decision: {_as_text(d.get('flirtai_decision'))}\n{_as_text(d.get('situational_rules'))}"
        kb.synth.append(SynthItem(did, "disagreement", _as_text(d.get("topic"))[:200], dbody, d))
        ev_by_mind: dict[str, list[str]] = {}
        for pos in d.get("positions", []) or []:
            cm = config.canonical_mind(pos.get("mind_id", ""))
            posid = f"pos:{_slug(d.get('id',''))}:{cm}"
            pbody = f"{pos.get('position','')}\nrazao: {pos.get('reasoning','')}"
            sraw = dict(pos); sraw["disagreement_id"] = did
            kb.synth.append(SynthItem(posid, "position", _as_text(pos.get("position"))[:200], pbody, sraw))
            kb.relations.append(Relation("HOLDS_POSITION_IN", "Mind", cm, "Position", posid,
                                         {"disagreement_id": did}))
            # evidencia -> resolve refs p/ CONTRADICTS depois
            ev = pos.get("evidence", "")
            refs = re.findall(r"[a-z_]+:[a-z_]+:[a-z0-9_]+", str(ev))
            ev_by_mind[cm] = refs
        # CONTRADICTS entre evidencias de minds diferentes do mesmo disagreement
        minds_in = list(ev_by_mind.keys())
        for a in range(len(minds_in)):
            for b in range(a + 1, len(minds_in)):
                for ra in ev_by_mind[minds_in[a]][:3]:
                    for rb in ev_by_mind[minds_in[b]][:3]:
                        kb.relations.append(Relation(
                            "CONTRADICTS", "ITEM", ra, "ITEM", rb, {"disagreement_id": did},
                        ))

    # --- situations -> APPLIES_TO_SITUATION + PRIMARY_MIND_FOR ---
    sit = _load_merged(config.SYNTHESIS_DIR / "situation_index.yaml")
    for s in sit.get("situation_index", []) or []:
        sid = f"sit:{_slug(s.get('situation_id', s.get('description', '')))}"
        sbody = f"{s.get('description','')}\nplay padrao: {_as_text(s.get('flirtai_default_play'))}"
        kb.synth.append(SynthItem(sid, "situation", _as_text(s.get("description"))[:200], sbody, s))
        for rel_key in ("relevant_frameworks", "relevant_heuristics", "relevant_techniques",
                        "relevant_scripts", "relevant_diagnostics"):
            for ref in s.get(rel_key, []) or []:
                kb.relations.append(Relation(
                    "APPLIES_TO_SITUATION", "ITEM", ref, "Situation", sid,
                    {"_unresolved_ref": ref},
                ))
        for mid in s.get("primary_minds", []) or []:
            kb.relations.append(Relation(
                "PRIMARY_MIND_FOR", "Mind", config.canonical_mind(mid), "Situation", sid
            ))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def parse_kb(only_mind: str | None = None) -> ParsedKB:
    kb = ParsedKB()
    want = config.canonical_mind(only_mind) if only_mind else None

    # gringos single-file
    for mid in config.GRINGOS:
        if want and mid != want:
            continue
        # arquivo usa alias curto: greene.yaml etc
        short = config.mind(mid).aliases[0] if config.mind(mid).aliases else mid
        p = config.KB_DIR / f"{short}.yaml"
        if p.exists():
            _parse_gringo(kb, p)

    # BR distribuido
    for dirname, category in config.DIR_TO_CATEGORY.items():
        cdir = config.KB_DIR / dirname
        if not cdir.is_dir():
            continue
        for p in sorted(cdir.glob("*.yaml")):
            mind_id = config.canonical_mind(p.stem)
            if want and mind_id != want:
                continue
            d = _load_merged(p)
            m = config.mind(mind_id)
            mind_name = m.name if m else mind_id
            items_list = d.get(category) or d.get(dirname) or []
            _parse_authorial(kb, mind_id, category, items_list, mind_name)

    # meta BR
    for p in sorted(config.KB_DIR.glob("*-meta.yaml")):
        mind_id = config.canonical_mind(p.stem.replace("-meta", ""))
        if want and mind_id != want:
            continue
        _parse_meta(kb, p)

    # synthesis (so no run completo)
    if not want:
        _parse_synthesis(kb)
        _resolve_item_refs(kb)

    log.info("parse: %d items, %d synth, %d relations",
             len(kb.items), len(kb.synth), len(kb.relations))
    return kb


def _resolve_item_refs(kb: ParsedKB) -> None:
    """Converte relations com src/dst label 'ITEM' (ref textual) p/ label real.

    Refs que nao resolvem (item nao carregado) sao descartadas com aviso agregado.
    """
    resolved: list[Relation] = []
    dropped = 0
    for r in kb.relations:
        rr = r
        ok = True
        if r.src_label == "ITEM":
            res = kb.resolve_ref(r.src_key)
            if res:
                rr = Relation(rr.edge, res[0], res[1], rr.dst_label, rr.dst_key, rr.props)
            else:
                ok = False
        if ok and rr.dst_label == "ITEM":
            res = kb.resolve_ref(rr.dst_key)
            if res:
                rr = Relation(rr.edge, rr.src_label, rr.src_key, res[0], res[1], rr.props)
            else:
                ok = False
        if ok:
            rr.props.pop("_unresolved_ref", None)
            resolved.append(rr)
        else:
            dropped += 1
    if dropped:
        log.warning("%d relacoes com ref de item nao resolvida (item ausente na KB) — descartadas", dropped)
    kb.relations = resolved
