import argparse
import os
import sys
from datetime import date, datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.dirname(CURRENT_DIR)
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from meta import ig_window
from postgres_client import get_postgres_client
from jobs.instagram_ingest import (
    snapshot_to_rows,
    daterange,
    day_bounds,
    upsert_metrics,
    resolve_ingest_accounts,
)

INGEST_LOGS_TABLE = "ingest_logs"
METRICS_TABLE = "metrics_daily"
JOB_TYPE = "instagram_backfill"
PLATFORM = "instagram"
DEFAULT_LOOKBACK_DAYS = 90
DEFAULT_BATCH_DAYS = 7
STANDARD_LOOKBACKS = (7, 30, 90, 180, 365)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _insert_log(account_id: str) -> Tuple[Optional[object], Optional[object]]:
    client = get_postgres_client()
    if client is None:
        print("[backfill] Banco não configurado; logs desabilitados.")
        return None, None
    record = {
        "platform": PLATFORM,
        "job_type": JOB_TYPE,
        "account_id": account_id,
        "status": "running",
        "started_at": _now_iso(),
        "finished_at": None,
        "records_inserted": 0,
        "records_updated": 0,
        "error_message": None,
    }
    try:
        response = client.table(INGEST_LOGS_TABLE).insert(record).execute()
        data = getattr(response, "data", None) or []
        log_id = data[0].get("id") if data else None
        return client, log_id
    except Exception as err:  # noqa: BLE001
        print(f"[backfill] Falha ao registrar início para {account_id}: {err}")
        return client, None


def _finalize_log(
    client,
    log_id,
    status: str,
    inserted: int,
    updated: int,
    error_message: Optional[str] = None,
) -> None:
    if client is None or not log_id:
        return
    payload = {
        "status": status,
        "finished_at": _now_iso(),
        "records_inserted": inserted,
        "records_updated": updated,
        "error_message": error_message,
    }
    try:
        client.table(INGEST_LOGS_TABLE).update(payload).eq("id", log_id).execute()
    except Exception as err:  # noqa: BLE001
        print(f"[backfill] Falha ao atualizar log {log_id}: {err}")


def _chunk_ranges(start: date, end: date, span_days: int) -> Iterable[Tuple[date, date]]:
    current = start
    delta = timedelta(days=span_days)
    while current <= end:
        chunk_end = min(current + timedelta(days=span_days - 1), end)
        yield current, chunk_end
        current = chunk_end + timedelta(days=1)


def _normalize_metric_date(value: object) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        candidate = value.strip()
        if not candidate:
            return None
        if candidate.endswith("Z"):
            candidate = candidate[:-1] + "+00:00"
        try:
            if "T" in candidate:
                return datetime.fromisoformat(candidate).date()
            return date.fromisoformat(candidate)
        except ValueError:
            return None
    return None


def _collect_metric_dates(client, ig_id: str, start: date, end: date) -> set[date]:
    response = (
        client.table(METRICS_TABLE)
        .select("metric_date")
        .eq("account_id", ig_id)
        .eq("platform", PLATFORM)
        .gte("metric_date", start.isoformat())
        .lte("metric_date", end.isoformat())
        .execute()
    )
    if getattr(response, "error", None):
        print(f"[ensure] Falha ao consultar {METRICS_TABLE}: {response.error}")
        return set()

    existing: set[date] = set()
    for row in response.data or []:
        normalized = _normalize_metric_date(row.get("metric_date"))
        if normalized is not None:
            existing.add(normalized)
    return existing


def _find_missing_dates(client, ig_id: str, start: date, end: date) -> List[date]:
    if start > end:
        return []
    existing = _collect_metric_dates(client, ig_id, start, end)
    return [day for day in daterange(start, end) if day not in existing]


def ensure_lookbacks(
    account_ids: Sequence[str],
    lookbacks: Sequence[int],
    *,
    fill_missing: bool = True,
    batch_days: int = DEFAULT_BATCH_DAYS,
) -> None:
    if not account_ids:
        return

    client = get_postgres_client()
    if client is None:
        print("[ensure] Banco não configurado; não é possível verificar cobertura.")
        return

    normalized_ranges = sorted({max(1, int(value)) for value in lookbacks if value})
    if not normalized_ranges:
        print("[ensure] Nenhuma janela válida informada.")
        return

    target_end = datetime.now(timezone.utc).date() - timedelta(days=1)

    for ig_id in account_ids:
        print(f"[ensure] Conta {ig_id}: verificando janelas {normalized_ranges} dia(s).")
        largest_missing_window = 0
        coverage: Dict[int, Dict[str, object]] = {}

        for window in normalized_ranges:
            start = target_end - timedelta(days=window - 1)
            missing = _find_missing_dates(client, ig_id, start, target_end)
            coverage[window] = {
                "missing": len(missing),
                "start": start,
                "end": target_end,
            }
            if missing:
                largest_missing_window = max(largest_missing_window, window)
                sample = ", ".join(day.isoformat() for day in missing[:5])
                extra = "..." if len(missing) > 5 else ""
                print(
                    f"[ensure]  - {window}d incompleto: faltam {len(missing)} dia(s) entre {start} e {target_end}. {sample}{extra}"
                )
            else:
                print(f"[ensure]  - {window}d OK ({start} -> {target_end}).")

        if largest_missing_window and fill_missing:
            print(
                f"[ensure]  -> Executando backfill de {largest_missing_window} dia(s) para {ig_id}."
            )
            backfill_account(ig_id, largest_missing_window, batch_days)
            print(f"[ensure]  -> Revalidando janelas após backfill para {ig_id}.")
            for window in normalized_ranges:
                start = target_end - timedelta(days=window - 1)
                missing = _find_missing_dates(client, ig_id, start, target_end)
                status = "OK" if not missing else f"faltam {len(missing)} dia(s)"
                print(f"[ensure]     {window}d -> {status}.")
        elif largest_missing_window and not fill_missing:
            print(
                f"[ensure]  -> {ig_id} possui lacunas, mas --verify-only está ativo; nenhum backfill foi executado."
            )
        else:
            print(f"[ensure]  -> Todas as janelas solicitadas estão completas para {ig_id}.")


def backfill_account(ig_id: str, lookback_days: int, batch_days: int) -> None:
    if lookback_days <= 0:
        print(f"[backfill] {ig_id}: lookback inválido ({lookback_days}). Ignorando.")
        return
    batch_days = max(1, batch_days)

    target_end = datetime.now(timezone.utc).date() - timedelta(days=1)
    target_start = target_end - timedelta(days=lookback_days - 1)

    client, log_id = _insert_log(ig_id)
    inserted_total = 0
    updated_total = 0

    try:
        print(f"[backfill] {ig_id}: processando {lookback_days} dias ({target_start} -> {target_end}) em lotes de {batch_days} dia(s).")
        for chunk_start, chunk_end in _chunk_ranges(target_start, target_end, batch_days):
            rows: List[dict] = []
            for day in daterange(chunk_start, chunk_end):
                bounds = day_bounds(day)
                snapshot = ig_window(ig_id, bounds["since"], bounds["until"])
                rows.extend(snapshot_to_rows(ig_id, day, snapshot))
            if not rows:
                print(f"[backfill] {ig_id}: nenhum dado entre {chunk_start} e {chunk_end}.")
                continue
            inserted, updated = upsert_metrics(rows)
            inserted_total += inserted
            updated_total += updated
            print(f"[backfill] {ig_id}: lote {chunk_start} -> {chunk_end} | inseridos={inserted} atualizados={updated}")

        _finalize_log(client, log_id, "succeeded", inserted_total, updated_total)
        print(f"[backfill] {ig_id}: concluído. inseridos={inserted_total} atualizados={updated_total}")
    except Exception as err:  # noqa: BLE001
        _finalize_log(client, log_id, "failed", inserted_total, updated_total, str(err))
        print(f"[backfill] {ig_id}: falha {err}")
        raise


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill de métricas do Instagram (últimos 90 dias).")
    parser.add_argument("--ig", dest="ig_ids", action="append", help="ID(s) do Instagram Business para backfill.")
    parser.add_argument("--days", type=int, default=DEFAULT_LOOKBACK_DAYS, help="Quantidade de dias a recuperar (default: 90).")
    parser.add_argument("--batch", type=int, default=DEFAULT_BATCH_DAYS, help="Tamanho do lote em dias (default: 7).")
    parser.add_argument("--no-discover", dest="no_discover", action="store_true", help="Não descobrir contas automaticamente.")
    parser.add_argument(
        "--ensure-standard",
        dest="ensure_standard",
        action="store_true",
        help="Verifica e preenche automaticamente as janelas padrão (7/30/90/180/365 dias).",
    )
    parser.add_argument(
        "--ensure",
        dest="ensure_ranges",
        nargs="+",
        type=int,
        help="Lista personalizada de janelas (em dias) para verificar e preencher.",
    )
    parser.add_argument(
        "--verify-only",
        dest="verify_only",
        action="store_true",
        help="Apenas verifica cobertura quando usado com --ensure/--ensure-standard, sem executar backfill.",
    )
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    lookback_days = max(1, args.days)
    batch_days = max(1, args.batch)

    ensure_ranges: List[int] = []
    if args.ensure_standard:
        ensure_ranges.extend(STANDARD_LOOKBACKS)
    if args.ensure_ranges:
        ensure_ranges.extend(args.ensure_ranges)

    account_ids = resolve_ingest_accounts(args.ig_ids, auto_discover=not args.no_discover)
    if not account_ids:
        print("[backfill] Nenhuma conta encontrada. Informe via --ig ou configure META_IG_USER_ID.")
        return 1

    if ensure_ranges:
        ensure_lookbacks(
            account_ids,
            ensure_ranges,
            fill_missing=not args.verify_only,
            batch_days=batch_days,
        )
        return 0

    for ig_id in account_ids:
        backfill_account(ig_id, lookback_days, batch_days)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
