// pages/FacebookDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Heart, MessageCircle, Share2 } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from "recharts";
import Topbar from "../components/Topbar";
import Modal from "../components/Modal";
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
    title: "Alcance org�nico",
    hint: "Pessoas alcancadas no per�odo.",
    group: "primary",
    order: 1,
  },
  {
    key: "post_engagement_total",
    title: "Engajamento total",
    hint: "Rea��es, coment�rios e compartilhamentos em posts.",
    type: "engagement",
    group: "primary",
    order: 2,
  },
  {
    key: "page_views",
    title: "Visualiza��es da p�gina",
    hint: "Visualiza��es registradas na p�gina.",
    group: "primary",
    order: 3,
  },
  {
    key: "content_activity",
    title: "Intera��es totais",
    hint: "Somat�rio de cliques, rea��es e engajamentos.",
    group: "engagement",
    order: 1,
    hidden: true,
  },
  {
    key: "cta_clicks",
    title: "Cliques em CTA",
    hint: "Cliques em bot�es de call-to-action.",
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
    title: "Seguidores da p�gina",
    hint: "Total de seguidores no final do per�odo selecionado.",
    group: "audience",
    order: 0,
  },
  {
    key: "followers_gained",
    title: "Novos seguidores",
    hint: "Seguidores ganhos no per�odo.",
    group: "audience",
    order: 1,
  },
  {
    key: "followers_lost",
    title: "Deixaram de seguir",
    hint: "Seguidores perdidos no per�odo.",
    group: "audience",
    order: 2,
  },
  {
    key: "net_followers",
    title: "Crescimento l�quido",
    hint: "Saldo entre ganhos e perdas de seguidores.",
    group: "audience",
    order: 3,
  },
  {
    key: "video_watch_time_total",
    title: "Tempo total assistido",
    hint: "Tempo acumulado de visualiza��o dos v�deos.",
    format: "duration",
    group: "video",
    order: 1,
  },
  {
    key: "video_views_total",
    title: "Video views",
    hint: "Total de visualiza��es de v�deos no per�odo.",
    group: "video",
    order: 2,
  },
  {
    key: "video_engagement_total",
    title: "V�deos (rea��es, coment�rios, compartilhamentos)",
    hint: "Engajamento gerado pelos v�deos: rea��es, coment�rios e compartilhamentos.",
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
  const [openEngagementModal, setOpenEngagementModal] = useState(false);

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
      setPageError("P�gina do Facebook n�o configurada.");
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
          throw new Error(describeApiError(json, "Falha ao carregar m�tricas de p�gina."));
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
          setPageError(err.message || "N�o foi poss�vel carregar as m�tricas de p�gina.");
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
      setAdsError("Conta de an�ncios n�o configurada.");
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
          throw new Error(describeApiError(json, "Falha ao carregar m�tricas de an�ncios."));
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
          setAdsError(err.message || "N�o foi poss�vel carregar os destaques de an�ncios.");
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
      setPageError(err?.message || 'N�o foi poss�vel atualizar os dados.');
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
      { key: "reactions", label: "Rea��es", icon: Heart },
      { key: "comments", label: "Coment�rios", icon: MessageCircle },
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

  const cardGroups = useMemo(() => {
    const groups = {};
    FACEBOOK_CARD_CONFIG.forEach((config) => {
      const metric = pageMetricsByKey[config.key];
      const groupKey = config.group || "other";
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push({
        ...config,
        metric,
        value: loadingPage ? "..." : formatMetricValue(metric, config),
        delta: loadingPage ? null : metric?.deltaPct ?? null,
      });
    });
    Object.values(groups).forEach((items) => {
      items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    });
    return groups;
  }, [loadingPage, pageMetricsByKey]);

  const primaryCards = cardGroups.primary || [];

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

  // Barras empilhadas por tipo de engajamento (reactions/comments/shares)
  const engagementStackedData = useMemo(() => {
    const metric = pageMetricsByKey.post_engagement_total;
    if (metric?.daily_series) {
      return metric.daily_series
        .map((point) => {
          const date = point?.date;
          if (!date) return null;
          return {
            date,
            label: formatDateLabel(date),
            reactions: Number(point?.reactions || 0),
            comments: Number(point?.comments || 0),
            shares: Number(point?.shares || 0),
          };
        })
        .filter(Boolean);
    }
    return dailyEngagementData.map(({ date, label, reactions, comments, shares }) => ({
      date,
      label,
      reactions,
      comments,
      shares,
    }));
  }, [dailyEngagementData, pageMetricsByKey]);
  const hasEngagementStacked = engagementStackedData.some(
    (item) =>
      (item?.reactions ?? 0) > 0 ||
      (item?.comments ?? 0) > 0 ||
      (item?.shares ?? 0) > 0,
  );

  const filteredOrganicVsPaidData = useMemo(() => {
    const safeNumber = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : 0;
    };

    const totals = adsData?.totals || {};
    const base = [
      {
        name: "Alcance",
        organico: safeNumber(pageMetricsByKey.reach?.value),
        pago: safeNumber(totals.reach),
      },
      {
        name: "Engajamento",
        organico: safeNumber(pageMetricsByKey.post_engagement_total?.value),
        pago: safeNumber(totals.engagement ?? totals.post_engagement ?? totals.clicks),
      },
      {
        name: "Cliques",
        organico: safeNumber(pageMetricsByKey.post_clicks?.value),
        pago: safeNumber(totals.clicks),
      },
    ];

    const dataset = base
      .map((item) => ({
        name: item.name,
        Organico: Math.max(0, item.organico || 0),
        Pago: Math.max(0, item.pago || 0),
      }))
      .filter((item) => item.Organico > 0 || item.Pago > 0);

    if (performanceScope === "organic") {
      return dataset
        .filter((item) => item.Organico > 0)
        .map((item) => ({ ...item, Pago: 0 }));
    }
    if (performanceScope === "paid") {
      return dataset
        .filter((item) => item.Pago > 0)
        .map((item) => ({ ...item, Organico: 0 }));
    }
    return dataset;
  }, [adsData?.totals, pageMetricsByKey, performanceScope]);
  const hasFilteredOrgVsPaidData = filteredOrganicVsPaidData.length > 0;

  const donutComposition = useMemo(() => {
    const primaryItems = cardGroups.primary || [];
    const reachVal = toNumber(primaryItems.find((item) => item.key === "reach")?.metric?.value) ?? 0;
    const viewsVal = toNumber(primaryItems.find((item) => item.key === "page_views")?.metric?.value) ?? 0;
    const engageVal = toNumber(primaryItems.find((item) => item.key === "post_engagement_total")?.metric?.value) ?? 0;

    const items = [
      { key: "reach", label: "Alcance", value: reachVal, color: "#00FFD3" },
      { key: "views", label: "Visualizacoes", value: viewsVal, color: "#22A3FF" },
      { key: "eng", label: "Engajamento", value: engageVal, color: "#9B8CFF" },
    ].filter((item) => item.value > 0);

    const total = items.reduce((sum, item) => sum + item.value, 0);
    return { items, total };
  }, [cardGroups]);

  const adsTotals = adsData?.totals || {};
  const adsAverages = adsData?.averages || {};
  const frequencyValue = toNumber(adsAverages.frequency);
  const frequencyDisplay = frequencyValue != null ? frequencyValue.toFixed(2) : "-";
  const frequencyDelta = toNumber(adsAverages.frequency_change_pct);
  const volumeBarData = useMemo(() => {
    const totals = adsData?.totals || {};
    return [
      { name: "Impressoes", value: Number(totals.impressions) || 0, color: "var(--chart-1)" },
      { name: "Alcance", value: Number(totals.reach) || 0, color: "var(--chart-2)" },
      { name: "Cliques", value: Number(totals.clicks) || 0, color: "var(--chart-3)" },
    ];
  }, [adsData?.totals]);
  const hasVolumeData = volumeBarData.some((item) => item.value > 0);

  const adsActionsData = useMemo(() => {
    const list = Array.isArray(adsData?.actions) ? adsData.actions : [];
    const map = new Map();
    list.forEach((action) => {
      const key = String(action?.action_type || "").replace(/_/g, " ").trim();
      const value = Number(action?.value || 0);
      if (!key || !Number.isFinite(value)) return;
      map.set(key, (map.get(key) || 0) + value);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [adsData?.actions]);
  const hasAdsActions = adsActionsData.some((item) => (item?.value ?? 0) > 0);

  const filterOptions = [
    { value: "all", label: "Tudo" },
    { value: "organic", label: "Org�nico" },
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
            <Section title="Pagina do Facebook" description="">
              {/* === 6 KPIs compactos em 2 fileiras === */}
              <div className="dashboard-kpis">
                {/* 1. Alcance organico */}
                <MetricCard
                  title="Alcance organico"
                  value={primaryCards.find(c=>c.key==="reach")?.value}
                  delta={primaryCards.find(c=>c.key==="reach")?.delta}
                  compact
                />

                {/* 2. Engajamento total (abre modal com detalhes) */}
                <MetricCard
                  title="Engajamento total"
                  value={primaryCards.find(c=>c.key==="post_engagement_total")?.value}
                  delta={primaryCards.find(c=>c.key==="post_engagement_total")?.delta}
                  compact
                  onOpen={()=>setOpenEngagementModal(true)}
                />

                {/* 3. Visualizacoes da pagina */}
                <MetricCard
                  title="Visualizacoes da pagina"
                  value={primaryCards.find(c=>c.key==="page_views")?.value}
                  delta={primaryCards.find(c=>c.key==="page_views")?.delta}
                  compact
                />

                {/* 4. Crescimento liquido */}
                <MetricCard
                  title="Crescimento liquido"
                  value={(cardGroups.audience||[]).find(c=>c.key==="net_followers")?.value}
                  delta={(cardGroups.audience||[]).find(c=>c.key==="net_followers")?.delta}
                  compact
                />

                {/* 5. Tempo total assistido */}
                <MetricCard
                  title="Tempo total assistido"
                  value={(cardGroups.video||[]).find(c=>c.key==="video_watch_time_total")?.value}
                  delta={(cardGroups.video||[]).find(c=>c.key==="video_watch_time_total")?.delta}
                  compact
                />

                {/* 6. Novos seguidores */}
                <MetricCard
                  title="Novos seguidores"
                  value={(cardGroups.audience||[]).find(c=>c.key==="followers_gained")?.value}
                  delta={(cardGroups.audience||[]).find(c=>c.key==="followers_gained")?.delta}
                  compact
                />
              </div>

              {/* === Linha extra de KPIs compactos === */}
              <div className="dashboard-kpis-extended">
                <MetricCard
                  title="Seguidores da pagina"
                  value={(cardGroups.audience || []).find((c) => c.key === "followers_total")?.value}
                  delta={(cardGroups.audience || []).find((c) => c.key === "followers_total")?.delta}
                  compact
                />
                <MetricCard
                  title="Deixaram de seguir"
                  value={(cardGroups.audience || []).find((c) => c.key === "followers_lost")?.value}
                  delta={(cardGroups.audience || []).find((c) => c.key === "followers_lost")?.delta}
                  compact
                />
                <MetricCard
                  title="Video views"
                  value={(cardGroups.video || []).find((c) => c.key === "video_views_total")?.value}
                  delta={(cardGroups.video || []).find((c) => c.key === "video_views_total")?.delta}
                  compact
                />
                <MetricCard
                  title="Video engajamento"
                  value={(cardGroups.video || []).find((c) => c.key === "video_engagement_total")?.value}
                  delta={(cardGroups.video || []).find((c) => c.key === "video_engagement_total")?.delta}
                  compact
                />
                <MetricCard
                  title="Cliques em posts"
                  value={(cardGroups.engagement || []).find((c) => c.key === "post_clicks")?.value}
                  delta={(cardGroups.engagement || []).find((c) => c.key === "post_clicks")?.delta}
                  compact
                />
                <MetricCard
                  title="Cliques no CTA"
                  value={(cardGroups.engagement || []).find((c) => c.key === "cta_clicks")?.value}
                  delta={(cardGroups.engagement || []).find((c) => c.key === "cta_clicks")?.delta}
                  compact
                />
              </div>
            </Section>

            <Section title="" description="">
              <div className="dashboard-charts">
                {/* Esquerda: Crescimento liquido (seguidores) */}
                <div className="chart-card chart-card--sm">
                  <div className="fb-line-card__header" style={{marginBottom:12}}>
                    <h3>Crescimento liquido</h3>
                    <p className="muted">Saldo diario de seguidores</p>
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
                          contentStyle={{
                            backgroundColor: '#f7fafc',
                            color: '#0f1720',
                            border: '1px solid #e3e8ef',
                            borderRadius: '10px',
                            boxShadow: '0 6px 20px rgba(0,0,0,.25)'
                          }}
                          labelFormatter={(label, payload) => {
                            const rawDate = payload && payload[0]?.payload?.date;
                            return rawDate ? formatDateFull(rawDate) : label;
                          }}
                          formatter={(value, name) => {
                            const numeric = Number(value);
                            if (name === 'net') return [formatSignedNumber(numeric), 'Liquido'];
                            return [formatNumber(Number(numeric)), 'Acumulado'];
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

                {/* Direita: Comparativo organico vs pago */}
                <div className="chart-card chart-card--sm">
                  <h3>Organico x Pago</h3>
                  <p>Comparativo de alcance e engajamento/cliques</p>
                  {(loadingPage || loadingAds) ? (
                    <div className="chart-card__empty">Carregando...</div>
                  ) : hasFilteredOrgVsPaidData ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={filteredOrganicVsPaidData} layout="vertical" margin={{ left: 24, right: 24, bottom: 12 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
                        <XAxis type="number" tickFormatter={formatShortNumber} stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                        <YAxis type="category" dataKey="name" width={140} stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#f7fafc',
                            color: '#0f1720',
                            border: '1px solid #e3e8ef',
                            borderRadius: '10px',
                            boxShadow: '0 6px 20px rgba(0,0,0,.25)'
                          }}
                          formatter={(value) => formatNumber(Number(value))}
                        />
                        <Legend />
                        <Bar dataKey="Organico" fill="#00FFD3" radius={[0, 12, 12, 0]} />
                        <Bar dataKey="Pago" fill="#6aa7ff" radius={[0, 12, 12, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="chart-card__empty">Sem dados suficientes.</div>
                  )}
                </div>

                <div className="chart-card">
                  <div className="fb-line-card__header" style={{marginBottom:12}}>
                    <h3>Composicao de resultados</h3>
                    <span className="muted">Distribuicao entre alcance, visualizacoes e engajamento.</span>
                  </div>
                  {donutComposition.items.length ? (
                    <div className="fb-donut-card__chart">
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie
                            data={donutComposition.items}
                            dataKey="value"
                            nameKey="label"
                            innerRadius={60}
                            outerRadius={90}
                            stroke="none"
                            isAnimationActive={false}
                          >
                            {donutComposition.items.map((item) => (
                              <Cell key={item.key} fill={item.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="fb-donut-card__center">
                        <strong>{donutComposition.total.toLocaleString("pt-BR")}</strong>
                        <span>Total combinado</span>
                      </div>
                    </div>
                  ) : (
                    <div className="chart-card__empty">Sem dados suficientes no periodo.</div>
                  )}
                </div>
              </div>

            </Section>
          </>
        )}
      {showPaidSections && (
        <Section title="Trafego pago" className="ads-section">
          {adsError && <div className="alert alert--error">{adsError}</div>}

          <div className="dashboard-kpis">
            <MetricCard
              title="Investimento"
              value={loadingAds ? "..." : formatCurrency(Number(adsTotals.spend))}
              delta={loadingAds ? null : toNumber(adsTotals.spend_change_pct)}
              compact
            />
            <MetricCard
              title="Impressoes"
              value={loadingAds ? "..." : formatNumber(Number(adsTotals.impressions))}
              delta={loadingAds ? null : toNumber(adsTotals.impressions_change_pct)}
              compact
            />
            <MetricCard
              title="Alcance"
              value={loadingAds ? "..." : formatNumber(Number(adsTotals.reach))}
              delta={loadingAds ? null : toNumber(adsTotals.reach_change_pct)}
              compact
            />
            <MetricCard
              title="Cliques"
              value={loadingAds ? "..." : formatNumber(Number(adsTotals.clicks))}
              delta={loadingAds ? null : toNumber(adsTotals.clicks_change_pct)}
              compact
            />
            <MetricCard
              title="CPC medio"
              value={loadingAds ? "..." : formatCurrency(Number(adsAverages.cpc))}
              delta={loadingAds ? null : toNumber(adsAverages.cpc_change_pct)}
              compact
            />
            <MetricCard
              title="CPM medio"
              value={loadingAds ? "..." : formatCurrency(Number(adsAverages.cpm))}
              delta={loadingAds ? null : toNumber(adsAverages.cpm_change_pct)}
              compact
            />
            <MetricCard
              title="CTR medio"
              value={loadingAds ? "..." : formatPercent(Number(adsAverages.ctr))}
              delta={loadingAds ? null : toNumber(adsAverages.ctr_change_pct)}
              compact
            />
            <MetricCard
              title="Frequencia"
              value={loadingAds ? "..." : frequencyDisplay}
              delta={loadingAds ? null : frequencyDelta}
              compact
            />
          </div>

          <div className="charts-row charts-row--ads">
            <div className="card chart-card">
              <div>
                <h3 className="chart-card__title">Volume por indicador</h3>
                <p className="chart-card__subtitle">Impressoes, alcance e cliques</p>
              </div>
              <div className="chart-card__viz">
                {loadingAds ? (
                  <div className="chart-card__empty">Carregando dados...</div>
                ) : hasVolumeData ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={volumeBarData} layout="vertical" margin={{ left: 20, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
                      <XAxis type="number" tickFormatter={formatShortNumber} stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} width={100} />
                      <Tooltip
                        formatter={(value) => formatNumber(Number(value))}
                        contentStyle={{
                          backgroundColor: "var(--panel)",
                          border: "1px solid var(--stroke)",
                          borderRadius: "12px",
                          padding: "8px 12px",
                          boxShadow: "var(--shadow-lg)",
                          color: "var(--text-primary)",
                        }}
                        cursor={{ fill: "var(--panel-hover)" }}
                      />
                      <Bar dataKey="value" radius={[0, 12, 12, 0]}>
                        {volumeBarData.map((entry, index) => (
                          <Cell key={`volume-cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="chart-card__empty">Sem dados no periodo.</div>
                )}
              </div>
            </div>

            <div className="card chart-card">
              <div>
                <h3 className="chart-card__title">Acoes do anuncio</h3>
                <p className="chart-card__subtitle">Cliques, visualizacoes e outras acoes</p>
              </div>
              <div className="chart-card__viz">
                {loadingAds ? (
                  <div className="chart-card__empty">Carregando dados...</div>
                ) : hasAdsActions ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={adsActionsData} margin={{ left: 12, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                      <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                      <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickFormatter={formatShortNumber} width={60} />
                      <Tooltip
                        formatter={(value) => formatNumber(Number(value))}
                        contentStyle={{
                          backgroundColor: "var(--panel)",
                          border: "1px solid var(--stroke)",
                          borderRadius: "12px",
                          padding: "8px 12px",
                          boxShadow: "var(--shadow-lg)",
                          color: "var(--text-primary)",
                        }}
                        cursor={{ fill: "var(--panel-hover)" }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#6aa7ff">
                        {adsActionsData.map((entry, index) => (
                          <Cell key={`actions-cell-${index}`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="chart-card__empty">Sem acoes suficientes no periodo.</div>
                )}
              </div>
            </div>
          </div>
        </Section>
      )}
      <Modal
        open={openEngagementModal}
        title="Detalhes - Engajamento total"
        onClose={()=>setOpenEngagementModal(false)}
      >
        <div style={{display:"grid", gap:8}}>
          {renderEngagementBreakdown(pageMetricsByKey.post_engagement_total) || (
            <p className="muted">Sem detalhes para o periodo.</p>
          )}
        </div>
      </Modal>
      </div>
    </>
  );
}
