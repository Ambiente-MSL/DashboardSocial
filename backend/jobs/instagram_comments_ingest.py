import argparse
import logging
import os
import random
import sys
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, Iterator, List, Optional, Sequence, Tuple

CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.dirname(CURRENT_DIR)
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from meta import MetaAPIError, gget
from postgres_client import get_postgres_client

logger = logging.getLogger(__name__)

IG_COMMENTS_TABLE = "ig_comments"
IG_COMMENTS_DAILY_TABLE = "ig_comments_daily"
DEFAULT_DAYS_LOOKBACK = 30
GRAPH_PAGE_LIMIT_MEDIA = 100
GRAPH_PAGE_LIMIT_COMMENTS = 50
GRAPH_PAGE_LIMIT_REPLIES = 50
RETRYABLE_STATUS = {429, 500, 502, 503, 504}
OUTER_GRAPH_RETRIES = 5
INITIAL_BACKOFF_SECONDS = 1.0
MAX_BACKOFF_SECONDS = 32.0


def parse_timestamp(value: str) -> datetime:
    """
    Parse ISO-8601 timestamp into an aware datetime in UTC.
    """
    if not value:
        raise ValueError("missing timestamp")
    candidate = value.replace("Z", "+00:00")
    if len(candidate) > 5 and candidate[-5] in {"+", "-"} and ":" not in candidate[-5:]:
        candidate = f"{candidate[:-2]}:{candidate[-2:]}"
    try:
        parsed = datetime.fromisoformat(candidate)
    except ValueError as err:
        raise ValueError(f"invalid timestamp '{value}': {err}") from err
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def graph_get(path: str, params: Optional[Dict[str, object]] = None) -> Dict[str, object]:
    """
    Wrapper around meta.gget that adds outer retries with jitter for rate limiting.
    """
    backoff = INITIAL_BACKOFF_SECONDS
    for attempt in range(OUTER_GRAPH_RETRIES):
        try:
            return gget(path, params=params)
        except MetaAPIError as err:
            if err.status in RETRYABLE_STATUS and attempt < OUTER_GRAPH_RETRIES - 1:
                jitter = random.uniform(0, backoff)
                sleep_for = backoff + jitter
                logger.warning(
                    "Graph API throttled (%s) on %s. Backing off %.2fs (attempt %s/%s).",
                    err.status,
                    path,
                    sleep_for,
                    attempt + 1,
                    OUTER_GRAPH_RETRIES,
                )
                time.sleep(sleep_for)
                backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)
                continue
            raise
    raise RuntimeError(f"Graph API retry exhaustion for {path}")


def iterate_media(ig_user_id: str, since_utc: datetime) -> Iterator[Dict[str, object]]:
    """
    Yield media objects newer than since_utc (inclusive).
    """
    after: Optional[str] = None
    while True:
        params = {
            "fields": "id,caption,timestamp,comments_count",
            "limit": GRAPH_PAGE_LIMIT_MEDIA,
        }
        if after:
            params["after"] = after
        payload = graph_get(f"/{ig_user_id}/media", params=params)
        data = payload.get("data") or []
        if not isinstance(data, list):
            break

        stop_paging = False
        for media in data:
            timestamp_raw = str(media.get("timestamp") or "")
            try:
                timestamp = parse_timestamp(timestamp_raw)
            except ValueError:
                logger.debug("Skipping media without valid timestamp: %s", media)
                continue
            if timestamp < since_utc:
                stop_paging = True
                continue
            yield {
                "id": str(media.get("id")),
                "caption": media.get("caption") or "",
                "timestamp": timestamp,
            }

        paging = payload.get("paging") or {}
        cursors = paging.get("cursors") or {}
        after = cursors.get("after")
        if stop_paging or not after:
            break


def iterate_comments(media_id: str, since_utc: datetime) -> Iterator[Dict[str, object]]:
    """
    Yield comment payloads for a given media filtered by timestamp.
    """
    after: Optional[str] = None
    while True:
        params = {
            "fields": "id,text,username,timestamp,like_count,comment_count",
            "limit": GRAPH_PAGE_LIMIT_COMMENTS,
        }
        if after:
            params["after"] = after
        payload = graph_get(f"/{media_id}/comments", params=params)
        data = payload.get("data") or []
        if not isinstance(data, list) or not data:
            break

        stop_paging = False
        for comment in data:
            timestamp_raw = str(comment.get("timestamp") or "")
            try:
                timestamp = parse_timestamp(timestamp_raw)
            except ValueError:
                logger.debug("Skipping comment without valid timestamp: %s", comment)
                continue
            if timestamp < since_utc:
                stop_paging = True
                continue
            yield {
                "id": str(comment.get("id")),
                "text": comment.get("text") or "",
                "username": comment.get("username") or "",
                "timestamp": timestamp,
                "like_count": int(comment.get("like_count") or 0),
                "comment_count": int(
                    comment.get("comment_count")
                    or comment.get("replies_count")
                    or (((comment.get("replies") or {}).get("summary") or {}).get("total_count"))
                    or 0
                ),
            }

        paging = payload.get("paging") or {}
        cursors = paging.get("cursors") or {}
        after = cursors.get("after")
        if stop_paging or not after:
            break


def iterate_replies(comment_id: str, since_utc: datetime) -> Iterator[Dict[str, object]]:
    """
    Yield replies for a given comment filtered by timestamp.
    """
    after: Optional[str] = None
    while True:
        params = {
            "fields": "id,text,username,timestamp,like_count",
            "limit": GRAPH_PAGE_LIMIT_REPLIES,
        }
        if after:
            params["after"] = after
        payload = graph_get(f"/{comment_id}/replies", params=params)
        data = payload.get("data") or []
        if not isinstance(data, list) or not data:
            break

        stop_paging = False
        for reply in data:
            timestamp_raw = str(reply.get("timestamp") or "")
            try:
                timestamp = parse_timestamp(timestamp_raw)
            except ValueError:
                logger.debug("Skipping reply without valid timestamp: %s", reply)
                continue
            if timestamp < since_utc:
                stop_paging = True
                continue
            yield {
                "id": str(reply.get("id")),
                "text": reply.get("text") or "",
                "username": reply.get("username") or "",
                "timestamp": timestamp,
                "like_count": int(reply.get("like_count") or 0),
            }

        paging = payload.get("paging") or {}
        cursors = paging.get("cursors") or {}
        after = cursors.get("after")
        if stop_paging or not after:
            break


def normalize_comment_record(
    account_id: str,
    media_id: str,
    media_timestamp: datetime,
    comment: Dict[str, object],
    parent_id: Optional[str],
    fetched_at: datetime,
) -> Optional[Dict[str, object]]:
    """
    Build a Postgres row for a comment or reply.
    """
    comment_id = str(comment.get("id") or "").strip()
    text = (comment.get("text") or "").strip()
    if not comment_id or not text:
        return None
    created_at = comment.get("timestamp")
    if not isinstance(created_at, datetime):
        return None
    like_count = int(comment.get("like_count") or 0)
    username = (comment.get("username") or "").strip() or None
    record = {
        "id": comment_id,
        "account_id": account_id,
        "media_id": media_id,
        "username": username,
        "text": text,
        "like_count": like_count,
        "timestamp": created_at.isoformat(),
        "created_at": fetched_at.isoformat(),
        "updated_at": fetched_at.isoformat(),
    }
    return record


def chunked(items: Sequence[Dict[str, object]], size: int) -> Iterable[Sequence[Dict[str, object]]]:
    for index in range(0, len(items), size):
        yield items[index:index + size]


def fetch_existing_comment_ids(client, comment_ids: Sequence[str]) -> set[str]:
    existing: set[str] = set()
    if not comment_ids:
        return existing
    chunk_size = 500
    for chunk_start in range(0, len(comment_ids), chunk_size):
        chunk = comment_ids[chunk_start:chunk_start + chunk_size]
        response = (
            client.table(IG_COMMENTS_TABLE)
            .select("id")
            .in_("id", chunk)
            .execute()
        )
        data = getattr(response, "data", None) or []
        for row in data:
            comment_id = row.get("id")
            if comment_id:
                existing.add(str(comment_id))
    return existing


def upsert_comments(rows: Sequence[Dict[str, object]]) -> Tuple[int, int]:
    if not rows:
        return 0, 0
    client = get_postgres_client()
    if client is None:
        raise RuntimeError("Database client is not configured.")

    deduplicated: Dict[str, Dict[str, object]] = {}
    for row in rows:
        deduplicated[row["id"]] = row
    deduped_rows = list(deduplicated.values())

    existing_ids = fetch_existing_comment_ids(client, [row["id"] for row in deduped_rows])
    inserted = 0
    updated = 0
    for row in deduped_rows:
        if row["id"] in existing_ids:
            updated += 1
        else:
            inserted += 1

    for chunk in chunked(deduped_rows, 500):
        response = (
            client.table(IG_COMMENTS_TABLE)
            .upsert(chunk, on_conflict="id")
            .execute()
        )
        if getattr(response, "error", None):
            raise RuntimeError(f"Failed to upsert comments: {response.error}")
    return inserted, updated


def refresh_daily_rollup(account_id: str, comments: Sequence[Dict[str, object]]) -> None:
    if not comments:
        return
    client = get_postgres_client()
    if client is None:
        raise RuntimeError("Database client is not configured.")

    counts: Dict[str, int] = defaultdict(int)
    for comment in comments:
        created_at_iso = comment.get("timestamp") or comment.get("created_at")
        if not created_at_iso:
            continue
        created_at = parse_timestamp(created_at_iso)
        day_key = created_at.date().isoformat()
        counts[day_key] += 1

    payload = [
        {
            "account_id": account_id,
            "comment_date": day,
            "comments_count": count,
        }
        for day, count in counts.items()
    ]
    if not payload:
        return

    for chunk in chunked(payload, 500):
        response = (
            client.table(IG_COMMENTS_DAILY_TABLE)
            .upsert(chunk, on_conflict="account_id,comment_date")
            .execute()
        )
        if getattr(response, "error", None):
            raise RuntimeError(f"Failed to upsert daily counts: {response.error}")


def ingest_account_comments(ig_user_id: str, days: int) -> Tuple[int, int, int]:
    """
    Fetch media comments for the given Instagram account and persist them.
    """
    start_ts = time.perf_counter()
    since_utc = datetime.now(timezone.utc) - timedelta(days=days)
    fetched_at = datetime.now(timezone.utc)

    total_media = 0
    collected_comments: List[Dict[str, object]] = []
    seen_comment_ids: set[str] = set()

    for media in iterate_media(ig_user_id, since_utc):
        media_id = media["id"]
        media_ts = media["timestamp"]
        total_media += 1
        logger.info("[comments] Fetching comments for media %s (%s)", media_id, media_ts.isoformat())

        try:
            for comment in iterate_comments(media_id, since_utc):
                record = normalize_comment_record(
                    account_id=ig_user_id,
                    media_id=media_id,
                    media_timestamp=media_ts,
                    comment=comment,
                    parent_id=None,
                    fetched_at=fetched_at,
                )
                if record and record["comment_id"] not in seen_comment_ids:
                    collected_comments.append(record)
                    seen_comment_ids.add(record["comment_id"])

                reply_count = comment.get("comment_count") or 0
                if reply_count:
                    try:
                        for reply in iterate_replies(comment["id"], since_utc):
                            reply_record = normalize_comment_record(
                                account_id=ig_user_id,
                                media_id=media_id,
                                media_timestamp=media_ts,
                                comment=reply,
                                parent_id=comment["id"],
                                fetched_at=fetched_at,
                            )
                            if reply_record and reply_record["comment_id"] not in seen_comment_ids:
                                collected_comments.append(reply_record)
                                seen_comment_ids.add(reply_record["comment_id"])
                    except MetaAPIError as err:
                        logger.warning(
                            "[comments] Failed to fetch replies for %s: %s",
                            comment["id"],
                            err,
                        )
        except MetaAPIError as err:
            logger.warning("[comments] Failed to fetch comments for media %s: %s", media_id, err)

    inserted, updated = upsert_comments(collected_comments)
    refresh_daily_rollup(ig_user_id, collected_comments)
    duration = time.perf_counter() - start_ts
    logger.info(
        "[comments] %s: medias=%s total_comments=%s inserted=%s updated=%s duration=%.2fs",
        ig_user_id,
        total_media,
        len(collected_comments),
        inserted,
        updated,
        duration,
    )
    return total_media, inserted, updated


def parse_args(argv: Optional[Sequence[str]]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest Instagram comments from recent media.")
    parser.add_argument("--ig", dest="ig_user_ids", action="append", required=True, help="Instagram Business account ID.")
    parser.add_argument("--days", type=int, default=DEFAULT_DAYS_LOOKBACK, help="Lookback window in days (default: 30).")
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s :: %(message)s")
    args = parse_args(argv)
    days = max(1, args.days or DEFAULT_DAYS_LOOKBACK)
    account_ids = [item.strip() for item in (args.ig_user_ids or []) if item and item.strip()]
    if not account_ids:
        logger.error("No Instagram account IDs provided.")
        return 1

    exit_code = 0
    for ig_user_id in account_ids:
        try:
            ingest_account_comments(ig_user_id, days=days)
        except Exception:  # noqa: BLE001
            logger.exception("Failed to ingest comments for %s", ig_user_id)
            exit_code = 1
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
