"""Helpers de grafo sobre Apache AGE (Cypher via funcao cypher()).

MERGE = idempotente: rodar 2x nao duplica nodes/edges (match por id).
Labels sao literais controlados (config), NUNCA input do usuario -> seguro
interpolar na query. Valores vao por parametro agtype ($1).

Se AGE nao estiver instalado, as funcoes viram no-op (warn 1x) — assim o ETL
relacional/vetorial roda mesmo sem grafo.
"""
from __future__ import annotations

import json

import config
from logging_setup import get_logger

log = get_logger("graph")
_warned = False


def _age_ok(conn) -> bool:
    global _warned
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM pg_extension WHERE extname='age';")
        ok = cur.fetchone() is not None
    if not ok and not _warned:
        log.warning("AGE ausente — operacoes de grafo viram no-op (so vetor/relacional)")
        _warned = True
    return ok


def _cypher(conn, query: str, params: dict | None = None,
            returns: str = "v agtype") -> list:
    """Executa Cypher.

    Sem params: query 100% inline (merges/leituras) -> execute sem 2o arg, pra
    psycopg NAO interpretar '%' dos dados (ex: "80%+") como placeholder.
    Com params: passa agtype JSON em $1 (referenciado como $key no Cypher).
    Dollar-tag $ag$ reduz colisao com '$$' eventual nos dados.
    """
    import psycopg
    with conn.cursor() as cur:
        if params:
            pjson = json.dumps(params, ensure_ascii=False)
            sql = (f"SELECT * FROM cypher('{config.GRAPH_NAME}', $ag$ {query} $ag$, "
                   f"%s::agtype) AS ({returns});")
            cur.execute(sql, (pjson,))
        else:
            sql = f"SELECT * FROM cypher('{config.GRAPH_NAME}', $ag$ {query} $ag$) AS ({returns});"
            cur.execute(sql)
        try:
            return cur.fetchall()
        except psycopg.ProgrammingError:
            return []


# -- serializacao de map/valor Cypher INLINE -------------------------------
# AGE nao aceita `SET n += $param` (map via parametro). Serializamos o map como
# literal Cypher, com escaping. Chaves sao identificadores controlados (props
# internas), valores escapados -> seguro contra injection dos dados da KB.
def _cval(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (list, tuple)):
        return "[" + ", ".join(_cval(x) for x in v) + "]"
    if isinstance(v, dict):
        return _cmap(v)
    s = (str(v).replace("\\", "\\\\").replace("'", "\\'")
         .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t"))
    return f"'{s}'"


def _cmap(d: dict) -> str:
    if not d:
        return "{}"
    return "{" + ", ".join(f"{k}: {_cval(v)}" for k, v in d.items()) + "}"


def merge_node(conn, label: str, key: str, props: dict | None = None) -> None:
    if not _age_ok(conn):
        return
    props = {k: v for k, v in (props or {}).items() if v is not None}
    setclause = f" SET n += {_cmap(props)}" if props else ""
    _cypher(
        conn,
        f"MERGE (n:{label} {{id: {_cval(key)}}}){setclause} RETURN id(n)",
    )


def merge_edge(conn, src_label: str, src_key: str, edge: str,
               dst_label: str, dst_key: str, props: dict | None = None) -> bool:
    """MERGE de aresta entre nodes existentes. Retorna False se algum no nao existe."""
    if not _age_ok(conn):
        return False
    props = {k: v for k, v in (props or {}).items() if v is not None}
    setclause = f" SET r += {_cmap(props)}" if props else ""
    rows = _cypher(
        conn,
        f"""MATCH (a:{src_label} {{id: {_cval(src_key)}}}), (b:{dst_label} {{id: {_cval(dst_key)}}})
            MERGE (a)-[r:{edge}]->(b){setclause}
            RETURN id(r)""",
        returns="r agtype",
    )
    return bool(rows)


def query(conn, cypher_query: str, params: dict | None = None,
          returns: str = "v agtype") -> list:
    """Cypher arbitrario (p/ retrieve --explain e cheatsheet). Retorna agtype cru."""
    if not _age_ok(conn):
        return []
    return _cypher(conn, cypher_query, params, returns)


def counts(conn) -> dict:
    """Contagem de nodes e edges por label (p/ --stats)."""
    import psycopg
    if not _age_ok(conn):
        return {"nodes": 0, "edges": 0, "available": False}
    out: dict = {"available": True, "by_node_label": {}, "by_edge_label": {}}
    node_labels = list(config.CATEGORY_TO_LABEL.values()) + [
        "Mind", "UniversalPrinciple", "Disagreement", "Position", "Situation", "Concept"
    ]
    edge_labels = ["AUTHORED_BY", "CONFIRMS", "HOLDS_POSITION_IN", "APPLIES_TO_SITUATION",
                   "ANTIDOTE_FOR", "CONTRADICTS", "RELATED_TO", "MENTIONS_CONCEPT",
                   "EVOLUTION_OF", "PRIMARY_MIND_FOR"]
    total_n = total_e = 0
    for lbl in sorted(set(node_labels)):
        try:
            rows = _cypher(conn, f"MATCH (n:{lbl}) RETURN count(n)", {}, "c agtype")
            n = int(str(rows[0][0])) if rows else 0
        except psycopg.Error:
            n = 0
        out["by_node_label"][lbl] = n
        total_n += n
    for lbl in edge_labels:
        try:
            rows = _cypher(conn, f"MATCH ()-[r:{lbl}]->() RETURN count(r)", {}, "c agtype")
            e = int(str(rows[0][0])) if rows else 0
        except psycopg.Error:
            e = 0
        out["by_edge_label"][lbl] = e
        total_e += e
    out["nodes"], out["edges"] = total_n, total_e
    return out
