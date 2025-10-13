// src/pages/InstagramDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Bookmark, ExternalLink, Heart, MessageCircle, Play, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";

import Topbar from "../components/Topbar";
import Section from "../components/Section";
import MetricCard from "../components/MetricCard";
import DateRangeIndicator from "../components/DateRangeIndicator";
import useQueryState from "../hooks/useQueryState";
import { accounts } from "../data/accounts";

const API_BASE_URL = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
const DEFAULT_ACCOUNT_ID = accounts[0]?.id || "";

const mapByKey = (items) => {
  const map = {};
  (items || []).forEach((item) => {
    if (item && item.key) {
      map[item.key] = item;
    }
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

const truncate = (text, length = 120) => {
  if (!text) return "";
  if (text.length <= length) return text;
  return `${text.slice(0, length - 3)}...`;
};

const extractNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const sumInteractions = (post) => {
  const likes = extractNumber(post.likeCount ?? post.likes);
  const comments = extractNumber(post.commentsCount ?? post.comments);
  const shares = extractNumber(post.shares ?? post.shareCount);
  const saves = extractNumber(post.saved ?? post.saves ?? post.saveCount);
  return likes + comments + shares + saves;
};

const formatMetricValue = (metric, { loading } = {}) => {
  if (loading) return "...";
  if (!metric) return "-";
  const value = metric.value;
  if (value == null) return "-";
  if (typeof value === "number") {
    return value.toLocaleString("pt-BR");
  }
  return String(value);
};

const metricDelta = (metric, { loading } = {}) => {
  if (loading) return null;
  return metric?.deltaPct ?? null;
};

const formatDate = (iso) => {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
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
  const [visiblePosts, setVisiblePosts] = useState(5);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState("");
  const [accountInfo, setAccountInfo] = useState(null);
  const [followerSeries, setFollowerSeries] = useState([]);

  useEffect(() => {
    if (!accountConfig?.instagramUserId) {
      setMetrics([]);
      setFollowerSeries([]);
      setMetricsError("Conta do Instagram nao configurada.");
      return;
    }
    const controller = new AbortController();
    (async () => {
      setLoadingMetrics(true);
      setMetricsError("");
      try {
        const params = new URLSearchParams();
        if (since) params.set("since", since);
        if (until) params.set("until", until);
        params.set("igUserId", accountConfig.instagramUserId);
        const url = `${API_BASE_URL}/api/instagram/metrics?${params.toString()}`;
        const resp = await fetch(url, { signal: controller.signal });
        const raw = await resp.text();
        const json = safeParseJson(raw) || {};
        if (!resp.ok) throw new Error(describeApiError(json, "Falha ao carregar metricas do Instagram."));
        setMetrics(json.metrics || []);
        setFollowerSeries(Array.isArray(json.follower_series) ? json.follower_series : []);
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }
        console.error(err);
        setMetrics([]);
        setFollowerSeries([]);
        setMetricsError(err.message || "Nao foi possivel atualizar os indicadores do Instagram.");
      } finally {
        setLoadingMetrics(false);
      }
    })();
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
    (async () => {
      setLoadingPosts(true);
      setPostsError("");
      try {
        const params = new URLSearchParams({ igUserId: accountConfig.instagramUserId, limit: "15" });
        const url = `${API_BASE_URL}/api/instagram/posts?${params.toString()}`;
        const resp = await fetch(url, { signal: controller.signal });
        const raw = await resp.text();
        const json = safeParseJson(raw) || {};
        if (!resp.ok) throw new Error(describeApiError(json, "Falha ao carregar posts do Instagram."));
        setPosts(json.posts || []);
        setAccountInfo(json.account || null);
        setVisiblePosts(5);
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }
        console.error(err);
        setPosts([]);
        setAccountInfo(null);
        setPostsError(err.message || "Nao foi possivel carregar os posts recentes.");
      } finally {
        setLoadingPosts(false);
      }
    })();
    return () => controller.abort();
  }, [accountConfig?.instagramUserId]);

  const metricsByKey = useMemo(() => mapByKey(metrics), [metrics]);
  const interactionsMetric = metricsByKey.interactions;
  const likesMetric = metricsByKey.likes;
  const commentsMetric = metricsByKey.comments;
  const sharesMetric = metricsByKey.shares;
  const savesMetric = metricsByKey.saves;

  const interactionsValue = extractNumber(interactionsMetric?.value);

  const engagementBreakdown = useMemo(
    () => metricsByKey.engagement_rate?.breakdown || {
      likes: extractNumber(likesMetric?.value),
      comments: extractNumber(commentsMetric?.value),
      shares: extractNumber(sharesMetric?.value),
      saves: extractNumber(savesMetric?.value),
    },
    [metricsByKey.engagement_rate?.breakdown, likesMetric, commentsMetric, sharesMetric, savesMetric],
  );

  const primaryCards = useMemo(
    () => [
      {
        key: "interactions",
        title: "Interacoes",
        metric: interactionsMetric,
      },
      {
        key: "engagement",
        title: "Engajamento total",
        metric: { value: interactionsValue },
      },
    ],
    [interactionsMetric, interactionsValue],
  );

  const engagementDetails = useMemo(
    () => [
      { key: "likes", label: "Curtidas", value: extractNumber(engagementBreakdown.likes) },
      { key: "comments", label: "Comentarios", value: extractNumber(engagementBreakdown.comments) },
      { key: "shares", label: "Compart.", value: extractNumber(engagementBreakdown.shares) },
      { key: "saves", label: "Salvos", value: extractNumber(engagementBreakdown.saves) },
    ],
    [engagementBreakdown],
  );

  const followerLineData = useMemo(
    () => followerSeries.map((entry) => ({
      label: formatDate(entry.date ?? entry.end_time),
      value: extractNumber(entry.value),
    })),
    [followerSeries],
  );

  const barChartData = useMemo(
    () => posts.slice(0, 6).map((post, index) => ({
      label: `Post ${index + 1}`,
      interactions: sumInteractions(post),
      reach: extractNumber(post.reach),
    })),
    [posts],
  );

  const rankingMetrics = useMemo(() => {
    const builders = [
      { key: "reach", label: "Maior alcance", extractor: (post) => extractNumber(post.reach) },
      { key: "interactions", label: "Maior engajamento", extractor: (post) => sumInteractions(post) },
      { key: "saves", label: "Maior salvamento", extractor: (post) => extractNumber(post.saved ?? post.saves ?? post.saveCount) },
    ];
    return builders.map(({ key, label, extractor }) => {
      let topPost = null;
      let topValue = -1;
      posts.forEach((post) => {
        const value = extractor(post);
        if (value > topValue) {
          topPost = post;
          topValue = value;
        }
      });
      return { key, label, post: topPost, value: topValue };
    });
  }, [posts]);

  const displayedPosts = posts.slice(0, visiblePosts);

  const accountBadge = accountInfo ? (
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
  ) : null;

  return (
    <>
      <Topbar title="Instagram" sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} showFilters={true} />
      <div className="page-content ig-dashboard">
        <DateRangeIndicator />
        {accountBadge && <div className="ig-account-highlight">{accountBadge}</div>}
        {metricsError && <div className="alert alert--error">{metricsError}</div>}

        <Section title="Visao geral do perfil">
          <div className="ig-primary-cards">
            {primaryCards.map(({ key, title, metric, deltaValue }) => (
              <MetricCard
                key={key}
                title={title}
                value={formatMetricValue(metric, { loading: loadingMetrics })}
                delta={typeof deltaValue === "number" ? deltaValue : metricDelta(metric, { loading: loadingMetrics })}
                variant="compact"
              />
            ))}
          </div>
          <div className="ig-engagement-details">
            {engagementDetails.map((detail) => (
              <div key={detail.key} className="ig-engagement-details__item">
                <span className="ig-engagement-details__label">{detail.label}</span>
                <span className="ig-engagement-details__value">{detail.value.toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Tendencias da conta" description="Comparativos rápidos para análise diária.">
          <div className="ig-charts">
            <div className="ig-chart-card">
              <div className="ig-chart-card__header">
                <h3>Evolucao de seguidores</h3>
                <span>Serie diária informada pelo Instagram.</span>
              </div>
              <div className="ig-chart-card__body">
                {loadingMetrics ? (
                  <div className="chart-card__empty">Carregando...</div>
                ) : followerLineData.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={followerLineData} margin={{ left: 8, right: 12, top: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                      <XAxis dataKey="label" stroke="var(--text-muted)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                      <YAxis stroke="var(--text-muted)" tickFormatter={(value) => value.toLocaleString("pt-BR")} />
                      <Tooltip formatter={(value) => Number(value).toLocaleString("pt-BR")} />
                      <Line type="monotone" dataKey="value" stroke="#34d399" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="chart-card__empty">Sem dados suficientes.</div>
                )}
              </div>
            </div>

            <div className="ig-chart-card">
              <div className="ig-chart-card__header">
                <h3>Interacoes por post</h3>
                <span>Comparativo entre alcance e interacoes.</span>
              </div>
              <div className="ig-chart-card__body">
                {loadingPosts ? (
                  <div className="chart-card__empty">Carregando...</div>
                ) : barChartData.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={barChartData} margin={{ left: 8, right: 12, top: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                      <XAxis dataKey="label" stroke="var(--text-muted)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                      <YAxis stroke="var(--text-muted)" tickFormatter={(value) => value.toLocaleString("pt-BR")} />
                      <Tooltip formatter={(value) => Number(value).toLocaleString("pt-BR")} />
                      <Bar dataKey="interactions" fill="#34d399" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="reach" fill="#4e4e4e" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="chart-card__empty">Sem interacoes recentes.</div>
                )}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Ranking de posts" description="Destaques do período atual.">
          <div className="ig-ranking">
            {rankingMetrics.map(({ key, label, post, value }) => (
              <div key={key} className="ig-ranking__item">
                <div className="ig-ranking__title">
                  <span className="badge">{label}</span>
                  <strong>{Number.isFinite(value) && value >= 0 ? value.toLocaleString("pt-BR") : "-"}</strong>
                </div>
                {post ? (
                  <div className="ig-ranking__content">
                    <div className="ig-ranking__preview">
                      {post.previewUrl ? (
                        <img src={post.previewUrl} alt={truncate(post.caption || "Post", 60)} />
                      ) : (
                        <div className="ig-ranking__preview--placeholder">Sem preview</div>
                      )}
                      {post.mediaType === "VIDEO" && <Play size={14} className="ig-ranking__badge" />}
                    </div>
                    <div className="ig-ranking__meta">
                      <span className="ig-ranking__caption">{truncate(post.caption, 100) || "Sem legenda"}</span>
                      <div className="ig-ranking__metrics">
                        <span><Heart size={14} /> {extractNumber(post.likeCount).toLocaleString("pt-BR")}</span>
                        <span><MessageCircle size={14} /> {extractNumber(post.commentsCount).toLocaleString("pt-BR")}</span>
                        <span><TrendingUp size={14} /> {sumInteractions(post).toLocaleString("pt-BR")}</span>
                      </div>
                      {post.permalink && (
                        <a className="ig-ranking__link" href={post.permalink} target="_blank" rel="noreferrer">
                          <ExternalLink size={14} /> Ver post
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="ig-ranking__empty">Sem dados disponíveis.</div>
                )}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Últimos posts" description="Acompanhe o desempenho recente.">
          {postsError && <div className="alert alert--error">{postsError}</div>}
          {loadingPosts && posts.length === 0 ? (
            <div className="table-loading">Carregando posts...</div>
          ) : displayedPosts.length ? (
            <>
              <div className="posts-table-container">
                <table className="posts-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Preview</th>
                      <th>Legenda</th>
                      <th>Curtidas</th>
                      <th>Qtd comentários</th>
                      <th>Compartilhamentos</th>
                      <th>Salvos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedPosts.map((post) => {
                      const previewUrl = post.previewUrl || post.mediaUrl || post.thumbnailUrl;
                      const publishedAt = formatDate(post.timestamp);
                      const likes = extractNumber(post.likeCount);
                      const comments = extractNumber(post.commentsCount);
                      const shares = extractNumber(post.shareCount ?? post.shares);
                      const saves = extractNumber(post.saved ?? post.saves ?? post.saveCount);
                      return (
                        <tr key={post.id}>
                          <td className="posts-table__date">{publishedAt}</td>
                          <td className="posts-table__preview">
                            {previewUrl ? (
                              post.permalink ? (
                                <a href={post.permalink} target="_blank" rel="noreferrer" className="posts-table__link">
                                  <img src={previewUrl} alt={truncate(post.caption || "Post", 40)} />
                                </a>
                              ) : (
                                <img src={previewUrl} alt={truncate(post.caption || "Post", 40)} />
                              )
                            ) : (
                              <div className="posts-table__placeholder">Sem preview</div>
                            )}
                            {post.mediaType === "VIDEO" && <Play size={12} className="posts-table__badge" />}
                          </td>
                          <td className="posts-table__caption">{truncate(post.caption, 80) || "Sem legenda"}</td>
                          <td className="posts-table__metric">
                            <Heart size={14} /> {likes.toLocaleString("pt-BR")}
                          </td>
                          <td className="posts-table__metric">
                            <MessageCircle size={14} /> {comments.toLocaleString("pt-BR")}
                          </td>
                          <td className="posts-table__metric">
                            <TrendingUp size={14} /> {shares.toLocaleString("pt-BR")}
                          </td>
                          <td className="posts-table__metric">
                            <Bookmark size={14} /> {saves.toLocaleString("pt-BR")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {posts.length > displayedPosts.length && (
                <div className="posts-table__footer">
                  <button
                    type="button"
                    className="posts-table__more"
                    onClick={() => setVisiblePosts((prev) => Math.min(prev + 5, posts.length))}
                  >
                    Ver mais
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="muted">Nenhum post recente encontrado.</p>
          )}
        </Section>
      </div>
    </>
  );
}
