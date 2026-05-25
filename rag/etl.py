#!/usr/bin/env python3
"""ETL graph+vector da KB FlirtAI — 6 stages, idempotente.

Stages:
  1 parse      -> le YAMLs -> itens canonicos + relacoes estruturais
  2 concepts   -> extrai Concepts via LLM (cache local) + MENTIONS_CONCEPT/RELATED_TO
  3 cross-mind -> persiste synth nodes (UP/Disagreement/Position/Situation) + edges
  4 antidote   -> LLM mapeia AntiPattern.antidote -> Technique/Heuristic (ANTIDOTE_FOR)
  5 embed      -> Voyage/local/openai em batches; pula itens ja vetorizados
  6 persist    -> upsert relacional (kb_items/synthesis_items) + MERGE no grafo AGE

Run completo respeita a ordem de dependencia interna (nao a numeracao crua).

CLI:
  python etl.py                      # full
  python etl.py --stage 2            # so concepts
  python etl.py --mind krausche      # so 1 mind (stages aplicaveis)
  python etl.py --dry-run            # sem API/DB
  python etl.py --force-reembed      # re-vetoriza tudo
  python etl.py --stats              # contagem nodes/edges + cobertura de embedding
  python etl.py --migrate            # so aplica migrations
"""
from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict

from tqdm import tqdm

import config
import db as dbmod
import graph as gmod
from concepts import ConceptExtractor, canonical_concept
from embeddings import get_embedder
from kb_parser import Item, ParsedKB, Relation, SynthItem, _slug, parse_kb
from logging_setup import get_logger

log = get_logger("etl")

STAGES = {1: "parse", 2: "concepts", 3: "cross-mind", 4: "antidote", 5: "embed", 6: "persist"}


# ---------------------------------------------------------------------------
# Schema bootstrap
# ---------------------------------------------------------------------------
def _tables_exist(conn) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema=%s AND table_name='kb_items'",
            (config.SCHEMA,),
        )
        return cur.fetchone() is not None


def ensure_schema(conn) -> None:
    if not _tables_exist(conn):
        log.info("schema ausente -> aplicando migrations")
        dbmod.apply_migrations(conn)


# ---------------------------------------------------------------------------
# Stage 2 — concepts
# ---------------------------------------------------------------------------
def stage_concepts(kb: ParsedKB, dry_run: bool) -> tuple[list[str], list[Relation]]:
    """Retorna (concept_keys, relations) com MENTIONS_CONCEPT + RELATED_TO."""
    extractor = ConceptExtractor(dry_run=dry_run)
    rels: list[Relation] = []
    concept_keys: set[str] = set()
    cooccur: dict[tuple[str, str], int] = defaultdict(int)

    for it in tqdm(kb.items, desc="stage2:concepts", disable=dry_run):
        concepts = extractor.extract(it.id, it.category, it.body)
        item_concepts = []
        for c in concepts:
            name = canonical_concept(c.get("concept", ""))
            if not name:
                continue
            ckey = f"concept:{_slug(name)}"
            concept_keys.add(ckey)
            item_concepts.append(ckey)
            rels.append(Relation(
                "MENTIONS_CONCEPT", it.label, it.id, "Concept", ckey,
                {"importance": c.get("importance", "medium"), "concept": name},
            ))
        for a in range(len(item_concepts)):
            for b in range(a + 1, len(item_concepts)):
                pair = tuple(sorted((item_concepts[a], item_concepts[b])))
                cooccur[pair] += 1

    # RELATED_TO: pares de conceitos que co-ocorrem em >=3 itens (poda ruido)
    for (ca, cb), n in cooccur.items():
        if n >= 3:
            rels.append(Relation("RELATED_TO", "Concept", ca, "Concept", cb, {"cooccurrence": n}))

    log.info("stage2: %d conceitos distintos, %d MENTIONS, %d RELATED_TO",
             len(concept_keys),
             sum(1 for r in rels if r.edge == "MENTIONS_CONCEPT"),
             sum(1 for r in rels if r.edge == "RELATED_TO"))
    return sorted(concept_keys), rels


# ---------------------------------------------------------------------------
# Stage 4 — antidote inference
# ---------------------------------------------------------------------------
def stage_antidote(kb: ParsedKB, dry_run: bool) -> list[Relation]:
    """Pra cada AntiPattern com campo antidote, mapeia p/ Technique/Heuristic do mesmo mind."""
    rels: list[Relation] = []
    # candidatos por mind: techniques + heuristics
    by_mind: dict[str, list[Item]] = defaultdict(list)
    for it in kb.items:
        if it.category in ("techniques", "heuristics"):
            by_mind[it.mind_id].append(it)

    aps = [it for it in kb.items if it.category == "anti_patterns" and it.raw.get("antidote")]
    if dry_run:
        log.info("stage4(dry): %d anti-patterns com antidote", len(aps))
        return rels

    import llm
    ok, why = llm.available()
    if not ok:
        log.warning("stage4: %s -> pulando ANTIDOTE_FOR", why)
        return rels

    schema = {
        "type": "object",
        "properties": {"item_id": {"type": "string",
                                   "description": "id exato do catalogo, ou vazio se nenhum serve"}},
        "required": ["item_id"],
    }
    system = ("Voce mapeia o ANTIDOTO de um anti-pattern de seducao para a tecnica/heuristica "
              "do mesmo autor que o neutraliza. Responda so com um id exato do catalogo.")

    for ap in tqdm(aps, desc="stage4:antidote"):
        cands = by_mind.get(ap.mind_id, [])
        if not cands:
            continue
        catalog = "\n".join(f"- {c.id} :: {c.name}" for c in cands[:60])
        try:
            out = llm.json_call(
                system,
                f"ANTI-PATTERN: {ap.name}\nantidote (texto): {ap.raw.get('antidote')}\n\n"
                f"CATALOGO ({ap.mind_id}):\n{catalog}",
                schema, max_tokens=128,
            )
            chosen = (out or {}).get("item_id", "").strip()
            if chosen and any(c.id == chosen for c in cands):
                tech = next(c for c in cands if c.id == chosen)
                rels.append(Relation("ANTIDOTE_FOR", tech.label, tech.id,
                                     "AntiPattern", ap.id, {"inferred": True}))
        except Exception as e:  # noqa: BLE001
            log.warning("stage4: falha em %s (%s)", ap.id, e)
    log.info("stage4: %d ANTIDOTE_FOR inferidos", len(rels))
    return rels


# ---------------------------------------------------------------------------
# Stage 5 — embedding (relacional, idempotente por presenca)
# ---------------------------------------------------------------------------
def _embed_targets(conn, force: bool) -> dict[str, list[tuple[str, str]]]:
    """Retorna {'kb': [(id, body)], 'syn': [(id, body)]} dos itens SEM embedding."""
    cond = "" if force else "WHERE embedding IS NULL"
    out = {"kb": [], "syn": []}
    with conn.cursor() as cur:
        cur.execute(f"SELECT id, body FROM {config.SCHEMA}.kb_items {cond}")
        out["kb"] = cur.fetchall()
        cur.execute(f"SELECT id, body FROM {config.SCHEMA}.synthesis_items {cond}")
        out["syn"] = cur.fetchall()
    return out


def stage_embed(conn, force: bool, dry_run: bool) -> None:
    targets = _embed_targets(conn, force)
    n = len(targets["kb"]) + len(targets["syn"])
    if dry_run:
        log.info("stage5(dry): %d itens precisariam embedar (force=%s)", n, force)
        return
    if n == 0:
        log.info("stage5: nada a embedar (tudo ja vetorizado)")
        return
    emb = get_embedder()
    for table, rows in (("kb_items", targets["kb"]), ("synthesis_items", targets["syn"])):
        if not rows:
            continue
        ids = [r[0] for r in rows]
        texts = [r[1] or r[0] for r in rows]
        log.info("stage5: embedando %d em %s (provider=%s)", len(ids), table, emb.provider)
        vectors = emb.embed(texts)
        with conn.cursor() as cur:
            for _id, vec in zip(ids, vectors):
                cur.execute(
                    f"UPDATE {config.SCHEMA}.{table} SET embedding=%s, updated_at=now() WHERE id=%s",
                    (vec, _id),
                )
        conn.commit()
    with conn.cursor() as cur:
        cur.execute(f"ANALYZE {config.SCHEMA}.kb_items;")
        cur.execute(f"ANALYZE {config.SCHEMA}.synthesis_items;")
    conn.commit()


# ---------------------------------------------------------------------------
# Stage 6 — persist (relacional + grafo)
# ---------------------------------------------------------------------------
def persist_relational(conn, kb: ParsedKB) -> None:
    with conn.cursor() as cur:
        for it in kb.items:
            cur.execute(
                f"""INSERT INTO {config.SCHEMA}.kb_items
                    (id, mind_id, category, name, body, source_refs, raw_metadata)
                    VALUES (%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (id) DO UPDATE SET
                      mind_id=EXCLUDED.mind_id, category=EXCLUDED.category,
                      name=EXCLUDED.name, body=EXCLUDED.body,
                      source_refs=EXCLUDED.source_refs, raw_metadata=EXCLUDED.raw_metadata,
                      updated_at=now()""",
                (it.id, it.mind_id, it.category, it.name, it.body,
                 it.source_refs, json.dumps(it.raw, ensure_ascii=False, default=str)),
            )
        for s in kb.synth:
            cur.execute(
                f"""INSERT INTO {config.SCHEMA}.synthesis_items
                    (id, kind, title, body, raw_metadata)
                    VALUES (%s,%s,%s,%s,%s)
                    ON CONFLICT (id) DO UPDATE SET
                      kind=EXCLUDED.kind, title=EXCLUDED.title, body=EXCLUDED.body,
                      raw_metadata=EXCLUDED.raw_metadata, updated_at=now()""",
                (s.id, s.kind, s.title, s.body, json.dumps(s.raw, ensure_ascii=False, default=str)),
            )
    conn.commit()
    log.info("persist relacional: %d kb_items, %d synthesis_items", len(kb.items), len(kb.synth))


def persist_graph(conn, kb: ParsedKB, concept_keys: list[str], extra_rels: list[Relation]) -> None:
    if not gmod._age_ok(conn):
        log.warning("persist grafo: AGE indisponivel -> pulado")
        return
    # nodes: minds
    for m in config.MINDS:
        gmod.merge_node(conn, "Mind", m.id,
                        {"name": m.name, "origin": m.origin, "tier": m.tier,
                         "philosophical_alignment": m.alignment})
    # nodes: items autorais
    for it in tqdm(kb.items, desc="graph:items"):
        gmod.merge_node(conn, it.label, it.id, {
            "mind_id": it.mind_id, "category": it.category, "name": it.name,
            "source_refs": it.source_refs,
        })
    # nodes: synthesis
    label_by_kind = {"universal_principle": "UniversalPrinciple", "disagreement": "Disagreement",
                     "position": "Position", "situation": "Situation"}
    for s in kb.synth:
        gmod.merge_node(conn, label_by_kind[s.kind], s.id,
                        {"title": s.title, "kind": s.kind,
                         **({"disagreement_id": s.raw.get("disagreement_id")} if s.kind == "position" else {})})
    # nodes: concepts
    for ck in concept_keys:
        gmod.merge_node(conn, "Concept", ck, {"name": ck.split(":", 1)[1]})
    conn.commit()

    # edges (estruturais + extras de concepts/antidote)
    all_rels = kb.relations + extra_rels
    ok = miss = 0
    for r in tqdm(all_rels, desc="graph:edges"):
        if gmod.merge_edge(conn, r.src_label, r.src_key, r.edge, r.dst_label, r.dst_key, r.props):
            ok += 1
        else:
            miss += 1
    conn.commit()
    log.info("persist grafo: %d edges criadas, %d puladas (no inexistente)", ok, miss)


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------
def show_stats(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(f"SELECT count(*), count(embedding) FROM {config.SCHEMA}.kb_items")
        kb_tot, kb_emb = cur.fetchone()
        cur.execute(f"SELECT count(*), count(embedding) FROM {config.SCHEMA}.synthesis_items")
        syn_tot, syn_emb = cur.fetchone()
        cur.execute(f"SELECT mind_id, count(*) FROM {config.SCHEMA}.kb_items GROUP BY mind_id ORDER BY 2 DESC")
        by_mind = cur.fetchall()
    print("\n=== RELACIONAL ===")
    print(f"kb_items: {kb_tot} (embedding: {kb_emb}/{kb_tot})")
    print(f"synthesis_items: {syn_tot} (embedding: {syn_emb}/{syn_tot})")
    print("por mind:", dict(by_mind))
    g = gmod.counts(conn)
    print("\n=== GRAFO (AGE) ===")
    if not g.get("available"):
        print("AGE indisponivel")
        return
    print(f"NODES total: {g['nodes']}  |  EDGES total: {g['edges']}")
    print("nodes:", {k: v for k, v in g["by_node_label"].items() if v})
    print("edges:", {k: v for k, v in g["by_edge_label"].items() if v})


# ---------------------------------------------------------------------------
# Orquestrador
# ---------------------------------------------------------------------------
def run(args) -> None:
    dry = args.dry_run

    if args.stats:
        with dbmod.connect() as conn:
            show_stats(conn)
        return

    if args.migrate:
        with dbmod.connect(with_age=False) as conn:
            dbmod.apply_migrations(conn)
        return

    # Stage 1 sempre (barato)
    kb = parse_kb(only_mind=args.mind)
    if args.stage == 1:
        print(f"parse: {len(kb.items)} items, {len(kb.synth)} synth, {len(kb.relations)} relations")
        return

    only = args.stage  # None = full

    if dry:
        # dry-run: exercita parse + concepts(cache) + antidote(contagem), sem DB
        ck, crel = stage_concepts(kb, dry_run=True)
        arel = stage_antidote(kb, dry_run=True)
        stage_embed_dry(kb)
        print(f"\n[DRY] items={len(kb.items)} synth={len(kb.synth)} "
              f"structural_rels={len(kb.relations)} concept_rels={len(crel)} antidote_rels={len(arel)}")
        return

    with dbmod.connect() as conn:
        ensure_schema(conn)
        try:
            dbmod.register_vector_now(conn)  # extensao ja existe apos ensure_schema
        except Exception as e:  # noqa: BLE001
            log.warning("register_vector pos-schema falhou: %s", e)

        concept_keys: list[str] = []
        extra_rels: list[Relation] = []

        # relacional primeiro (embedding atualiza essas linhas)
        if only in (None, 6, 3):
            persist_relational(conn, kb)

        if only in (None, 2) and not args.no_llm:
            concept_keys, crel = stage_concepts(kb, dry_run=False)
            extra_rels += crel
        elif args.no_llm and only in (None, 2):
            log.info("stage2 pulado (--no-llm)")
        if only in (None, 4) and not args.no_llm:
            extra_rels += stage_antidote(kb, dry_run=False)
        elif args.no_llm and only in (None, 4):
            log.info("stage4 pulado (--no-llm)")

        if only in (None, 5):
            stage_embed(conn, force=args.force_reembed, dry_run=False)

        if only in (None, 6, 3):
            persist_graph(conn, kb, concept_keys, extra_rels)

        show_stats(conn)


def stage_embed_dry(kb: ParsedKB) -> None:
    log.info("stage5(dry): %d itens + %d synth seriam embedados", len(kb.items), len(kb.synth))


def main() -> None:
    ap = argparse.ArgumentParser(description="ETL graph+vector da KB FlirtAI")
    ap.add_argument("--stage", type=int, choices=list(STAGES), help="roda so 1 stage")
    ap.add_argument("--mind", type=str, help="filtra 1 mind (id ou alias)")
    ap.add_argument("--dry-run", action="store_true", help="sem API/DB")
    ap.add_argument("--force-reembed", action="store_true", help="re-vetoriza tudo")
    ap.add_argument("--no-llm", action="store_true", help="pula stages 2 e 4 (concepts/antidote)")
    ap.add_argument("--stats", action="store_true", help="mostra contagens e sai")
    ap.add_argument("--migrate", action="store_true", help="aplica migrations e sai")
    args = ap.parse_args()
    run(args)


if __name__ == "__main__":
    main()
