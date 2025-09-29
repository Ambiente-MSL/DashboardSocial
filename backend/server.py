# backend/server.py
import os
import time
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify
from flask_cors import CORS

from meta import fb_page_window, fb_recent_posts, ig_window, ig_recent_posts, ads_highlights, MetaAPIError

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
    metrics = [
        {"key": "reach", "label": "Alcance organico", "value": cur["reach"], "deltaPct": pct(cur["reach"], prev["reach"])},
        {"key": "post_engagement", "label": "Engajamento post", "value": cur["interactions"], "deltaPct": pct(cur["interactions"], prev["interactions"])},
        {"key": "impressions", "label": "Impressoes", "value": cur["impressions"], "deltaPct": pct(cur["impressions"], prev["impressions"])},
        {"key": "profile_link_clicks", "label": "Cliques de perfil (proxy)", "value": cur["post_clicks"], "deltaPct": pct(cur["post_clicks"], prev["post_clicks"])},
    ]
    return jsonify({"since": since, "until": until, "metrics": metrics})

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



@app.get("/api/instagram/metrics")
def instagram_metrics():
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
    metrics = [
        {"key": "reach", "label": "ALCANCE", "value": cur["reach"], "deltaPct": pct(cur["reach"], prev["reach"])},
        {"key": "impressions", "label": "IMPRESSOES", "value": cur["impressions"], "deltaPct": pct(cur["impressions"], prev["impressions"])},
        {"key": "accounts_engaged", "label": "CONTAS ENGAJADAS", "value": cur["accounts_engaged"], "deltaPct": pct(cur["accounts_engaged"], prev["accounts_engaged"])},
        {"key": "profile_views", "label": "VIEWS DE PERFIL", "value": cur["profile_views"], "deltaPct": pct(cur["profile_views"], prev["profile_views"])},
        {"key": "website_clicks", "label": "CLICS SITE", "value": cur["website_clicks"], "deltaPct": pct(cur["website_clicks"], prev["website_clicks"])},
        {"key": "interactions", "label": "INTERACOES TOTAIS", "value": cur["interactions"], "deltaPct": pct(cur["interactions"], prev["interactions"])},
        {
            "key": "engagement_rate",
            "label": "TAXA ENGAJAMENTO",
            "value": round((cur["interactions"] / cur["reach"]) * 100, 2) if cur["reach"] else None,
            "deltaPct": None,
        },
    ]
    return jsonify({"since": since, "until": until, "metrics": metrics})



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






