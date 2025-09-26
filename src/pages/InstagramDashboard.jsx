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

const SUMMARY_CARDS = [
  {
    key: "reach",
    title: "Alcance do perÃ­odo",
    hint: "Total de perfis Ãºnicos alcanÃ§ados no intervalo selecionado.",
  },
  {
    key: "impressions",
    title: "ImpressÃµes totais",
    hint: "Quantidade de visualizaÃ§Ãµes dos conteÃºdos publicados.",
  },
  {
    key: "engagement",
    title: "InteraÃ§Ãµes totais",
    hint: "Soma de curtidas, comentÃ¡rios, compartilhamentos e salvamentos.",
  },
  {
    key: "engagement_rate",
    title: "Taxa de engajamento",
    hint: "Percentual de interaÃ§Ãµes em relaÃ§Ã£o ao alcance.",
    percentage: true,
  },
];

const mediaTypeLabel = {
  IMAGE: "Imagem",
  VIDEO: "VÃ­deo",
  CAROUSEL_ALBUM: "Carrossel",
  REELS: "Reels",
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
      setMetricsError("Conta do Instagram nÃ£o configurada.");
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
          throw new Error(describeApiError(json, "Falha ao carregar mÃ©tricas do Instagram."));
        }
        setMetrics(json.metrics || []);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(err);
          setMetricsError(err.message || "NÃ£o foi possÃ­vel atualizar os indicadores do Instagram.");
        }
      } finally {
        setLoadingMetrics(false);
      }
    };

    loadMetrics();
    return () => controller.abort();
  }, [accountConfig?.instagramUserId, since, until]);

  useEffect(() => {
    if (!accountConfig?.facebookPageId) {
      setPosts([]);
      setAccountInfo(null);
      setPostsError("PÃ¡gina do Facebook nÃ£o configurada.");
      return;
    }

    const controller = new AbortController();
    const loadPosts = async () => {
      setLoadingPosts(true);
      setPostsError("");
      try {
        const params = new URLSearchParams({
          pageId: accountConfig.facebookPageId,
          limit: "6",
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
          setPostsError(err.message || "NÃ£o foi possÃ­vel carregar os posts recentes.");
        }
        setAccountInfo(null);
      } finally {
        setLoadingPosts(false);
      }
    };

    loadPosts();
    return () => controller.abort();
  }, [accountConfig?.facebookPageId]);

  const metricsByKey = useMemo(() => mapByKey(metrics), [metrics]);

  const formatValue = (metric, options = {}) => {
    if (loadingMetrics) return "...";
    if (!metric) return "-";
    const value = metric.value;
    if (value == null) return "-";
    if (options.percentage && typeof value === "number") {
      return `${Number(value).toFixed(2)}%`;
    }
    if (typeof value === "number") {
      return value.toLocaleString("pt-BR");
    }
    return String(value);
  };

  const metricDelta = (metric) => (loadingMetrics ? null : metric?.deltaPct);

  const renderPostCard = (post) => {
    const previewUrl = post.previewUrl;
    const typeLabel = mediaTypeLabel[post.mediaType] || post.mediaType || "Post";
    const publishedAt = formatDate(post.timestamp);
    const likes = Number.isFinite(post.likeCount) ? post.likeCount : null;
    const comments = Number.isFinite(post.commentsCount) ? post.commentsCount : null;

    return (
      <article key={post.id} className="media-card">
        <a
          href={post.permalink || "#"}
          target="_blank"
          rel="noreferrer"
          className="media-card__preview"
          aria-label="Abrir publicaÃ§Ã£o no Instagram"
        >
          {previewUrl ? (
            <img src={previewUrl} alt={truncate(post.caption || "Postagem do Instagram", 80)} loading="lazy" />
          ) : (
            <div className="media-card__placeholder">PrÃ©via indisponÃ­vel</div>
          )}
          {post.mediaType === "VIDEO" && (
            <span className="media-card__badge" title="ConteÃºdo em vÃ­deo">
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
            <span>{publishedAt || "Data indisponÃ­vel"}</span>
            <span>{typeLabel}</span>
          </header>
          <p className="media-card__caption">{truncate(post.caption, 160) || "Legenda nÃ£o disponÃ­vel."}</p>
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
              <a
                href={post.permalink}
                target="_blank"
                rel="noreferrer"
                className="media-card__link"
              >
                Ver no Instagram <ExternalLink size={14} />
              </a>
            )}
          </footer>
        </div>
      </article>
    );
  };

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
        title="Resumo orgÃ¢nico"
        description="Principais indicadores do perfil no perÃ­odo selecionado."
      >
        <KpiGrid>
          {SUMMARY_CARDS.map(({ key, title, hint, percentage }) => (
            <MetricCard
              key={key}
              title={title}
              value={formatValue(metricsByKey[key], { percentage })}
              delta={percentage ? null : metricDelta(metricsByKey[key])}
              hint={hint}
            />
          ))}
        </KpiGrid>
      </Section>

      <Section
        title="Ãšltimos posts"
        description="ConteÃºdo recente publicado no feed oficial."
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
          <div className="media-grid">
            {posts.map((post) => renderPostCard(post))}
          </div>
        ) : (
          <p className="muted">Nenhum post recente encontrado para o perÃ­odo selecionado.</p>
        )}
      </Section>
    </>
  );
}

