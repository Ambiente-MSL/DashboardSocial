import logging
import os
from typing import Any, Dict

from apscheduler.schedulers.background import BackgroundScheduler

from cache import get_cached_payload, list_due_entries, mark_cache_error
from supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

DEFAULT_INTERVAL_MINUTES = int(os.getenv("META_SYNC_INTERVAL_MINUTES", "60"))


class MetaSyncScheduler:
    def __init__(self, interval_minutes: int = DEFAULT_INTERVAL_MINUTES):
        self.interval_minutes = max(5, interval_minutes)
        self._scheduler = BackgroundScheduler(timezone="UTC")
        self._started = False

    def start(self) -> None:
        if self._started:
            return

        if get_supabase_client() is None:
            logger.warning("Supabase não configurado. Scheduler de sincronização não iniciado.")
            return

        self._scheduler.add_job(
            self._run_cycle,
            "interval",
            minutes=self.interval_minutes,
            id="meta_cache_refresh",
            max_instances=1,
            coalesce=True,
        )
        self._scheduler.start()
        self._started = True
        logger.info("Scheduler de sincronização iniciado (intervalo %s minutos).", self.interval_minutes)

    def shutdown(self) -> None:
        if self._started:
            self._scheduler.shutdown(wait=False)
            self._started = False

    def _run_cycle(self) -> None:
        due_entries = list_due_entries(limit=25)
        if not due_entries:
            return

        logger.info("Atualizando %s registro(s) expostos do cache Meta.", len(due_entries))

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
