#!/usr/bin/env python3
"""Hybrid retrieval da KB FlirtAI — vector + graph expansion + RRF.

Modos:
  vector   — so similaridade vetorial (pgvector cosine)
  graph    — seeds vetoriais + expansao 1-2 hops no grafo, re-rank vetorial
  hybrid   — (default) vector top-N + expansao grafo, fundidos por RRF

CLI:
  python retrieve.py --query "ela me chamou de amigo" --mode hybrid --k 5
  python retrieve.py --query "primeira mensagem Tinder" --filter-axis greene_axis
  python retrieve.py --query "ela sumiu 3 dias" --explain
"""
from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass, field

import config
import db as dbmod
import graph as gmod
from embeddings import get_embedder
from logging_setup import get_logger

log = get_logger("retrieve")

RRF_K0 = 60  # constante padrao de Reciprocal Rank Fusion


def _veclit(qvec) -> str:
    """Vetor Python -> literal pgvector '[a,b,...]' p/ cast ::vector explicito."""
    return "[" + ",".join(f"{float(x):.8f}" for x in qvec) + "]"


@dataclass
class Hit:
    id: str
    mind_id: str
    category: str
    name: str
    distance: float = 1.0          # cosine distance (menor = melhor)
    via: list[str] = field(default_factory=list)  # explicacao (vector / concept:X / situation:Y)


# ---------------------------------------------------------------------------
# Filtro de eixo
# ---------------------------------------------------------------------------
def _minds_for_axis(axis: str | None) -> list[str] | None:
    if not axis:
        return None
    return [m.id for m in config.MINDS if m.alignment == axis]


# ---------------------------------------------------------------------------
# Vector search (kb_items)
# ---------------------------------------------------------------------------
def vector_search(conn, qvec, k: int, allowed_minds: list[str] | None) -> list[Hit]:
    where = "WHERE embedding IS NOT NULL"
    params: list = [_veclit(qvec)]             # 1) SELECT (embedding <=> %s::vector)
    if allowed_minds:
        where += " AND mind_id = ANY(%s)"      # 2) filtro de eixo
        params.append(allowed_minds)
    params.append(k)                           # 3) LIMIT
    sql = (
        f"SELECT id, mind_id, category, name, (embedding <=> %s::vector) AS dist "
        f"FROM {config.SCHEMA}.kb_items {where} ORDER BY dist LIMIT %s"
    )
    with conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
    return [Hit(r[0], r[1], r[2], r[3], float(r[4]), ["vector"]) for r in rows]


def _distance_for_ids(conn, qvec, ids: list[str]) -> dict[str, tuple]:
    if not ids:
        return {}
    sql = (
        f"SELECT id, mind_id, category, name, (embedding <=> %s::vector) AS dist "
        f"FROM {config.SCHEMA}.kb_items WHERE id = ANY(%s) AND embedding IS NOT NULL"
    )
    with conn.cursor() as cur:
        cur.execute(sql, [_veclit(qvec), ids])
        return {r[0]: (r[1], r[2], r[3], float(r[4])) for r in cur.fetchall()}


# ---------------------------------------------------------------------------
# Graph expansion
# ---------------------------------------------------------------------------
def _agstr(v) -> str:
    """agtype escalar -> string limpa (remove aspas/sufixo de tipo)."""
    s = str(v)
    s = re.sub(r"::\w+$", "", s)
    return s.strip().strip('"')


def expand_via_graph(conn, seed_ids: list[str], hops_limit: int = 40) -> dict[str, list[str]]:
    """Pra cada seed, acha itens vizinhos via Concept compartilhado e Situation comum.

    Retorna {item_id: [motivos]} (sem os proprios seeds).
    """
    if not seed_ids or not gmod._age_ok(conn):
        return {}
    found: dict[str, list[str]] = {}
    seeds_lit = gmod._cval(seed_ids)  # lista inline (AGE nao curte $param de lista)

    # 1) mesmos Concepts
    rows = gmod.query(
        conn,
        f"""MATCH (s)-[:MENTIONS_CONCEPT]->(c:Concept)<-[:MENTIONS_CONCEPT]-(o)
            WHERE s.id IN {seeds_lit} AND o.id <> s.id
            RETURN o.id, c.name LIMIT {hops_limit * 5}""",
        returns="oid agtype, cname agtype",
    )
    for r in rows:
        oid, cname = _agstr(r[0]), _agstr(r[1])
        found.setdefault(oid, []).append(f"concept:{cname}")

    # 2) mesma Situation
    rows = gmod.query(
        conn,
        f"""MATCH (s)-[:APPLIES_TO_SITUATION]->(sit:Situation)<-[:APPLIES_TO_SITUATION]-(o)
            WHERE s.id IN {seeds_lit} AND o.id <> s.id
            RETURN o.id, sit.title LIMIT {hops_limit * 3}""",
        returns="oid agtype, sname agtype",
    )
    for r in rows:
        oid, sname = _agstr(r[0]), _agstr(r[1])
        found.setdefault(oid, []).append(f"situation:{sname[:40]}")

    for sid in seed_ids:
        found.pop(sid, None)
    return found


# ---------------------------------------------------------------------------
# RRF
# ---------------------------------------------------------------------------
def _rrf(rankings: list[list[str]]) -> dict[str, float]:
    score: dict[str, float] = {}
    for ranking in rankings:
        for rank, _id in enumerate(ranking):
            score[_id] = score.get(_id, 0.0) + 1.0 / (RRF_K0 + rank + 1)
    return score


# ---------------------------------------------------------------------------
# Modos
# ---------------------------------------------------------------------------
def retrieve(conn, query: str, mode: str = "hybrid", k: int = 5,
             axis: str | None = None) -> list[Hit]:
    qvec = get_embedder().embed([query], kind="query")[0]
    allowed = _minds_for_axis(axis)

    if mode == "vector":
        return vector_search(conn, qvec, k, allowed)

    # seeds (recall amplo)
    seeds = vector_search(conn, qvec, 10 if mode == "hybrid" else 3, allowed)
    seed_ids = [h.id for h in seeds]
    expanded = expand_via_graph(conn, seed_ids)
    exp_info = _distance_for_ids(conn, qvec, list(expanded.keys()))

    if mode == "graph":
        # seeds + expandidos, re-rank por distancia vetorial a query
        pool: dict[str, Hit] = {h.id: h for h in seeds}
        for oid, (mind, cat, name, dist) in exp_info.items():
            if allowed and mind not in allowed:
                continue
            pool[oid] = Hit(oid, mind, cat, name, dist, expanded[oid])
        ranked = sorted(pool.values(), key=lambda h: h.distance)
        return ranked[:k]

    # hybrid: RRF entre ranking vetorial e ranking de expansao (por dist)
    vec_rank = [h.id for h in seeds]
    exp_rank = [oid for oid, _ in sorted(exp_info.items(), key=lambda kv: kv[1][3])]
    fused = _rrf([vec_rank, exp_rank])

    info: dict[str, Hit] = {h.id: h for h in seeds}
    for oid, (mind, cat, name, dist) in exp_info.items():
        if oid not in info:
            info[oid] = Hit(oid, mind, cat, name, dist, expanded.get(oid, []))
        else:
            info[oid].via += expanded.get(oid, [])

    if allowed:
        fused = {i: s for i, s in fused.items() if i in info and info[i].mind_id in allowed}

    ranked_ids = sorted(fused, key=lambda i: fused[i], reverse=True)
    out: list[Hit] = []
    for i in ranked_ids[:k]:
        h = info[i]
        h.via = ["rrf"] + sorted(set(h.via))
        out.append(h)
    return out


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser(description="Hybrid retrieval FlirtAI KB")
    ap.add_argument("--query", required=True)
    ap.add_argument("--mode", choices=["vector", "graph", "hybrid"], default="hybrid")
    ap.add_argument("--k", type=int, default=5)
    ap.add_argument("--filter-axis", dest="axis",
                    choices=["greene_axis", "glover_axis", "hybrid"], default=None)
    ap.add_argument("--explain", action="store_true", help="mostra via/graph path de cada hit")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    with dbmod.connect() as conn:
        hits = retrieve(conn, args.query, args.mode, args.k, args.axis)

    if args.json:
        print(json.dumps([h.__dict__ for h in hits], ensure_ascii=False, indent=2))
        return

    print(f"\nquery: {args.query!r}  | mode={args.mode} k={args.k} axis={args.axis}")
    for rank, h in enumerate(hits, 1):
        print(f"\n{rank}. [{h.mind_id} · {h.category}] {h.name}")
        print(f"   id={h.id}  dist={h.distance:.4f}")
        if args.explain:
            print(f"   via: {', '.join(h.via)}")


if __name__ == "__main__":
    main()
