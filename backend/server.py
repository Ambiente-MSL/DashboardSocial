# backend/server.py
import os
import time
import logging
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify
from flask_cors import CORS

from meta import (
    fb_page_window,
    fb_recent_posts,
    ig_window,
    ig_recent_posts,
    ig_organic_summary,
    ig_audience,
    ads_highlights,
    MetaAPIError,
    gget,
)

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

    page_overview = cur.get("page_overview") or {}

    return jsonify({
        "since": since,
        "until": until,
        "metrics": metrics,
        "breakdowns": breakdowns,
        "page_overview": page_overview,
    })


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
    Calcula taxa de engajamento baseada nos últimos posts do período.
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

    # Calcular taxa de engajamento dos últimos posts com breakdown detalhado
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
        # Buscar últimos 10 posts do período para calcular taxa de engajamento
        posts_data = ig_recent_posts(ig, limit=10)
        posts = posts_data.get("posts", [])

        # Filtrar posts do período
        posts_in_period = []
        for post in posts:
            if post.get("timestamp"):
                try:
                    # Tentar converter timestamp ISO para Unix
                    timestamp_str = post["timestamp"].replace("Z", "+00:00")
                    post_time = datetime.fromisoformat(timestamp_str)
                    post_unix = int(post_time.timestamp())

                    if since <= post_unix <= until:
                        posts_in_period.append(post)
                except (ValueError, AttributeError) as e:
                    logger.warning(f"Failed to parse timestamp for post {post.get('id')}: {e}")
                    # Se falhar, incluir post mesmo assim (melhor ter dados que não ter)
                    posts_in_period.append(post)

        # Se não houver posts no período, usar todos os últimos posts
        if not posts_in_period:
            posts_in_period = posts

        if posts_in_period:
            # Calcular engajamento médio dos posts
            total_likes = 0
            total_comments = 0
            total_shares = 0
            total_saves = 0
            total_reach = 0

            for post in posts_in_period:
                likes = post.get("likeCount") or 0
                comments = post.get("commentsCount") or 0
                total_likes += likes
                total_comments += comments

                # Para cada post, buscar shares e saves dos insights
                try:
                    post_insights = gget(
                        f"/{post['id']}/insights",
                        {"metric": "shares,saved,reach"}
                    )
                    shares = 0
                    saves = 0
                    reach = 0
                    for insight in post_insights.get("data", []):
                        name = insight.get("name")
                        value = (insight.get("values") or [{}])[0].get("value", 0) or 0
                        if name == "shares":
                            shares = value
                        elif name in ("saved", "saves"):
                            saves = value
                        elif name == "reach":
                            reach = value

                    total_shares += shares
                    total_saves += saves
                    total_reach += reach
                except:
                    # Se falhar, continuar sem shares/saves/reach deste post
                    pass

            # Preencher breakdown
            engagement_breakdown["likes"] = total_likes
            engagement_breakdown["comments"] = total_comments
            engagement_breakdown["shares"] = total_shares
            engagement_breakdown["saves"] = total_saves
            engagement_breakdown["total"] = total_likes + total_comments + total_shares + total_saves
            engagement_breakdown["reach"] = total_reach

            # Calcular taxa de engajamento média
            if total_reach > 0:
                engagement_rate_from_posts = round((engagement_breakdown["total"] / total_reach) * 100, 2)
            elif posts_in_period and cur["reach"] > 0:
                # Fallback: usar alcance da conta se não conseguir dos posts
                engagement_breakdown["reach"] = cur["reach"]
                engagement_rate_from_posts = round((engagement_breakdown["total"] / cur["reach"]) * 100, 2)
    except Exception as e:
        logger.error(f"Erro ao calcular taxa de engajamento dos posts: {e}", exc_info=True)
        engagement_rate_from_posts = None

    # Se não conseguiu calcular dos posts, usar o método antigo como fallback
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
    return jsonify({
        "since": since,
        "until": until,
        "metrics": metrics,
        "profile_visitors_breakdown": cur.get("profile_visitors_breakdown"),
        "follower_counts": follower_counts,
    })


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


@app.get("/api/instagram/audience")
def instagram_audience():
    ig = request.args.get("igUserId", IG_ID)
    if not ig:
        return jsonify({"error": "META_IG_USER_ID is not configured"}), 500
    try:
        data = ig_audience(ig)
    except MetaAPIError as err:
        return meta_error_response(err)
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
