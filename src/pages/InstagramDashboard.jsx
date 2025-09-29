import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ExternalLink, Heart, MessageCircle, Play } from "lucide-react";

import Topbar from "../components/Topbar";
import Section from "../components/Section";
import KpiGrid from "../components/KpiGrid";
import MetricCard from "../components/MetricCard";
import useQueryState from "../hooks/useQueryState";
import { accounts } from "../data/accounts";

const API_BASE_URL = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
const DEFAULT_ACCOUNT_ID = accounts[0]?.id || "";

const INSIGHT_CARDS = [
  {
    key: "reach",
    title: "Alcance",
    hint: "Perfis unicos alcancados no intervalo selecionado.",
  },
  {
    key: "impressions",
    title: "Impressoes",
    hint: "Total de visualizacoes do conteudo no periodo.",
  },
  {
    key: "accounts_engaged",
    title: "Contas engajadas",
    hint: "Usuarios que interagiram com o perfil no periodo.",
  },
  {
    key: "profile_views",
    title: "Views de perfil",
    hint: "Quantidade de visitas ao perfil no periodo.",
  },
  {
    key: "website_clicks",
    title: "Cliques no site",
    hint: "Cliques no link do perfil durante o periodo.",
  },
  {
    key: "interactions",
    title: "Interacoes totais",
    hint: "Soma de curtidas, comentarios, compartilhamentos e salvamentos.",
  },
  {
    key: "engagement_rate",
    title: "Taxa de engajamento",
    hint: "Interacoes sobre alcance (em porcentagem).",
    percentage: true,
  },
];

const mediaTypeLabel = {
  IMAGE: "Imagem",
  VIDEO: "Video",
  CAROUSEL_ALBUM: "Carrossel",
  REELS: "Reels",
};

const mapByKey = (arr) => {
  const map = {};
  (arr || []).forEach((item) => {
    if (item && item.key) map[item.key] = item;
  });
  return map;
};

const safeParseJson = (text) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("Falha ao converter resposta JSON", err);
    return null;
  }
};

const describeApiError = (payload, fallback) => {
  if (!payload) return fallback;
  if (payload.error) {
    const graph = payload.graph;
    if (graph?.code) {
      return `${payload.error} (Graph code ${graph.code})`;
    }
    return payload.error;
  }
  if (payload.message) return payload.message;
  return fallback;
};

const formatDate = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
};

const truncate = (text, length = 140) => {
  if (!text) return "";
  if (text.length <= length) return text;
  return `${text.slice(0, length - 3)}...`;
};

const formatMetricValue = (metric, { percentage = false, loading } = {}) => {
  if (loading) return "...";
  if (!metric) return "-";
  const value = metric.value;
  if (value == null) return "-";
  if (percentage && typeof value === "number") {
    return `${Number(value).toFixed(2)}%`;
  }
  if (typeof value === "number") {
    return value.toLocaleString("pt-BR");
  }
  return String(value);
};

const metricDelta = (metric, { loading } = {}) => {
  if (loading) return null;
  return metric?.deltaPct ?? null;
};

const renderCarouselCard = (post) => {
  const previewUrl = post.previewUrl || post.mediaUrl || post.thumbnailUrl;
  const typeLabel = mediaTypeLabel[post.mediaType] || post.mediaType || "Post";
  const publishedAt = formatDate(post.timestamp);
  const likes = Number.isFinite(post.likeCount) ? post.likeCount : null;
  const comments = Number.isFinite(post.commentsCount) ? post.commentsCount : null;

  return (
    <article key={post.id} className="media-card media-card--carousel">
      <a
        href={post.permalink || "#"}
        target="_blank"
        rel="noreferrer"
        className="media-card__preview"
        aria-label="Abrir publicacao no Instagram"
      >
        {previewUrl ? (
          <img src={previewUrl} alt={truncate(post.caption || "Postagem do Instagram", 80)} loading="lazy" />
        ) : (
          <div className="media-card__placeholder">Preview indisponivel</div>
        )}
        {post.mediaType === "VIDEO" && (
          <span className="media-card__badge" title="Conteudo em video">
            <Play size={16} />
          </span>
        )}
        {post.mediaType === "CAROUSEL_ALBUM" && (
          <span className="media-card__badge media-card__badge--stack" title="Carrossel">
            +
          </span>
        )}
      </a>
      <div className="media-card__body">
        <header className="media-card__meta">
          <span>{publishedAt || "Data indisponivel"}</span>
          <span>{typeLabel}</span>
        </header>
        <p className="media-card__caption">{truncate(post.caption, 160) || "Legenda indisponivel."}</p>
        <footer className="media-card__footer">
          <div className="media-card__stats">
            {likes !== null && (
              <span>
                <Heart size={14} /> {likes.toLocaleString("pt-BR")}
              </span>
            )}
            {comments !== null && (
              <span>
                <MessageCircle size={14} /> {comments.toLocaleString("pt-BR")}
              </span>
            )}
          </div>
          {post.permalink && (
            <a href={post.permalink} target="_blank" rel="noreferrer" className="media-card__link">
              Ver no Instagram <ExternalLink size={14} />
            </a>
          )}
        </footer>
      </div>
    </article>
  );
};

export default function InstagramDashboard() {
  const { sidebarOpen, toggleSidebar } = useOutletContext();
  const [get] = useQueryState({ account: DEFAULT_ACCOUNT_ID });
  const accountId = get("account") || DEFAULT_ACCOUNT_ID;
  const accountConfig = useMemo(
    () => accounts.find((item) => item.id === accountId) || accounts[0],
    [accountId],
  );

  const since = get("since");
  const until = get("until");

  const [metrics, setMetrics] = useState([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState("");

  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState("");
  const [accountInfo, setAccountInfo] = useState(null);

  useEffect(() => {
    if (!accountConfig?.instagramUserId) {
      setMetrics([]);
      setMetricsError("Conta do Instagram nao configurada.");
      return;
    }

    const controller = new AbortController();

    const loadMetrics = async () => {
      setLoadingMetrics(true);
      setMetricsError("");
      try {
        const params = new URLSearchParams();
        if (since) params.set("since", since);
        if (until) params.set("until", until);
        params.set("igUserId", accountConfig.instagramUserId);

        const url = `${API_BASE_URL}/api/instagram/metrics?${params.toString()}`;
        const response = await fetch(url, { signal: controller.signal });
        const raw = await response.text();
        const json = safeParseJson(raw) || {};
        if (!response.ok) {
          throw new Error(describeApiError(json, "Falha ao carregar metricas do Instagram."));
        }
        setMetrics(json.metrics || []);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(err);
          setMetricsError(err.message || "Nao foi possivel atualizar os indicadores do Instagram.");
        }
      } finally {
        setLoadingMetrics(false);
      }
    };

    loadMetrics();
    return () => controller.abort();
  }, [accountConfig?.instagramUserId, since, until]);

  useEffect(() => {
    if (!accountConfig?.instagramUserId) {
      setPosts([]);
      setAccountInfo(null);
      setPostsError("Conta do Instagram nao configurada.");
      return;
    }

    const controller = new AbortController();
    const loadPosts = async () => {
      setLoadingPosts(true);
      setPostsError("");
      try {
        const params = new URLSearchParams({
          igUserId: accountConfig.instagramUserId,
          limit: "10",
        });
        const url = `${API_BASE_URL}/api/instagram/posts?${params.toString()}`;
        const response = await fetch(url, { signal: controller.signal });
        const raw = await response.text();
        const json = safeParseJson(raw) || {};
        if (!response.ok) {
          throw new Error(describeApiError(json, "Falha ao carregar posts do Instagram."));
        }
        setPosts(json.posts || []);
        setAccountInfo(json.account || null);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(err);
          setPostsError(err.message || "Nao foi possivel carregar os posts recentes.");
        }
        setAccountInfo(null);
      } finally {
        setLoadingPosts(false);
      }
    };

    loadPosts();
    return () => controller.abort();
  }, [accountConfig?.instagramUserId]);

  const metricsByKey = useMemo(() => mapByKey(metrics), [metrics]);

  const accountBadge = accountInfo
    ? (
      <div className="media-account">
        <div className="media-account__avatar">
          {accountInfo.profile_picture_url ? (
            <img src={accountInfo.profile_picture_url} alt={accountInfo.username || accountInfo.id} />
          ) : (
            <span>{(accountInfo.username || accountInfo.id || "IG").charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="media-account__meta">
          <span className="media-account__name">{accountInfo.username || accountInfo.id}</span>
          {Number.isFinite(Number(accountInfo.followers_count)) && (
            <span className="media-account__followers">
              {Number(accountInfo.followers_count).toLocaleString("pt-BR")} seguidores
            </span>
          )}
        </div>
      </div>
    )
    : null;

  return (
    <>
      <Topbar title="Instagram" sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />

      {metricsError && <div className="alert alert--error">{metricsError}</div>}

      <Section
        title="Insights do perfil"
        description="Principais indicadores organicos do periodo selecionado."
      >
        <KpiGrid>
          {INSIGHT_CARDS.map(({ key, title, hint, percentage }) => (
            <MetricCard
              key={key}
              title={title}
              value={formatMetricValue(metricsByKey[key], { percentage, loading: loadingMetrics })}
              delta={key === "engagement_rate" ? null : metricDelta(metricsByKey[key], { loading: loadingMetrics })}
              hint={hint}
            />
          ))}
        </KpiGrid>
      </Section>

      <Section
        title="Ultimos posts"
        description="Percorra os destaques recentes do feed oficial."
        right={accountBadge}
      >
        {postsError && <div className="alert alert--error">{postsError}</div>}
        {loadingPosts && posts.length === 0 ? (
          <div className="media-grid">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="media-card media-card--loading" />
            ))}
          </div>
        ) : posts.length > 0 ? (
          <div className="media-carousel" role="list">
            {posts.map((post) => renderCarouselCard(post))}
          </div>
        ) : (
          <p className="muted">Nenhum post recente encontrado para o periodo selecionado.</p>
        )}
      </Section>
    </>
  );
}
