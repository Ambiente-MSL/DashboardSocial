import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler

from cache import get_cached_payload, list_due_entries, mark_cache_error
from jobs.instagram_ingest import ingest_account_range, resolve_ingest_accounts
from supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

DEFAULT_INTERVAL_MINUTES = int(os.getenv("META_SYNC_INTERVAL_MINUTES", "60"))
DEFAULT_INGEST_ENABLED = os.getenv("INSTAGRAM_INGEST_ENABLED", "1") != "0"
DEFAULT_INGEST_TIME = os.getenv("INSTAGRAM_INGEST_TIME", "03:00")
DEFAULT_INGEST_TZ = os.getenv("INSTAGRAM_INGEST_TZ", "America/Sao_Paulo")
DEFAULT_INGEST_AUTO_DISCOVER = os.getenv("INSTAGRAM_INGEST_AUTO_DISCOVER", "1") != "0"
DEFAULT_INGEST_WARM_POSTS = os.getenv("INSTAGRAM_INGEST_WARM_POSTS", "1") != "0"
DEFAULT_INGEST_LOOKBACK_DAYS = int(os.getenv("INSTAGRAM_INGEST_LOOKBACK_DAYS", "1") or "1")


class MetaSyncScheduler:
    def __init__(self, interval_minutes: int = DEFAULT_INTERVAL_MINUTES):
        self.interval_minutes = max(5, interval_minutes)
        self._scheduler = BackgroundScheduler(timezone="UTC")
        self._started = False

        self._ingest_enabled = DEFAULT_INGEST_ENABLED
        self._ingest_time = DEFAULT_INGEST_TIME
        self._ingest_timezone = DEFAULT_INGEST_TZ
        self._ingest_auto_discover = DEFAULT_INGEST_AUTO_DISCOVER
        self._ingest_warm_posts = DEFAULT_INGEST_WARM_POSTS
        self._ingest_lookback = max(1, DEFAULT_INGEST_LOOKBACK_DAYS)

    def start(self) -> None:
        if self._started:
            return

        if get_supabase_client() is None:
            logger.warning("Supabase não configurado. Scheduler de sincronização não iniciado.")
            return

        self._scheduler.add_job(
            self._run_cache_cycle,
            "interval",
            minutes=self.interval_minutes,
            id="meta_cache_refresh",
            max_instances=1,
            coalesce=True,
        )

        if self._ingest_enabled:
            ingest_hour, ingest_minute = self._parse_ingest_time(self._ingest_time)
            ingest_tz = self._resolve_timezone(self._ingest_timezone)
            self._scheduler.add_job(
                self._run_ingest_cycle,
                "cron",
                hour=ingest_hour,
                minute=ingest_minute,
                id="instagram_daily_ingest",
                max_instances=1,
                coalesce=True,
                timezone=ingest_tz,
            )
            logger.info(
                "Ingestão diária do Instagram agendada para %02d:%02d (%s).",
                ingest_hour,
                ingest_minute,
                ingest_tz.key if hasattr(ingest_tz, "key") else ingest_tz.tzname(datetime.utcnow()),
            )

        self._scheduler.start()
        self._started = True
        logger.info("Scheduler de sincronização iniciado (intervalo %s minutos).", self.interval_minutes)

    def shutdown(self) -> None:
        if self._started:
            self._scheduler.shutdown(wait=False)
            self._started = False

    def _parse_ingest_time(self, config_time: str) -> tuple[int, int]:
        try:
            hour_str, minute_str = config_time.split(":")
            return int(hour_str), int(minute_str)
        except Exception:  # noqa: BLE001
            logger.error("INSTAGRAM_INGEST_TIME inválido (%s). Usando 03:00.", config_time)
            return 3, 0

    def _resolve_timezone(self, tz_name: str) -> ZoneInfo:
        try:
            return ZoneInfo(tz_name)
        except Exception as err:  # noqa: BLE001
            logger.error("Timezone %s inválido (%s). Usando UTC.", tz_name, err)
            return ZoneInfo("UTC")

    def _run_cache_cycle(self) -> None:
        due_entries = list_due_entries(limit=25)
        if not due_entries:
            return

        logger.info("Atualizando %s registro(s) expirados do cache Meta.", len(due_entries))

        for entry in due_entries:
            resource = entry.get("resource")
            owner_id = entry.get("owner_id")
            since_ts = entry.get("since_ts")
            until_ts = entry.get("until_ts")
            extra = entry.get("extra")
            cache_key = entry.get("cache_key")

            try:
                get_cached_payload(
                    resource,
                    owner_id,
                    since_ts,
                    until_ts,
                    extra,
                    force=True,
                    refresh_reason="scheduler",
                )
                logger.debug("Cache %s atualizado pelo scheduler.", cache_key)
            except Exception as err:  # noqa: BLE001
                message = str(err)
                logger.exception("Falha ao atualizar cache %s: %s", cache_key, message)
                mark_cache_error(resource, owner_id, since_ts, until_ts, extra, message)

    def _resolve_ingest_accounts(self) -> List[str]:
        accounts = resolve_ingest_accounts(auto_discover=self._ingest_auto_discover)
        return accounts

    def _run_ingest_cycle(self) -> None:
        account_ids = self._resolve_ingest_accounts()
        if not account_ids:
            logger.warning("Sem contas de Instagram para ingestão diária.")
            return

        tz = self._resolve_timezone(self._ingest_timezone)
        today_local = datetime.now(tz).date()
        target_end = today_local - timedelta(days=1)
        target_start = target_end - timedelta(days=self._ingest_lookback - 1)

        logger.info(
            "Iniciando ingestão diária (%s -> %s) para %s conta(s).",
            target_start,
            target_end,
            len(account_ids),
        )

        for ig_id in account_ids:
            try:
                ingest_account_range(
                    ig_id=ig_id,
                    since=target_start,
                    until=target_end,
                    refresh_rollup=True,
                    warm_posts=self._ingest_warm_posts,
                )
                logger.info("Ingestão concluída para %s.", ig_id)
            except Exception as err:  # noqa: BLE001
                logger.exception("Falha na ingestão para %s: %s", ig_id, err)
