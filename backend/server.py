# backend/server.py
import os
import time
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify
from flask_cors import CORS

from meta import (
    fb_page_window,
    fb_recent_posts,
    ig_window,
    ig_recent_posts,
    ig_organic_summary,   # NOVO
    ads_highlights,
    MetaAPIError,
)

app = Flask(__name__)
CORS(app)

PAGE_ID = os.getenv("META_PAGE_ID")
IG_ID = os.getenv("META_IG_USER_ID")
ACT_ID = os.getenv("META_AD_ACCOUNT_ID")


def unix_range(args, default_days=7):
    now = int(time.time())
    days = int(args.get("days", default_days))
    until = int(args.get("until", now))
    since = int(args.get("since", until - days * 86_400))
    return since, until


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
        cur = fb_page_window(page_id, since, until)
        prev = fb_page_window(page_id, since - (until - since), since)
    except MetaAPIError as err:
        return meta_error_response(err)

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

    return jsonify({"since": since, "until": until, "metrics": metrics, "breakdowns": breakdowns})


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
        data = fb_recent_posts(page_id, limit)
    except MetaAPIError as err:
        return meta_error_response(err)
    return jsonify(data)


# ============== INSTAGRAM (ORGÂNICO) ==============

@app.get("/api/instagram/metrics")
def instagram_metrics():
    """
    Cards orgânicos (conta) – sem 'accounts_engaged' (removido a pedido).
    """
    ig = request.args.get("igUserId", IG_ID)
    if not ig:
        return jsonify({"error": "META_IG_USER_ID is not configured"}), 500
    since, until = unix_range(request.args)
    try:
        cur = ig_window(ig, since, until)
        prev = ig_window(ig, since - (until - since), since)
    except MetaAPIError as err:
        return meta_error_response(err)

    def pct(current, previous):
        return round(((current - previous) / previous) * 100, 2) if previous and previous > 0 and current is not None else None

    # Mantemos as métricas pedidas (sem accounts_engaged)
    metrics = [
        {"key": "reach", "label": "ALCANCE", "value": cur["reach"], "deltaPct": pct(cur["reach"], prev["reach"])},
        {"key": "impressions", "label": "IMPRESSOES", "value": cur["impressions"], "deltaPct": pct(cur["impressions"], prev["impressions"])},
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
            "value": round((cur["interactions"] / cur["reach"]) * 100, 2) if cur["reach"] else None,
            "deltaPct": None,
        },
    ]
    return jsonify({"since": since, "until": until, "metrics": metrics})


@app.get("/api/instagram/organic")
def instagram_organic():
    """
    Resumo orgânico avançado: TOPs, médias por formato, stories (retenção).
    Usa since/until.
    """
    ig = request.args.get("igUserId", IG_ID)
    if not ig:
        return jsonify({"error": "META_IG_USER_ID is not configured"}), 500
    since, until = unix_range(request.args)
    try:
        data = ig_organic_summary(ig, since, until)
    except MetaAPIError as err:
        return meta_error_response(err)
    data.update({"since": since, "until": until})
    return jsonify(data)


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
        data = ig_recent_posts(ig, limit)
    except MetaAPIError as err:
        return meta_error_response(err)
    return jsonify(data)


# ============== ADS / MARKETING API ==============

@app.get("/api/ads/highlights")
def ads_high():
    act = request.args.get("actId", ACT_ID)
    if not act:
        return jsonify({"error": "META_AD_ACCOUNT_ID is not configured"}), 500

    since = request.args.get("since")
    until = request.args.get("until")
    if not since or not until:
        until_date = datetime.now(timezone.utc).date()
        since_date = until_date - timedelta(days=7)
        since, until = since_date.isoformat(), until_date.isoformat()

    try:
        data = ads_highlights(act, since, until)
    except MetaAPIError as err:
        return meta_error_response(err)

    response = {"since": since, "until": until}
    response.update(data)
    return jsonify(response)


if __name__ == "__main__":
    app.run(port=3001, debug=True)
