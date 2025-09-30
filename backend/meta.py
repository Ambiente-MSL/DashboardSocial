# backend/meta.py
import os
import time
import hmac
import hashlib
import requests
from typing import Optional, List, Dict, Any
from urllib.parse import urlencode

from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"), override=False)

VERSION = os.getenv("META_GRAPH_VERSION", "v23.0")
TOKEN = os.getenv("META_SYSTEM_USER_TOKEN")
SECRET = os.getenv("META_APP_SECRET")
BASE = f"https://graph.facebook.com/{VERSION}"


class MetaAPIError(Exception):
    def __init__(self, status: int, message: str, code: Optional[int] = None, error_type: Optional[str] = None,
                 raw: Optional[dict] = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.error_type = error_type
        self.raw = raw or {}


def appsecret_proof(token: Optional[str]) -> Optional[str]:
    if not token or not SECRET:
        return None
    return hmac.new(SECRET.encode(), token.encode(), hashlib.sha256).hexdigest()


def gget(path: str, params: Optional[dict] = None):
    if not TOKEN:
        raise RuntimeError("META_SYSTEM_USER_TOKEN is not configured")
    p = {"access_token": TOKEN}
    proof = appsecret_proof(TOKEN)
    if proof:
        p["appsecret_proof"] = proof
    if params:
        p.update(params)
    url = f"{BASE}{path}?{urlencode(p, doseq=True)}"
    for i in range(3):  # retry simples
        r = requests.get(url, timeout=15)
        if r.status_code in (429, 500, 502, 503) and i < 2:
            time.sleep(1.5 * (i + 1))
            continue
        if r.ok:
            return r.json()
        try:
            payload = r.json()
        except ValueError:
            payload = {}
        err = payload.get("error") if isinstance(payload, dict) else None
        message = (err or {}).get("message") if isinstance(err, dict) else None
        raise MetaAPIError(
            status=r.status_code,
            message=message or r.text or "Meta Graph API request failed",
            code=(err or {}).get("code") if isinstance(err, dict) else None,
            error_type=(err or {}).get("type") if isinstance(err, dict) else None,
            raw=payload if isinstance(payload, dict) else {"raw": r.text},
        )
    return {"data": []}


def sum_values(arr, key="value"):
    return sum((x.get(key, 0) or 0) for x in arr if isinstance(x, dict))


# ---- Facebook (organico) ----

def fb_page_window(page_id: str, since: int, until: int):
    metrics = "page_impressions,page_impressions_unique,page_engaged_users,page_fan_adds_unique"
    ins = gget(
        f"/{page_id}/insights",
        {"metric": metrics, "period": "day", "since": since, "until": until},
    )

    def by(name):
        m = next((m for m in ins.get("data", []) if m.get("name") == name), {})
        return m.get("values", [])

    impressions = sum_values(by("page_impressions"))
    reach = sum_values(by("page_impressions_unique"))
    engaged = sum_values(by("page_engaged_users"))
    likes_add = sum_values(by("page_fan_adds_unique"))

    total_reac = total_com = total_sha = total_clicks = 0
    url = f"/{page_id}/posts"
    params = {
        "since": since,
        "until": until,
        "limit": 100,
        "fields": (
            "created_time,permalink_url,"
            "insights.metric(post_impressions,post_engaged_users,post_clicks),"
            "reactions.summary(true).limit(0),comments.summary(true).limit(0),shares"
        ),
    }
    page = gget(url, params)
    while True:
        for p_item in page.get("data", []):
            total_reac += ((p_item.get("reactions") or {}).get("summary") or {}).get("total_count", 0)
            total_com += ((p_item.get("comments") or {}).get("summary") or {}).get("total_count", 0)
            total_sha += (p_item.get("shares") or {}).get("count", 0)
            ins_values = (p_item.get("insights") or {}).get("data", [])
            clicks = next((i for i in ins_values if i.get("name") == "post_clicks"), {}).get("values", [{"value": 0}])[0]["value"]
            total_clicks += clicks or 0
        nextp = (page.get("paging") or {}).get("next")
        if not nextp:
            break
        page = requests.get(nextp, timeout=15).json()

    interactions = total_reac + total_com + total_sha
    return {
        "impressions": impressions,
        "reach": reach,
        "engaged": engaged,
        "likes_add": likes_add,
        "interactions": interactions,
        "post_clicks": total_clicks,
    }


# ---- Instagram (orgânico) ----

def ig_window(ig_user_id: str, since: int, until: int):
    """
    Métricas de conta + agregados básicos de mídia (para likes/comments/shares/saves).
    """
    metrics_query = "reach,profile_views,website_clicks,accounts_engaged,total_interactions"
    ins = gget(
        f"/{ig_user_id}/insights",
        {
            "metric": metrics_query,
            "period": "day",
            "metric_type": "total_value",
            "since": since,
            "until": until,
        },
    )

    def by(name):
        m = next((m for m in ins.get("data", []) if m.get("name") == name), {})
        return m.get("values", [])

    reach = sum_values(by("reach"))
    profile_views = sum_values(by("profile_views"))
    website = sum_values(by("website_clicks"))
    accounts_engaged = sum_values(by("accounts_engaged"))
    total_interactions_metric = sum_values(by("total_interactions"))

    # Agregar métricas por mídia (para likes/comments/shares/saves/impressions)
    sum_likes = sum_comments = sum_shares = sum_saves = 0
    sum_impressions = 0

    url = f"/{ig_user_id}/media"
    params = {
        "since": since,
        "until": until,
        "limit": 100,
        "fields": "id,media_type,timestamp,like_count,comments_count,permalink",
    }
    page = gget(url, params)
    while True:
        for media in page.get("data", []):
            sum_likes += media.get("like_count", 0) or 0
            sum_comments += media.get("comments_count", 0) or 0
            try:
                mi = gget(
                    f"/{media['id']}/insights",
                    {"metric": "impressions,reach,plays,shares,saved,likes,comments"},
                )
                for k_item in mi.get("data", []):
                    v = (k_item.get("values") or [{}])[0].get("value", 0) or 0
                    name = k_item.get("name")
                    if name == "impressions":
                        sum_impressions += v
                    elif name == "shares":
                        sum_shares += v
                    elif name in ("saved", "saves"):
                        sum_saves += v
            except Exception:
                pass
        nextp = (page.get("paging") or {}).get("next")
        if not nextp:
            break
        page = requests.get(nextp, timeout=15).json()

    interactions = total_interactions_metric or (sum_likes + sum_comments + sum_shares + sum_saves)
    return {
        "impressions": sum_impressions,
        "reach": reach,
        "interactions": interactions,
        "accounts_engaged": accounts_engaged,
        "profile_views": profile_views,
        "website_clicks": website,
        "likes": sum_likes,
        "comments": sum_comments,
        "shares": sum_shares,
        "saves": sum_saves,
    }


def _safe(val, cast=float):
    try:
        return cast(val or 0)
    except Exception:
        return 0


def ig_organic_summary(ig_user_id: str, since: int, until: int) -> Dict[str, Any]:
    """
    - varre mídias no intervalo para calcular:
      * tops: maior_engajamento, maior_alcance, maior_salvamentos
      * médias por formato (IMAGE, VIDEO, CAROUSEL_ALBUM)
    - stories: maior retenção (1 - exits/impressions), replay_rate (taps_back/impressions)
    """
    # ===== MÍDIAS DO FEED =====
    media_fields = "id,media_type,timestamp,like_count,comments_count,permalink,caption,media_url,thumbnail_url"
    media_res = gget(
        f"/{ig_user_id}/media",
        {"since": since, "until": until, "limit": 100, "fields": media_fields},
    )

    posts: List[Dict[str, Any]] = []
    format_aggr: Dict[str, Dict[str, float]] = {}

    def aggr_fmt(fmt, reach, interactions):
        rec = format_aggr.setdefault(fmt, {"reach": 0.0, "interactions": 0.0, "count": 0.0})
        rec["reach"] += _safe(reach)
        rec["interactions"] += _safe(interactions)
        rec["count"] += 1.0

    def score_interactions(item):
        return _safe(item.get("likes")) + _safe(item.get("comments")) + _safe(item.get("shares")) + _safe(item.get("saves"))

    paging = media_res
    while True:
        for it in paging.get("data", []):
            mid = it.get("id")
            # insights por mídia
            insights = {}
            try:
                ins = gget(f"/{mid}/insights", {"metric": "impressions,reach,shares,saved,likes,comments,plays"})
                for row in ins.get("data", []):
                    insights[row.get("name")] = (row.get("values") or [{}])[0].get("value")
            except Exception:
                pass

            likes = it.get("like_count") or insights.get("likes") or 0
            comments = it.get("comments_count") or insights.get("comments") or 0
            shares = insights.get("shares") or 0
            saves = insights.get("saved") or insights.get("saves") or 0
            reach = insights.get("reach") or 0
            impressions = insights.get("impressions") or 0

            post_row = {
                "id": mid,
                "mediaType": it.get("media_type"),
                "timestamp": it.get("timestamp"),
                "permalink": it.get("permalink"),
                "caption": it.get("caption"),
                "previewUrl": it.get("media_url") or it.get("thumbnail_url"),
                "likes": _safe(likes, int),
                "comments": _safe(comments, int),
                "shares": _safe(shares, int),
                "saves": _safe(saves, int),
                "reach": _safe(reach, int),
                "impressions": _safe(impressions, int),
                "total_interactions": _safe(likes, int) + _safe(comments, int) + _safe(shares, int) + _safe(saves, int),
            }
            posts.append(post_row)
            aggr_fmt(post_row["mediaType"] or "OTHER", post_row["reach"], post_row["total_interactions"])

        nextp = (paging.get("paging") or {}).get("next")
        if not nextp:
            break
        paging = requests.get(nextp, timeout=15).json()

    # TOPS
    def top_by(key):
        cand = None
        for p in posts:
            if cand is None or _safe(p.get(key)) > _safe(cand.get(key)):
                cand = p
        return cand

    tops = {
        "post_maior_engajamento": top_by("total_interactions"),
        "post_maior_alcance": top_by("reach"),
        "post_maior_salvamentos": top_by("saves"),
    }

    # MÉDIAS POR FORMATO
    by_format = []
    for fmt, rec in format_aggr.items():
        avg = None
        if rec["count"] > 0 and rec["reach"] > 0:
            avg = (rec["interactions"] / rec["reach"]) * 100.0
        by_format.append({
            "format": fmt,
            "avg_engagement_rate": round(avg, 2) if avg is not None else None,
            "avg_interactions": round(rec["interactions"] / rec["count"], 2) if rec["count"] else None,
            "avg_reach": round(rec["reach"] / rec["count"], 2) if rec["count"] else None,
            "count": int(rec["count"]),
        })

    # ===== STORIES =====
    # Algumas contas podem não retornar; tratamos de forma resiliente
    top_story = None
    try:
        stories_res = gget(f"/{ig_user_id}/stories", {"since": since, "until": until, "limit": 100, "fields": "id,permalink,timestamp"})
        best = None
        page_s = stories_res
        while True:
            for st in page_s.get("data", []):
                try:
                    sins = gget(f"/{st['id']}/insights", {"metric": "impressions,exits,taps_forward,taps_back,replies"})
                except Exception:
                    continue
                vals = {row.get("name"): (row.get("values") or [{}])[0].get("value") for row in sins.get("data", [])}
                imp = _safe(vals.get("impressions"), int)
                exits = _safe(vals.get("exits"), int)
                taps_back = _safe(vals.get("taps_back"), int)
                if imp <= 0:
                    continue
                retention = 1.0 - (exits / imp)
                replay_rate = taps_back / imp
                row = {
                    "id": st.get("id"),
                    "permalink": st.get("permalink"),
                    "timestamp": st.get("timestamp"),
                    "impressions": imp,
                    "exits": exits,
                    "retention": round(retention * 100.0, 2),
                    "replay_rate": round(replay_rate * 100.0, 2),
                }
                if best is None or row["retention"] > best["retention"]:
                    best = row
            nextp = (page_s.get("paging") or {}).get("next")
            if not nextp:
                break
            page_s = requests.get(nextp, timeout=15).json()
        top_story = best
    except MetaAPIError:
        top_story = None

    return {
        "tops": tops,
        "formats": by_format,
        "top_story": top_story,
    }


def ig_recent_posts(ig_user_id: str, limit: int = 6):
    try:
        limit_int = int(limit or 6)
    except (TypeError, ValueError):
        limit_int = 6
    limit_sanitized = max(1, min(limit_int, 25))

    media_fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count"
    media_res = gget(
        f"/{ig_user_id}/media",
        {
            "limit": limit_sanitized,
            "fields": media_fields,
        },
    )

    posts = []
    for item in media_res.get("data", []):
        preview = item.get("media_url") or item.get("thumbnail_url")
        posts.append({
            "id": item.get("id"),
            "caption": item.get("caption"),
            "mediaType": item.get("media_type"),
            "mediaUrl": item.get("media_url"),
            "thumbnailUrl": item.get("thumbnail_url"),
            "permalink": item.get("permalink"),
            "timestamp": item.get("timestamp"),
            "likeCount": item.get("like_count"),
            "commentsCount": item.get("comments_count"),
            "previewUrl": preview,
        })

    account_fields = "id,username,profile_picture_url,followers_count"
    try:
        account = gget(f"/{ig_user_id}", {"fields": account_fields})
    except MetaAPIError:
        account = None

    return {
        "account": account,
        "posts": posts,
    }


def fb_recent_posts(page_id: str, limit: int = 6):
    try:
        limit_int = int(limit or 6)
    except (TypeError, ValueError):
        limit_int = 6
    limit_sanitized = max(1, min(limit_int, 25))
    fields = (
        "id,created_time,message,permalink_url,full_picture,story,"
        "attachments{media_type,type,media,url,description,subattachments},"
        "reactions.summary(true).limit(0),comments.summary(true).limit(0),shares"
    )
    res = gget(
        f"/{page_id}/posts",
        {
            "limit": limit_sanitized,
            "fields": fields,
        },
    )
    posts = []
    for item in res.get("data", []):
        attachments = (item.get("attachments") or {}).get("data", [])

        def extract_preview(att_list):
            for att in att_list:
                media = att.get("media") or {}
                image = (media.get("image") or {}).get("src") or media.get("source")
                if image:
                    return image
                subatts = (att.get("subattachments") or {}).get("data", [])
                preview = extract_preview(subatts)
                if preview:
                    return preview
                url = att.get("url")
                if url:
                    return url
            return None

        preview = item.get("full_picture") or extract_preview(attachments)
        reactions = ((item.get("reactions") or {}).get("summary") or {}).get("total_count")
        comments = ((item.get("comments") or {}).get("summary") or {}).get("total_count")
        shares = (item.get("shares") or {}).get("count")
        posts.append({
            "id": item.get("id"),
            "message": item.get("message") or item.get("story"),
            "permalink": item.get("permalink_url"),
            "timestamp": item.get("created_time"),
            "previewUrl": preview,
            "reactions": reactions,
            "comments": comments,
            "shares": shares,
        })
    paging = res.get("paging") or {}
    return {
        "posts": posts,
        "paging": {
            "next": bool(paging.get("next")),
            "previous": bool(paging.get("previous")),
        },
    }


# ---- Ads (Marketing API) ----

def ads_highlights(act_id: str, since_str: str, until_str: str):
    fields = "campaign_name,adset_name,ad_name,ad_id,impressions,reach,clicks,spend,ctr,cpc,cpm,frequency,actions"
    res = gget(
        f"/{act_id}/insights",
        {
            "fields": fields,
            "time_range[since]": since_str,
            "time_range[until]": until_str,
            "level": "ad",
            "limit": 200,
        },
    )
    best_ad = None
    totals = {"spend": 0.0, "impressions": 0, "reach": 0, "clicks": 0}
    actions_totals = {}
    # buckets de video
    v3 = v10 = thru = 0.0
    vavg = 0.0

    for row in res.get("data", []):
        spend = float(row.get("spend", 0) or 0)
        impressions = int(row.get("impressions", 0) or 0)
        reach = int(row.get("reach", 0) or 0)
        clicks = int(row.get("clicks", 0) or 0)
        ctr = float(row.get("ctr", 0) or 0)
        cpc = float(row.get("cpc", 0) or 0)
        cpm = float(row.get("cpm", 0) or 0)
        frequency = float(row.get("frequency", 0) or 0)

        totals["spend"] += spend
        totals["impressions"] += impressions
        totals["reach"] += reach
        totals["clicks"] += clicks

        for action in row.get("actions") or []:
            action_type = action.get("action_type")
            if not action_type:
                continue
            value = float(action.get("value", 0) or 0)
            actions_totals[action_type] = actions_totals.get(action_type, 0.0) + value
            # capturar ações típicas de vídeo
            if action_type == "video_3_sec_watched_actions":
                v3 += value
            elif action_type == "video_10_sec_watched_actions":
                v10 += value
            elif action_type in ("thruplay", "video_15_sec_watched_actions"):
                thru += value
            elif action_type == "video_avg_time_watched_actions":
                vavg += value

        if best_ad is None or ctr > float(best_ad.get("ctr", 0) or 0):
            best_ad = {
                "ad_id": row.get("ad_id"),
                "ad_name": row.get("ad_name"),
                "campaign_name": row.get("campaign_name"),
                "adset_name": row.get("adset_name"),
                "ctr": ctr,
                "cpc": cpc,
                "cpm": cpm,
                "frequency": frequency,
                "impressions": impressions,
                "reach": reach,
                "spend": spend,
                "clicks": clicks,
            }

    averages = {
        "cpc": (totals["spend"] / totals["clicks"]) if totals["clicks"] else None,
        "cpm": (totals["spend"] / totals["impressions"] * 1000.0) if totals["impressions"] else None,
        "ctr": (totals["clicks"] / totals["impressions"] * 100.0) if totals["impressions"] else None,
        "frequency": (totals["impressions"] / totals["reach"]) if totals["reach"] else None,
    }

    actions_summary = [
        {"type": key, "value": value}
        for key, value in sorted(actions_totals.items(), key=lambda item: item[1], reverse=True)
    ]

    # resumo de vídeo
    video_summary = {
        "video_views_3s": int(v3),
        "video_views_10s": int(v10),
        "thruplays": int(thru),
        "video_avg_time_watched": float(vavg) if vavg > 0 else None,
        "video_completion_rate": round((thru / v3) * 100.0, 2) if v3 > 0 else None,
        "drop_off_points": [
            {"bucket": "0-3s", "views": int(v3)},
            {"bucket": "3-10s", "views": int(v10)},
            {"bucket": "10s–thruplay", "views": int(thru)},
        ],
    }

    # Demografia (igual ao seu)
    try:
        demo_res = gget(
            f"/{act_id}/insights",
            {
                "fields": "reach,impressions,spend",
                "time_range[since]": since_str,
                "time_range[until]": until_str,
                "level": "account",
                "breakdowns": "age,gender",
                "limit": 500,
            },
        )
    except MetaAPIError:
        demo_res = {"data": []}

    gender_totals = {}
    age_totals = {}
    combo_totals = {}

    def label_gender(value: str) -> str:
        lookup = {"male": "Masculino", "female": "Feminino"}
        if value is None:
            return "Indefinido"
        return lookup.get(value.lower(), "Indefinido")

    for row in demo_res.get("data", []):
        gender = label_gender(row.get("gender"))
        age = row.get("age") or "Desconhecido"
        reach = int(row.get("reach", 0) or 0)
        impressions = int(row.get("impressions", 0) or 0)
        spend = float(row.get("spend", 0) or 0)

        gender_entry = gender_totals.setdefault(gender, {"reach": 0, "impressions": 0, "spend": 0.0})
        gender_entry["reach"] += reach
        gender_entry["impressions"] += impressions
        gender_entry["spend"] += spend

        age_entry = age_totals.setdefault(age, {"reach": 0, "impressions": 0, "spend": 0.0})
        age_entry["reach"] += reach
        age_entry["impressions"] += impressions
        age_entry["spend"] += spend

        combo_key = (age, gender)
        combo_entry = combo_totals.setdefault(
            combo_key,
            {"age": age, "gender": gender, "reach": 0, "impressions": 0, "spend": 0.0},
        )
        combo_entry["reach"] += reach
        combo_entry["impressions"] += impressions
        combo_entry["spend"] += spend

    demographics = {
        "byGender": [
            {"segment": key, **values}
            for key, values in sorted(gender_totals.items(), key=lambda item: item[1]["reach"], reverse=True)
        ],
        "byAge": [
            {"segment": key, **values}
            for key, values in sorted(age_totals.items(), key=lambda item: item[1]["reach"], reverse=True)
        ],
        "topSegments": sorted(combo_totals.values(), key=lambda item: item["reach"], reverse=True)[:5],
    }

    return {
        "best_ad": best_ad,
        "totals": totals,
        "averages": averages,
        "actions": actions_summary,
        "demographics": demographics,
        "video_summary": video_summary,  # NOVO
    }
