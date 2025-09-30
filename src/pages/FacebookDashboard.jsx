// pages/FacebookDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ExternalLink, MessageCircle, Share2, ThumbsUp, Trophy } from "lucide-react";
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
  Line,
} from "recharts";
import Topbar from "../components/Topbar";
import Section from "../components/Section";
import KpiGrid from "../components/KpiGrid";
import MetricCard from "../components/MetricCard";
import useQueryState from "../hooks/useQueryState";
import { accounts } from "../data/accounts";

const API_BASE_URL = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
const DEFAULT_ACCOUNT_ID = accounts[0]?.id || "";
const PIE_COLORS = ["#2af0a3", "#8b9dff", "#f59e0b", "#f472b6", "#38bdf8", "#a855f7"];

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

const PAGE_SUMMARY_CARDS = [
  { key: "reach", title: "Alcance do período", hint: "Pessoas alcançadas (orgânico + pago)." },
  { key: "impressions", title: "Impressões", hint: "Visualizações dos posts (orgânico + pago)." },
  { key: "post_engagement", title: "Interações", hint: "Reações + comentários + compartilhamentos." },
  { key: "profile_link_clicks", title: "Cliques em links", hint: "Cliques em links nos posts (proxy)." },
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
  const [pageSeries, setPageSeries] = useState([]);
  const [pageSplits, setPageSplits] = useState({ impressions: {}, reach: {}, engagement: {} });

  const [posts, setPosts] = useState([]);
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
      setPageSeries([]);
      setPageSplits({ impressions: {}, reach: {}, engagement: {} });
      setPageError("Pagina do Facebook nao configurada.");
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
          throw new Error(describeApiError(json, "Falha ao carregar metricas de pagina."));
        }
        setPageMetrics(json.metrics || []);
        setPageSeries(Array.isArray(json.series) ? json.series : []);
        setPageSplits(json.splits || { impressions: {}, reach: {}, engagement: {} });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(err);
          setPageError(err.message || "Nao foi possivel carregar as metricas de pagina.");
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
      setPosts([]);
      setPostsError("Pagina do Facebook nao configurada.");
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
        const url = `${API_BASE_URL}/api/facebook/posts?${params.toString()}`;
        const response = await fetch(url, { signal: controller.signal });
        const raw = await response.text();
        const json = safeParseJson(raw) || {};
        if (!response.ok) {
          throw new Error(describeApiError(json, "Falha ao carregar posts do Facebook."));
        }
        setPosts(json.posts || []);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(err);
          setPostsError(err.message || "Nao foi possivel carregar os posts recentes.");
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
      setAdsError("Conta de anuncios nao configurada.");
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
          throw new Error(describeApiError(json, "Falha ao carregar metricas de anuncios."));
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
          setAdsError(err.message || "Nao foi possivel carregar os destaques de anuncios.");
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

  const formatMetric = (metric) => {
    if (loadingPage) return "...";
    if (!metric) return "-";
    const { value } = metric;
    if (value == null) return "-";
    return typeof value === "number" ? value.toLocaleString("pt-BR") : String(value);
  };

  const renderFbPostCard = (post) => (
    <article key={post.id} className="media-card">
      <a
        href={post.permalink || "#"}
        target="_blank"
        rel="noreferrer"
        className="media-card__preview"
        aria-label="Abrir publicacao no Facebook"
      >
        {post.previewUrl ? (
          <img src={post.previewUrl} alt={truncate(post.message || "Publicacao do Facebook", 80)} loading="lazy" />
        ) : (
          <div className="media-card__placeholder">Previa indisponivel</div>
        )}
      </a>
      <div className="media-card__body">
        <header className="media-card__meta">
          <span>{formatDate(post.timestamp) || "Data indisponivel"}</span>
        </header>
        <p className="media-card__caption">{truncate(post.message, 200) || "Sem descricao."}</p>
        <footer className="media-card__footer">
          <div className="media-card__stats">
            {Number.isFinite(post.reactions) && (
              <span>
                <ThumbsUp size={14} /> {formatNumber(post.reactions)}
              </span>
            )}
            {Number.isFinite(post.comments) && (
              <span>
                <MessageCircle size={14} /> {formatNumber(post.comments)}
              </span>
            )}
            {Number.isFinite(post.shares) && (
              <span>
                <Share2 size={14} /> {formatNumber(post.shares)}
              </span>
            )}
          </div>
          {post.permalink && (
            <a href={post.permalink} target="_blank" rel="noreferrer" className="media-card__link">
              Ver no Facebook <ExternalLink size={14} />
            </a>
          )}
        </footer>
      </div>
    </article>
  );

  // ======= Dados para gráficos da seção Orgânico =======
  const impressionsSplitData = useMemo(() => {
    const paid = Number(pageSplits?.impressions?.paid || 0);
    const organic = Number(pageSplits?.impressions?.organic || 0);
    return [
      { name: "Pago", value: paid },
      { name: "Orgânico", value: organic },
    ].filter((x) => x.value > 0);
  }, [pageSplits]);

  const engagementPieData = useMemo(() => {
    const e = pageSplits?.engagement || {};
    return [
      { name: "Curtidas", value: Number(e.reactions || 0) },
      { name: "Comentários", value: Number(e.comments || 0) },
      { name: "Compart.", value: Number(e.shares || 0) },
    ].filter((x) => x.value > 0);
  }, [pageSplits]);

  const hasImpressionsSplit = impressionsSplitData.reduce((a, b) => a + b.value, 0) > 0;
  const hasEngagementSplit = engagementPieData.reduce((a, b) => a + b.value, 0) > 0;

  // Série para linha (alcance orgânico x pago + impressões totais)
  const lineSeries = useMemo(() => {
    return (pageSeries || []).map((d) => ({
      date: d.date,
      reach_org: Number(d.reach_organic || 0),
      reach_paid: Number(d.reach_paid || 0),
      impressions: Number(d.impressions || 0),
    }));
  }, [pageSeries]);

  // ======= Métricas de ADS (já existiam) =======
  const adsTotalsCards = [
    { key: "spend", title: "Investimento", value: formatCurrency(Number(adsData.totals?.spend)) },
    { key: "impressions", title: "Impressões", value: formatNumber(Number(adsData.totals?.impressions)) },
    { key: "reach", title: "Alcance", value: formatNumber(Number(adsData.totals?.reach)) },
    { key: "clicks", title: "Cliques", value: formatNumber(Number(adsData.totals?.clicks)) },
  ];

  const adsAverageCards = [
    { key: "cpc", title: "CPC médio", value: formatCurrency(Number(adsData.averages?.cpc)) },
    { key: "cpm", title: "CPM médio", value: formatCurrency(Number(adsData.averages?.cpm)) },
    { key: "ctr", title: "CTR médio", value: formatPercent(Number(adsData.averages?.ctr)) },
    {
      key: "frequency",
      title: "Frequência",
      value: Number.isFinite(adsData.averages?.frequency) ? adsData.averages.frequency.toFixed(2) : "-",
    },
  ];

  const bestAd = adsData.best_ad;

  const totalsBarData = useMemo(() => {
    const totals = adsData?.totals || {};
    return [
      { name: "Impressões", value: Number(totals.impressions) || 0 },
      { name: "Alcance", value: Number(totals.reach) || 0 },
      { name: "Cliques", value: Number(totals.clicks) || 0 },
    ];
  }, [adsData?.totals]);

  const hasBarData = totalsBarData.some((item) => item.value > 0);

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
          {PAGE_SUMMARY_CARDS.map(({ key, title, hint }) => (
            <MetricCard
              key={key}
              title={title}
              value={formatMetric(pageMetricsByKey[key])}
              delta={loadingPage ? null : pageMetricsByKey[key]?.deltaPct}
              hint={hint}
            />
          ))}
        </KpiGrid>

        {/* Linha: Alcance Orgânico x Pago + Impressões */}
        <div className="card chart-card">
          <div>
            <h3 className="chart-card__title">Evolução do alcance e impressões</h3>
            <p className="chart-card__subtitle">Orgânico x Pago (alcance) e total de impressões</p>
          </div>
          <div className="chart-card__viz">
            {loadingPage ? (
              <div className="chart-card__empty">Carregando dados...</div>
            ) : lineSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={lineSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--stroke-40)" />
                  <XAxis dataKey="date" stroke="var(--text-muted)" />
                  <YAxis tickFormatter={formatShortNumber} stroke="var(--text-muted)" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="reach_org" name="Alcance (Orgânico)" dot={false} stroke="#2af0a3" />
                  <Line type="monotone" dataKey="reach_paid" name="Alcance (Pago)" dot={false} stroke="#8b9dff" />
                  <Line type="monotone" dataKey="impressions" name="Impressões (total)" dot={false} stroke="#f59e0b" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-card__empty">Sem dados suficientes no período.</div>
            )}
          </div>
        </div>

        {/* Pizza: Distribuição de Engajamento */}
        <div className="ads-insights-grid">
          <div className="card chart-card">
            <div>
              <h3 className="chart-card__title">Distribuição de engajamento</h3>
              <p className="chart-card__subtitle">Curtidas, comentários e compartilhamentos</p>
            </div>
            <div className="chart-card__viz">
              {loadingPage ? (
                <div className="chart-card__empty">Carregando dados...</div>
              ) : hasEngagementSplit ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={engagementPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label
                    >
                      {engagementPieData.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="chart-card__empty">Sem dados de engajamento.</div>
              )}
            </div>
          </div>

          {/* Pizza: Impressões – Orgânico x Pago */}
          <div className="card chart-card">
            <div>
              <h3 className="chart-card__title">Impressões por origem</h3>
              <p className="chart-card__subtitle">Orgânico x Pago</p>
            </div>
            <div className="chart-card__viz">
              {loadingPage ? (
                <div className="chart-card__empty">Carregando dados...</div>
              ) : hasImpressionsSplit ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={impressionsSplitData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label
                    >
                      {impressionsSplitData.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="chart-card__empty">Sem dados de origem de impressões.</div>
              )}
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Desempenho de anúncios"
        description="Resumo das campanhas no período selecionado."
      >
        {adsError && <div className="alert alert--error">{adsError}</div>}
        <KpiGrid>
          {adsTotalsCards.map(({ key, title, value }) => (
            <MetricCard key={key} title={title} value={loadingAds ? "..." : value} />
          ))}
        </KpiGrid>
        <KpiGrid>
          {adsAverageCards.map(({ key, title, value }) => (
            <MetricCard key={key} title={title} value={loadingAds ? "..." : value} />
          ))}
        </KpiGrid>

        <div className="card chart-card">
          <div>
            <h3 className="chart-card__title">Volume por indicador</h3>
            <p className="chart-card__subtitle">Comparativo de impressões, alcance e cliques</p>
          </div>
          <div className="chart-card__viz">
            {loadingAds ? (
              <div className="chart-card__empty">Carregando dados...</div>
            ) : hasBarData ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={totalsBarData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--stroke-40)" />
                  <XAxis dataKey="name" stroke="var(--text-muted)" />
                  <YAxis tickFormatter={formatShortNumber} stroke="var(--text-muted)" />
                  <Tooltip formatter={(value) => formatNumber(Number(value))} />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]} fill="var(--accent2)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-card__empty">Sem dados suficientes no período.</div>
            )}
          </div>
        </div>

        <div className="ads-insights-grid ads-insights-grid--compact">
          <div className="card best-ad-card">
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
              <p className="muted">Carregando dados do Gerenciador de Anuncios...</p>
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
        title="Últimos posts"
        description="Publicações recentes da página do Facebook."
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
            {posts.map((post) => renderFbPostCard(post))}
          </div>
        ) : (
          <p className="muted">Nenhum post encontrado para o intervalo selecionado.</p>
        )}
      </Section>
    </>
  );
}
