// pages/FacebookDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ArrowDown, ArrowUp, Trophy } from "lucide-react";
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
import DateRangeIndicator from "../components/DateRangeIndicator";
import useQueryState from "../hooks/useQueryState";
import { accounts } from "../data/accounts";

const API_BASE_URL = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
const DEFAULT_ACCOUNT_ID = accounts[0]?.id || "";
const FB_DONUT_COLORS = ['#22c55e', '#1120f8ff', '#f97316', '#a855f7', '#eab308'];
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
    hint: "Pessoas alcancadas no periodo.",
    group: "primary",
    order: 1,
  },
  {
    key: "post_engagement_total",
    title: "Engajamento total",
    hint: "Reações, comentarios e compartilhamentos em posts.",
    type: "engagement",
    group: "primary",
    order: 2,
  },
  {
    key: "page_views",
    title: "Visualizacoes da pagina",
    hint: "Visualizacoes registradas na pagina.",
    group: "primary",
    order: 3,
  },
  {
    key: "content_activity",
    title: "Interacoes totais",
    hint: "Somatorio de cliques, reacoes e engajamentos.",
    group: "engagement",
    order: 1,
    hidden: true,
  },
  {
    key: "cta_clicks",
    title: "Cliques em CTA",
    hint: "Cliques em botoes de call-to-action.",
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
    title: "Seguidores da pagina",
    hint: "Total de seguidores no final do periodo selecionado.",
    group: "audience",
    order: 0,
  },
  {
    key: "followers_gained",
    title: "Novos seguidores",
    hint: "Seguidores ganhos no periodo.",
    group: "audience",
    order: 1,
  },
  {
    key: "followers_lost",
    title: "Deixaram de seguir",
    hint: "Seguidores perdidos no periodo.",
    group: "audience",
    order: 2,
  },
  {
    key: "net_followers",
    title: "Crescimento liquido",
    hint: "Saldo entre ganhos e perdas de seguidores.",
    group: "audience",
    order: 3,
  },
  {
    key: "video_watch_time_total",
    title: "Tempo total assistido",
    hint: "Tempo acumulado de visualizacao dos videos.",
    format: "duration",
    group: "video",
    order: 1,
  },
  {
    key: "video_views_total",
    title: "Video views",
    hint: "Total de visualizacoes de videos no periodo.",
    group: "video",
    order: 2,
  },
  {
    key: "video_engagement_total",
    title: "Videos (reacoes, comentarios, compartilhamentos)",
    hint: "Engajamento gerado pelos videos: reacoes, comentarios e compartilhamentos.",
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
      setPageError("PÃ¡gina do Facebook nÃ£o configurada.");
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
          throw new Error(describeApiError(json, "Falha ao carregar métricas de pÃ¡gina."));
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
      setPageError(err?.message || 'Nao foi possivel atualizar os dados.');
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
      FACEBOOK_CARD_CONFIG.filter((config) => !config.hidden).map((config) => {
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

  const cardGroups = useMemo(() => {
    const groups = {};
    cardItems.forEach((item) => {
      const groupKey = item.group || "other";
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(item);
    });
    Object.values(groups).forEach((items) => {
      items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    });
    return groups;
  }, [cardItems]);

  const primaryCards = cardGroups.primary || [];

  const supportingGroups = useMemo(() => {
    const baseGroups = [
      { key: "audience", title: "Audiência", items: cardGroups.audience || [] },
      { key: "engagement", title: "Interações", items: cardGroups.engagement || [] },
      { key: "video", title: "Vídeos", items: cardGroups.video || [] },
    ];
    const extraGroups = Object.entries(cardGroups)
      .filter(([key]) => !["primary", "audience", "engagement", "video"].includes(key))
      .map(([key, items]) => ({
        key,
        title: key === "other" ? "Outros" : key.charAt(0).toUpperCase() + key.slice(1),
        items,
      }));
    return [...baseGroups, ...extraGroups].filter((group) => group.items.length > 0);
  }, [cardGroups]);

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

  const netFollowersSummary = useMemo(() => {
    if (!Array.isArray(netFollowersSeries) || !netFollowersSeries.length) return null;
    const last = netFollowersSeries[netFollowersSeries.length - 1] || {};
    const total = Number(last.cumulative ?? 0);
    const latestNet = Number(last.net ?? 0);
    const adds = Number(last.adds ?? 0);
    const removes = Number(last.removes ?? 0);
    const lastDate = last.date || null;
    return {
      total: Number.isFinite(total) ? total : 0,
      latestNet: Number.isFinite(latestNet) ? latestNet : 0,
      adds: Number.isFinite(adds) ? adds : 0,
      removes: Number.isFinite(removes) ? removes : 0,
      lastDate,
    };
  }, [netFollowersSeries]);

  const hasNetFollowersTrend = netFollowersTrend.length > 0;

  const insightDonutData = useMemo(() => {
    const segments = [
      { key: 'content_activity', label: 'Interações', value: Number(pageOverview?.content_activity ?? 0) || 0 },
      { key: 'video_views', label: 'Views de vídeo', value: Number(pageOverview?.video_views ?? 0) || 0 },
      { key: 'page_views', label: 'Visualizações de página', value: Number(pageOverview?.page_views ?? 0) || 0 },
      { key: 'followers_gained', label: 'Novos seguidores', value: Number(pageOverview?.followers_gained ?? 0) || 0 },
    ].filter((item) => Number.isFinite(item.value) && item.value > 0);

    const total = segments.reduce((sum, item) => sum + item.value, 0);
    return {
      items: segments,
      total,
    };
  }, [pageOverview]);

  const reachVsInteractionsData = useMemo(() => {
    const reachMetric = Number(pageMetricsByKey.reach?.value ?? pageOverview?.reach ?? 0);
    const interactionsMetric = Number(
      pageOverview?.content_activity ?? pageMetricsByKey.post_engagement_total?.value ?? 0,
    );

    return [
      {
        key: 'reach',
        name: 'Alcance total',
        description: 'Pessoas alcançadas no perí­odo selecionado',
        value: Number.isFinite(reachMetric) && reachMetric > 0 ? reachMetric : 0,
        color: '#22c55e',
      },
      {
        key: 'interactions',
        name: 'Interações totais',
        description: 'Soma de reações, comentários, compartilhamentos e cliques',
        value: Number.isFinite(interactionsMetric) && interactionsMetric > 0 ? interactionsMetric : 0,
        color: '#f97316',
      },
    ].filter((item) => item.value > 0);
  }, [pageOverview, pageMetricsByKey]);

  const hasInsightDonut = insightDonutData.items.length > 0;
  const hasReachVsInteractions = reachVsInteractionsData.length > 0;

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

  // GrÃ¡fico horizontal de barras (ImpressÃµes, Alcance, Cliques)
  const volumeBarData = useMemo(() => {
    const totals = adsData?.totals || {};
    return [
      { name: "Impressões", value: Number(totals.impressions) || 0, color: "#06b6d4" },
      { name: "Alcance", value: Number(totals.reach) || 0, color: "#6366f1" },
      { name: "Cliques", value: Number(totals.clicks) || 0, color: "#8b5cf6" },
    ];
  }, [adsData?.totals]);

  const hasVolumeData = volumeBarData.some((item) => item.value > 0);

  // ComparaÃ§Ã£o orgÃ¢nico x pago
  const organicVsPaidData = useMemo(() => {
    const organicReach = Number(pageMetricsByKey.reach?.value || 0);
    const organicEngagement = Number(pageMetricsByKey.post_engagement_total?.value || 0);
    const paidReach = Number(adsData.totals?.reach || 0);
    const paidClicks = Number(adsData.totals?.clicks || 0);

    return [
      { name: "Alcance", "Orgânico": organicReach, Pago: paidReach },
      { name: "Engajamento/Cliques", "Orgânico": organicEngagement, Pago: paidClicks },
    ];
  }, [pageMetricsByKey, adsData.totals]);

  const filteredOrganicVsPaidData = useMemo(() => {
    if (performanceScope === "organic") {
      return organicVsPaidData.map((item) => ({ ...item, Pago: 0 }));
    }
    if (performanceScope === "paid") {
      return organicVsPaidData.map((item) => ({ ...item, "Orgânico": 0 }));
    }
    return organicVsPaidData;
  }, [organicVsPaidData, performanceScope]);

  const hasFilteredOrgVsPaidData = filteredOrganicVsPaidData.some(
    (item) => ((item["Orgânico"] || 0) > 0) || ((item.Pago || 0) > 0),
  );

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
      <Topbar
        title="Facebook"
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
        showFilters={true}
        onRefresh={handleManualRefresh}
        refreshing={refreshing}
        lastSync={lastSyncAt}
      />

      <div className="page-content">
        <DateRangeIndicator />

        <div className="content-filter">
          <span className="content-filter__label">Visualizar</span>
          <div className="content-filter__buttons">
            {[
              { value: "all", label: "Tudo" },
              { value: "organic", label: "Orgânico" },
              { value: "paid", label: "Pago" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                className={`content-filter__btn ${performanceScope === option.value ? "content-filter__btn--active" : ""}`}
                onClick={() => setPerformanceScope(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {pageError && <div className="alert alert--error">{pageError}</div>}

        {showOrganicSections && (
          <Section
            title="Resumo organico da página"
            description="Indicadores principais do periodo selecionado."
          >
            <div className="fb-summary">
              <div className="fb-summary__metrics">
                {primaryCards.length > 0 && (
                  <div className="fb-summary__primary">
                    {primaryCards.map((card) => (
                      <MetricCard
                        key={card.key}
                        title={card.title}
                        value={card.value}
                        delta={card.delta}
                        hint={card.hint}
                        variant="compact"
                      >
                        {card.extra}
                      </MetricCard>
                    ))}
                  </div>
                )}

                {supportingGroups.map((group) => (
                  <div key={group.key} className="fb-summary__group">
                    <div className="fb-summary__group-header">
                      <h3>{group.title}</h3>
                    </div>
                    <div className="fb-summary__group-grid">
                      {group.items.map((item) => (
                        <MetricCard
                          key={item.key}
                          title={item.title}
                          value={item.value}
                          delta={item.delta}
                          hint={item.hint}
                          variant="compact"
                        >
                          {item.extra}
                        </MetricCard>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="fb-summary__insights">
                <div className="card fb-line-card">
                  <div className="fb-line-card__header">
                    <div>
                      <h3>Crescimento liquido</h3>
                      <p>Acompanhamento diario do saldo de seguidores.</p>
                    </div>
                    {netFollowersSummary && (
                      <div className={`fb-line-card__badge${netFollowersSummary.total < 0 ? ' fb-line-card__badge--down' : ''}`}>
                        {formatSignedNumber(netFollowersSummary.total)}
                      </div>
                    )}
                  </div>
                  <div className="fb-line-card__chart">
                    {loadingPage ? (
                      <div className="chart-card__empty">Carregando dados...</div>
                    ) : hasNetFollowersTrend ? (
                      <ResponsiveContainer width="100%" height={220}>
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
                              if (name === 'net') {
                                return [formatSignedNumber(numeric), 'Liquido'];
                              }
                              return [formatNumber(Number(numeric)), 'Total acumulado'];
                            }}
                            contentStyle={{
                              backgroundColor: 'var(--panel)',
                              border: '1px solid var(--stroke)',
                              borderRadius: '12px',
                              padding: '8px 12px',
                              boxShadow: 'var(--shadow-lg)',
                            }}
                          />
                          <Line type="monotone" dataKey="cumulative" stroke="var(--accent)" strokeWidth={2.5} dot={false} />
                          <Line type="monotone" dataKey="net" stroke="#0ea5e9" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="chart-card__empty">Sem dados suficientes para o periodo.</div>
                    )}
                  </div>
                  {netFollowersSummary && (
                    <div className="fb-line-card__footer">
                      <span>
                        Ultimo dia {netFollowersSummary.lastDate ? formatDateLabel(netFollowersSummary.lastDate) : '---'}: {formatSignedNumber(netFollowersSummary.latestNet)}
                      </span>
                      <span>
                        Entradas {formatNumber(netFollowersSummary.adds)} - Saidas {formatNumber(netFollowersSummary.removes)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="card fb-insight-card fb-insight-card--donut">
                  <div className="fb-insight-card__header">
                    <h3>Composicao de resultados</h3>
                    <span>Distribuicao das metricas principais do periodo</span>
                  </div>

                  {loadingPage ? (
                    <div className="fb-insight-card__empty">Carregando distribuicao...</div>
                  ) : hasInsightDonut ? (
                    <>
                      <div className="fb-donut-card__chart">
                        <ResponsiveContainer width="100%" height={240}>
                          <PieChart>
                            <Pie
                              data={insightDonutData.items}
                              dataKey="value"
                              nameKey="label"
                              innerRadius="60%"
                              outerRadius="95%"
                              paddingAngle={2}
                              stroke="none"
                            >
                              {insightDonutData.items.map((entry, index) => (
                                <Cell key={entry.key} fill={FB_DONUT_COLORS[index % FB_DONUT_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => formatNumber(Number(value))} />
                          </PieChart>
                        </ResponsiveContainer>

                        <div className="fb-donut-card__center">
                          <strong>{formatShortNumber(insightDonutData.total)}</strong>
                          <span>Total combinado</span>
                        </div>
                      </div>

                      <ul className="fb-donut-card__legend">
                        {insightDonutData.items.map((segment, index) => (
                          <li key={segment.key}>
                            <span
                              className="fb-donut-card__dot"
                              style={{ backgroundColor: FB_DONUT_COLORS[index % FB_DONUT_COLORS.length] }}
                            ></span>
                            <span className="fb-donut-card__legend-label">{segment.label}</span>
                            <span className="fb-donut-card__legend-value">{formatShortNumber(segment.value)}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <div className="fb-insight-card__empty">Sem dados suficientes para exibir o grafico.</div>
                  )}
                </div>

                <div className="card fb-insight-card fb-insight-card--bars">
                  <div className="fb-insight-card__header">
                    <h3>Alcance vs. Interacoes</h3>
                    <span>Comparativo visual do periodo atual</span>
                  </div>

                  {loadingPage ? (
                    <div className="fb-insight-card__empty">Carregando comparativo...</div>
                  ) : hasReachVsInteractions ? (
                    <>
                      <div className="fb-bar-card__chart">
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={reachVsInteractionsData} layout="vertical" margin={{ left: 24, right: 24, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
                            <XAxis
                              type="number"
                              tickFormatter={formatShortNumber}
                              stroke="var(--text-muted)"
                              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                            />
                            <YAxis
                              type="category"
                              dataKey="name"
                              width={120}
                              stroke="var(--text-muted)"
                              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                            />
                            <Tooltip formatter={(value) => formatNumber(Number(value))} cursor={{ fill: 'rgba(34, 197, 94, 0.12)' }} />
                            <Bar dataKey="value" radius={[8, 8, 8, 8]}>
                              {reachVsInteractionsData.map((entry) => (
                                <Cell key={entry.key} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <ul className="fb-bar-card__legend">
                        {reachVsInteractionsData.map((item) => (
                          <li key={item.key}>
                            <span className="fb-donut-card__dot" style={{ backgroundColor: item.color }}></span>
                            <div className="fb-bar-card__legend-text">
                              <strong>{item.name}</strong>
                              <span>{item.description}</span>
                            </div>
                            <span className="fb-bar-card__value">{formatShortNumber(item.value)}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <div className="fb-insight-card__empty">Sem dados suficientes para exibir o comparativo.</div>
                  )}
                </div>
              </div>
            </div>
          </Section>
        )}
      {showPaidSections && (
        <Section
        title="Desempenho de anúncios"
        description="Resumo das campanhas no perí­odo selecionado."
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
              <p className="chart-card__subtitle">Comparativo de impressÃµes, alcance e cliques</p>
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
                <div className="chart-card__empty">Sem dados suficientes no perí­odo.</div>
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
              <p className="muted">Nenhum anúncio disponí­vel para o perí­odo.</p>
            )}
          </div>
        </div>
      </Section>
      )}


      <Section
        title="OrgÃ¢nico x Pago"
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
            ) : hasFilteredOrgVsPaidData ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={filteredOrganicVsPaidData}
                  layout="vertical"
                  margin={{ left: 24, right: 24, bottom: 12 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={formatShortNumber}
                    stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
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
                  <Bar dataKey="Orgânico" fill="#10b981" radius={[0, 12, 12, 0]} />
                  <Bar dataKey="Pago" fill="#6366f1" radius={[0, 12, 12, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-card__empty">Sem dados suficientes no período.</div>
            )}
          </div>
        </div>
      </Section>
      </div>
    </>
  );
}
