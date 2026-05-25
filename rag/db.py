"""Camada de banco: conexao psycopg + pgvector + bootstrap do AGE por sessao.

AGE exige `LOAD 'age'` e search_path com ag_catalog em CADA conexao nova antes
de qualquer Cypher. connect() ja faz isso quando with_age=True.
"""
from __future__ import annotations

import config
from logging_setup import get_logger

log = get_logger("db")


def connect(*, with_age: bool = True, autocommit: bool = False) -> "psycopg.Connection":
    """Abre conexao. Registra vector. Se with_age, carrega a extensao na sessao."""
    import psycopg
    from pgvector.psycopg import register_vector

    conn = psycopg.connect(config.DATABASE_URL, autocommit=autocommit)
    try:
        register_vector(conn)
    except psycopg.ProgrammingError:
        # extensao 'vector' ainda nao criada (antes das migrations). Registra depois.
        conn.rollback()
        log.debug("tipo vector ausente — register_vector adiado p/ apos migrations")
    if with_age:
        ensure_age_session(conn)
    return conn


def register_vector_now(conn) -> None:
    """Registra o tipo vector numa conexao ja com a extensao criada."""
    from pgvector.psycopg import register_vector
    register_vector(conn)


def ensure_age_session(conn: "psycopg.Connection") -> None:
    """LOAD 'age' + search_path. Tolerante: se AGE nao estiver instalado, avisa."""
    import psycopg
    try:
        with conn.cursor() as cur:
            cur.execute("LOAD 'age';")
            cur.execute('SET search_path = ag_catalog, "$user", public;')
        if not conn.autocommit:
            conn.commit()
    except psycopg.Error as e:
        conn.rollback()
        log.warning("AGE indisponivel nesta sessao (%s). Grafo sera pulado.", e)


def age_available(conn: "psycopg.Connection") -> bool:
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM pg_extension WHERE extname = 'age';")
        return cur.fetchone() is not None


def apply_migrations(conn: "psycopg.Connection") -> None:
    """Aplica todas as migrations *.sql em ordem, numa unica sessao.

    Idempotentes por design (IF NOT EXISTS / guards). Roda o arquivo inteiro
    em um execute — psycopg envia como multi-statement.
    """
    files = sorted(config.MIGRATIONS_DIR.glob("*.sql"))
    if not files:
        raise RuntimeError(f"nenhuma migration em {config.MIGRATIONS_DIR}")
    for f in files:
        log.info("migration %s", f.name)
        sql = f.read_text(encoding="utf-8")
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
    # AGE so fica utilizavel apos o CREATE EXTENSION da 002 -> recarrega sessao
    ensure_age_session(conn)
    log.info("migrations aplicadas (%d arquivo(s))", len(files))
