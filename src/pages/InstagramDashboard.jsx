// src/pages/InstagramDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Heart, MessageCircle, Clock, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

import Topbar from "../components/Topbar";
import Section from "../components/Section";
import MetricCard from "../components/MetricCard";
import DateRangeIndicator from "../components/DateRangeIndicator";
import useQueryState from "../hooks/useQueryState";
import { accounts } from "../data/accounts";

const API_BASE_URL = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
const DEFAULT_ACCOUNT_ID = accounts[0]?.id || "";
const CACHE_KEYS = {
  instagram_metrics: 'metrics',
  instagram_audience: 'audience',
  instagram_posts: 'posts',
  instagram_organic: 'organic',
};

const GENDER_COLORS = { male: '#6366f1', female: '#ec4899' };


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

const formatPercentage = (value) => {
  if (value == null || Number.isNaN(value)) return "-";
  return `${Number(value).toFixed(1)}%`;
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
  const [metricsMeta, setMetricsMeta] = useState({
    profileBreakdown: null,
    followerCounts: null,
  });
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState("");

  const [audience, setAudience] = useState({ cities: [], ages: [], gender: [] });
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [audienceError, setAudienceError] = useState("");

  const [posts, setPosts] = useState([]);
  const [visiblePosts, setVisiblePosts] = useState(5);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState("");
  const [accountInfo, setAccountInfo] = useState(null);

  const [cacheMeta, setCacheMeta] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    setCacheMeta({});
  }, [accountId]);

  const lastSyncAt = useMemo(() => {
    const timestamps = Object.values(cacheMeta)
      .map((meta) => {
        if (!meta?.fetched_at) return null;
        const time = new Date(meta.fetched_at).getTime();
        return Number.isFinite(time) ? time : null;
      })
      .filter((value) => value != null);
    if (!timestamps.length) return null;
    return new Date(Math.max(...timestamps)).toISOString();
  }, [cacheMeta]);

  useEffect(() => {
    if (!accountConfig?.instagramUserId) {
      setMetrics([]);
      setMetricsMeta({ profileBreakdown: null, followerCounts: null });
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
        setMetricsMeta({
          profileBreakdown: json.profile_visitors_breakdown || null,
          followerCounts: json.follower_counts || null,
        });
        if (json.cache) {
          setCacheMeta((prev) => ({
            ...prev,
            [CACHE_KEYS.instagram_metrics]: json.cache,
          }));
        }
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }
        console.error(err);
        setMetrics([]);
        setMetricsMeta({ profileBreakdown: null, followerCounts: null });
        setMetricsError(err.message || "Nao foi possivel atualizar os indicadores do Instagram.");
      } finally {
        setLoadingMetrics(false);
      }
    })();
    return () => controller.abort();
  }, [accountConfig?.instagramUserId, since, until, refreshToken]);

  useEffect(() => {
    if (!accountConfig?.instagramUserId) {
      setAudience({ cities: [], ages: [], gender: [] });
      setAudienceError("Conta do Instagram nao configurada.");
      return;
    }
    const controller = new AbortController();
    (async () => {
      setLoadingAudience(true);
      setAudienceError("");
      try {
        const params = new URLSearchParams({ igUserId: accountConfig.instagramUserId });
        const url = `${API_BASE_URL}/api/instagram/audience?${params.toString()}`;
        const resp = await fetch(url, { signal: controller.signal });
        const raw = await resp.text();
        const json = safeParseJson(raw) || {};
        if (!resp.ok) throw new Error(describeApiError(json, "Falha ao carregar audiencia do Instagram."));
        setAudience({
          cities: Array.isArray(json.cities) ? json.cities : [],
          ages: Array.isArray(json.ages) ? json.ages : [],
          gender: Array.isArray(json.gender) ? json.gender : [],
        });
        if (json.cache) {
          setCacheMeta((prev) => ({
            ...prev,
            [CACHE_KEYS.instagram_audience]: json.cache,
          }));
        }
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }
        console.error(err);
        setAudience({ cities: [], ages: [], gender: [] });
        setAudienceError(err.message || "Nao foi possivel carregar a audiencia.");
      } finally {
        setLoadingAudience(false);
      }
    })();
    return () => controller.abort();
  }, [accountConfig?.instagramUserId, refreshToken]);

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
        if (json.cache) {
          setCacheMeta((prev) => ({
            ...prev,
            [CACHE_KEYS.instagram_posts]: json.cache,
          }));
        }
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
  }, [accountConfig?.instagramUserId, refreshToken]);

  useEffect(() => {
    setVisiblePosts(5);
  }, [posts]);

  const handleManualRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const payload = {
        resources: ['instagram_metrics', 'instagram_audience', 'instagram_posts', 'instagram_organic'],
        account: {
          instagramUserId: accountConfig?.instagramUserId,
        },
        since: since ? Number(since) : null,
        until: until ? Number(until) : null,
        limit: 15,
      };

      const response = await fetch(`${API_BASE_URL}/api/sync/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const raw = await response.text();
      const json = safeParseJson(raw) || {};

      if (!response.ok) {
        throw new Error(describeApiError(json, 'Falha ao atualizar os dados do Instagram.'));
      }

      if (json.results) {
        const updates = Object.entries(json.results).reduce((acc, [resource, value]) => {
          if (value?.cache && CACHE_KEYS[resource]) {
            acc[CACHE_KEYS[resource]] = value.cache;
          }
          return acc;
        }, {});
        if (Object.keys(updates).length) {
          setCacheMeta((prev) => ({ ...prev, ...updates }));
        }
      }

      if (Array.isArray(json.errors) && json.errors.length) {
        const metricsIssue = json.errors.find((item) => item.resource === 'instagram_metrics');
        const audienceIssue = json.errors.find((item) => item.resource === 'instagram_audience');
        const postsIssue = json.errors.find((item) => item.resource === 'instagram_posts');
        if (metricsIssue?.error) setMetricsError(metricsIssue.error);
        if (audienceIssue?.error) setAudienceError(audienceIssue.error);
        if (postsIssue?.error) setPostsError(postsIssue.error);
      } else {
        setMetricsError('');
        setAudienceError('');
        setPostsError('');
      }

      setRefreshToken(Date.now());
    } catch (err) {
      console.error('Erro ao atualizar dados do Instagram manualmente', err);
      setMetricsError(err?.message || 'Nao foi possivel atualizar os dados do Instagram.');
    } finally {
      setRefreshing(false);
    }
  };

  const metricsByKey = useMemo(() => mapByKey(metrics), [metrics]);

  const profileViewsMetric = metricsByKey.profile_views;
  const interactionsMetric = metricsByKey.interactions;
  const savesMetric = metricsByKey.saves;
  const sharesMetric = metricsByKey.shares;
  const reachMetric = metricsByKey.reach;
  const followerGrowthMetric = metricsByKey.follower_growth;
  const engagementRateMetric = metricsByKey.engagement_rate;

  const interactionsValue = typeof interactionsMetric?.value === "number" ? interactionsMetric.value : null;
  const reachValue = typeof reachMetric?.value === "number" ? reachMetric.value : null;
  const computedEngagementRate = typeof engagementRateMetric?.value === "number"
    ? engagementRateMetric.value
    : (Number.isFinite(interactionsValue) && Number.isFinite(reachValue) && reachValue > 0
      ? (interactionsValue / reachValue) * 100
      : null);

  const engagementBreakdown = engagementRateMetric?.breakdown || null;

  const followerCounts = metricsMeta.followerCounts || {};
  const followerGrowthValue = typeof followerGrowthMetric?.value === "number"
    ? followerGrowthMetric.value
    : (typeof followerCounts.end === "number" && typeof followerCounts.start === "number"
      ? followerCounts.end - followerCounts.start
      : null);


  const audienceCities = useMemo(
    () => (audience?.cities || []).slice(0, 5),
    [audience],
  );

  const genderPieData = useMemo(() => {
    const source = Array.isArray(audience?.gender) ? audience.gender : [];
    const buckets = {
      female: { key: 'female', label: 'Feminino', value: 0 },
      male: { key: 'male', label: 'Masculino', value: 0 },
    };

    source.forEach((entry) => {
      const token = String(entry?.key || '').toLowerCase();
      if (token.startsWith('f')) {
        buckets.female.value += Number(entry?.value || 0);
        if (entry?.label) buckets.female.label = entry.label;
      } else if (token.startsWith('m')) {
        buckets.male.value += Number(entry?.value || 0);
        if (entry?.label) buckets.male.label = entry.label;
      }
    });

    const entries = Object.values(buckets).filter((item) => item.value > 0);
    const total = entries.reduce((sum, item) => sum + item.value, 0);
    return entries.map((item) => ({
      ...item,
      percentage: total ? Number(((item.value / total) * 100).toFixed(2)) : 0,
      color: item.key === 'female' ? GENDER_COLORS.female : GENDER_COLORS.male,
    }));
  }, [audience]);

  const hasGenderData = genderPieData.some((item) => item.value > 0);
  const genderTotalFollowers = genderPieData.reduce((sum, item) => sum + item.value, 0);
  const hasAudienceData = audienceCities.length > 0 || hasGenderData;

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
      <Topbar
        title="Instagram"
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
        showFilters={true}
        onRefresh={handleManualRefresh}
        refreshing={refreshing}
        lastSync={lastSyncAt}
      />

      <div className="page-content">
        <DateRangeIndicator />

        {metricsError && <div className="alert alert--error">{metricsError}</div>}

        <Section
          title="Visao geral do perfil"
          description="Resumo rapido de visitas, engajamento e crescimento organico do periodo selecionado."
        >
          <div className="overview-layout">
            <div className="overview-layout__cards">
              <MetricCard
                title="Visitas no perfil"
                value={formatMetricValue(profileViewsMetric, { loading: loadingMetrics })}
                delta={metricDelta(profileViewsMetric, { loading: loadingMetrics })}
                hint="Total de visitas no perfil durante o intervalo."
              />
              <MetricCard
                title="Interacoes totais"
                value={formatMetricValue(interactionsMetric, { loading: loadingMetrics })}
                delta={metricDelta(interactionsMetric, { loading: loadingMetrics })}
                hint="Somatorio de curtidas, comentarios, compartilhamentos e salvamentos."
              />
              <MetricCard
                title="Taxa de engajamento"
                value={loadingMetrics ? "..." : (computedEngagementRate != null ? `${computedEngagementRate.toFixed(2)}%` : "-")}
                hint={
                  engagementBreakdown && engagementBreakdown.total > 0
                    ? `${engagementBreakdown.likes.toLocaleString("pt-BR")} curtidas - ${engagementBreakdown.comments.toLocaleString("pt-BR")} coment. - ${engagementBreakdown.saves.toLocaleString("pt-BR")} salvamentos - ${engagementBreakdown.shares.toLocaleString("pt-BR")} compart. | Alcance: ${engagementBreakdown.reach.toLocaleString("pt-BR")}`
                    : "(Curtidas + Comentarios + Salvamentos + Compartilhamentos) dividido pelo alcance."
                }
              />
              <MetricCard
                title="Salvamentos"
                value={formatMetricValue(savesMetric, { loading: loadingMetrics })}
                hint="Quantidade de vezes que os posts foram salvos no periodo."
              />
              <MetricCard
                title="Compartilhamentos"
                value={formatMetricValue(sharesMetric, { loading: loadingMetrics })}
                hint="Compartilhamentos gerados pelos posts no periodo."
              />
              <MetricCard
                title="Crescimento de seguidores"
                value={loadingMetrics ? "..." : (followerGrowthValue != null ? followerGrowthValue.toLocaleString("pt-BR") : "-")}
                hint="Saldo de seguidores ganhados no periodo."
              />
            </div>
            <div className="overview-layout__chart">
              <div className="overview-layout__chart-compact">
                <header className="overview-layout__chart-header">
                  <h3>Genero</h3>
                </header>
                <div className="overview-layout__chart-viz overview-layout__chart-viz--compact">
                  {loadingAudience ? (
                    <div className="chart-card__empty">...</div>
                  ) : hasGenderData ? (
                    <>
                      <ResponsiveContainer width="100%" height={140}>
                        <PieChart>
                          <Pie
                            data={genderPieData}
                            dataKey="value"
                            nameKey="label"
                            innerRadius="50%"
                            outerRadius="85%"
                            paddingAngle={2}
                            stroke="none"
                          >
                            {genderPieData.map((segment) => (
                              <Cell key={segment.key} fill={segment.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="overview-layout__chart-legend">
                        {genderPieData.map((segment) => (
                          <div key={segment.key} className="overview-layout__legend-item">
                            <span className="overview-layout__legend-dot" style={{ backgroundColor: segment.color }}></span>
                            <span className="overview-layout__legend-label">{segment.label}</span>
                            <strong>{formatPercentage(segment.percentage)}</strong>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="chart-card__empty">Sem dados</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Section>

        {audienceError && <div className="alert alert--error">{audienceError}</div>}

        <div className="insights-panels">
          <Section
            title="Audiencia"
            description="Distribuicao de cidades e genero dos seguidores."
          >
            {loadingAudience ? (
              <div className="audience-card__loading">Carregando audiencia...</div>
            ) : hasAudienceData ? (
              <div className="audience-card audience-card--balanced">
                <div className="audience-card__column">
                  <h3>Principais cidades</h3>
                  <ul className="audience-ranking">
                    {audienceCities.map((city, index) => {
                      const percentage = city?.percentage ?? 0;
                      return (
                        <li key={`${city.name || "Cidade"}-${index}`} className="audience-ranking__item">
                          <span className="audience-ranking__position">{index + 1}</span>
                          <div className="audience-ranking__meta">
                            <div className="audience-ranking__top">
                              <span className="audience-ranking__name">{city?.name || "Nao informado"}</span>
                              <span className="audience-ranking__value">{formatPercentage(percentage)}</span>
                            </div>
                            <div className="audience-ranking__bar">
                              <span style={{ width: `${Math.max(percentage, 2)}%` }} />
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="audience-card__column audience-card__column--chart">
                  <h3>Genero dos seguidores</h3>
                  {hasGenderData ? (
                    <div className="audience-gender-chart">
                      <div className="audience-gender-chart__pie">
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie
                              data={genderPieData}
                              dataKey="value"
                              nameKey="label"
                              innerRadius="55%"
                              outerRadius="100%"
                              paddingAngle={2}
                              stroke="none"
                            >
                              {genderPieData.map((segment) => (
                                <Cell key={segment.key} fill={segment.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => Number(value).toLocaleString('pt-BR')} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="audience-gender-chart__total">
                          <strong>{genderTotalFollowers.toLocaleString('pt-BR')}</strong>
                          <span>Seguidores</span>
                        </div>
                      </div>
                      <ul className="audience-gender-chart__legend">
                        {genderPieData.map((segment) => (
                          <li key={segment.key}>
                            <span className="audience-gender-chart__label">
                              <span
                                className="audience-gender-chart__dot"
                                style={{ backgroundColor: segment.color }}
                              ></span>
                              {segment.label}
                            </span>
                            <strong>{formatPercentage(segment.percentage)}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="audience-card__notice">Sem dados de genero disponiveis.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="audience-card__empty">Sem dados de audiencia disponiveis.</div>
            )}
          </Section>

          <Section
            title="Melhor horario para postar"
            description="Janela com maior engajamento medio historico."
            surface={true}
          >
            <div className="best-time-card best-time-card--compact">
              <div className="best-time-card__icon">
                <Clock size={32} />
              </div>
              <div className="best-time-card__content">
                <div className="best-time-card__primary">
                  <div className="best-time-card__time">18:00 - 21:00</div>
                  <div className="best-time-card__label">Janela de melhor desempenho</div>
                </div>
                <div className="best-time-card__secondary">
                  <div className="best-time-card__metric">
                    <TrendingUp size={16} />
                    <span>+45% de engajamento</span>
                  </div>
                  <div className="best-time-card__days">
                    Dias favoraveis: <strong>Terca, Quarta e Quinta</strong>
                  </div>
                </div>
              </div>
            </div>
          </Section>
        </div>

        <Section
          title="Ultimos posts"
          description="Acompanhe o desempenho recente do feed oficial."
          right={accountBadge}
        >
          {postsError && <div className="alert alert--error">{postsError}</div>}
          {loadingPosts && posts.length === 0 ? (
            <div className="table-loading">Carregando posts...</div>
          ) : displayedPosts.length > 0 ? (
            <>
              <div className="posts-table-container">
                <table className="posts-table">
                  <thead>
  <tr>
    <th>Data postada</th>
    <th>Thumb</th>
    <th>Legenda</th>
    <th>Curtidas</th>
    <th>comentários</th>
    <th>Compartilhamentos</th>
    <th>Salvos</th>
  </tr>
</thead>

<tbody>
  {displayedPosts.map((post) => {
    const previewUrl = post.previewUrl || post.mediaUrl || post.thumbnailUrl;
    const publishedAt = formatDate(post.timestamp);
    const likes = Number.isFinite(post.likeCount) ? post.likeCount : 0;
    const comments = Number.isFinite(post.commentsCount) ? post.commentsCount : 0;

    // Alguns backends salvam em nomes diferentes; deixo fallback inteligente:
    const shares =
      [post.shareCount, post.shares, post.sharesCount]
        .find(v => Number.isFinite(v)) ?? '-';

    const saves =
      [post.saveCount, post.saves, post.saved, post.savedCount]
        .find(v => Number.isFinite(v)) ?? '-';

    return (
      <tr key={post.id}>
        {/* Data postada */}
        <td className="posts-table__date">{publishedAt}</td>

        {/* Thumb */}
        <td className="posts-table__preview">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={truncate(post.caption || "Post", 30)}
            />
          ) : (
            <div className="posts-table__placeholder">Sem preview</div>
          )}
        </td>

        {/* Legenda */}
        <td className="posts-table__caption">
          {truncate(post.caption, 80) || "Sem legenda"}
        </td>

        {/* Curtidas */}
        <td className="posts-table__metric">
          <Heart size={14} />{likes.toLocaleString("pt-BR")}
        </td>

        {/* Comentários */}
        <td className="posts-table__metric">
          <MessageCircle size={14} />{comments.toLocaleString("pt-BR")}
        </td>

        {/* Compartilhamentos */}
        <td className="posts-table__metric">
          {Number.isFinite(shares) ? shares.toLocaleString("pt-BR") : "-"}
        </td>

        {/* Salvos */}
        <td className="posts-table__metric">
          {Number.isFinite(saves) ? saves.toLocaleString("pt-BR") : "-"}
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
