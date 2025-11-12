from __future__ import annotations

import os
import threading
from contextlib import contextmanager
from typing import Any, Iterable, Mapping, Optional, Sequence, Union

from psycopg import sql
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

PoolQuery = Union[str, sql.Composable]

_pool: Optional[ConnectionPool] = None
_lock = threading.Lock()


def _build_conninfo() -> Optional[str]:
    dsn = os.getenv("DATABASE_URL")
    if dsn:
        return dsn

    host = os.getenv("DATABASE_HOST")
    if not host:
        return None

    user = os.getenv("DATABASE_USER")
    password = os.getenv("DATABASE_PASSWORD")
    name = os.getenv("DATABASE_NAME")
    port = os.getenv("DATABASE_PORT", "5432")

    if not all([user, password, name]):
        return None

    return f"postgresql://{user}:{password}@{host}:{port}/{name}"


def get_pool() -> Optional[ConnectionPool]:
    global _pool
    if _pool is not None:
        return _pool

    conninfo = _build_conninfo()
    if not conninfo:
        return None

    with _lock:
        if _pool is None:
            max_size = int(os.getenv("DATABASE_POOL_MAX", "10") or "10")
            min_size = int(os.getenv("DATABASE_POOL_MIN", "1") or "1")
            _pool = ConnectionPool(
                conninfo=conninfo,
                open=True,
                min_size=min_size,
                max_size=max_size,
                kwargs={"autocommit": False},
            )
    return _pool


def is_configured() -> bool:
    return get_pool() is not None


@contextmanager
def connection():
    pool = get_pool()
    if pool is None:
        raise RuntimeError("Database connection is not configured.")
    with pool.connection() as conn:
        yield conn


def fetch_all(query: PoolQuery, params: Optional[Mapping[str, Any]] = None) -> list[dict[str, Any]]:
    pool = get_pool()
    if pool is None:
        return []
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(query, params or {})
            return cur.fetchall()


def fetch_one(query: PoolQuery, params: Optional[Mapping[str, Any]] = None) -> Optional[dict[str, Any]]:
    pool = get_pool()
    if pool is None:
        return None
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(query, params or {})
            return cur.fetchone()


def execute(query: PoolQuery, params: Optional[Mapping[str, Any]] = None) -> None:
    pool = get_pool()
    if pool is None:
        raise RuntimeError("Database connection is not configured.")
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params or {})
        conn.commit()


def execute_many(query: PoolQuery, param_seq: Iterable[Mapping[str, Any]]) -> None:
    pool = get_pool()
    if pool is None:
        raise RuntimeError("Database connection is not configured.")
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.executemany(query, param_seq)
        conn.commit()


def format_identifier(name: str) -> sql.Identifier:
    return sql.Identifier(name)


def format_column_list(columns: Sequence[str]) -> sql.SQL:
    identifiers = [sql.Identifier(col.strip()) for col in columns]
    return sql.SQL(", ").join(identifiers)
