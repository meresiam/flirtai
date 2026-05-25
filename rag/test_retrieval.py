#!/usr/bin/env python3
"""Validacao do retrieval contra golden set = as 32 situations do situation_index.

Pra cada situation:
  query    = situation.description
  expected = relevant_frameworks + heuristics + scripts (resolvidos a id global)
  primary  = primary_minds (canonico)
  retrieved = retrieve(query, mode=hybrid, k=10)

Metricas:
  precision@5   = |retrieved[:5] ∩ expected| / 5
  mind_overlap  = |retrieved_minds ∩ primary| / |primary|

Gate de commit (spec): precision@5 > 0.5 em >= 70% das situations.

CLI:
  python test_retrieval.py                 # roda tudo
  python test_retrieval.py --mode vector   # compara baseline so-vetor
  python test_retrieval.py --k 10
"""
from __future__ import annotations

import argparse
import statistics

import config
import db as dbmod
from kb_parser import parse_kb
from logging_setup import get_logger
from retrieve import retrieve

log = get_logger("test")

PASS_THRESHOLD = 0.5      # precision@5 minimo por situation
PASS_RATE_GATE = 0.70     # fracao de situations que precisa passar
FAIL_DEBUG = 0.4          # abaixo disso, lista p/ debug


def build_golden() -> list[dict]:
    kb = parse_kb()  # popula _ref_index
    from kb_parser import _load_merged
    sit = _load_merged(config.SYNTHESIS_DIR / "situation_index.yaml")
    golden = []
    REL_KEYS = ("relevant_frameworks", "relevant_heuristics", "relevant_techniques",
                "relevant_scripts", "relevant_diagnostics")
    for s in sit.get("situation_index", []) or []:
        relevant: list[str] = []
        for key in REL_KEYS:
            for ref in (s.get(key) or []):
                res = kb.resolve_ref(ref)
                if res:
                    relevant.append(res[1])
        golden.append({
            "id": s.get("situation_id"),
            "query": s.get("description", ""),
            # conjunto relevante = TODOS os itens curados p/ a situacao (precision@k textbook)
            "relevant": list(dict.fromkeys(relevant)),
            "primary": [config.canonical_mind(m) for m in (s.get("primary_minds") or [])],
        })
    return golden


def evaluate(mode: str, k: int) -> None:
    golden = build_golden()
    precisions, overlaps, failures = [], [], []

    with dbmod.connect() as conn:
        for g in golden:
            if not g["relevant"]:
                continue  # situation sem ids resolviveis -> nao pontua
            hits = retrieve(conn, g["query"], mode=mode, k=k)
            top5 = [h.id for h in hits[:5]]
            inter = set(top5) & set(g["relevant"])
            p5 = len(inter) / 5.0
            retr_minds = {h.mind_id for h in hits}
            mo = (len(retr_minds & set(g["primary"])) / len(g["primary"])) if g["primary"] else 0.0
            precisions.append(p5)
            overlaps.append(mo)
            if p5 < FAIL_DEBUG:
                failures.append((g["id"], p5, mo, top5, g["relevant"][:8]))

    n = len(precisions)
    if not n:
        print("Nenhuma situation pontuavel (rode o ETL + embedding antes).")
        return
    passed = sum(1 for p in precisions if p > PASS_THRESHOLD)
    rate = passed / n

    print(f"\n=== GOLDEN SET ({mode}, k={k}) — {n} situations pontuaveis ===")
    print(f"Precision@5 medio : {statistics.mean(precisions):.3f}")
    print(f"Mind overlap medio: {statistics.mean(overlaps):.3f}")
    print(f"Situations com P@5 > {PASS_THRESHOLD}: {passed}/{n} ({rate:.0%})")
    gate = rate >= PASS_RATE_GATE
    print(f"GATE (>= {PASS_RATE_GATE:.0%}): {'PASS' if gate else 'FAIL'}")

    if failures:
        print(f"\n--- {len(failures)} situations fracas (P@5 < {FAIL_DEBUG}) ---")
        for sid, p5, mo, top5, exp in failures:
            print(f"  [{sid}] P@5={p5:.2f} mind_overlap={mo:.2f}")
            print(f"     esperado: {exp}")
            print(f"     retornado: {top5}")

    raise SystemExit(0 if gate else 1)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["vector", "graph", "hybrid"], default="hybrid")
    ap.add_argument("--k", type=int, default=10)
    args = ap.parse_args()
    evaluate(args.mode, args.k)


if __name__ == "__main__":
    main()
