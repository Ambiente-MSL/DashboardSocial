# backend/meta.py
import os
import time
import hmac
import hashlib
import requests
from typing import Optional
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
    # agregados por post
    total_reac = total_com = total_sha = total_clicks = 0
    url = f"/{page_id}/posts"
    params = {
        "since": since,
        "until": until,
        "limit": 100,
        "fields": "created_time,permalink_url," "insights.metric(post_impressions,post_engaged_users,post_clicks)," "reactions.summary(true).limit(0),comments.summary(true).limit(0),shares",
    }
    page = gget(url, params)
    while True:
        for p_item in page.get("data", []):
            total_reac += ((p_item.get("reactions") or {}).get("summary") or {}).get("total_count", 0)
            total_com += ((p_item.get("comments") or {}).get("summary") or {}).get("total_count", 0)
            total_sha += (p_item.get("shares") or {}).get("count", 0)
            ins_values = (p_item.get("insights") or {}).get("data", [])
            clicks = next((i for i in ins_values if i.get("name") == "post_clicks"), {}).get("values", [{"value": 0}])[0][
                "value"
            ]
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

# ---- Instagram (organico) ----

def ig_window(ig_user_id: str, since: int, until: int):
    metrics_query = "reach,profile_views,website_clicks,accounts_engaged,total_interactions"
    ins = gget(
        f"/{ig_user_id}/insights",
        {
            "metric": metrics_query,
            "metric_type": "total_value",
            "period": "day",
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
            sum_likes += media.get("like_count", 0)
            sum_comments += media.get("comments_count", 0)
            try:
                mi = gget(
                    f"/{media['id']}/insights",
                    {
                        "metric": "impressions,reach,plays,shares,saved,likes,comments",
                    },
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
    }
def ig_recent_posts(page_id: str, limit: int = 6):
    try:
        limit_int = int(limit or 6)
    except (TypeError, ValueError):
        limit_int = 6
    limit_sanitized = max(1, min(limit_int, 25))
    posts_fields = (
        'id,created_time,message,permalink_url,full_picture,'
        'attachments{media_type,type,media,url,subattachments},'
        'likes.summary(true).limit(0),comments.summary(true).limit(0)'
    )
    fields = (
        'instagram_accounts{followers_count,id,username,profile_picture_url,has_profile_pic},'
        f"posts.limit({limit_sanitized}){{{posts_fields}}}"
    )
    res = gget(f"/{page_id}", {"fields": "".join(fields)})

    account_data = (res.get("instagram_accounts") or {}).get("data", [])
    account = account_data[0] if account_data else None

    def extract_preview(attachments, full_picture):
        if full_picture:
            return full_picture
        for att in attachments:
            media = att.get("media") or {}
            image = (media.get("image") or {}).get("src") or media.get("source")
            if image:
                return image
            subatts = (att.get("subattachments") or {}).get("data", [])
            for sub in subatts:
                media = sub.get("media") or {}
                image = (media.get("image") or {}).get("src") or media.get("source")
                if image:
                    return image
            url = att.get("url")
            if url:
                return url
        return None

    posts = []
    for item in (res.get("posts") or {}).get("data", []):
        attachments = (item.get("attachments") or {}).get("data", [])
        preview = extract_preview(attachments, item.get("full_picture"))
        likes_summary = ((item.get("likes") or {}).get("summary") or {}).get("total_count")
        comments_summary = ((item.get("comments") or {}).get("summary") or {}).get("total_count")
        posts.append({
            "id": item.get("id"),
            "caption": item.get("message"),
            "mediaType": attachments[0].get("media_type") if attachments else None,
            "permalink": item.get("permalink_url"),
            "timestamp": item.get("created_time"),
            "previewUrl": preview,
            "likeCount": likes_summary,
            "commentsCount": comments_summary,
        })
    return {
        "account": account,
        "posts": posts,
    }
# ---- Ads (Marketing API) ----

def ads_highlights(act_id: str, since_str: str, until_str: str):
    fields = "campaign_name,adset_name,ad_name,ad_id,impressions,reach,clicks,spend,ctr,cpc,cpm,actions"
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
    # CPMS por views especificas (se existirem)
    v3 = v10 = v60 = None
    spend_total = 0
    views3 = views10 = views60 = 0
    for row in res.get("data", []):
        spend_total += float(row.get("spend", 0) or 0)
        acts = {a["action_type"]: float(a.get("value", 0) or 0) for a in (row.get("actions") or []) if "action_type" in a}
        # heuristicas comuns (varia por conta): 3s~video_view, 10s=video_10s_views, 60s~thruplay
        views3 += acts.get("video_view", 0)
        views10 += acts.get("video_10s_views", 0)
        views60 += acts.get("thruplay", 0)
        # "melhor anuncio" por CTR (ajuste se quiser por conversoes)
        if best_ad is None or float(row.get("ctr", 0) or 0) > float(best_ad.get("ctr", 0) or 0):
            best_ad = {
                "ad_id": row.get("ad_id"),
                "ad_name": row.get("ad_name"),
                "ctr": row.get("ctr"),
                "impressions": row.get("impressions"),
                "spend": row.get("spend"),
            }

    def cpm(views):
        return round(spend_total / (views / 1000.0), 2) if views and views > 0 else None

    v3, v10, v60 = cpm(views3), cpm(views10), cpm(views60)
    return {"best_ad": best_ad, "video_cpm_3s": v3, "video_cpm_10s": v10, "video_cpm_1min": v60}





