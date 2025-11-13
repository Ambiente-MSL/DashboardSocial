from __future__ import annotations

import logging
import re
import threading
from types import SimpleNamespace
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple, Union

from psycopg import sql
from psycopg.rows import dict_row

from db import get_pool, is_configured

logger = logging.getLogger(__name__)

_instance_lock = threading.Lock()
_client: Optional["PostgresLikeClient"] = None

_COLUMN_RE = re.compile(r"^[A-Za-z0-9_]+$")
_SELECT_SPLITTER = re.compile(r"\s*,\s*")


class PostgresLikeClient:
    def table(self, name: str) -> "TableQuery":
        return TableQuery(name)

    def rpc(self, function_name: str, params: Optional[Dict[str, Any]] = None) -> "RpcQuery":
        return RpcQuery(function_name, params or {})


class TableQuery:
    def __init__(self, table_name: str):
        self.table_name = table_name
        self._action = "select"
        self._select_columns: List[str] = ["*"]
        self._filters: List[Tuple[str, str, str]] = []
        self._orders: List[Tuple[str, bool]] = []
        self._limit: Optional[int] = None
        self._insert_rows: Optional[List[Dict[str, Any]]] = None
        self._update_payload: Optional[Dict[str, Any]] = None
        self._on_conflict: Optional[List[str]] = None
        self._params: Dict[str, Any] = {}
        self._param_index = 0

    # ----- Query modifiers -----
    def select(self, columns: Union[str, Sequence[str]] = "*") -> "TableQuery":
        if isinstance(columns, str):
            if columns.strip() == "*":
                parsed = ["*"]
            else:
                parsed = [col.strip() for col in _SELECT_SPLITTER.split(columns) if col.strip()]
        else:
            parsed = list(columns)
        if not parsed:
            parsed = ["*"]
        for col in parsed:
            if col != "*" and not _COLUMN_RE.match(col):
                raise ValueError(f"Invalid column name '{col}'.")
        self._select_columns = parsed
        self._action = "select"
        return self

    def _add_filter(self, column: str, operator: str, value: Any) -> "TableQuery":
        if not _COLUMN_RE.match(column):
            raise ValueError(f"Invalid column name '{column}'.")
        placeholder = self._next_param_name()
        self._filters.append((column, operator, placeholder))
        self._params[placeholder] = value
        return self

    def eq(self, column: str, value: Any) -> "TableQuery":
        return self._add_filter(column, "=", value)

    def gte(self, column: str, value: Any) -> "TableQuery":
        return self._add_filter(column, ">=", value)

    def lte(self, column: str, value: Any) -> "TableQuery":
        return self._add_filter(column, "<=", value)

    def in_(self, column: str, values: Sequence[Any]) -> "TableQuery":
        value_list = list(values)
        return self._add_filter(column, "IN", value_list)

    def order(self, column: str, desc: bool = False) -> "TableQuery":
        if not _COLUMN_RE.match(column):
            raise ValueError(f"Invalid column name '{column}'.")
        self._orders.append((column, desc))
        return self

    def limit(self, count: int) -> "TableQuery":
        self._limit = int(count)
        return self

    # ----- Mutations -----
    def insert(self, rows: Union[Dict[str, Any], Sequence[Dict[str, Any]]]) -> "TableQuery":
        self._action = "insert"
        self._insert_rows = self._normalize_rows(rows)
        return self

    def upsert(
        self,
        rows: Union[Dict[str, Any], Sequence[Dict[str, Any]]],
        *,
        on_conflict: str,
    ) -> "TableQuery":
        self._action = "upsert"
        self._insert_rows = self._normalize_rows(rows)
        conflicts = [col.strip() for col in on_conflict.split(",") if col.strip()]
        if not conflicts:
            raise ValueError("on_conflict must define at least one column.")
        for col in conflicts:
            if not _COLUMN_RE.match(col):
                raise ValueError(f"Invalid conflict column '{col}'.")
        self._on_conflict = conflicts
        return self

    def update(self, payload: Dict[str, Any]) -> "TableQuery":
        self._action = "update"
        self._update_payload = dict(payload)
        return self

    # ----- Execution helpers -----
    def execute(self) -> SimpleNamespace:
        pool = get_pool()
        if pool is None:
            raise RuntimeError("Database connection is not configured.")

        with pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                if self._action == "select":
                    query, params = self._build_select()
                    cur.execute(query, params)
                    rows = cur.fetchall()
                elif self._action == "insert":
                    query, params = self._build_insert()
                    cur.execute(query, params)
                    rows = cur.fetchall()
                    conn.commit()
                elif self._action == "upsert":
                    query, params = self._build_upsert()
                    cur.execute(query, params)
                    rows = cur.fetchall()
                    conn.commit()
                elif self._action == "update":
                    query, params = self._build_update()
                    cur.execute(query, params)
                    rows = cur.fetchall()
                    conn.commit()
                else:
                    raise ValueError(f"Ação desconhecida: {self._action}")
        return SimpleNamespace(data=rows, error=None)

    # ----- Build queries -----
    def _build_select(self) -> Tuple[sql.SQL, Dict[str, Any]]:
        columns_sql = self._format_columns(self._select_columns)
        base = sql.SQL("SELECT {columns} FROM {table}").format(
            columns=columns_sql,
            table=sql.Identifier(self.table_name),
        )
        params = dict(self._params)
        where_clause = self._build_where_clause()
        order_clause = self._build_order_clause()
        limit_clause = sql.SQL("")
        if self._limit is not None:
            limit_clause = sql.SQL(" LIMIT {limit}").format(limit=sql.Literal(self._limit))
        return base + where_clause + order_clause + limit_clause, params

    def _build_insert(self) -> Tuple[sql.SQL, Dict[str, Any]]:
        rows = self._insert_rows or []
        if not rows:
            raise ValueError("Nenhuma linha fornecida para insert.")
        columns = self._collect_columns(rows)
        params: Dict[str, Any] = {}
        values_sql = self._build_values(rows, columns, params)
        query = sql.SQL("INSERT INTO {table} ({cols}) VALUES {values} RETURNING *").format(
            table=sql.Identifier(self.table_name),
            cols=self._format_columns(columns),
            values=values_sql,
        )
        return query, params

    def _build_upsert(self) -> Tuple[sql.SQL, Dict[str, Any]]:
        rows = self._insert_rows or []
        conflicts = self._on_conflict or []
        if not rows or not conflicts:
            raise ValueError("Upsert requer linhas e colunas de conflito.")

        columns = self._collect_columns(rows)
        params: Dict[str, Any] = {}
        values_sql = self._build_values(rows, columns, params)

        conflict_sql = sql.SQL(", ").join(sql.Identifier(col) for col in conflicts)
        update_assignments = sql.SQL(", ").join(
            sql.SQL("{col} = EXCLUDED.{col}").format(col=sql.Identifier(col)) for col in columns
        )

        query = sql.SQL(
            "INSERT INTO {table} ({cols}) VALUES {values} "
            "ON CONFLICT ({conflict}) DO UPDATE SET {updates} RETURNING *"
        ).format(
            table=sql.Identifier(self.table_name),
            cols=self._format_columns(columns),
            values=values_sql,
            conflict=conflict_sql,
            updates=update_assignments,
        )
        return query, params

    def _build_update(self) -> Tuple[sql.SQL, Dict[str, Any]]:
        if not self._update_payload:
            raise ValueError("Payload de update vazio.")
        assignments = []
        params = dict(self._params)
        for column, value in self._update_payload.items():
            if not _COLUMN_RE.match(column):
                raise ValueError(f"Invalid column name '{column}'.")
            placeholder = self._next_param_name()
            params[placeholder] = value
            assignments.append(
                sql.SQL("{col} = {placeholder}").format(
                    col=sql.Identifier(column),
                    placeholder=sql.Placeholder(placeholder),
                )
            )
        if not assignments:
            raise ValueError("Nenhuma coluna fornecida para update.")
        set_clause = sql.SQL(", ").join(assignments)
        where_clause = self._build_where_clause()
        query = sql.SQL("UPDATE {table} SET {set_clause}").format(
            table=sql.Identifier(self.table_name),
            set_clause=set_clause,
        )
        return query + where_clause + sql.SQL(" RETURNING *"), params

    # ----- Utility helpers -----
    def _build_where_clause(self) -> sql.SQL:
        if not self._filters:
            return sql.SQL("")
        clauses = []
        for column, operator, placeholder in self._filters:
            col_sql = sql.Identifier(column)
            if operator == "IN":
                clause = sql.SQL("{col} = ANY({placeholder})").format(
                    col=col_sql,
                    placeholder=sql.Placeholder(placeholder),
                )
            else:
                clause = sql.SQL("{col} {op} {placeholder}").format(
                    col=col_sql,
                    op=sql.SQL(operator),
                    placeholder=sql.Placeholder(placeholder),
                )
            clauses.append(clause)
        return sql.SQL(" WHERE ") + sql.SQL(" AND ").join(clauses)

    def _build_order_clause(self) -> sql.SQL:
        if not self._orders:
            return sql.SQL("")
        parts = []
        for column, desc in self._orders:
            direction = sql.SQL("DESC") if desc else sql.SQL("ASC")
            parts.append(sql.SQL("{col} {direction}").format(col=sql.Identifier(column), direction=direction))
        return sql.SQL(" ORDER BY ") + sql.SQL(", ").join(parts)

    def _collect_columns(self, rows: Sequence[Dict[str, Any]]) -> List[str]:
        columns: List[str] = []
        for row in rows:
            for column in row.keys():
                if column not in columns:
                    if not _COLUMN_RE.match(column):
                        raise ValueError(f"Invalid column '{column}'.")
                    columns.append(column)
        return columns

    def _build_values(
        self,
        rows: Sequence[Dict[str, Any]],
        columns: Sequence[str],
        params: Dict[str, Any],
    ) -> sql.SQL:
        compiled_rows = []
        for row_index, row in enumerate(rows):
            placeholders = []
            for column in columns:
                placeholder_name = f"val_{row_index}_{column}"
                params[placeholder_name] = row.get(column)
                placeholders.append(sql.Placeholder(placeholder_name))
            compiled_rows.append(sql.SQL("({values})").format(values=sql.SQL(", ").join(placeholders)))
        return sql.SQL(", ").join(compiled_rows)

    def _format_columns(self, columns: Sequence[str]) -> sql.SQL:
        parts = []
        for column in columns:
            if column == "*":
                parts.append(sql.SQL("*"))
            else:
                parts.append(sql.Identifier(column))
        return sql.SQL(", ").join(parts)

    def _next_param_name(self) -> str:
        name = f"p{self._param_index}"
        self._param_index += 1
        return name

    def _normalize_rows(
        self, rows: Union[Dict[str, Any], Sequence[Dict[str, Any]]]
    ) -> List[Dict[str, Any]]:
        if isinstance(rows, dict):
            return [rows]
        return [dict(row) for row in rows]


class RpcQuery:
    def __init__(self, function_name: str, params: Dict[str, Any]):
        self.function_name = function_name
        self.params = params

    def execute(self) -> SimpleNamespace:
        pool = get_pool()
        if pool is None:
            raise RuntimeError("Database connection is not configured.")

        with pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                if self.params:
                    placeholders = sql.SQL(", ").join(
                        sql.Placeholder(key) for key in self.params.keys()
                    )
                else:
                    placeholders = sql.SQL("")
                query = sql.SQL("SELECT * FROM {function_name}({placeholders})").format(
                    function_name=sql.Identifier(self.function_name),
                    placeholders=placeholders,
                )
                cur.execute(query, self.params)
                rows = cur.fetchall()
                conn.commit()
        return SimpleNamespace(data=rows, error=None)


def get_postgres_client() -> Optional[PostgresLikeClient]:
    global _client

    if _client is not None:
        return _client

    if not is_configured():
        return None

    with _instance_lock:
        if _client is None:
            _client = PostgresLikeClient()
    return _client
