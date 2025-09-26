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

const ACTION_LABELS = {
  link_click: "Cliques no link",
  outbound_click: "Cliques externos",
  post_engagement: "Engajamento",
  post_reaction: "Reacoes",
  page_engagement: "Engajamento da pagina",
  offsite_conversion: "Conversoes",
  purchases: "Compras",
  leads: "Leads",
};

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

const formatActionLabel = (type) => {
  if (!type) return "Outros";
  const label = ACTION_LABELS[type];
  if (label) return label;
  return type.replace(/_/g, " ");
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
  {
    key: "reach",
    title: "Alcance do periódo",
    hint: "Total de pessoas alcançadas organicamente.",
  },
  {
    key: "impressions",
    title: "Impressões",
    hint: "Quantidade de visualizações registradas pelos posts.",
  },
  {
    key: "post_engagement",
    title: "Interações",
    hint: "Soma de reações, comentários e compartilhamentos.",
  },
  {
    key: "profile_link_clicks",
    title: "Cliques no perfil",
    hint: "Cliques que levaram ao perfil ou site da página.",
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

  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState("");

  const [adsData, setAdsData] = useState({
    best_ad: null,
    totals: {},
    averages: {},
    actions: [],
    demographics: {},
  });
  const [adsError, setAdsError] = useState("");
  const [loadingAds, setLoadingAds] = useState(false);

  useEffect(() => {
    if (!accountConfig?.facebookPageId) {
      setPageMetrics([]);
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

  const adsTotalsCards = [
    {
      key: "spend",
      title: "Investimento",
      value: formatCurrency(Number(adsData.totals?.spend)),
    },
    {
      key: "impressions",
      title: "Impressões",
      value: formatNumber(Number(adsData.totals?.impressions)),
    },
    {
      key: "reach",
      title: "Alcance",
      value: formatNumber(Number(adsData.totals?.reach)),
    },
    {
      key: "clicks",
      title: "Cliques",
      value: formatNumber(Number(adsData.totals?.clicks)),
    },
  ];

  const adsAverageCards = [
    {
      key: "cpc",
      title: "CPC medio",
      value: formatCurrency(Number(adsData.averages?.cpc)),
    },
    {
      key: "cpm",
      title: "CPM medio",
      value: formatCurrency(Number(adsData.averages?.cpm)),
    },
    {
      key: "ctr",
      title: "CTR medio",
      value: formatPercent(Number(adsData.averages?.ctr)),
    },
    {
      key: "frequency",
      title: "Frequencia",
      value: Number.isFinite(adsData.averages?.frequency)
        ? adsData.averages.frequency.toFixed(2)
        : "-",
    },
  ];

  const bestAd = adsData.best_ad;

  const actionPieData = useMemo(() => {
    const actions = Array.isArray(adsData.actions) ? adsData.actions : [];
    const normalized = actions
      .map((item) => ({
        name: formatActionLabel(item.type),
        value: Number(item.value) || 0,
      }))
      .filter((item) => item.value > 0);
    return normalized.slice(0, 6);
  }, [adsData.actions]);

  const totalsBarData = useMemo(() => {
    const totals = adsData?.totals || {};
    return [
      { name: "Impressões", value: Number(totals.impressions) || 0 },
      { name: "Alcance", value: Number(totals.reach) || 0 },
      { name: "Cliques", value: Number(totals.clicks) || 0 },
    ];
  }, [adsData?.totals]);

  const hasPieData = actionPieData.some((item) => item.value > 0);
  const hasBarData = totalsBarData.some((item) => item.value > 0);

  const genderRows = useMemo(() => {
    const rows = (adsData?.demographics?.byGender || [])
      .map((item) => ({
        segment: item.segment || "Outros",
        reach: Number(item.reach) || 0,
        impressions: Number(item.impressions) || 0,
        spend: Number(item.spend) || 0,
      }))
      .filter((row) => row.reach > 0 || row.impressions > 0 || row.spend > 0);
    const maxReach = rows.reduce((acc, row) => Math.max(acc, row.reach), 0);
    return rows.map((row) => ({
      ...row,
      percent: maxReach ? Math.round((row.reach / maxReach) * 100) : 0,
    }));
  }, [adsData.demographics]);

  const ageRows = useMemo(() => {
    const rows = (adsData?.demographics?.byAge || [])
      .map((item) => ({
        segment: item.segment || "Outros",
        reach: Number(item.reach) || 0,
        impressions: Number(item.impressions) || 0,
        spend: Number(item.spend) || 0,
      }))
      .filter((row) => row.reach > 0 || row.impressions > 0 || row.spend > 0);
    const maxReach = rows.reduce((acc, row) => Math.max(acc, row.reach), 0);
    return rows.map((row) => ({
      ...row,
      percent: maxReach ? Math.round((row.reach / maxReach) * 100) : 0,
    }));
  }, [adsData.demographics]);

  const topSegments = useMemo(() => {
    const combos = Array.isArray(adsData?.demographics?.topSegments)
      ? adsData.demographics.topSegments
      : [];
    return combos
      .map((item) => ({
        label: `${item.age || "Indefinido"} / ${item.gender || "Indefinido"}`,
        reach: Number(item.reach) || 0,
      }))
      .filter((item) => item.reach > 0)
      .slice(0, 3);
  }, [adsData.demographics]);

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

      <Section
        title="Desempenho de anúncios"
        description="Resumo das campanhas no periódo selecionado."
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

        <div className="ads-insights-grid">
          <div className="card chart-card">
            <div>
              <h3 className="chart-card__title">Ações mais registradas</h3>
              <p className="chart-card__subtitle">Distribuição das ações capturadas no periódo</p>
            </div>
            <div className="chart-card__viz">
              {loadingAds ? (
                <div className="chart-card__empty">Carregando dados...</div>
              ) : hasPieData ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={actionPieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={4}
                    >
                      {actionPieData.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatNumber(Number(value))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="chart-card__empty">Sem dados suficientes no periódo.</div>
              )}
            </div>
          </div>

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
                <div className="chart-card__empty">Sem dados suficientes no periódo.</div>
              )}
            </div>
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
              <p className="muted">Nenhum anúncio disponível para o periódo.</p>
            )}
          </div>

          <div className="card demographics-card">
            <header className="demographics-card__header">
              <h3>Demografia</h3>
              <p>Segmentos com maior alcance</p>
            </header>
            <div className="demographics-card__body">
              <div className="demographics-card__column">
                <h4>Por gênero</h4>
                <div className="demographics-card__list">
                  {genderRows.length > 0 ? (
                    genderRows.map((row) => (
                      <div key={row.segment} className="demographics-card__item">
                        <div className="demographics-card__item-label">
                          <span>{row.segment}</span>
                          <span>{formatNumber(row.reach)}</span>
                        </div>
                        <div className="demographics-card__progress">
                          <div
                            className="demographics-card__progress-bar"
                            style={{ width: `${Math.max(row.percent || (row.reach > 0 ? 12 : 0), 0)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="muted">Sem dados.</p>
                  )}
                </div>
              </div>

              <div className="demographics-card__column">
                <h4>Por faixa etaria</h4>
                <div className="demographics-card__list">
                  {ageRows.length > 0 ? (
                    ageRows.map((row) => (
                      <div key={row.segment} className="demographics-card__item">
                        <div className="demographics-card__item-label">
                          <span>{row.segment}</span>
                          <span>{formatNumber(row.reach)}</span>
                        </div>
                        <div className="demographics-card__progress">
                          <div
                            className="demographics-card__progress-bar"
                            style={{ width: `${Math.max(row.percent || (row.reach > 0 ? 12 : 0), 0)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="muted">Sem dados.</p>
                  )}
                </div>
              </div>
            </div>
            {topSegments.length > 0 && (
              <footer className="demographics-card__footer">
                <h4>TOP combinacoes</h4>
                <div className="demographics-card__chips">
                  {topSegments.map((segment) => (
                    <span key={segment.label} className="demographics-card__badge">
                      {segment.label}
                      <strong>{formatNumber(segment.reach)}</strong>
                    </span>
                  ))}
                </div>
              </footer>
            )}
          </div>
        </div>
      </Section>

      {pageError && <div className="alert alert--error">{pageError}</div>}

      <Section
        title="Resumo orgânico"
        description="Indicadores principais da pagina no intervalo selecionado."
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
