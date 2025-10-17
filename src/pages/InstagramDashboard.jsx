// src/pages/InstagramDashboard.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Heart, MessageCircle, Play } from "lucide-react";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";

import Topbar from "../components/Topbar";
import Section from "../components/Section";
import MetricCard from "../components/MetricCard";
import InstagramRanking from "../components/InstagramRanking";
import useQueryState from "../hooks/useQueryState";
import { accounts } from "../data/accounts";

const API_BASE_URL = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
const DEFAULT_ACCOUNT_ID = accounts[0]?.id || "";

const mapByKey = (items) => {
  const map = {};
  (items || []).forEach((item) => {
    if (item && item.key) map[item.key] = item;
  });
  return map;
};

const safeParseJson = (text) => {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
};

const describeApiError = (payload, fallback) => {
  if (!payload) return fallback;
  if (payload.error) return payload.graph?.code ? `${payload.error} (Graph code ${payload.graph.code})` : payload.error;
  return payload.message || fallback;
};

const truncate = (text, length = 120) => !text ? "" : (text.length <= length ? text : `${text.slice(0, length - 3)}...`);
const extractNumber = (v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

const sumInteractions = (post) => {
  const likes = extractNumber(post.likeCount ?? post.likes);
  const comments = extractNumber(post.commentsCount ?? post.comments);
  const shares = extractNumber(post.shares ?? post.shareCount);
  const saves = extractNumber(post.saved ?? post.saves ?? post.saveCount);
  return likes + comments + shares + saves;
};

const formatMetricValue = (metric, { loading } = {}) => {
  if (loading) return "...";
  if (!metric || metric.value == null) return "-";
  return typeof metric.value === "number" ? metric.value.toLocaleString("pt-BR") : String(metric.value);
};
const metricDelta = (metric, { loading } = {}) => (loading ? null : (metric?.deltaPct ?? null));
const formatDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium"}).format(d);
};

function VideoThumbnail({ src, alt, className = "posts-table__video" }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedData = () => {
      try {
        if (video.readyState >= 2) {
          const targetTime = Math.min(0.1, video.duration || 0);
          video.currentTime = targetTime;
        }
      } catch (err) {
        // ignore seeking issues (cross-origin, etc.)
      }
    };

    const handleSeeked = () => {
      try {
        video.pause();
      } catch (err) {
        // ignore pause issues
      }
    };

    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("seeked", handleSeeked);
    return () => {
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("seeked", handleSeeked);
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      className={className}
      src={src}
      muted
      playsInline
      preload="metadata"
      aria-label={alt}
    />
  );
}

export default function InstagramDashboard() {
  const { sidebarOpen, toggleSidebar } = useOutletContext();
  const [get] = useQueryState({ account: DEFAULT_ACCOUNT_ID });
  const accountId = get("account") || DEFAULT_ACCOUNT_ID;
  const accountConfig = useMemo(
    () => accounts.find((i) => i.id === accountId) || accounts[0],
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
      setMetrics([]); setFollowerSeries([]); setMetricsError("Conta do Instagram nao configurada.");
      return;
    }
    const controller = new AbortController();
    (async () => {
      setLoadingMetrics(true); setMetricsError("");
      try {
        const params = new URLSearchParams();
        if (since) params.set("since", since);
        if (until) params.set("until", until);
        params.set("igUserId", accountConfig.instagramUserId);
        const url = `${API_BASE_URL}/api/instagram/metrics?${params.toString()}`;
        const resp = await fetch(url, { signal: controller.signal });
        const json = safeParseJson(await resp.text()) || {};
        if (!resp.ok) throw new Error(describeApiError(json, "Falha ao carregar metricas do Instagram."));
        setMetrics(json.metrics || []);
        setFollowerSeries(Array.isArray(json.follower_series) ? json.follower_series : []);
      } catch (err) {
        if (err.name !== "AbortError") {
          setMetrics([]); setFollowerSeries([]); setMetricsError(err.message || "Nao foi possivel atualizar.");
        }
      } finally { setLoadingMetrics(false); }
    })();
    return () => controller.abort();
  }, [accountConfig?.instagramUserId, since, until]);

  useEffect(() => {
    if (!accountConfig?.instagramUserId) {
      setPosts([]); setAccountInfo(null); setPostsError("Conta do Instagram nao configurada."); return;
    }
    const controller = new AbortController();
    (async () => {
      setLoadingPosts(true); setPostsError("");
      try {
        const params = new URLSearchParams({ igUserId: accountConfig.instagramUserId, limit: "15" });
        const url = `${API_BASE_URL}/api/instagram/posts?${params.toString()}`;
        const resp = await fetch(url, { signal: controller.signal });
        const json = safeParseJson(await resp.text()) || {};
        if (!resp.ok) throw new Error(describeApiError(json, "Falha ao carregar posts do Instagram."));
        setPosts(json.posts || []); setAccountInfo(json.account || null); setVisiblePosts(5);
      } catch (err) {
        if (err.name !== "AbortError") {
          setPosts([]); setAccountInfo(null); setPostsError(err.message || "Nao foi possivel carregar os posts.");
        }
      } finally { setLoadingPosts(false); }
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

  // ===== KPIs padronizados (mesmo look do FB) =====
  const kpiCards = useMemo(
    () => ([
      { key: "interactions", title: "Interações", metric: interactionsMetric },
      { key: "engagement_total", title: "Engajamento total", metric: { value: interactionsValue } },
      { key: "likes", title: "Curtidas", metric: likesMetric },
      { key: "comments", title: "Comentários", metric: commentsMetric },
      { key: "shares", title: "Compart.", metric: sharesMetric },
      { key: "saves", title: "Salvos", metric: savesMetric },
      // Preencha com mais KPIs se o endpoint fornecer (alcance, impress�es etc.)
    ]),
    [interactionsMetric, interactionsValue, likesMetric, commentsMetric, sharesMetric, savesMetric],
  );

  // ===== Donut (composição do engajamento) =====
  const donutData = useMemo(() => ([
    { name: "Curtidas", value: extractNumber(engagementBreakdown.likes) },
    { name: "Comentários", value: extractNumber(engagementBreakdown.comments) },
    { name: "Compart.", value: extractNumber(engagementBreakdown.shares) },
    { name: "Salvos", value: extractNumber(engagementBreakdown.saves) },
  ]), [engagementBreakdown]);

  const DONUT_COLORS = ["#60a5fa", "#a855f7", "#f59e0b", "#34d399"];

  // ===== Gráficos =====
  const followerLineData = useMemo(
    () => followerSeries.map((e) => ({ label: formatDate(e.date ?? e.end_time), value: extractNumber(e.value) })),
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

  // Top 3 posts por interações totais para o ranking sidebar
  const rankedPosts = useMemo(() => {
    return [...posts]
      .sort((a, b) => sumInteractions(b) - sumInteractions(a))
      .slice(0, 3);
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
      <Topbar title="Instagram" sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} showFilters />
      <div className="page-content page-content--unified">
        {metricsError && <div className="alert alert--error">{metricsError}</div>}

        <Section title="Instagram" description="">
          {accountBadge && <div className="mb-6">{accountBadge}</div>}

          {/* ====== GRID DE KPIS + RANKING ====== */}
          <div className="ig-top-section">
            <div className="dashboard-kpis">
              {kpiCards.map(({ key, title, metric }) => (
                <MetricCard
                  key={key}
                  title={title}
                  value={formatMetricValue(metric, { loading: loadingMetrics })}
                  delta={metricDelta(metric, { loading: loadingMetrics })}
                  compact
                />
              ))}
            </div>

            {/* ====== RANKING SIDEBAR ====== */}
            <InstagramRanking posts={rankedPosts} loading={loadingPosts} />
          </div>
        </Section>

        {/* ====== GRÁFICOS - 3 COLUNAS ====== */}
        <Section title="" description="">
          <div className="charts-row">
            {/* Donut */}
            <div className="chart-card">
              <div className="fb-line-card__header" style={{ marginBottom: 12 }}>
                <h3>Composição de resultados</h3>
                <span className="muted">Distribuição do engajamento no período</span>
              </div>
              <div style={{ position: "relative", width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {donutData.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#f7fafc',
                        color: '#0f1720',
                        border: '1px solid #e3e8ef',
                        borderRadius: '10px',
                        boxShadow: '0 6px 20px rgba(0,0,0,.25)'
                      }}
                      formatter={(v) => Number(v).toLocaleString("pt-BR")}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Centro do donut */}
                <div className="fb-donut-card__center">
                  <strong>{interactionsValue.toLocaleString("pt-BR")}</strong>
                  <span>Total combinado</span>
                </div>
              </div>
            </div>

            {/* Linha - Evolução de seguidores */}
            <div className="chart-card chart-card--sm">
              <div className="fb-line-card__header" style={{ marginBottom: 12 }}>
                <h3>Evolução de seguidores</h3>
                <p className="muted">Série diária informada pelo Instagram.</p>
              </div>
              {loadingMetrics ? (
                <div className="chart-card__empty">Carregando...</div>
              ) : followerLineData.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={followerLineData} margin={{ left: 8, right: 12, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis dataKey="label" stroke="var(--text-muted)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                    <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickFormatter={(v) => v.toLocaleString("pt-BR")} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#f7fafc',
                        color: '#0f1720',
                        border: '1px solid #e3e8ef',
                        borderRadius: '10px',
                        boxShadow: '0 6px 20px rgba(0,0,0,.25)'
                      }}
                      formatter={(v) => Number(v).toLocaleString("pt-BR")}
                    />
                    <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="chart-card__empty">Sem dados suficientes.</div>
              )}
            </div>

            {/* Barras - Interações por post */}
            <div className="chart-card chart-card--sm">
              <div className="fb-line-card__header" style={{ marginBottom: 12 }}>
                <h3>Interações por post</h3>
                <p className="muted">Comparativo entre alcance e interações.</p>
              </div>
              {loadingPosts ? (
                <div className="chart-card__empty">Carregando...</div>
              ) : barChartData.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barChartData} margin={{ left: 8, right: 12, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis dataKey="label" stroke="var(--text-muted)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                    <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickFormatter={(v) => v.toLocaleString("pt-BR")} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#f7fafc',
                        color: '#0f1720',
                        border: '1px solid #e3e8ef',
                        borderRadius: '10px',
                        boxShadow: '0 6px 20px rgba(0,0,0,.25)'
                      }}
                      formatter={(v) => Number(v).toLocaleString("pt-BR")}
                    />
                    <Bar dataKey="interactions" fill="#34d399" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="reach" fill="#4b5563" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="chart-card__empty">Sem interações recentes.</div>
              )}
            </div>
          </div>
        </Section>

        {/* ====== ÚLTIMOS POSTS ====== */}
        <Section title="Últimos posts" description="Acompanhe o desempenho recente.">
          {postsError && <div className="alert alert--error">{postsError}</div>}
          {loadingPosts && posts.length === 0 ? (
            <div className="table-loading">Carregando posts...</div>
          ) : displayedPosts.length ? (
            <>
              <div className="posts-table-container">
                <table className="posts-table">
                  <colgroup>
                    <col className="posts-table__col posts-table__col--date" />
                    <col className="posts-table__col posts-table__col--preview" />
                    <col className="posts-table__col posts-table__col--caption" />
                    <col className="posts-table__col posts-table__col--metric" />
                    <col className="posts-table__col posts-table__col--metric" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Preview</th>
                      <th>Legenda</th>
                      <th>Curtidas</th>
                      <th>Comentários</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedPosts.map((post) => {
                      const isVideo = post.mediaType === "VIDEO";
                      const previewCandidates = [
                        post.previewUrl,
                        post.thumbnailUrl,
                        post.thumbnail_url,
                        post.posterUrl,
                        post.poster_url,
                      ];
                      const previewFallback = previewCandidates.find(Boolean);
                      const videoSource = isVideo ? (post.mediaUrl || post.media_url) : null;
                      const previewUrl = previewFallback || (!isVideo ? (post.mediaUrl || post.media_url) : null);
                      const publishedAt = formatDate(post.timestamp);
                      const likes = extractNumber(post.likeCount);
                      const comments = extractNumber(post.commentsCount);
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
                            ) : videoSource ? (
                              <VideoThumbnail src={videoSource} alt={truncate(post.caption || "Post", 40)} />
                            ) : (
                              <div className="posts-table__placeholder">Sem preview</div>
                            )}
                            {isVideo && <Play size={12} className="posts-table__badge" />}
                          </td>
                          <td className="posts-table__caption">{truncate(post.caption, 80) || "Sem legenda"}</td>
                          <td className="posts-table__metric">
                            <span className="posts-table__metric-content">
                              <Heart size={14} /> {likes.toLocaleString("pt-BR")}
                            </span>
                          </td>
                          <td className="posts-table__metric">
                            <span className="posts-table__metric-content">
                              <MessageCircle size={14} /> {comments.toLocaleString("pt-BR")}
                            </span>
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



