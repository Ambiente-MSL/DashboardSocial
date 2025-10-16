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
  PieChart,
  Pie,
  Cell,
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
      // Preencha com mais KPIs se o endpoint fornecer (alcance, impressões etc.)
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

  const rankingMetrics = useMemo(() => {
    const builders = [
      { key: "reach", label: "Maior alcance", extractor: (p) => extractNumber(p.reach) },
      { key: "interactions", label: "Maior engajamento", extractor: (p) => sumInteractions(p) },
      { key: "saves", label: "Maior salvamento", extractor: (p) => extractNumber(p.saved ?? p.saves ?? p.saveCount) },
    ];
    return builders.map(({ key, label, extractor }) => {
      let topPost = null; let topValue = -1;
      posts.forEach((p) => { const v = extractor(p); if (v > topValue) { topPost = p; topValue = v; } });
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
      <Topbar title="Instagram" sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} showFilters />
      <div className="page-content ig-dashboard">
        <DateRangeIndicator />
        {accountBadge && <div className="mb-6">{accountBadge}</div>}
        {metricsError && <div className="alert alert--error">{metricsError}</div>}

        {/* ====== TOPO (KPIs + DONUT) – idêntico ao “molde” do Facebook ====== */}
        <div className="ig-summary-top">
          <div className="card">
            <div className="ig-kpi-grid">
              {kpiCards.map(({ key, title, metric }) => (
                <MetricCard
                  key={key}
                  title={title}
                  value={formatMetricValue(metric, { loading: loadingMetrics })}
                  delta={metricDelta(metric, { loading: loadingMetrics })}
                  variant="compact"
                />
              ))}
            </div>
          </div>

          <div className="card ig-donut-card">
            <div className="fb-insight-card__header">
              <h3>Composição de resultados</h3>
              <span className="text-xs muted">Distribuição do engajamento no período</span>
            </div>
            <div style={{ position: "relative", width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={2}
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
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  pointerEvents: "none",
                  textAlign: "center",
                }}
              >
                <strong style={{ fontSize: 22 }}>{interactionsValue.toLocaleString("pt-BR")}</strong>
                <span className="muted" style={{ fontSize: 12 }}>Total combinado</span>
              </div>
            </div>
            <ul className="ig-donut-legend">
              {donutData.map((d, i) => (
                <li key={d.name}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span className="ig-dot" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    {d.name}
                  </span>
                  <strong className="text-sm" style={{ color: "var(--text-primary)" }}>
                    {d.value.toLocaleString("pt-BR")}
                  </strong>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ====== GRÁFICOS (linha + barras) ====== */}
        <div className="ig-charts-grid">
          <div className="ig-line-card">
            <div className="ig-line-card__header">
              <h3>Evolução de seguidores</h3>
              <p>Série diária informada pelo Instagram.</p>
            </div>
            {loadingMetrics ? (
              <div className="chart-card__empty">Carregando...</div>
            ) : followerLineData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={followerLineData} margin={{ left: 8, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="label" stroke="var(--text-muted)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                  <YAxis stroke="var(--text-muted)" tickFormatter={(v) => v.toLocaleString("pt-BR")} />
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
                  <Line type="monotone" dataKey="value" stroke="#60a5fa" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-card__empty">Sem dados suficientes.</div>
            )}
          </div>

          <div className="ig-bar-card">
            <div className="ig-bar-card__header">
              <h3>Interações por post</h3>
              <p>Comparativo entre alcance e interações.</p>
            </div>
            {loadingPosts ? (
              <div className="chart-card__empty">Carregando...</div>
            ) : barChartData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barChartData} margin={{ left: 8, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="label" stroke="var(--text-muted)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                  <YAxis stroke="var(--text-muted)" tickFormatter={(v) => v.toLocaleString("pt-BR")} />
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

        {/* ====== RANKING ====== */}
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

        {/* ====== ÚLTIMOS POSTS ====== */}
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
                      <th>Engajamento</th>
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
                          <td className="posts-table__metric"><Heart size={14} /> {likes.toLocaleString("pt-BR")}</td>
                          <td className="posts-table__metric"><MessageCircle size={14} /> {comments.toLocaleString("pt-BR")}</td>
                          <td className="posts-table__metric"><TrendingUp size={14} /> {shares.toLocaleString("pt-BR")}</td>
                          <td className="posts-table__metric"><Bookmark size={14} /> {saves.toLocaleString("pt-BR")}</td>
                          <td className="posts-table__metric-group">
                           <span><Heart size={13}/> {likes.toLocaleString("pt-BR")}</span>
                           <span><MessageCircle size={13}/> {comments.toLocaleString("pt-BR")}</span>
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
