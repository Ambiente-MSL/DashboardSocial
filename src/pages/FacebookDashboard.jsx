// pages/FacebookDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ArrowDown, ArrowUp, ExternalLink, MessageCircle, Share2, ThumbsUp, Trophy } from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line
} from "recharts";
import Topbar from "../components/Topbar";
import Section from "../components/Section";
import KpiGrid from "../components/KpiGrid";
import MetricCard from "../components/MetricCard";
import useQueryState from "../hooks/useQueryState";
import { accounts } from "../data/accounts";

const API_BASE_URL = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
const DEFAULT_ACCOUNT_ID = accounts[0]?.id || "";
const PIE_COLORS = ["#06b6d4", "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

const toNumber = (value) => {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const toIsoDate = (value) => {
  const num = toNumber(value);
  if (!Number.isFinite(num)) return null;
  const ms = num > 1_000_000_000_000 ? num : num * 1000;
  return new Date(ms).toISOString().slice(0, 10);
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

const formatShortNumber = (value) => {
  if (!Number.isFinite(value)) return "0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString("pt-BR");
};

const FACEBOOK_CARD_CONFIG = [
  {
    key: "reach",
    title: "Alcance orgânico",
    hint: "Pessoas alcançadas no período.",
  },
  {
    key: "post_engagement_total",
    title: "Engajamento Post",
    hint: "Reações + comentários + compartilhamentos.",
    type: "engagement",
  },
  {
    key: "video_views_10s",
    title: 'Views de 10+ seg - "ficou interessado"',
    hint: "Quantidade de pessoas que assistiram pelo menos 10 segundos.",
  },
  {
    key: "video_views_1m",
    title: 'Views de 1+ min - "realmente assistiu"',
    hint: "Visualizações acima de um minuto.",
  },
  {
    key: "video_avg_watch_time",
    title: "Tempo médio de visualização",
    hint: "Duração média assistida por pessoa.",
    format: "duration",
  },
  {
    key: "video_watch_time_total",
    title: "Soma total de tempo assistido",
    hint: "Tempo acumulado de visualização dos vídeos.",
    format: "duration",
  },
];

const POST_HIGHLIGHT_CONFIG = [
  {
    key: "post_top_engagement",
    label: "Post campeão absoluto de engajamento",
    metricKey: "engagementTotal",
    metricLabel: "Engajamento total",
  },
  {
    key: "post_top_reach",
    label: "Post que alcançou mais pessoas",
    metricKey: "reach",
    metricLabel: "Alcance",
  },
  {
    key: "post_top_shares",
    label: "Post mais compartilhado (potencial viral)",
    metricKey: "shares",
    metricLabel: "Compartilhamentos",
  },
  {
    key: "post_top_comments",
    label: "Post que gerou mais discussão",
    metricKey: "comments",
    metricLabel: "Comentários",
  },
];

const formatDate = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
};

const truncate = (text, length = 180) => {
  if (!text) return "";
  if (text.length <= length) return text;
  return `${text.slice(0, length - 3)}...`;
};

const formatNumber = (value) => {
  if (!Number.isFinite(value)) return "-";
  return Math.trunc(value).toLocaleString("pt-BR");
};

const formatDuration = (value) => {
  if (!Number.isFinite(value)) return "-";
  let seconds = Math.round(Math.max(0, Number(value)));
  if (seconds > 1_000_000) {
    seconds = Math.round(seconds / 1000);
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  if (minutes > 0) {
    return `${minutes}min ${remaining}s`;
  }
  return `${remaining}s`;
};

const formatPercent = (value) => {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(2)}%`;
};

const formatCurrency = (value) => {
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export default function FacebookDashboard() {
  const { sidebarOpen, toggleSidebar } = useOutletContext();
  const [get] = useQueryState({ account: DEFAULT_ACCOUNT_ID });
  const accountId = get("account") || DEFAULT_ACCOUNT_ID;
  const accountConfig = useMemo(
    () => accounts.find((item) => item.id === accountId) || accounts[0],
    [accountId],
  );

  const since = get("since");
  const until = get("until");

  const [pageMetrics, setPageMetrics] = useState([]);
  const [pageError, setPageError] = useState("");
  const [loadingPage, setLoadingPage] = useState(false);
  const [pageBreakdowns, setPageBreakdowns] = useState({ engagement: {}, video: {} });

  const [postHighlights, setPostHighlights] = useState({});
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState("");

  const [adsData, setAdsData] = useState({
    best_ad: null,
    totals: {},
    averages: {},
    actions: [],
    demographics: {},
    ads_breakdown: [],
  });
  const [adsError, setAdsError] = useState("");
  const [loadingAds, setLoadingAds] = useState(false);

  useEffect(() => {
    if (!accountConfig?.facebookPageId) {
      setPageMetrics([]);
      setPageBreakdowns({ engagement: {}, video: {} });
      setPageError("Página do Facebook não configurada.");
      return;
    }

    const controller = new AbortController();

    const loadMetrics = async () => {
      setLoadingPage(true);
      setPageError("");
      try {
        const params = new URLSearchParams();
        params.set("pageId", accountConfig.facebookPageId);
        if (since) params.set("since", since);
        if (until) params.set("until", until);

        const url = `${API_BASE_URL}/api/facebook/metrics?${params.toString()}`;
        const response = await fetch(url, { signal: controller.signal });
        const raw = await response.text();
        const json = safeParseJson(raw) || {};
        if (!response.ok) {
          throw new Error(describeApiError(json, "Falha ao carregar métricas de página."));
        }
        setPageMetrics(json.metrics || []);
        setPageBreakdowns(json.breakdowns || { engagement: {}, video: {} });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(err);
          setPageMetrics([]);
          setPageBreakdowns({ engagement: {}, video: {} });
          setPageError(err.message || "Não foi possível carregar as métricas de página.");
        }
      } finally {
        setLoadingPage(false);
      }
    };

    loadMetrics();
    return () => controller.abort();
  }, [accountConfig?.facebookPageId, since, until]);

  useEffect(() => {
    if (!accountConfig?.facebookPageId) {
      setPostHighlights({});
      setPostsError("Página do Facebook não configurada.");
      return;
    }

    const controller = new AbortController();

    const loadPosts = async () => {
      setLoadingPosts(true);
      setPostsError("");
      try {
        const params = new URLSearchParams({
          pageId: accountConfig.facebookPageId,
          limit: "10",
        });
        const url = `${API_BASE_URL}/api/facebook/posts?${params.toString()}`;
        const response = await fetch(url, { signal: controller.signal });
        const raw = await response.text();
        const json = safeParseJson(raw) || {};
        if (!response.ok) {
          throw new Error(describeApiError(json, "Falha ao carregar posts do Facebook."));
        }
        setPostHighlights(json.highlights || {});
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(err);
          setPostHighlights({});
          setPostsError(err.message || "Não foi possível carregar os posts recentes.");
        }
      } finally {
        setLoadingPosts(false);
      }
    };

    loadPosts();
    return () => controller.abort();
  }, [accountConfig?.facebookPageId]);

  useEffect(() => {
    if (!accountConfig?.adAccountId) {
      setAdsData({
        best_ad: null,
        totals: {},
        averages: {},
        actions: [],
        demographics: {},
        ads_breakdown: [],
      });
      setAdsError("Conta de anúncios não configurada.");
      return;
    }

    const controller = new AbortController();

    const loadAds = async () => {
      setLoadingAds(true);
      setAdsError("");
      try {
        const params = new URLSearchParams({
          actId: accountConfig.adAccountId,
        });
        const isoSince = since ? toIsoDate(since) : null;
        const isoUntil = until ? toIsoDate(until) : null;
        if (isoSince) params.set("since", isoSince);
        if (isoUntil) params.set("until", isoUntil);

        const url = `${API_BASE_URL}/api/ads/highlights?${params.toString()}`;
        const response = await fetch(url, { signal: controller.signal });
        const raw = await response.text();
        const json = safeParseJson(raw) || {};
        if (!response.ok) {
          throw new Error(describeApiError(json, "Falha ao carregar métricas de anúncios."));
        }
        setAdsData({
          best_ad: null,
          totals: {},
          averages: {},
          actions: [],
          demographics: {},
          ads_breakdown: [],
          ...json,
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(err);
          setAdsError(err.message || "Não foi possível carregar os destaques de anúncios.");
        }
      } finally {
        setLoadingAds(false);
      }
    };

    loadAds();
    return () => controller.abort();
  }, [accountConfig?.adAccountId, since, until]);

  const pageMetricsByKey = useMemo(() => {
    const map = {};
    pageMetrics.forEach((metric) => {
      if (metric?.key) map[metric.key] = metric;
    });
    return map;
  }, [pageMetrics]);

  const formatMetricValue = (metric, config) => {
    if (!metric) return "-";
    const raw = metric.value;
    if (raw == null) return "-";
    if (config?.format === "duration") {
      return formatDuration(raw);
    }
    if (Number.isFinite(raw)) {
      return formatNumber(raw);
    }
    return String(raw);
  };

  const renderEngagementBreakdown = (metric) => {
    const breakdown = metric?.breakdown || {};
    const items = [
      { key: "reactions", label: "Reações" },
      { key: "comments", label: "Comentários" },
      { key: "shares", label: "Compart." },
    ]
      .map((item) => ({ ...item, value: Number(breakdown[item.key] || 0) }))
      .filter((item) => item.value > 0);
    if (!items.length) return null;
    return (
      <ul className="metric-card__list">
        {items.map((item) => (
          <li key={item.key}>
            {item.label}: {formatNumber(item.value)}
          </li>
        ))}
      </ul>
    );
  };

  const cardItems = useMemo(
    () =>
      FACEBOOK_CARD_CONFIG.map((config) => {
        const metric = pageMetricsByKey[config.key];
        return {
          ...config,
          value: loadingPage ? "..." : formatMetricValue(metric, config),
          delta: loadingPage ? null : metric?.deltaPct ?? null,
          extra: !loadingPage && config.type === "engagement" ? renderEngagementBreakdown(metric) : null,
        };
      }),
    [pageMetricsByKey, loadingPage],
  );

  // ======= Dados para gráficos da seção Orgânico =======
  const pageEngagementBreakdown = pageBreakdowns?.engagement || {};
  const engagementPieData = useMemo(() => {
    const reactions = Number(pageEngagementBreakdown.reactions || 0);
    const comments = Number(pageEngagementBreakdown.comments || 0);
    const shares = Number(pageEngagementBreakdown.shares || 0);
    return [
      { name: "Curtidas", value: reactions },
      { name: "Comentários", value: comments },
      { name: "Compart.", value: shares },
    ].filter((item) => item.value > 0);
  }, [pageBreakdowns]);

  const pageVideoBreakdown = pageBreakdowns?.video || {};
  const videoPieData = useMemo(() => {
    const watchers10s = Number(pageVideoBreakdown.views_10s || 0);
    const watchers1m = Number(pageVideoBreakdown.views_1m || 0);
    return [
      { name: "10s+", value: watchers10s },
      { name: "1min+", value: watchers1m },
    ].filter((item) => item.value > 0);
  }, [pageBreakdowns]);

  const hasEngagementSplit = engagementPieData.reduce((total, item) => total + item.value, 0) > 0;
  const hasVideoSplit = videoPieData.reduce((total, item) => total + item.value, 0) > 0;

  const hasHighlights = useMemo(
    () => Object.values(postHighlights || {}).some((item) => item && (item.id || item.metricValue != null)),
    [postHighlights],
  );

  // ======= Métricas de ADS com porcentagens e setas =======
  const adsTotalsCards = useMemo(() => {
    const totals = adsData.totals || {};
    return [
      {
        key: "spend",
        title: "Investimento",
        value: formatCurrency(Number(totals.spend)),
        change: totals.spend_change_pct
      },
      {
        key: "impressions",
        title: "Impressões",
        value: formatNumber(Number(totals.impressions)),
        change: totals.impressions_change_pct
      },
      {
        key: "reach",
        title: "Alcance",
        value: formatNumber(Number(totals.reach)),
        change: totals.reach_change_pct
      },
      {
        key: "clicks",
        title: "Cliques",
        value: formatNumber(Number(totals.clicks)),
        change: totals.clicks_change_pct
      },
    ];
  }, [adsData.totals]);

  const adsAverageCards = useMemo(() => {
    const averages = adsData.averages || {};
    return [
      {
        key: "cpc",
        title: "CPC médio",
        value: formatCurrency(Number(averages.cpc)),
        change: averages.cpc_change_pct
      },
      {
        key: "cpm",
        title: "CPM médio",
        value: formatCurrency(Number(averages.cpm)),
        change: averages.cpm_change_pct
      },
      {
        key: "ctr",
        title: "CTR médio",
        value: formatPercent(Number(averages.ctr)),
        change: averages.ctr_change_pct
      },
      {
        key: "frequency",
        title: "Frequência",
        value: Number.isFinite(averages.frequency) ? averages.frequency.toFixed(2) : "-",
        change: averages.frequency_change_pct
      },
    ];
  }, [adsData.averages]);

  const renderChangeIndicator = (change) => {
    if (!Number.isFinite(change)) return null;
    const isPositive = change >= 0;
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '12px',
        fontWeight: '600',
        color: isPositive ? 'var(--success-bright)' : 'var(--danger)',
        marginTop: '4px'
      }}>
        {isPositive ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
        {Math.abs(change).toFixed(1)}%
      </div>
    );
  };

  const bestAd = adsData.best_ad;

  // Gráfico horizontal de barras (Impressões, Alcance, Cliques)
  const volumeBarData = useMemo(() => {
    const totals = adsData?.totals || {};
    return [
      { name: "Impressões", value: Number(totals.impressions) || 0, color: "#06b6d4" },
      { name: "Alcance", value: Number(totals.reach) || 0, color: "#6366f1" },
      { name: "Cliques", value: Number(totals.clicks) || 0, color: "#8b5cf6" },
    ];
  }, [adsData?.totals]);

  const hasVolumeData = volumeBarData.some((item) => item.value > 0);

  // Comparação Orgânico x Pago
  const organicVsPaidData = useMemo(() => {
    const organicReach = Number(pageMetricsByKey.reach?.value || 0);
    const organicEngagement = Number(pageMetricsByKey.post_engagement_total?.value || 0);
    const paidReach = Number(adsData.totals?.reach || 0);
    const paidClicks = Number(adsData.totals?.clicks || 0);

    return [
      { name: "Alcance", Orgânico: organicReach, Pago: paidReach },
      { name: "Engajamento/Cliques", Orgânico: organicEngagement, Pago: paidClicks },
    ];
  }, [pageMetricsByKey, adsData.totals]);

  const hasOrgVsPaidData = organicVsPaidData.some(item => item.Orgânico > 0 || item.Pago > 0);

  const bestAdMetrics = useMemo(() => {
    if (!bestAd) return [];
    return [
      { label: "CTR", value: formatPercent(Number(bestAd.ctr)) },
      { label: "Impressões", value: formatNumber(Number(bestAd.impressions)) },
      { label: "Cliques", value: formatNumber(Number(bestAd.clicks)) },
      { label: "Investimento", value: formatCurrency(Number(bestAd.spend)) },
    ];
  }, [bestAd]);

  return (
    <>
      <Topbar title="Facebook" sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />

      {pageError && <div className="alert alert--error">{pageError}</div>}

      <Section
        title="Resumo orgânico"
        description="Indicadores principais da página (intervalo selecionado)."
      >
        <KpiGrid>
          {cardItems.map(({ key, title, hint, value, delta, extra }) => (
            <MetricCard key={key} title={title} value={value} delta={delta} hint={hint}>
              {extra}
            </MetricCard>
          ))}
        </KpiGrid>

      </Section>

      <Section
        title="Últimos posts"
        description="Destaques recentes da página do Facebook."
      >
        {postsError && <div className="alert alert--error">{postsError}</div>}
        {loadingPosts && !hasHighlights && (
          <div className="media-grid">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="media-card media-card--loading" />
            ))}
          </div>
        )}
        {hasHighlights ? (
          <div className="card post-highlights-card">
            <table className="post-highlights-table">
              <thead>
                <tr>
                  <th className="post-highlights-table__label">Destaque</th>
                  <th className="post-highlights-table__preview">Preview</th>
                  <th className="post-highlights-table__metrics">Indicadores</th>
                  <th className="post-highlights-table__action">Ação</th>
                </tr>
              </thead>
              <tbody>
                {POST_HIGHLIGHT_CONFIG.map((item) => {
                  const post = postHighlights?.[item.key];
                  const rawValue = post?.[item.metricKey];
                  const primaryValue = Number.isFinite(rawValue) ? formatNumber(rawValue) : '-';
                  return (
                    <tr key={item.key}>
                      <td className="post-highlights-table__label">{item.label}</td>
                      <td className="post-highlights-table__preview">
                        {post?.previewUrl ? (
                          <img src={post.previewUrl} alt={truncate(post.message || 'Publicação do Facebook', 80)} />
                        ) : (
                          <div className="post-highlights-table__placeholder">Sem imagem</div>
                        )}
                      </td>
                      <td className="post-highlights-table__metrics">
                        <div className="post-highlights-table__metric">
                          <strong>{item.metricLabel}:</strong> {primaryValue}
                        </div>
                        {item.key === 'post_top_engagement' && post ? (
                          <div className="post-highlights-table__metric-group">
                            <span><ThumbsUp size={14} /> {formatNumber(post.reactions)} curtidas</span>
                            <span><MessageCircle size={14} /> {formatNumber(post.comments)} comentários</span>
                            <span><Share2 size={14} /> {formatNumber(post.shares)} compartilhamentos</span>
                          </div>
                        ) : (
                          <div className="post-highlights-table__metric-secondary">
                            {post?.timestamp ? `Publicado em ${formatDate(post.timestamp)}` : 'Data indisponível'}
                          </div>
                        )}
                      </td>
                      <td className="post-highlights-table__action">
                        {post?.permalink ? (
                          <a href={post.permalink} target="_blank" rel="noreferrer">
                            Ver <ExternalLink size={14} />
                          </a>
                        ) : (
                          <span className="muted">Sem link</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : !loadingPosts ? (
          <p className="muted">Nenhum post encontrado para o intervalo selecionado.</p>
        ) : null}
      </Section>

      <Section
        title="Desempenho de anúncios"
        description="Resumo das campanhas no período selecionado."
      >
        {adsError && <div className="alert alert--error">{adsError}</div>}

        <KpiGrid>
          {adsTotalsCards.map(({ key, title, value, change }) => (
            <MetricCard key={key} title={title} value={loadingAds ? "..." : value}>
              {!loadingAds && renderChangeIndicator(change)}
            </MetricCard>
          ))}
        </KpiGrid>

        <KpiGrid>
          {adsAverageCards.map(({ key, title, value, change }) => (
            <MetricCard key={key} title={title} value={loadingAds ? "..." : value}>
              {!loadingAds && renderChangeIndicator(change)}
            </MetricCard>
          ))}
        </KpiGrid>

        <div className="ads-insights-grid">
          <div className="card chart-card" style={{ minHeight: '280px' }}>
            <div>
              <h3 className="chart-card__title">Volume por indicador</h3>
              <p className="chart-card__subtitle">Comparativo de impressões, alcance e cliques</p>
            </div>
            <div className="chart-card__viz" style={{ minHeight: '200px' }}>
              {loadingAds ? (
                <div className="chart-card__empty">Carregando dados...</div>
              ) : hasVolumeData ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={volumeBarData} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
                    <XAxis type="number" tickFormatter={formatShortNumber} stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} width={100} />
                    <Tooltip
                      formatter={(value) => formatNumber(Number(value))}
                      contentStyle={{
                        backgroundColor: 'var(--panel)',
                        border: '1px solid var(--stroke)',
                        borderRadius: '12px',
                        padding: '8px 12px',
                        boxShadow: 'var(--shadow-lg)'
                      }}
                      cursor={{ fill: 'var(--panel-hover)' }}
                    />
                    <Bar dataKey="value" radius={[0, 12, 12, 0]}>
                      {volumeBarData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="chart-card__empty">Sem dados suficientes no período.</div>
              )}
            </div>
          </div>

          <div className="card best-ad-card" style={{ minHeight: '280px' }}>
            <div className="best-ad-card__header">
              <span className="best-ad-card__title">
                <Trophy size={18} />
                Melhor anúncio
              </span>
              <span className="best-ad-card__subtitle">
                {loadingAds ? "..." : bestAd?.ad_name || "Sem dados"}
              </span>
            </div>
            {loadingAds ? (
              <p className="muted">Carregando dados do Gerenciador de Anúncios...</p>
            ) : bestAd ? (
              <div className="best-ad-card__metrics">
                {bestAdMetrics.map((metric) => (
                  <div key={metric.label} className="best-ad-card__metric">
                    <span className="best-ad-card__metric-label">{metric.label}</span>
                    <span className="best-ad-card__metric-value">{metric.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Nenhum anúncio disponível para o período.</p>
            )}
          </div>
        </div>
      </Section>

      <Section
        title="Orgânico x Pago"
        description="Comparativo de desempenho entre conteúdo orgânico e anúncios pagos."
      >
        <div className="card chart-card">
          <div>
            <h3 className="chart-card__title">Alcance e Engajamento</h3>
            <p className="chart-card__subtitle">Comparação entre orgânico e pago</p>
          </div>
          <div className="chart-card__viz">
            {(loadingPage || loadingAds) ? (
              <div className="chart-card__empty">Carregando dados...</div>
            ) : hasOrgVsPaidData ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={organicVsPaidData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis
                    dataKey="name"
                    stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  />
                  <YAxis
                    tickFormatter={formatShortNumber}
                    stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value) => formatNumber(Number(value))}
                    contentStyle={{
                      backgroundColor: 'var(--panel)',
                      border: '1px solid var(--stroke)',
                      borderRadius: '12px',
                      padding: '8px 12px',
                      boxShadow: 'var(--shadow-lg)'
                    }}
                    cursor={{ fill: 'var(--panel-hover)' }}
                  />
                  <Legend />
                  <Bar dataKey="Orgânico" fill="#10b981" radius={[12, 12, 0, 0]} />
                  <Bar dataKey="Pago" fill="#6366f1" radius={[12, 12, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-card__empty">Sem dados suficientes no período.</div>
            )}
          </div>
        </div>
      </Section>
    </>
  );
}
