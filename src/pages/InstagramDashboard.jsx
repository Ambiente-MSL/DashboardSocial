// src/pages/InstagramDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ExternalLink, Heart, MessageCircle, Play, BarChart3, Clock, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import Topbar from "../components/Topbar";
import Section from "../components/Section";
import KpiGrid from "../components/KpiGrid";
import MetricCard from "../components/MetricCard";
import useQueryState from "../hooks/useQueryState";
import { accounts } from "../data/accounts";

const API_BASE_URL = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
const DEFAULT_ACCOUNT_ID = accounts[0]?.id || "";

const INSIGHT_CARDS = [
  { key: "reach", title: "Alcance", hint: "Perfis únicos alcançados no período selecionado." },
  { key: "impressions", title: "Impressões", hint: "Total de visualizações dos conteúdos." },
  { key: "profile_views", title: "Views de perfil", hint: "Visitas ao perfil no período." },
  { key: "website_clicks", title: "Cliques no site", hint: "Cliques no link da bio no período." },
  { key: "interactions", title: "Interações totais", hint: "Soma de curtidas, comentários, compartilhamentos e salvamentos." },
  { key: "likes", title: "Curtidas", hint: "Total de curtidas no período." },
  { key: "comments", title: "Comentários", hint: "Total de comentários no período." },
  { key: "shares", title: "Compartilhamentos", hint: "Total de compartilhamentos no período." },
  { key: "saves", title: "Salvamentos", hint: "Total de salvamentos no período." },
  { key: "engagement_rate", title: "Taxa de engajamento", hint: "Interações / alcance * 100.", percentage: true },
];

const mediaTypeLabel = {
  IMAGE: "Imagem",
  VIDEO: "Vídeo",
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
        aria-label="Abrir publicação no Instagram"
      >
        {previewUrl ? (
          <img src={previewUrl} alt={truncate(post.caption || "Postagem do Instagram", 80)} loading="lazy" />
        ) : (
          <div className="media-card__placeholder">Preview indisponível</div>
        )}
        {post.mediaType === "VIDEO" && (
          <span className="media-card__badge" title="Conteúdo em vídeo">
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
          <span>{publishedAt || "Data indisponível"}</span>
          <span>{typeLabel}</span>
        </header>
        <p className="media-card__caption">{truncate(post.caption, 160) || "Legenda indisponível."}</p>
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

  // === Orgânico – cards ===
  const [metrics, setMetrics] = useState([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState("");

  // === Orgânico – painéis avançados ===
  const [organic, setOrganic] = useState({ tops: {}, formats: [], top_story: null });
  const [loadingOrganic, setLoadingOrganic] = useState(false);
  const [organicError, setOrganicError] = useState("");

  // === Posts recentes (carrossel) ===
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState("");
  const [accountInfo, setAccountInfo] = useState(null);

  // === Marketing API – vídeo ===
  const [adsVideo, setAdsVideo] = useState({ drop_off_points: [] });
  const [loadingAds, setLoadingAds] = useState(false);
  const [adsError, setAdsError] = useState("");

  // ----------- LOAD ORGÂNICO: CARDS -----------
  useEffect(() => {
    if (!accountConfig?.instagramUserId) {
      setMetrics([]);
      setMetricsError("Conta do Instagram não configurada.");
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
        if (!resp.ok) throw new Error(describeApiError(json, "Falha ao carregar métricas do Instagram."));
        setMetrics(json.metrics || []);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(err);
          setMetricsError(err.message || "Não foi possível atualizar os indicadores do Instagram.");
        }
      } finally {
        setLoadingMetrics(false);
      }
    })();
    return () => controller.abort();
  }, [accountConfig?.instagramUserId, since, until]);

  // ----------- LOAD ORGÂNICO: TOPS / FORMATS / STORY -----------
  useEffect(() => {
    if (!accountConfig?.instagramUserId) {
      setOrganic({ tops: {}, formats: [], top_story: null });
      setOrganicError("Conta do Instagram não configurada.");
      return;
    }
    const controller = new AbortController();
    (async () => {
      setLoadingOrganic(true);
      setOrganicError("");
      try {
        const params = new URLSearchParams();
        if (since) params.set("since", since);
        if (until) params.set("until", until);
        params.set("igUserId", accountConfig.instagramUserId);

        const url = `${API_BASE_URL}/api/instagram/organic?${params.toString()}`;
        const resp = await fetch(url, { signal: controller.signal });
        const raw = await resp.text();
        const json = safeParseJson(raw) || {};
        if (!resp.ok) throw new Error(describeApiError(json, "Falha ao carregar resumo orgânico."));
        setOrganic({
          tops: json.tops || {},
          formats: Array.isArray(json.formats) ? json.formats : [],
          top_story: json.top_story || null,
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(err);
          setOrganicError(err.message || "Não foi possível carregar os insights orgânicos avançados.");
        }
      } finally {
        setLoadingOrganic(false);
      }
    })();
    return () => controller.abort();
  }, [accountConfig?.instagramUserId, since, until]);

  // ----------- LOAD POSTS RECENTES -----------
  useEffect(() => {
    if (!accountConfig?.instagramUserId) {
      setPosts([]);
      setAccountInfo(null);
      setPostsError("Conta do Instagram não configurada.");
      return;
    }
    const controller = new AbortController();
    (async () => {
      setLoadingPosts(true);
      setPostsError("");
      try {
        const params = new URLSearchParams({ igUserId: accountConfig.instagramUserId, limit: "10" });
        const url = `${API_BASE_URL}/api/instagram/posts?${params.toString()}`;
        const resp = await fetch(url, { signal: controller.signal });
        const raw = await resp.text();
        const json = safeParseJson(raw) || {};
        if (!resp.ok) throw new Error(describeApiError(json, "Falha ao carregar posts do Instagram."));
        setPosts(json.posts || []);
        setAccountInfo(json.account || null);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(err);
          setPostsError(err.message || "Não foi possível carregar os posts recentes.");
        }
        setAccountInfo(null);
      } finally {
        setLoadingPosts(false);
      }
    })();
    return () => controller.abort();
  }, [accountConfig?.instagramUserId]);

  // ----------- LOAD ADS (VÍDEO) -----------
  useEffect(() => {
    if (!accountConfig?.adAccountId) {
      setAdsVideo({ drop_off_points: [] });
      setAdsError("Conta de anúncios não configurada.");
      return;
    }
    const controller = new AbortController();
    (async () => {
      setLoadingAds(true);
      setAdsError("");
      try {
        const params = new URLSearchParams({ actId: accountConfig.adAccountId });
        if (since) {
          // converter Unix -> ISO yyyy-mm-dd
          const ms = Number(since) > 1_000_000_000_000 ? Number(since) : Number(since) * 1000;
          params.set("since", new Date(ms).toISOString().slice(0, 10));
        }
        if (until) {
          const ms = Number(until) > 1_000_000_000_000 ? Number(until) : Number(until) * 1000;
          params.set("until", new Date(ms).toISOString().slice(0, 10));
        }
        const url = `${API_BASE_URL}/api/ads/highlights?${params.toString()}`;
        const resp = await fetch(url, { signal: controller.signal });
        const raw = await resp.text();
        const json = safeParseJson(raw) || {};
        if (!resp.ok) throw new Error(describeApiError(json, "Falha ao carregar métricas de anúncios."));
        setAdsVideo(json.video_summary || { drop_off_points: [] });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(err);
          setAdsError(err.message || "Não foi possível carregar os destaques de vídeo (Ads).");
        }
      } finally {
        setLoadingAds(false);
      }
    })();
    return () => controller.abort();
  }, [accountConfig?.adAccountId, since, until]);

  const metricsByKey = useMemo(() => mapByKey(metrics), [metrics]);

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

  // Gráfico de drop-off (Ads vídeo)
  const dropData = Array.isArray(adsVideo.drop_off_points) ? adsVideo.drop_off_points : [];

  return (
    <>
      <Topbar title="Instagram" sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />

      {metricsError && <div className="alert alert--error">{metricsError}</div>}

      <Section
        title="Insights do perfil (orgânico)"
        description="Principais indicadores orgânicos do período selecionado."
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

      {/* MELHOR HORÁRIO PARA POSTAR */}
      <Section
        title="Melhor horário para postar"
        description="Horários com maior engajamento do público."
      >
        <div className="best-time-card">
          <div className="best-time-card__icon">
            <Clock size={48} />
          </div>
          <div className="best-time-card__content">
            <div className="best-time-card__primary">
              <div className="best-time-card__time">18:00 - 21:00</div>
              <div className="best-time-card__label">Horário de pico</div>
            </div>
            <div className="best-time-card__secondary">
              <div className="best-time-card__metric">
                <TrendingUp size={16} />
                <span>+45% engajamento neste período</span>
              </div>
              <div className="best-time-card__days">
                Melhores dias: <strong>Terça, Quarta e Quinta</strong>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ORGÂNICO AVANÇADO */}
      {organicError && <div className="alert alert--error">{organicError}</div>}

      <Section
        title="Tops do período (orgânico)"
        description="Publicações com maior desempenho no intervalo."
      >
        <div className="media-grid">
          {loadingOrganic ? (
            <>
              <div className="media-card media-card--loading" />
              <div className="media-card media-card--loading" />
              <div className="media-card media-card--loading" />
            </>
          ) : (
            ["post_maior_engajamento", "post_maior_alcance", "post_maior_salvamentos"].map((k) => {
              const p = organic.tops?.[k];
              if (!p) return <div key={k} className="media-card media-card--loading" />;
              return (
                <article key={k} className="media-card">
                  <a href={p.permalink || "#"} target="_blank" rel="noreferrer" className="media-card__preview">
                    {p.previewUrl ? <img src={p.previewUrl} alt={k} /> : <div className="media-card__placeholder">Prévia indisponível</div>}
                  </a>
                  <div className="media-card__body">
                    <div className="media-card__meta">
                      <span>{formatDate(p.timestamp)}</span>
                      <span>{mediaTypeLabel[p.mediaType] || p.mediaType}</span>
                    </div>
                    <div className="media-card__stats">
                      <span><Heart size={14} /> {p.likes?.toLocaleString("pt-BR")}</span>
                      <span><MessageCircle size={14} /> {p.comments?.toLocaleString("pt-BR")}</span>
                    </div>
                    <div className="media-card__footer">
                      <span className="badge">Interações: {p.total_interactions?.toLocaleString("pt-BR")}</span>
                      {p.permalink && (
                        <a className="media-card__link" href={p.permalink} target="_blank" rel="noreferrer">
                          Ver no Instagram <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </Section>

      <Section
        title="Médias por formato (orgânico)"
        description="Comparativo de desempenho médio por tipo de conteúdo."
      >
        <div className="card chart-card">
          <div>
            <h3 className="chart-card__title"><BarChart3 size={16} style={{ verticalAlign: "text-top" }} /> Engajamento médio (%)</h3>
            <p className="chart-card__subtitle">Taxa média de engajamento por formato no período.</p>
          </div>
          <div className="chart-card__viz">
            {loadingOrganic ? (
              <div className="chart-card__empty">Carregando…</div>
            ) : organic.formats?.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={organic.formats.map(f => ({ name: mediaTypeLabel[f.format] || f.format, value: f.avg_engagement_rate || 0 }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis
                    dataKey="name"
                    stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--panel)',
                      border: '1px solid var(--stroke)',
                      borderRadius: '12px',
                      padding: '8px 12px',
                      boxShadow: 'var(--shadow-lg)'
                    }}
                    cursor={{ fill: 'var(--panel-hover)' }}
                  />
                  <Bar
                    dataKey="value"
                    radius={[12, 12, 0, 0]}
                    fill="url(#igBarGradient)"
                  >
                    <defs>
                      <linearGradient id="igBarGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-card__empty">Sem dados para o período.</div>
            )}
          </div>
        </div>
      </Section>

      {organic.top_story && (
        <Section
          title="Story com maior retenção"
          description="Story que mais segurou a atenção no período (orgânico)."
        >
          <div className="card best-ad-card">
            <div className="best-ad-card__header">
              <span className="best-ad-card__title">Retenção: {organic.top_story.retention}%</span>
              <span className="best-ad-card__subtitle">
                Replay rate: {organic.top_story.replay_rate}% — {formatDate(organic.top_story.timestamp)}
              </span>
            </div>
            <div className="best-ad-card__metrics">
              <div className="best-ad-card__metric">
                <span className="best-ad-card__metric-label">Impressões</span>
                <span className="best-ad-card__metric-value">{organic.top_story.impressions.toLocaleString("pt-BR")}</span>
              </div>
              <div className="best-ad-card__metric">
                <span className="best-ad-card__metric-label">Saídas</span>
                <span className="best-ad-card__metric-value">{organic.top_story.exits.toLocaleString("pt-BR")}</span>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* POSTS RECENTES */}
      <Section
        title="Últimos posts"
        description="Percorra os destaques recentes do feed oficial."
        right={accountBadge}
      >
        {postsError && <div className="alert alert--error">{postsError}</div>}
        {loadingPosts && posts.length === 0 ? (
          <div className="table-loading">Carregando posts...</div>
        ) : posts.length > 0 ? (
          <div className="posts-table-container">
            <table className="posts-table">
              <thead>
                <tr>
                  <th>Preview</th>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Legenda</th>
                  <th>Curtidas</th>
                  <th>Comentários</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => {
                  const previewUrl = post.previewUrl || post.mediaUrl || post.thumbnailUrl;
                  const typeLabel = mediaTypeLabel[post.mediaType] || post.mediaType || "Post";
                  const publishedAt = formatDate(post.timestamp);
                  const likes = Number.isFinite(post.likeCount) ? post.likeCount : 0;
                  const comments = Number.isFinite(post.commentsCount) ? post.commentsCount : 0;

                  return (
                    <tr key={post.id}>
                      <td className="posts-table__preview">
                        {previewUrl ? (
                          <img src={previewUrl} alt={truncate(post.caption || "Post", 30)} />
                        ) : (
                          <div className="posts-table__placeholder">Sem preview</div>
                        )}
                        {post.mediaType === "VIDEO" && <Play size={12} className="posts-table__badge" />}
                      </td>
                      <td className="posts-table__date">{publishedAt}</td>
                      <td className="posts-table__type">
                        <span className="badge">{typeLabel}</span>
                      </td>
                      <td className="posts-table__caption">{truncate(post.caption, 80) || "Sem legenda"}</td>
                      <td className="posts-table__metric">
                        <Heart size={14} />
                        {likes.toLocaleString("pt-BR")}
                      </td>
                      <td className="posts-table__metric">
                        <MessageCircle size={14} />
                        {comments.toLocaleString("pt-BR")}
                      </td>
                      <td className="posts-table__action">
                        {post.permalink && (
                          <a href={post.permalink} target="_blank" rel="noreferrer" className="posts-table__link">
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Nenhum post recente encontrado.</p>
        )}
      </Section>

      {/* MARKETING API – VÍDEO */}
      <Section
        title="Insights de vídeos (pago)"
        description="Resumo de retenção em anúncios de vídeo no período."
      >
        {adsError && <div className="alert alert--error">{adsError}</div>}

        <KpiGrid>
          <MetricCard title="Views 3s" value={loadingAds ? "..." : (adsVideo.video_views_3s ?? "-")} />
          <MetricCard title="Views 10s" value={loadingAds ? "..." : (adsVideo.video_views_10s ?? "-")} />
          <MetricCard title="Thruplays" value={loadingAds ? "..." : (adsVideo.thruplays ?? "-")} />
          <MetricCard title="Tempo médio assistido" value={loadingAds ? "..." : (adsVideo.video_avg_time_watched ? `${adsVideo.video_avg_time_watched.toFixed ? adsVideo.video_avg_time_watched.toFixed(1) : adsVideo.video_avg_time_watched}s` : "-")} />
          <MetricCard title="Completion rate" value={loadingAds ? "..." : (adsVideo.video_completion_rate != null ? `${adsVideo.video_completion_rate}%` : "-")} />
        </KpiGrid>

        <div className="card chart-card">
          <div>
            <h3 className="chart-card__title">Queda por bucket (drop-off)</h3>
            <p className="chart-card__subtitle">Comparativo entre 0–3s, 3–10s e 10s–thruplay.</p>
          </div>
          <div className="chart-card__viz">
            {loadingAds ? (
              <div className="chart-card__empty">Carregando…</div>
            ) : dropData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dropData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis
                    dataKey="bucket"
                    stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--panel)',
                      border: '1px solid var(--stroke)',
                      borderRadius: '12px',
                      padding: '8px 12px',
                      boxShadow: 'var(--shadow-lg)'
                    }}
                    cursor={{ fill: 'var(--panel-hover)' }}
                  />
                  <Bar
                    dataKey="views"
                    radius={[12, 12, 0, 0]}
                    fill="url(#videoBarGradient)"
                  >
                    <defs>
                      <linearGradient id="videoBarGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-card__empty">Sem dados de vídeo no período.</div>
            )}
          </div>
        </div>
      </Section>
    </>
  );
}
