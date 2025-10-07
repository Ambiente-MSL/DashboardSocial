# backend/server.py
import os
import time
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from flask import Flask, jsonify, request
from flask_cors import CORS

from cache import get_cached_payload, mark_cache_error, register_fetcher
from meta import (
    MetaAPIError,
    ads_highlights,
    fb_page_window,
    fb_recent_posts,
    ig_audience,
    ig_organic_summary,
    ig_recent_posts,
    ig_window,
)
from scheduler import MetaSyncScheduler

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

PAGE_ID = os.getenv("META_PAGE_ID")
IG_ID = os.getenv("META_IG_USER_ID")
ACT_ID = os.getenv("META_AD_ACCOUNT_ID")

# Constantes
MAX_DAYS_RANGE = 90  # Máximo de 90 dias
MIN_TIMESTAMP = 946684800  # 1 Jan 2000
DEFAULT_DAYS = 7
DEFAULT_REFRESH_RESOURCES = [
    "facebook_metrics",
    "facebook_posts",
    "instagram_metrics",
    "instagram_organic",
    "instagram_audience",
    "instagram_posts",
    "ads_highlights",
]


def validate_timestamp(ts: int, param_name: str = "timestamp") -> int:
    """
    Valida se um timestamp Unix está em um range válido.

    Args:
        ts: Timestamp Unix em segundos
        param_name: Nome do parâmetro (para mensagem de erro)

    Returns:
        int: Timestamp validado

    Raises:
        ValueError: Se timestamp for inválido
    """
    now = int(time.time())

    if ts < MIN_TIMESTAMP:
        raise ValueError(f"{param_name} muito antigo (antes de 2000)")

    if ts > now:
        raise ValueError(f"{param_name} não pode estar no futuro")

    return ts


def unix_range(args, default_days=DEFAULT_DAYS):
    """
    Extrai e valida range de datas dos parâmetros da request.

    Args:
        args: Request args (request.args)
        default_days: Número de dias padrão se não especificado

    Returns:
        tuple: (since, until) em Unix timestamp

    Raises:
        ValueError: Se range for inválido
    """
    now = int(time.time())

    # Obter until (padrão: agora)
    until_param = args.get("until")
    if until_param:
        try:
            until = int(until_param)
            until = validate_timestamp(until, "until")
        except (ValueError, TypeError) as e:
            logger.warning(f"Invalid until parameter: {until_param}, using now. Error: {e}")
            until = now
    else:
        until = now

    # Obter since
    since_param = args.get("since")
    if since_param:
        try:
            since = int(since_param)
            since = validate_timestamp(since, "since")
        except (ValueError, TypeError) as e:
            logger.warning(f"Invalid since parameter: {since_param}, using default. Error: {e}")
            since = until - (default_days * 86_400)
    else:
        since = until - (default_days * 86_400)

    # Validar ordem
    if since >= until:
        logger.warning(f"since ({since}) >= until ({until}), adjusting")
        since = until - (default_days * 86_400)

    # Validar range máximo (90 dias)
    range_days = (until - since) / 86_400
    if range_days > MAX_DAYS_RANGE:
        logger.warning(f"Range too large ({range_days:.1f} days), limiting to {MAX_DAYS_RANGE} days")
        since = until - (MAX_DAYS_RANGE * 86_400)

    # Garantir que since não seja negativo
    if since < MIN_TIMESTAMP:
        since = MIN_TIMESTAMP

    logger.info(f"Date range: {datetime.fromtimestamp(since)} to {datetime.fromtimestamp(until)} ({range_days:.1f} days)")

    return since, until


def _duration(since_ts: int, until_ts: int) -> int:
    return max(1, until_ts - since_ts)


def fetch_facebook_metrics(
    page_id: str,
    since_ts: Optional[int],
    until_ts: Optional[int],
    _extra: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    if since_ts is None or until_ts is None:
        raise ValueError("since_ts e until_ts sǭo obrigat��rios para facebook_metrics")

    cur = fb_page_window(page_id, since_ts, until_ts)
    prev = fb_page_window(page_id, since_ts - _duration(since_ts, until_ts), since_ts)

    def pct(current, previous):
        return round(((current - previous) / previous) * 100, 2) if previous and previous > 0 and current is not None else None

    engagement_cur = cur.get("engagement") or {}
    engagement_prev = prev.get("engagement") or {}
    video_cur = cur.get("video") or {}
    video_prev = prev.get("video") or {}

    metrics = [
        {
            "key": "reach",
            "label": "Alcance organico",
            "value": cur.get("reach"),
            "deltaPct": pct(cur.get("reach"), prev.get("reach")),
        },
        {
            "key": "post_engagement_total",
            "label": "Engajamento post",
            "value": engagement_cur.get("total"),
            "deltaPct": pct(engagement_cur.get("total"), engagement_prev.get("total")),
            "breakdown": {
                "reactions": engagement_cur.get("reactions"),
                "comments": engagement_cur.get("comments"),
                "shares": engagement_cur.get("shares"),
            },
        },
        {
            "key": "video_views_10s",
            "label": "Views de 10+ seg",
            "value": video_cur.get("views_10s"),
            "deltaPct": pct(video_cur.get("views_10s"), video_prev.get("views_10s")),
        },
        {
            "key": "video_views_1m",
            "label": "Views de 1+ min",
            "value": video_cur.get("views_1m"),
            "deltaPct": pct(video_cur.get("views_1m"), video_prev.get("views_1m")),
        },
        {
            "key": "video_avg_watch_time",
            "label": "Tempo medio de visualizacao",
            "value": video_cur.get("avg_watch_time"),
            "deltaPct": pct(video_cur.get("avg_watch_time"), video_prev.get("avg_watch_time")),
        },
        {
            "key": "video_watch_time_total",
            "label": "Tempo total assistido",
            "value": video_cur.get("watch_time_total"),
            "deltaPct": pct(video_cur.get("watch_time_total"), video_prev.get("watch_time_total")),
        },
    ]

    breakdowns = {
        "engagement": {
            "reactions": engagement_cur.get("reactions"),
            "comments": engagement_cur.get("comments"),
            "shares": engagement_cur.get("shares"),
        },
        "video": {
            "views_10s": video_cur.get("views_10s"),
            "views_1m": video_cur.get("views_1m"),
        },
    }

    page_overview = cur.get("page_overview") or {}

    return {
        "since": since_ts,
        "until": until_ts,
        "metrics": metrics,
        "breakdowns": breakdowns,
        "page_overview": page_overview,
    }


def fetch_facebook_posts(
    page_id: str,
    _since_ts: Optional[int],
    _until_ts: Optional[int],
    extra: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    limit = None
    if extra and "limit" in extra:
        try:
            limit = int(extra["limit"])
        except (TypeError, ValueError):
            limit = None
    limit = limit or 6
    return fb_recent_posts(page_id, limit)


def fetch_instagram_metrics(
    ig_id: str,
    since_ts: Optional[int],
    until_ts: Optional[int],
    _extra: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    if since_ts is None or until_ts is None:
        raise ValueError("since_ts e until_ts sǭo obrigat��rios para instagram_metrics")

    cur = ig_window(ig_id, since_ts, until_ts)
    prev = ig_window(ig_id, since_ts - _duration(since_ts, until_ts), since_ts)

    def pct(current, previous):
        return round(((current - previous) / previous) * 100, 2) if previous and previous > 0 and current is not None else None

    engagement_rate_from_posts = None
    engagement_breakdown = {
        "likes": 0,
        "comments": 0,
        "shares": 0,
        "saves": 0,
        "total": 0,
        "reach": 0,
    }

    try:
        posts_data = ig_recent_posts(ig_id, limit=10)
    except MetaAPIError as err:
        logger.warning("Falha ao buscar posts do Instagram para calcular engajamento: %s", err, exc_info=False)
        posts_data = {}
    posts = (posts_data or {}).get("posts", [])
    posts_in_period = []
    for post in posts:
        timestamp = post.get("timestamp")
        if not timestamp:
            continue
        try:
            timestamp_dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except ValueError:
            continue
        post_unix = int(timestamp_dt.timestamp())
        if since_ts <= post_unix <= until_ts:
            posts_in_period.append(post)

    if posts_in_period:
        total_interactions = 0
        total_reach = 0
        for post in posts_in_period:
            likes = int(post.get("like_count") or post.get("likes") or 0)
            comments = int(post.get("comments_count") or post.get("comments") or 0)
            shares = int(post.get("shares") or 0)
            saves = int(post.get("saves") or 0)
            total_post_interactions = likes + comments + shares + saves
            total_interactions += total_post_interactions
            reach_value = int(post.get("reach") or 0)
            total_reach += reach_value

            engagement_breakdown["likes"] += likes
            engagement_breakdown["comments"] += comments
            engagement_breakdown["shares"] += shares
            engagement_breakdown["saves"] += saves
            engagement_breakdown["total"] += total_post_interactions
            engagement_breakdown["reach"] += reach_value

        if total_reach > 0:
            engagement_rate_from_posts = round((total_interactions / total_reach) * 100, 2)

    cur_profile = cur.get("profile") or {}
    prev_profile = prev.get("profile") or {}
    cur_posts = cur.get("posts") or {}
    prev_posts = prev.get("posts") or {}

    if engagement_rate_from_posts is None:
        engagement_rate_from_posts = round((cur["interactions"] / cur["reach"]) * 100, 2) if cur["reach"] else None
        engagement_breakdown = {
            "likes": cur.get("likes", 0),
            "comments": cur.get("comments", 0),
            "shares": cur.get("shares", 0),
            "saves": cur.get("saves", 0),
            "total": cur.get("interactions", 0),
            "reach": cur.get("reach", 0),
        }

    if (cur.get("reach") or 0) <= 0 and engagement_breakdown["reach"] > 0:
        cur["reach"] = engagement_breakdown["reach"]

    if (cur.get("interactions") or 0) <= 0 and engagement_breakdown["total"] > 0:
        cur["interactions"] = engagement_breakdown["total"]

    metrics = [
        {"key": "reach", "label": "ALCANCE", "value": cur["reach"], "deltaPct": pct(cur["reach"], prev["reach"])},
        {"key": "profile_views", "label": "VIEWS DE PERFIL", "value": cur["profile_views"], "deltaPct": pct(cur["profile_views"], prev["profile_views"])},
        {"key": "website_clicks", "label": "CLIQUES NO SITE", "value": cur["website_clicks"], "deltaPct": pct(cur["website_clicks"], prev["website_clicks"])},
        {"key": "interactions", "label": "INTERACOES TOTAIS", "value": cur["interactions"], "deltaPct": pct(cur["interactions"], prev["interactions"])},
        {"key": "likes", "label": "CURTIDAS", "value": cur.get("likes"), "deltaPct": None},
        {"key": "comments", "label": "COMENTARIOS", "value": cur.get("comments"), "deltaPct": None},
        {"key": "shares", "label": "COMPARTILHAMENTOS", "value": cur.get("shares"), "deltaPct": None},
        {"key": "saves", "label": "SALVAMENTOS", "value": cur.get("saves"), "deltaPct": None},
        {
            "key": "engagement_rate",
            "label": "TAXA ENGAJAMENTO",
            "value": engagement_rate_from_posts,
            "deltaPct": None,
            "breakdown": engagement_breakdown,
        },
        {
            "key": "follower_growth",
            "label": "CRESCIMENTO DE SEGUIDORES",
            "value": cur.get("follower_growth"),
            "deltaPct": None,
        },
    ]
    follower_counts = {
        "start": cur.get("follower_count_start"),
        "end": cur.get("follower_count_end"),
        "follows": cur.get("follows"),
        "unfollows": cur.get("unfollows"),
    }
    return {
        "since": since_ts,
        "until": until_ts,
        "metrics": metrics,
        "profile_visitors_breakdown": cur.get("profile_visitors_breakdown"),
        "follower_counts": follower_counts,
    }


def fetch_instagram_organic(
    ig_id: str,
    since_ts: Optional[int],
    until_ts: Optional[int],
    _extra: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    if since_ts is None or until_ts is None:
        raise ValueError("since_ts e until_ts sǭo obrigat��rios para instagram_organic")
    data = ig_organic_summary(ig_id, since_ts, until_ts)
    data.update({"since": since_ts, "until": until_ts})
    return data


def fetch_instagram_audience(
    ig_id: str,
    _since_ts: Optional[int],
    _until_ts: Optional[int],
    _extra: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    return ig_audience(ig_id)


def fetch_instagram_posts(
    ig_id: str,
    _since_ts: Optional[int],
    _until_ts: Optional[int],
    extra: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    limit = None
    if extra and "limit" in extra:
        try:
            limit = int(extra["limit"])
        except (TypeError, ValueError):
            limit = None
    limit = limit or 6
    return ig_recent_posts(ig_id, limit)


def _ts_to_iso_date(ts: Optional[int]) -> Optional[str]:
    if ts is None:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat()


def _iso_to_ts(date_str: Optional[str]) -> Optional[int]:
    if not date_str:
        return None
    try:
        dt = datetime.fromisoformat(date_str)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    dt = dt.replace(hour=0, minute=0, second=0, microsecond=0)
    return int(dt.timestamp())


def _safe_int(value: Optional[Any]) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def fetch_ads_highlights(
    act_id: str,
    since_ts: Optional[int],
    until_ts: Optional[int],
    _extra: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    until_iso = _ts_to_iso_date(until_ts)
    since_iso = _ts_to_iso_date(since_ts)

    if not since_iso or not until_iso:
        until_dt = datetime.now(timezone.utc).date()
        since_dt = until_dt - timedelta(days=7)
        since_iso = since_dt.isoformat()
        until_iso = until_dt.isoformat()

    data = ads_highlights(act_id, since_iso, until_iso)
    response = {"since": since_iso, "until": until_iso}
    response.update(data)
    return response


def meta_error_response(err: MetaAPIError):
    payload = {
        "error": err.args[0],
        "graph": {
            "status": err.status,
            "code": err.code,
            "type": err.error_type,
        },
    }
    return jsonify(payload), 502


@app.get("/api/facebook/metrics")
def facebook_metrics():
    page_id = request.args.get("pageId", PAGE_ID)
    if not page_id:
        return jsonify({"error": "META_PAGE_ID is not configured"}), 500
    since, until = unix_range(request.args)
    try:
        payload, meta = get_cached_payload(
            "facebook_metrics",
            page_id,
            since,
            until,
            fetcher=fetch_facebook_metrics,
        )
    except MetaAPIError as err:
        mark_cache_error("facebook_metrics", page_id, since, until, None, err.args[0])
        return meta_error_response(err)
    except ValueError as err:
        return jsonify({"error": str(err)}), 400

    response = dict(payload)
    response["cache"] = meta
    return jsonify(response)


@app.get("/api/facebook/posts")
def facebook_posts():
    page_id = request.args.get("pageId", PAGE_ID)
    if not page_id:
        return jsonify({"error": "META_PAGE_ID is not configured"}), 500
    limit_param = request.args.get("limit")
    try:
        limit = int(limit_param) if limit_param is not None else 6
    except ValueError:
        limit = 6
    try:
        payload, meta = get_cached_payload(
            "facebook_posts",
            page_id,
            None,
            None,
            extra={"limit": limit},
            fetcher=fetch_facebook_posts,
        )
    except MetaAPIError as err:
        mark_cache_error("facebook_posts", page_id, None, None, {"limit": limit}, err.args[0])
        return meta_error_response(err)
    response = dict(payload)
    response["cache"] = meta
    return jsonify(response)


# ============== INSTAGRAM (ORGÂNICO) ==============

@app.get("/api/instagram/metrics")
def instagram_metrics():
    """
    Cards orgânicos (conta) – usa cache Supabase antes de acessar a Graph API.
    """
    ig = request.args.get("igUserId", IG_ID)
    if not ig:
        return jsonify({"error": "META_IG_USER_ID is not configured"}), 500
    since, until = unix_range(request.args)
    try:
        payload, meta = get_cached_payload(
            "instagram_metrics",
            ig,
            since,
            until,
            fetcher=fetch_instagram_metrics,
        )
    except MetaAPIError as err:
        mark_cache_error("instagram_metrics", ig, since, until, None, err.args[0])
        return meta_error_response(err)
    except ValueError as err:
        return jsonify({"error": str(err)}), 400

    response = dict(payload)
    response["cache"] = meta
    return jsonify(response)

@app.get("/api/instagram/organic")
def instagram_organic():
    """
    Resumo orgânico avançado: usa dados do cache antes de tocar a Graph API.
    """
    ig = request.args.get("igUserId", IG_ID)
    if not ig:
        return jsonify({"error": "META_IG_USER_ID is not configured"}), 500
    since, until = unix_range(request.args)
    try:
        payload, meta = get_cached_payload(
            "instagram_organic",
            ig,
            since,
            until,
            fetcher=fetch_instagram_organic,
        )
    except MetaAPIError as err:
        mark_cache_error("instagram_organic", ig, since, until, None, err.args[0])
        return meta_error_response(err)
    except ValueError as err:
        return jsonify({"error": str(err)}), 400

    response = dict(payload)
    response["cache"] = meta
    return jsonify(response)

@app.get("/api/instagram/audience")
def instagram_audience():
    ig = request.args.get("igUserId", IG_ID)
    if not ig:
        return jsonify({"error": "META_IG_USER_ID is not configured"}), 500
    try:
        payload, meta = get_cached_payload(
            "instagram_audience",
            ig,
            None,
            None,
            fetcher=fetch_instagram_audience,
        )
    except MetaAPIError as err:
        mark_cache_error("instagram_audience", ig, None, None, None, err.args[0])
        return meta_error_response(err)
    response = dict(payload)
    response["cache"] = meta
    return jsonify(response)

@app.get("/api/instagram/posts")
def instagram_posts():
    ig = request.args.get("igUserId", IG_ID)
    if not ig:
        return jsonify({"error": "META_IG_USER_ID is not configured"}), 500
    limit_param = request.args.get("limit")
    try:
        limit = int(limit_param) if limit_param is not None else 6
    except ValueError:
        limit = 6
    try:
        payload, meta = get_cached_payload(
            "instagram_posts",
            ig,
            None,
            None,
            extra={"limit": limit},
            fetcher=fetch_instagram_posts,
        )
    except MetaAPIError as err:
        mark_cache_error("instagram_posts", ig, None, None, {"limit": limit}, err.args[0])
        return meta_error_response(err)
    response = dict(payload)
    response["cache"] = meta
    return jsonify(response)

@app.get("/api/ads/highlights")
def ads_high():
    act = request.args.get("actId", ACT_ID)
    if not act:
        return jsonify({"error": "META_AD_ACCOUNT_ID is not configured"}), 500

    since_param = request.args.get("since")
    until_param = request.args.get("until")
    since_ts = _iso_to_ts(since_param)
    until_ts = _iso_to_ts(until_param)

    if since_ts is None or until_ts is None:
        until_date = datetime.now(timezone.utc).date()
        since_date = until_date - timedelta(days=7)
        since_ts = _iso_to_ts(since_date.isoformat())
        until_ts = _iso_to_ts(until_date.isoformat())

    try:
        payload, meta = get_cached_payload(
            "ads_highlights",
            act,
            since_ts,
            until_ts,
            fetcher=fetch_ads_highlights,
        )
    except MetaAPIError as err:
        mark_cache_error("ads_highlights", act, since_ts, until_ts, None, err.args[0])
        return meta_error_response(err)
    except ValueError as err:
        return jsonify({"error": str(err)}), 400

    response = dict(payload)
    response["cache"] = meta
    return jsonify(response)


@app.post("/api/sync/refresh")
def manual_refresh():
    body = request.get_json(silent=True) or {}
    resources = body.get("resources") or DEFAULT_REFRESH_RESOURCES
    if not isinstance(resources, list):
        return jsonify({"error": "resources must be a list"}), 400

    account = body.get("account") or {}
    page_id = body.get("pageId") or account.get("facebookPageId") or PAGE_ID
    ig_id = body.get("igUserId") or account.get("instagramUserId") or IG_ID
    ad_id = body.get("actId") or account.get("adAccountId") or ACT_ID
    limit_override = _safe_int(body.get("limit")) or 6

    since_ts = _safe_int(body.get("since"))
    until_ts = _safe_int(body.get("until"))

    if since_ts is None or until_ts is None:
        until_ts = int(time.time())
        since_ts = until_ts - (DEFAULT_DAYS * 86_400)

    results: Dict[str, Dict[str, Any]] = {}
    errors: List[Dict[str, Any]] = []

    def add_error(resource: str, message: str, details: Optional[Dict[str, Any]] = None) -> None:
        payload = {"resource": resource, "error": message}
        if details:
            payload.update(details)
        errors.append(payload)

    for resource in resources:
        owner_id = None
        since_arg = None
        until_arg = None
        extra = None
        fetcher = None

        if resource == "facebook_metrics":
            owner_id = page_id
            since_arg = since_ts
            until_arg = until_ts
            fetcher = fetch_facebook_metrics
        elif resource == "facebook_posts":
            owner_id = page_id
            extra = {"limit": limit_override}
            fetcher = fetch_facebook_posts
        elif resource == "instagram_metrics":
            owner_id = ig_id
            since_arg = since_ts
            until_arg = until_ts
            fetcher = fetch_instagram_metrics
        elif resource == "instagram_organic":
            owner_id = ig_id
            since_arg = since_ts
            until_arg = until_ts
            fetcher = fetch_instagram_organic
        elif resource == "instagram_audience":
            owner_id = ig_id
            fetcher = fetch_instagram_audience
        elif resource == "instagram_posts":
            owner_id = ig_id
            extra = {"limit": limit_override}
            fetcher = fetch_instagram_posts
        elif resource == "ads_highlights":
            owner_id = ad_id
            since_arg = since_ts
            until_arg = until_ts
            fetcher = fetch_ads_highlights
        else:
            add_error(resource, "Unsupported resource")
            continue

        if not owner_id:
            add_error(resource, "Missing identifier")
            continue

        try:
            _, meta = get_cached_payload(
                resource,
                owner_id,
                since_arg,
                until_arg,
                extra=extra,
                fetcher=fetcher,
                force=True,
                refresh_reason="manual",
            )
            results[resource] = {"cache": meta}
        except MetaAPIError as err:
            mark_cache_error(resource, owner_id, since_arg, until_arg, extra, err.args[0])
            add_error(
                resource,
                err.args[0],
                {"status": err.status, "code": err.code, "type": err.error_type},
            )
        except Exception as err:  # noqa: BLE001
            add_error(resource, str(err))

    status = 207 if errors else 200
    return jsonify({
        "results": results,
        "errors": errors,
        "resources": resources,
        "since": since_ts,
        "until": until_ts,
    }), status

register_fetcher("facebook_metrics", fetch_facebook_metrics)
register_fetcher("facebook_posts", fetch_facebook_posts)
register_fetcher("instagram_metrics", fetch_instagram_metrics)
register_fetcher("instagram_organic", fetch_instagram_organic)
register_fetcher("instagram_audience", fetch_instagram_audience)
register_fetcher("instagram_posts", fetch_instagram_posts)
register_fetcher("ads_highlights", fetch_ads_highlights)

_sync_scheduler: Optional[MetaSyncScheduler] = None
if os.getenv("META_SYNC_AUTOSTART", "1") != "0":
    should_start_scheduler = True
    if app.debug:
        should_start_scheduler = os.getenv("WERKZEUG_RUN_MAIN") == "true"
    if should_start_scheduler:
        _sync_scheduler = MetaSyncScheduler()
        _sync_scheduler.start()


if __name__ == "__main__":
    app.run(port=3001, debug=True)
