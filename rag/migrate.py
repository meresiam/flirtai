#!/usr/bin/env python3
"""Aplica as migrations (rag/migrations/*.sql) em ordem, numa unica sessao.

Atalho p/ `python etl.py --migrate`. Idempotente.
"""
import db
from logging_setup import get_logger

log = get_logger("migrate")

if __name__ == "__main__":
    with db.connect(with_age=False) as conn:
        db.apply_migrations(conn)
    log.info("ok")
