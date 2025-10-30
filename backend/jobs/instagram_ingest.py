import argparse
import logging
import os
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional, Sequence

from cache import get_cached_payload
from meta import MetaAPIError, ig_window, gget
from supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

PLATFORM = "instagram"
DEFAULT_BUCKETS = (7, 30, 90)
DEFAULT_POSTS_LIMIT = int(os.getenv("INSTAGRAM_POSTS_LIMIT", "20") or "20")


def discover_instagram_account_ids() -> List[str]:
    """
    Usa a Graph API para descobrir todos os perfis do Instagram ligados ao token.
    """
    try:
        response = gget(
            "/me/accounts",
            params={
                "fields": (
                    "id,name,"
                    "instagram_business_account{id,username,name},"
                    "connected_instagram_account{id,username,name}"
                )
            },
        )
    except MetaAPIError as err:
        logger.error("Falha ao descobrir contas do Instagram: %s", err)
        return []
    except Exception as err:  # noqa: BLE001
        logger.exception("Erro inesperado ao descobrir contas do Instagram: %s", err)
        return []

    ids: List[str] = []
    for page in (response or {}).get("data", []) or []:
        if not isinstance(page, dict):
            continue
        ig_account = page.get("instagram_business_account") or page.get("connected_instagram_account")
        if isinstance(ig_account, dict):
            candidate = str(ig_account.get("id") or "").strip()
            if candidate:
                ids.append(candidate)
    return sorted({item for item in ids if item})


def resolve_ingest_accounts(explicit_ids: Optional[Sequence[str]] = None, auto_discover: bool = True) -> List[str]:
    """
    Consolida IDs informados, variáveis de ambiente e descoberta automática.
    """
    candidates: List[str] = []
    if explicit_ids:
        candidates.extend(explicit_ids)

    env_list = os.getenv("INSTAGRAM_INGEST_IDS", "")
    if env_list:
        candidates.extend(item.strip() for item in env_list.split(","))

    env_default = os.getenv("META_IG_USER_ID", "")
    if env_default:
        candidates.append(env_default.strip())

    if auto_discover:
        candidates.extend(discover_instagram_account_ids())

    seen = set()
    result: List[str] = []
    for candidate in candidates:
        item = str(candidate or "").strip()
        if not item or item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


def parse_date(value: Optional[str], default: Optional[date] = None) -> Optional[date]:
    if value is None:
        return default
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        logger.error("Data inv\u00e1lida: %s", value)
        raise


def daterange(start: date, end: date) -> Iterable[date]:
    current = start
    delta = timedelta(days=1)
    while current <= end:
        yield current
        current += delta


def to_unix(dt: datetime) -> int:
    return int(dt.replace(tzinfo=timezone.utc).timestamp())


def day_bounds(target: date) -> Dict[str, int]:
    start_dt = datetime.combine(target, datetime.min.time(), tzinfo=timezone.utc)
    end_dt = start_dt + timedelta(days=1, seconds=-1)
    return {"since": to_unix(start_dt), "until": to_unix(end_dt)}


def snapshot_to_rows(
    ig_id: str,
    metric_date: date,
    snapshot: Dict[str, Optional[float]],
) -> List[Dict[str, object]]:
    rows: List[Dict[str, object]] = []

    def add(metric_key: str, numeric_value: Optional[float], metadata: Optional[dict] = None) -> None:
        if numeric_value is None:
            return
        rows.append(
            {
                "account_id": ig_id,
                "platform": PLATFORM,
                "metric_key": metric_key,
                "metric_date": metric_date.isoformat(),
                "value": float(numeric_value),
                "metadata": metadata,
            }
        )

    add("reach", snapshot.get("reach"))
    add("interactions", snapshot.get("interactions"))
    add("accounts_engaged", snapshot.get("accounts_engaged"))
    add("profile_views", snapshot.get("profile_views"))
    add("website_clicks", snapshot.get("website_clicks"))
    add("likes", snapshot.get("likes"))
    add("comments", snapshot.get("comments"))
    add("shares", snapshot.get("shares"))
    add("saves", snapshot.get("saves"))
    add("followers_delta", snapshot.get("follower_growth"))
    add("followers_total", snapshot.get("follower_count_end"))
    add("followers_start", snapshot.get("follower_count_start"))
    add("follows", snapshot.get("follows"))
    add("unfollows", snapshot.get("unfollows"))

    visitor_breakdown = snapshot.get("profile_visitors_breakdown")
    if visitor_breakdown:
        add("profile_visitors_total", visitor_breakdown.get("total"), metadata=visitor_breakdown)

    # Persist raw follower series for diagn\u00f3sticos
    follower_series = snapshot.get("follower_series")
    if follower_series:
        add("followers_series", len(follower_series), metadata={"series": follower_series})

    return rows


def upsert_metrics(rows: Sequence[Dict[str, object]]) -> None:
    if not rows:
        return
    client = get_supabase_client()
    if client is None:
        raise RuntimeError("Supabase n\u00e3o configurado para ingest\u00e3o.")
    # Supabase upsert aceita lista grande; dividimos para evitar payload excessivo
    chunk_size = 500
    for index in range(0, len(rows), chunk_size):
        chunk = rows[index:index + chunk_size]
        response = (
            client.table("metrics_daily")
            .upsert(chunk, on_conflict="account_id,platform,metric_key,metric_date")
            .execute()
        )
        if getattr(response, "error", None):
            raise RuntimeError(f"Falha ao inserir metrics_daily: {response.error}")


def build_rollup_payload(
    values: List[Dict[str, object]],
    metric_key: str,
    bucket: str,
    start_date: date,
    end_date: date,
) -> Dict[str, object]:
    numeric_values = [float(row["value"]) for row in values if row.get("value") is not None]
    if not numeric_values:
        raise ValueError("Nenhum valor num\u00e9rico encontrado para rollup.")
    value_sum = sum(numeric_values)
    value_avg = value_sum / len(numeric_values)
    payload = {
        "account_id": values[0]["account_id"],
        "platform": PLATFORM,
        "metric_key": metric_key,
        "bucket": bucket,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "value_sum": value_sum,
        "value_avg": value_avg,
        "samples": len(numeric_values),
        "payload": {
            "values": [
                {
                    "metric_date": row["metric_date"],
                    "value": row["value"],
                }
                for row in values
            ]
        },
    }
    return payload


def refresh_rollups(
    ig_id: str,
    metric_keys: Sequence[str],
    metric_date: date,
    buckets: Sequence[int] = DEFAULT_BUCKETS,
) -> None:
    client = get_supabase_client()
    if client is None:
        raise RuntimeError("Supabase n\u00e3o configurado para rollups.")

    for days in buckets:
        start_date = metric_date - timedelta(days=days - 1)
        for metric_key in metric_keys:
            response = (
                client.table("metrics_daily")
                .select("account_id,metric_date,value")
                .eq("account_id", ig_id)
                .eq("platform", PLATFORM)
                .eq("metric_key", metric_key)
                .gte("metric_date", start_date.isoformat())
                .lte("metric_date", metric_date.isoformat())
                .order("metric_date", desc=False)
                .execute()
            )
            rows = getattr(response, "data", None) or []
            if not rows:
                continue
            payload = build_rollup_payload(
                rows,
                metric_key=metric_key,
                bucket=f"{days}d",
                start_date=start_date,
                end_date=metric_date,
            )
            result = (
                client.table("metrics_daily_rollup")
                .upsert(payload, on_conflict="account_id,platform,metric_key,bucket,start_date,end_date")
                .execute()
            )
            if getattr(result, "error", None):
                raise RuntimeError(f"Falha ao atualizar rollup {metric_key}/{days}d: {result.error}")


def warm_instagram_posts_cache(ig_id: str, limit: int = DEFAULT_POSTS_LIMIT) -> None:
    try:
        get_cached_payload(
            "instagram_posts",
            ig_id,
            None,
            None,
            extra={"limit": limit},
            force=True,
            refresh_reason="ingest_job",
        )
        logger.debug("Cache de posts atualizado para %s (limite %s)", ig_id, limit)
    except Exception as err:  # noqa: BLE001
        logger.warning("Falha ao atualizar cache de posts para %s: %s", ig_id, err)


def ingest_account_range(
    ig_id: str,
    since: date,
    until: date,
    refresh_rollup: bool = True,
    warm_posts: bool = True,
) -> None:
    all_rows: List[Dict[str, object]] = []
    metric_keys_touched: defaultdict[str, set] = defaultdict(set)

    for daily_date in daterange(since, until):
        bounds = day_bounds(daily_date)
        snapshot = ig_window(ig_id, bounds["since"], bounds["until"])
        rows = snapshot_to_rows(ig_id, daily_date, snapshot)
        if not rows:
            logger.info("[%s] Nenhum dado para %s", ig_id, daily_date)
            continue
        all_rows.extend(rows)
        for row in rows:
            metric_keys_touched[daily_date.isoformat()].add(row["metric_key"])

    upsert_metrics(all_rows)
    if warm_posts:
        warm_instagram_posts_cache(ig_id)

    if not refresh_rollup:
        return

    for date_iso, keys in metric_keys_touched.items():
        metric_date = datetime.fromisoformat(date_iso).date()
        refresh_rollups(ig_id, list(keys), metric_date)


def main(argv: Optional[Sequence[str]] = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s :: %(message)s")

    parser = argparse.ArgumentParser(description="Ingest\u00e3o de m\u00e9tricas di\u00e1rias do Instagram.")
    parser.add_argument("--ig", dest="ig_ids", action="append", help="ID(s) do Instagram Business a ingerir.")
    parser.add_argument("--since", dest="since", help="Data inicial (ISO, inclusive).")
    parser.add_argument("--until", dest="until", help="Data final (ISO, inclusive).")
    parser.add_argument("--no-rollup", dest="no_rollup", action="store_true", help="N\u00e3o gerar rollups ap\u00f3s a ingest\u00e3o.")
    parser.add_argument("--no-discover", dest="no_discover", action="store_true", help="N\u00e3o buscar contas automaticamente na Graph API.")
    parser.add_argument("--skip-posts", dest="skip_posts", action="store_true", help="N\u00e3o aquecer o cache de posts ap\u00f3s a ingest\u00e3o.")

    args = parser.parse_args(argv)

    today = datetime.now(timezone.utc).date()
    default_since = today - timedelta(days=1)
    default_until = default_since

    since_date = parse_date(args.since, default_since)
    until_date = parse_date(args.until, default_until)
    if since_date > until_date:
        parser.error("--since n\u00e3o pode ser maior que --until.")

    account_ids = resolve_ingest_accounts(args.ig_ids, auto_discover=not args.no_discover)
    if not account_ids:
        parser.error("Nenhum Instagram ID encontrado. Informe via --ig ou garanta acesso \u00e0 Graph API.")

    for ig_id in account_ids:
        logger.info("Iniciando ingest\u00e3o %s (%s -> %s)", ig_id, since_date, until_date)
        ingest_account_range(
            ig_id=ig_id,
            since=since_date,
            until=until_date,
            refresh_rollup=not args.no_rollup,
            warm_posts=not args.skip_posts,
        )
        logger.info("Finalizado %s", ig_id)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
