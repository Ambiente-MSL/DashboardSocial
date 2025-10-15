// pages/FacebookDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ArrowDown, ArrowUp, Heart, MessageCircle, Share2 } from "lucide-react";
import {
  ResponsiveContainer,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line
} from "recharts";
import Topbar from "../components/Topbar";
import MetricCard from "../components/MetricCard";
import Section from "../components/Section";
import DateRangePicker from "../components/DateRangePicker";
import AccountSelect from "../components/AccountSelect";
import FilterButton from "../components/FilterButton";
import useQueryState from "../hooks/useQueryState";
import { accounts } from "../data/accounts";

const API_BASE_URL = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
const DEFAULT_ACCOUNT_ID = accounts[0]?.id || "";
const CACHE_KEYS = {
  facebook_metrics: "facebookMetrics",
  ads_highlights: "adsHighlights",
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

const formatShortNumber = (value) => {
  if (!Number.isFinite(value)) return "0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString("pt-BR");
};

const formatDateLabel = (isoDate) => {
  if (!isoDate) return "";
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
};

const formatDateFull = (isoDate) => {
  if (!isoDate) return "";
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
};

const formatSignedNumber = (value) => {
  if (!Number.isFinite(value) || value === 0) return '0';
  const formatted = Math.abs(Math.trunc(value)).toLocaleString('pt-BR');
  return `${value > 0 ? '+' : '-'}${formatted}`;
};

const FACEBOOK_CARD_CONFIG = [
  {
    key: "reach",
    title: "Alcance orgânico",
    hint: "Pessoas alcancadas no período.",
    group: "primary",
    order: 1,
  },
  {
    key: "post_engagement_total",
    title: "Engajamento total",
    hint: "Reações, comentários e compartilhamentos em posts.",
    type: "engagement",
    group: "primary",
    order: 2,
  },
  {
    key: "page_views",
    title: "Visualizações da página",
    hint: "Visualizações registradas na página.",
    group: "primary",
    order: 3,
  },
  {
    key: "content_activity",
    title: "Interações totais",
    hint: "Somatório de cliques, reações e engajamentos.",
    group: "engagement",
    order: 1,
    hidden: true,
  },
  {
    key: "cta_clicks",
    title: "Cliques em CTA",
    hint: "Cliques em botões de call-to-action.",
    group: "engagement",
    order: 2,
    hidden: true,
  },
  {
    key: "post_clicks",
    title: "Cliques em posts",
    hint: "Cliques gerados pelos posts publicados.",
    group: "engagement",
    order: 3,
    hidden: true,
  },
  {
    key: "followers_total",
    title: "Seguidores da página",
    hint: "Total de seguidores no final do período selecionado.",
    group: "audience",
    order: 0,
  },
  {
    key: "followers_gained",
    title: "Novos seguidores",
    hint: "Seguidores ganhos no período.",
    group: "audience",
    order: 1,
  },
  {
    key: "followers_lost",
    title: "Deixaram de seguir",
    hint: "Seguidores perdidos no período.",
    group: "audience",
    order: 2,
  },
  {
    key: "net_followers",
    title: "Crescimento líquido",
    hint: "Saldo entre ganhos e perdas de seguidores.",
    group: "audience",
    order: 3,
  },
  {
    key: "video_watch_time_total",
    title: "Tempo total assistido",
    hint: "Tempo acumulado de visualização dos vídeos.",
    format: "duration",
    group: "video",
    order: 1,
  },
  {
    key: "video_views_total",
    title: "Video views",
    hint: "Total de visualizações de vídeos no período.",
    group: "video",
    order: 2,
  },
  {
    key: "video_engagement_total",
    title: "Vídeos (reações, comentários, compartilhamentos)",
    hint: "Engajamento gerado pelos vídeos: reações, comentários e compartilhamentos.",
    type: "engagement",
    group: "video",
    order: 3,
  },
];

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
  const [pageOverview, setPageOverview] = useState({});
  const [netFollowersSeries, setNetFollowersSeries] = useState([]);


  const [performanceScope, setPerformanceScope] = useState("all");

  const showOrganicSections = performanceScope !== "paid";
  const showPaidSections = performanceScope !== "organic";


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
    if (!accountConfig?.facebookPageId) {
      setPageMetrics([]);
      setPageOverview({});
      setNetFollowersSeries([]);
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
        setPageOverview(json.page_overview || {});
        setNetFollowersSeries(json.net_followers_series || []);
        if (json.cache) {
          setCacheMeta((prev) => ({
            ...prev,
            [CACHE_KEYS.facebook_metrics]: json.cache,
          }));
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(err);
          setPageMetrics([]);
          setPageOverview({});
          setNetFollowersSeries([]);
          setPageError(err.message || "Não foi possível carregar as métricas de página.");
        }
      } finally {
        setLoadingPage(false);
      }
    };

    loadMetrics();
    return () => controller.abort();
  }, [accountConfig?.facebookPageId, since, until, refreshToken]);




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
        if (json.cache) {
          setCacheMeta((prev) => ({
            ...prev,
            [CACHE_KEYS.ads_highlights]: json.cache,
          }));
        }
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
  }, [accountConfig?.adAccountId, since, until, refreshToken]);

  const handleManualRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const payload = {
        resources: ['facebook_metrics', 'ads_highlights'],
        account: {
          facebookPageId: accountConfig?.facebookPageId,
          adAccountId: accountConfig?.adAccountId,
        },
        since: toNumber(since),
        until: toNumber(until),
      };

      const response = await fetch(`${API_BASE_URL}/api/sync/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const raw = await response.text();
      const json = safeParseJson(raw) || {};

      if (!response.ok) {
        throw new Error(describeApiError(json, 'Falha ao atualizar os dados.'));
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
        const metricsIssue = json.errors.find((item) => item.resource === 'facebook_metrics');
        const adsIssue = json.errors.find((item) => item.resource === 'ads_highlights');
        if (metricsIssue?.error) setPageError(metricsIssue.error);
        if (adsIssue?.error) setAdsError(adsIssue.error);
      } else {
        setPageError('');
        setAdsError('');
      }

      setRefreshToken(Date.now());
    } catch (err) {
      console.error('Erro ao atualizar dados manualmente', err);
      setPageError(err?.message || 'Não foi possível atualizar os dados.');
    } finally {
      setRefreshing(false);
    }
  };

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
      { key: "reactions", label: "Reações", icon: Heart },
      { key: "comments", label: "Comentários", icon: MessageCircle },
      { key: "shares", label: "Compart.", icon: Share2 },
    ]
      .map((item) => ({ ...item, value: Number(breakdown[item.key] || 0) }))
      .filter((item) => item.value > 0);
    if (!items.length) return null;
    return (
      <ul className="metric-card__list metric-card__list--icons">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Icon size={14} />
              <span>{item.label}:</span>
              <strong>{formatNumber(item.value)}</strong>
            </li>
          );
        })}
      </ul>
    );
  };

  // Unused variables - kept for potential future use
  // const cardGroups = useMemo(() => {
  //   const groups = {};
  //   cardItems.forEach((item) => {
  //     const groupKey = item.group || "other";
  //     if (!groups[groupKey]) groups[groupKey] = [];
  //     groups[groupKey].push(item);
  //   });
  //   Object.values(groups).forEach((items) => {
  //     items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  //   });
  //   return groups;
  // }, [cardItems]);

  // const primaryCards = cardGroups.primary || [];

  // const supportingGroups = useMemo(() => {
  //   const baseGroups = [
  //     { key: "audience", title: "Audiência", items: cardGroups.audience || [] },
  //     { key: "engagement", title: "Interações", items: cardGroups.engagement || [] },
  //     { key: "video", title: "Vídeos", items: cardGroups.video || [] },
  //   ];
  //   const extraGroups = Object.entries(cardGroups)
  //     .filter(([key]) => !["primary", "audience", "engagement", "video"].includes(key))
  //     .map(([key, items]) => ({
  //       key,
  //       title: key === "other" ? "Outros" : key.charAt(0).toUpperCase() + key.slice(1),
  //       items,
  //     }));
  //   return [...baseGroups, ...extraGroups].filter((group) => group.items.length > 0);
  // }, [cardGroups]);

  const netFollowersTrend = useMemo(() => {
    if (!Array.isArray(netFollowersSeries)) return [];
    return netFollowersSeries
      .map((point) => {
        const date = point?.date;
        if (!date) return null;
        const cumulative = Number(point?.cumulative ?? 0);
        const net = Number(point?.net ?? 0);
        return {
          date,
          label: formatDateLabel(date),
          cumulative: Number.isFinite(cumulative) ? cumulative : 0,
          net: Number.isFinite(net) ? net : 0,
        };
      })
      .filter(Boolean);
  }, [netFollowersSeries]);

  // Unused variable - kept for potential future use
  // const netFollowersSummary = useMemo(() => {
  //   if (!Array.isArray(netFollowersSeries) || !netFollowersSeries.length) return null;
  //   const last = netFollowersSeries[netFollowersSeries.length - 1] || {};
  //   const total = Number(last.cumulative ?? 0);
  //   const latestNet = Number(last.net ?? 0);
  //   const adds = Number(last.adds ?? 0);
  //   const removes = Number(last.removes ?? 0);
  //   const lastDate = last.date || null;
  //   return {
  //     total: Number.isFinite(total) ? total : 0,
  //     latestNet: Number.isFinite(latestNet) ? latestNet : 0,
  //     adds: Number.isFinite(adds) ? adds : 0,
  //     removes: Number.isFinite(removes) ? removes : 0,
  //     lastDate,
  //   };
  // }, [netFollowersSeries]);

  const hasNetFollowersTrend = netFollowersTrend.length > 0;

  const dailyEngagementData = useMemo(() => {
    const series =
      Array.isArray(pageOverview?.daily_engagement_series)
        ? pageOverview.daily_engagement_series
        : Array.isArray(pageOverview?.engagement_series)
          ? pageOverview.engagement_series
          : [];

    return series
      .map((point) => {
        const date = point?.date || point?.day;
        if (!date) return null;
        const total = Number(point?.total ?? point?.value ?? 0) || 0;
        const reactions = Number(point?.reactions ?? 0) || 0;
        const comments = Number(point?.comments ?? 0) || 0;
        const shares = Number(point?.shares ?? 0) || 0;
        return {
          date,
          label: formatDateLabel(date),
          total,
          reactions,
          comments,
          shares,
        };
      })
      .filter(Boolean);
  }, [pageOverview]);

  const hasDailyEngagement = dailyEngagementData.some(
    (point) =>
      (point?.total ?? 0) > 0 ||
      (point?.reactions ?? 0) > 0 ||
      (point?.comments ?? 0) > 0 ||
      (point?.shares ?? 0) > 0,
  );

  // ======= MÃ©tricas de ADS com porcentagens e setas =======
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

  const volumeBarData = useMemo(() => {
    const totals = adsData?.totals || {};
    return [
      { name: "Impressões", value: Number(totals.impressions) || 0, color: "var(--chart-1)" },
      { name: "Alcance", value: Number(totals.reach) || 0, color: "var(--chart-2)" },
      { name: "Cliques", value: Number(totals.clicks) || 0, color: "var(--chart-3)" },
    ];
  }, [adsData?.totals]);

  const hasVolumeData = volumeBarData.some((item) => item.value > 0);

  const bestAdMetrics = useMemo(() => {
    if (!bestAd) return [];
    return [
      { label: "CTR", value: formatPercent(Number(bestAd.ctr)) },
      { label: "Impressões", value: formatNumber(Number(bestAd.impressions)) },
      { label: "Cliques", value: formatNumber(Number(bestAd.clicks)) },
      { label: "Investimento", value: formatCurrency(Number(bestAd.spend)) },
    ];
  }, [bestAd]);

  const filterOptions = [
    { value: "all", label: "Tudo" },
    { value: "organic", label: "Orgânico" },
    { value: "paid", label: "Pago" },
  ];

  const topbarFilters = (
    <>
      <AccountSelect />
      <DateRangePicker />
      <FilterButton
        value={performanceScope}
        onChange={setPerformanceScope}
        options={filterOptions}
      />
    </>
  );

  return (
    <>
      <Topbar
        title="Facebook"
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
        showFilters={false}
        onRefresh={handleManualRefresh}
        refreshing={refreshing}
        lastSync={lastSyncAt}
        customFilters={topbarFilters}
      />

      <div className="page-content page-content--unified">
        {pageError && <div className="alert alert--error">{pageError}</div>}

        {showOrganicSections && (
          <>
            {/* ====== TOP CARDS (4) ====== */}
            <Section title="Visão rápida" description="Principais KPIs do período.">
              <div className="dash-grid dash-4up">
                {['reach','post_engagement_total','page_views','net_followers'].map((k) => {
                  const cfg = FACEBOOK_CARD_CONFIG.find(c => c.key === k);
                  const metric = pageMetricsByKey[k];
                  if (!cfg) return null;
                  return (
                    <div className="dash-card" key={k}>
                      <MetricCard
                        title={cfg.title}
                        value={loadingPage ? '...' : formatMetricValue(metric, cfg)}
                        delta={loadingPage ? null : metric?.deltaPct ?? null}
                        hint={cfg.hint}
                        variant="compact"
                      >
                        {!loadingPage && cfg.type === 'engagement' ? renderEngagementBreakdown(metric) : null}
                      </MetricCard>
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* ====== CHARTS ROW (2) ====== */}
            <Section title="Tendências" description="Evolução diária no período.">
              <div className="dash-grid dash-2col">
                {/* Chart 1 — Crescimento líquido (seguidores) */}
                <div className="dash-chart">
                  <div className="fb-line-card__header" style={{marginBottom:12}}>
                    <h3>Crescimento líquido</h3>
                    <p className="muted">Saldo diário de seguidores</p>
                  </div>
                  {loadingPage ? (
                    <div className="chart-card__empty">Carregando dados...</div>
                  ) : hasNetFollowersTrend ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={netFollowersTrend} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                        <XAxis dataKey="label" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                        <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickFormatter={formatShortNumber} width={64} />
                        <Tooltip
                          labelFormatter={(label, payload) => {
                            const rawDate = payload && payload[0]?.payload?.date;
                            return rawDate ? formatDateFull(rawDate) : label;
                          }}
                          formatter={(value, name) => {
                            const numeric = Number(value);
                            if (name === 'net') return [formatSignedNumber(numeric), 'Líquido'];
                            return [formatNumber(Number(numeric)), 'Acumulado'];
                          }}
                        />
                        <Line type="monotone" dataKey="cumulative" stroke="var(--accent)" strokeWidth={2.5} dot={false} />
                        <Line type="monotone" dataKey="net" stroke="#0ea5e9" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="chart-card__empty">Sem dados suficientes para o período.</div>
                  )}
                </div>

                {/* Chart 2 — Evolução do engajamento diário */}
                <div className="dash-chart">
                  <div className="fb-insight-card__header" style={{marginBottom:12}}>
                    <h3>Evolução do engajamento</h3>
                    <span className="muted">Reações + comentários + compartilhamentos</span>
                  </div>
                  {loadingPage ? (
                    <div className="chart-card__empty">Carregando evolução...</div>
                  ) : hasDailyEngagement ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={dailyEngagementData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                        <XAxis dataKey="label" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                        <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickFormatter={formatShortNumber} width={64} />
                        <Tooltip
                          labelFormatter={(label, payload) => {
                            const rawDate = payload && payload[0]?.payload?.date;
                            return rawDate ? formatDateFull(rawDate) : label;
                          }}
                          formatter={(value, name) => {
                            const labels = { total: 'Engajamento total', reactions: 'Reações', comments: 'Comentários', shares: 'Compartilhamentos' };
                            return [formatNumber(Number(value)), labels[name] || name];
                          }}
                        />
                        <Line type="monotone" dataKey="total" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="chart-card__empty">Sem dados suficientes para exibir a evolução.</div>
                  )}
                </div>
              </div>
            </Section>
          </>
        )}
      {showPaidSections && (
        <Section title="Desempenho de anúncios" description="Resumo das campanhas no período selecionado.">
          {adsError && <div className="alert alert--error">{adsError}</div>}
          <div className="dash-grid dash-paid">
            {/* Bloco A — Volume por indicador */}
            <div className="dash-card dash-chart" style={{minHeight:320}}>
              <div style={{marginBottom:12}}>
                <h3>Volume por indicador</h3>
                <p className="muted">Impressões, alcance e cliques</p>
              </div>
              {loadingAds ? (
                <div className="chart-card__empty">Carregando dados...</div>
              ) : hasVolumeData ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={volumeBarData} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
                    <XAxis type="number" tickFormatter={formatShortNumber} stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} width={110} />
                    <Tooltip formatter={(value) => formatNumber(Number(value))} />
                    <Bar dataKey="value" radius={[0,12,12,0]}>
                      {volumeBarData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="chart-card__empty">Sem dados no período.</div>
              )}
            </div>

            {/* Bloco B — Melhor anúncio + KPIs médios (cards compactos) */}
            <div className="dash-card" style={{display:'flex', flexDirection:'column', gap:12}}>
              <div className="best-ad-card__header">
                <span className="best-ad-card__title">Melhor anúncio</span>
                <span className="best-ad-card__subtitle">{loadingAds ? '...' : (bestAd?.ad_name || 'Sem dados')}</span>
              </div>

              <div className="dash-grid dash-4up" style={{gridTemplateColumns:'repeat(4,minmax(0,1fr))'}}>
                {adsTotalsCards.slice(0,2).map(({ key, title, value, change }) => (
                  <MetricCard key={key} title={title} value={loadingAds ? '...' : value} variant="compact">
                    {!loadingAds && renderChangeIndicator(change)}
                  </MetricCard>
                ))}
                {adsAverageCards.slice(0,2).map(({ key, title, value, change }) => (
                  <MetricCard key={key} title={title} value={loadingAds ? '...' : value} variant="compact">
                    {!loadingAds && renderChangeIndicator(change)}
                  </MetricCard>
                ))}
              </div>

              {!loadingAds && bestAd && (
                <div className="best-ad-card__metrics">
                  {bestAdMetrics.map(m => (
                    <div key={m.label} className="best-ad-card__metric">
                      <span className="best-ad-card__metric-label">{m.label}</span>
                      <span className="best-ad-card__metric-value">{m.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Section>
      )}
      </div>
    </>
  );
}
