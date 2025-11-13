import argparse
from datetime import date, datetime, timedelta, timezone
from typing import Iterable, List, Optional, Sequence, Tuple

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
JOB_TYPE = "instagram_backfill"
PLATFORM = "instagram"
DEFAULT_LOOKBACK_DAYS = 90
DEFAULT_BATCH_DAYS = 7


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
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    lookback_days = max(1, args.days)
    batch_days = max(1, args.batch)

    account_ids = resolve_ingest_accounts(args.ig_ids, auto_discover=not args.no_discover)
    if not account_ids:
        print("[backfill] Nenhuma conta encontrada. Informe via --ig ou configure META_IG_USER_ID.")
        return 1

    for ig_id in account_ids:
        backfill_account(ig_id, lookback_days, batch_days)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
