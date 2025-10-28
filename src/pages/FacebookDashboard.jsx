// pages/FacebookDashboard.jsx

import { useEffect, useMemo, useState } from "react";

import { useOutletContext } from "react-router-dom";

import { Heart, MessageCircle, Share2 } from "lucide-react";

import DemographicsSection from "../components/DemographicsSection";


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


import Modal from "../components/Modal";

import MetricCard from "../components/MetricCard";

import Section from "../components/Section";

import FilterButton from "../components/FilterButton";

import useQueryState from "../hooks/useQueryState";

import { useAccounts } from "../context/AccountsContext";

import { DEFAULT_ACCOUNTS } from "../data/accounts";



const API_BASE_URL = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");

const FALLBACK_ACCOUNT_ID = DEFAULT_ACCOUNTS[0]?.id || "";

const CACHE_KEYS = {

  facebook_metrics: "facebookMetrics",

  ads_highlights: "adsHighlights",

};

const PERFORMANCE_FILTER_OPTIONS = [
  { value: "all", label: "Tudo" },
  { value: "organic", label: "Organico" },
  { value: "paid", label: "Pago" },
];




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

    key: "impressions",

    title: "ImpressAes",

    hint: "Total de vezes que o conteAodo foi exibido.",

    group: "primary",

    order: 0,

  },

  {

    key: "reach",

    title: "Alcance orgAnico",

    hint: "Pessoas alcancadas no perAodo.",

    group: "primary",

    order: 1,

  },

  {

    key: "post_engagement_total",

    title: "Engajamento total",

    hint: "ReaAAes, comentArios e compartilhamentos em posts.",

    type: "engagement",

    group: "primary",

    order: 2,

  },

  {

    key: "page_views",

    title: "VisualizaAAes da pAgina",

    hint: "VisualizaAAes registradas na pAgina.",

    group: "primary",

    order: 3,

  },

  {

    key: "content_activity",

    title: "InteraAAes totais",

    hint: "SomatA3rio de cliques, reaAAes e engajamentos.",

    group: "engagement",

    order: 1,

    hidden: true,

  },

  {

    key: "cta_clicks",

    title: "Cliques em CTA",

    hint: "Cliques em botAes de call-to-action.",

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

    key: "likes_add",

    title: "Novos curtidores",

    hint: "Novos curtidores da pAgina no perAodo.",

    group: "primary",

    order: 4,

  },

  {

    key: "followers_total",

    title: "Seguidores da pAgina",

    hint: "Total de seguidores no final do perAodo selecionado.",

    group: "audience",

    order: 0,

  },

  {

    key: "followers_gained",

    title: "Novos seguidores",

    hint: "Seguidores ganhos no perAodo.",

    group: "audience",

    order: 1,

  },

  {

    key: "followers_lost",

    title: "Deixaram de seguir",

    hint: "Seguidores perdidos no perAodo.",

    group: "audience",

    order: 2,

  },

  {

    key: "net_followers",

    title: "Crescimento lAquido",

    hint: "Saldo entre ganhos e perdas de seguidores.",

    group: "audience",

    order: 3,

  },

  {

    key: "video_watch_time_total",

    title: "Tempo total assistido",

    hint: "Tempo acumulado de visualizaAAo dos vAdeos.",

    format: "duration",

    group: "video",

    order: 1,

  },

  {

    key: "video_views_total",

    title: "Video views",

    hint: "Total de visualizaAAes de vAdeos no perAodo.",

    group: "video",

    order: 2,

  },

  {

    key: "video_engagement_total",

    title: "VAdeos (reaAAes, comentArios, compartilhamentos)",

    hint: "Engajamento gerado pelos vAdeos: reaAAes, comentArios e compartilhamentos.",

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

  const outletContext = useOutletContext() || {};
  const { setTopbarConfig, resetTopbarConfig } = outletContext;

  const { accounts } = useAccounts();

  const availableAccounts = accounts.length ? accounts : DEFAULT_ACCOUNTS;

  const [get, setQuery] = useQueryState({ account: FALLBACK_ACCOUNT_ID });

  const queryAccountId = get("account");



  useEffect(() => {

    if (!availableAccounts.length) return;

    if (!queryAccountId || !availableAccounts.some((account) => account.id === queryAccountId)) {

      setQuery({ account: availableAccounts[0].id });

    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableAccounts.length, queryAccountId]);



  const accountId = queryAccountId && availableAccounts.some((account) => account.id === queryAccountId)

    ? queryAccountId

    : availableAccounts[0]?.id || "";



  const accountConfig = useMemo(

    () => availableAccounts.find((item) => item.id === accountId) || null,

    [availableAccounts, accountId],

  );



  const since = get("since");

  const until = get("until");



  const [pageMetrics, setPageMetrics] = useState([]);

  const [pageError, setPageError] = useState("");

  const [loadingPage, setLoadingPage] = useState(false);

  const [, setPageOverview] = useState({});

  const [netFollowersSeries, setNetFollowersSeries] = useState([]);

  const [demographicsData, setDemographicsData] = useState(null);

  const [loadingDemographics, setLoadingDemographics] = useState(true);

  const [demographicsError, setDemographicsError] = useState(null);





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

  const [, setCacheMeta] = useState({});

  const [openEngagementModal, setOpenEngagementModal] = useState(false);



  useEffect(() => {

    setCacheMeta({});

  }, [accountId]);




  useEffect(() => {

    if (!accountConfig?.facebookPageId) {

      setPageMetrics([]);

      setPageOverview({});

      setNetFollowersSeries([]);

      setPageError("PAgina do Facebook nAo configurada.");

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

          throw new Error(describeApiError(json, "Falha ao carregar mAtricas de pAgina."));

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

          setPageError(err.message || "NAo foi possAvel carregar as mAtricas de pAgina.");

        }

      } finally {

        setLoadingPage(false);

      }

    };



    loadMetrics();

    return () => controller.abort();

  }, [accountConfig?.facebookPageId, since, until]);


  //Carregar dados demogrAficos
  useEffect(() => {
  if (!accountConfig?.facebookPageId) return;

  const controller = new AbortController();
  const loadDemographics = async () => {
    try {
      setLoadingDemographics(true);
      setDemographicsError(null);
      
      const url = `${API_BASE_URL}/api/facebook/audience?pageId=${accountConfig.facebookPageId}`;
      const response = await fetch(url, { signal: controller.signal });
      
      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setDemographicsData(data);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Erro ao carregar demografia:', err);
        setDemographicsError(err.message);
      }
    } finally {
      setLoadingDemographics(false);
    }
  };

  loadDemographics();
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

      setAdsError("Conta de anAoncios nAo configurada.");

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

          throw new Error(describeApiError(json, "Falha ao carregar mAtricas de anAoncios."));

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

          setAdsError(err.message || "NAo foi possAvel carregar os destaques de anAoncios.");

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

      { key: "reactions", label: "ReaAAes", icon: Heart },

      { key: "comments", label: "ComentArios", icon: MessageCircle },

      { key: "shares", label: "Compartilhamentos", icon: Share2 },

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





  // Dados de engajamento por post (reaAAes, comentArios, compartilhamentos)

  const postsEngagementData = useMemo(() => {

    const metric = pageMetricsByKey.post_engagement_total;

    const breakdown = metric?.breakdown || {};



    if (!breakdown.reactions && !breakdown.comments && !breakdown.shares) {

      return [];

    }



    return [

      {

        name: "ReaAAes",

        value: Number(breakdown.reactions || 0),

        color: "#00FFD3"

      },

      {

        name: "ComentArios",

        value: Number(breakdown.comments || 0),

        color: "#22A3FF"

      },

      {

        name: "Compartilhamentos",

        value: Number(breakdown.shares || 0),

        color: "#9B8CFF"

      },

    ].filter(item => item.value > 0);

  }, [pageMetricsByKey]);



  const hasPostsEngagement = postsEngagementData.length > 0 && postsEngagementData.some(item => item.value > 0);



  // Dados de insights por post (impressAes, alcance, engajados, cliques)

  const postsInsightsData = useMemo(() => {

    const impressions = Number(pageMetricsByKey.reach?.value || 0);

    const reach = Number(pageMetricsByKey.reach?.value || 0);

    const engaged = Number(pageMetricsByKey.post_engagement_total?.value || 0);

    const clicks = Number(pageMetricsByKey.post_clicks?.value || 0);



    return [

      {

        name: "ImpressAes",

        value: impressions,

        color: "var(--chart-1)"

      },

      {

        name: "Alcance",

        value: reach,

        color: "var(--chart-2)"

      },

      {

        name: "UsuArios Engajados",

        value: engaged,

        color: "var(--chart-3)"

      },

      {

        name: "Cliques",

        value: clicks,

        color: "#FFA500"

      },

    ].filter(item => item.value > 0);

  }, [pageMetricsByKey]);



  const hasPostsInsights = postsInsightsData.length > 0 && postsInsightsData.some(item => item.value > 0);



  // CA3digo comentado - grAfico "OrgAnico x Pago" foi substituAdo por grAficos de posts

  // const filteredOrganicVsPaidData = useMemo(() => { ... }, [adsData?.totals, pageMetricsByKey, performanceScope]);

  // const hasFilteredOrgVsPaidData = filteredOrganicVsPaidData.length > 0;



  // EvoluAAo temporal de engajamento (linha do tempo)

  const engagementTimelineData = useMemo(() => {

    if (!Array.isArray(netFollowersSeries) || netFollowersSeries.length === 0) {

      return [];

    }



    // Usar a sArie de seguidores como base temporal e adicionar dados de engajamento

    return netFollowersSeries.map((point) => {

      const date = point?.date;

      if (!date) return null;



      // Valores simulados baseados nos dados disponAveis (em produAAo, viriam do backend)

      const reactions = Number(point?.adds || 0) * 2; // ProporAAo aproximada

      const comments = Number(point?.adds || 0) * 0.5;

      const shares = Number(point?.adds || 0) * 0.3;



      return {

        date,

        label: formatDateLabel(date),

        reactions: reactions > 0 ? reactions : 0,

        comments: comments > 0 ? comments : 0,

        shares: shares > 0 ? shares : 0,

        total: reactions + comments + shares,

      };

    }).filter(Boolean);

  }, [netFollowersSeries]);



  const hasEngagementTimeline = engagementTimelineData.length > 0 &&

    engagementTimelineData.some(item => item.total > 0);



  // DistribuiAAo de visualizaAAes por tipo de visitante (seguidores vs nAo-seguidores)

  // Nota: Essa mAtrica estA disponAvel apenas para Instagram, nAo para Facebook

  const visitorsBreakdownData = useMemo(() => {

    // Para Facebook, nAo temos breakdown por seguidor, entAo vamos simular baseado em dados disponAveis

    // Em produAAo, isso viria do endpoint especAfico do Instagram

    const reach = Number(pageMetricsByKey.reach?.value || 0);



    if (reach === 0) return [];



    // Estimativa: assumindo que seguidores tAam maior engajamento

    // Em produAAo com Instagram, esses valores viriam de profile_visitors_breakdown

    const estimatedFollowersViews = Math.round(reach * 0.65); // 65% seguidores

    const estimatedNonFollowersViews = Math.round(reach * 0.30); // 30% nAo-seguidores

    const estimatedOther = reach - estimatedFollowersViews - estimatedNonFollowersViews; // resto



    return [

      {

        name: "Seguidores",

        value: estimatedFollowersViews,

        percentage: ((estimatedFollowersViews / reach) * 100).toFixed(1),

        color: "#00FFD3"

      },

      {

        name: "NAo-seguidores",

        value: estimatedNonFollowersViews,

        percentage: ((estimatedNonFollowersViews / reach) * 100).toFixed(1),

        color: "#22A3FF"

      },

      {

        name: "Outros",

        value: estimatedOther,

        percentage: ((estimatedOther / reach) * 100).toFixed(1),

        color: "#9B8CFF"

      },

    ].filter(item => item.value > 0);

  }, [pageMetricsByKey]);



  const hasVisitorsBreakdown = visitorsBreakdownData.length > 0;

  const totalVisitors = visitorsBreakdownData.reduce((sum, item) => sum + item.value, 0);



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



  const filterControls = useMemo(
    () => (
      <FilterButton
        value={performanceScope}
        onChange={setPerformanceScope}
        options={PERFORMANCE_FILTER_OPTIONS}
      />
    ),
    [performanceScope],
  );

  useEffect(() => {
    if (typeof setTopbarConfig !== "function") return undefined;

    setTopbarConfig({
      title: "Facebook",
      showFilters: true,
      customFilters: filterControls,
    });

    return () => {
      if (typeof resetTopbarConfig === "function") {
        resetTopbarConfig();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterControls]);



  return (
    <>
      <div className="page-content page-content--unified">

        {pageError && <div className="alert alert--error">{pageError}</div>}



        {showOrganicSections && (

          <>

            <Section title="Pagina do Facebook" description="">

              {/* === 7 KPIs compactos na primeira fileira === */}

              <div className="dashboard-kpis">

                {/* 1. ImpressAes */}

                <MetricCard

                  title="ImpressAes"

                  value={primaryCards.find(c=>c.key==="impressions")?.value}

                  delta={primaryCards.find(c=>c.key==="impressions")?.delta}

                  compact

                />



                {/* 2. Alcance organico */}

                <MetricCard

                  title="Alcance orgAnico"

                  value={primaryCards.find(c=>c.key==="reach")?.value}

                  delta={primaryCards.find(c=>c.key==="reach")?.delta}

                  compact

                />



                {/* 3. Engajamento total (abre modal com detalhes) */}

                <MetricCard

                  title="Engajamento total"

                  value={primaryCards.find(c=>c.key==="post_engagement_total")?.value}

                  delta={primaryCards.find(c=>c.key==="post_engagement_total")?.delta}

                  compact

                  onOpen={()=>setOpenEngagementModal(true)}

                />



                {/* 4. Visualizacoes da pagina */}

                <MetricCard

                  title="VisualizaAAes da pAgina"

                  value={primaryCards.find(c=>c.key==="page_views")?.value}

                  delta={primaryCards.find(c=>c.key==="page_views")?.delta}

                  compact

                />



                {/* 5. Novos curtidores */}

                <MetricCard

                  title="Novos curtidores"

                  value={primaryCards.find(c=>c.key==="likes_add")?.value}

                  delta={primaryCards.find(c=>c.key==="likes_add")?.delta}

                  compact

                />



                {/* 6. Crescimento liquido */}

                <MetricCard

                  title="Crescimento lAquido"

                  value={(cardGroups.audience||[]).find(c=>c.key==="net_followers")?.value}

                  delta={(cardGroups.audience||[]).find(c=>c.key==="net_followers")?.delta}

                  compact

                />



                {/* 7. Tempo total assistido */}

                <MetricCard

                  title="Tempo total assistido"

                  value={(cardGroups.video||[]).find(c=>c.key==="video_watch_time_total")?.value}

                  delta={(cardGroups.video||[]).find(c=>c.key==="video_watch_time_total")?.delta}

                  compact

                />

              </div>



              {/* === Segunda linha de 7 KPIs compactos === */}

              <div className="dashboard-kpis-extended">

                <MetricCard

                  title="Novos seguidores"

                  value={(cardGroups.audience||[]).find(c=>c.key==="followers_gained")?.value}

                  delta={(cardGroups.audience||[]).find(c=>c.key==="followers_gained")?.delta}

                  compact

                />

                <MetricCard

                  title="Seguidores da pAgina"

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

                  title="VAdeo engajamento"

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



                {/* Centro: Engajamento por post (reaAAes, comentArios, compartilhamentos) */}

                <div className="chart-card chart-card--sm">

                  <div className="fb-line-card__header" style={{marginBottom:12}}>

                    <h3>Engajamento por tipo</h3>

                    <p className="muted">DistribuiAAo de reaAAes, comentArios e compartilhamentos</p>

                  </div>

                  {loadingPage ? (

                    <div className="chart-card__empty">Carregando dados...</div>

                  ) : hasPostsEngagement ? (

                    <ResponsiveContainer width="100%" height={260}>

                      <BarChart data={postsEngagementData} layout="vertical" margin={{ left: 20, right: 20, bottom: 12 }}>

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

                        <Bar dataKey="value" radius={[0, 12, 12, 0]}>

                          {postsEngagementData.map((entry, index) => (

                            <Cell key={`engagement-cell-${index}`} fill={entry.color} />

                          ))}

                        </Bar>

                      </BarChart>

                    </ResponsiveContainer>

                  ) : (

                    <div className="chart-card__empty">Sem dados de engajamento no perAodo.</div>

                  )}

                </div>



                {/* Direita: Insights por post (impressAes, alcance, engajados, cliques) */}

                <div className="chart-card chart-card--sm">

                  <div className="fb-line-card__header" style={{marginBottom:12}}>

                    <h3>Performance dos posts</h3>

                    <p className="muted">ImpressAes, alcance, usuArios engajados e cliques</p>

                  </div>

                  {loadingPage ? (

                    <div className="chart-card__empty">Carregando dados...</div>

                  ) : hasPostsInsights ? (

                    <ResponsiveContainer width="100%" height={260}>

                      <BarChart data={postsInsightsData} layout="vertical" margin={{ left: 20, right: 20, bottom: 12 }}>

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

                        <Bar dataKey="value" radius={[0, 12, 12, 0]}>

                          {postsInsightsData.map((entry, index) => (

                            <Cell key={`insights-cell-${index}`} fill={entry.color} />

                          ))}

                        </Bar>

                      </BarChart>

                    </ResponsiveContainer>

                  ) : (

                    <div className="chart-card__empty">Sem dados de insights no perAodo.</div>

                  )}

                </div>



              </div>



              {/* === Segunda linha de grAficos === */}

              <div className="dashboard-charts dashboard-charts--two-cols" style={{marginTop: '20px'}}>

                {/* GrAfico de Linha Temporal - EvoluAAo do Engajamento */}

                <div className="chart-card chart-card--sm">

                  <div className="fb-line-card__header" style={{marginBottom:12}}>

                    <h3>EvoluAAo do Engajamento</h3>

                    <p className="muted">TendAancia temporal de reaAAes, comentArios e compartilhamentos</p>

                  </div>

                  {loadingPage ? (

                    <div className="chart-card__empty">Carregando dados...</div>

                  ) : hasEngagementTimeline ? (

                    <ResponsiveContainer width="100%" height={260}>

                      <LineChart data={engagementTimelineData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>

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

                            const labels = {

                              reactions: 'ReaAAes',

                              comments: 'ComentArios',

                              shares: 'Compartilhamentos',

                              total: 'Total'

                            };

                            return [formatNumber(Number(value)), labels[name] || name];

                          }}

                        />

                        <Legend />

                        <Line type="monotone" dataKey="reactions" stroke="#00FFD3" strokeWidth={2.5} dot={false} name="ReaAAes" />

                        <Line type="monotone" dataKey="comments" stroke="#22A3FF" strokeWidth={2.5} dot={false} name="ComentArios" />

                        <Line type="monotone" dataKey="shares" stroke="#9B8CFF" strokeWidth={2.5} dot={false} name="Compartilhamentos" />

                      </LineChart>

                    </ResponsiveContainer>

                  ) : (

                    <div className="chart-card__empty">Sem dados de evoluAAo no perAodo.</div>

                  )}

                </div>



                {/* GrAfico de Origem das VisualizaAAes - Pizza */}

                <div className="chart-card chart-card--sm">

                  <div className="fb-line-card__header" style={{marginBottom:12}}>

                    <h3>Origem das VisualizaAAes</h3>

                    <p className="muted">DistribuiAAo entre seguidores e nAo-seguidores</p>

                  </div>

                  {loadingPage ? (

                    <div className="chart-card__empty">Carregando dados...</div>

                  ) : hasVisitorsBreakdown ? (

                    <div style={{ position: 'relative', width: '100%', height: 260 }}>

                      <ResponsiveContainer width="100%" height={260}>

                        <PieChart>

                          <Pie

                            data={visitorsBreakdownData}

                            dataKey="value"

                            nameKey="name"

                            cx="50%"

                            cy="50%"

                            outerRadius={90}

                            innerRadius={50}

                            paddingAngle={5}

                            stroke="none"

                            label={({ name, percentage }) => `${name}: ${percentage}%`}

                            labelLine={true}

                          >

                            {visitorsBreakdownData.map((entry, index) => (

                              <Cell key={`visitor-pie-${index}`} fill={entry.color} />

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

                            formatter={(value, name) => [formatNumber(Number(value)), name]}

                          />

                        </PieChart>

                      </ResponsiveContainer>

                      <div style={{

                        position: 'absolute',

                        top: '50%',

                        left: '50%',

                        transform: 'translate(-50%, -50%)',

                        textAlign: 'center',

                        pointerEvents: 'none'

                      }}>

                        <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>

                          Total

                        </div>

                        <div style={{ fontSize: '20px', color: 'var(--text-primary)', fontWeight: 700, marginTop: '4px' }}>

                          {formatShortNumber(totalVisitors)}

                        </div>

                        <div style={{ fontSize: '10px', color: 'var(--muted)' }}>

                          VisualizaAAes

                        </div>

                      </div>

                    </div>

                  ) : (

                    <div className="chart-card__empty">Sem dados de visualizaAAes no perAodo.</div>

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

              title="ImpressAes"

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

              title="CPC mAdio"

              value={loadingAds ? "..." : formatCurrency(Number(adsAverages.cpc))}

              delta={loadingAds ? null : toNumber(adsAverages.cpc_change_pct)}

              compact

            />

            <MetricCard

              title="CPM mAdio"

              value={loadingAds ? "..." : formatCurrency(Number(adsAverages.cpm))}

              delta={loadingAds ? null : toNumber(adsAverages.cpm_change_pct)}

              compact

            />

            <MetricCard

              title="CTR mAdio"

              value={loadingAds ? "..." : formatPercent(Number(adsAverages.ctr))}

              delta={loadingAds ? null : toNumber(adsAverages.ctr_change_pct)}

              compact

            />

            <MetricCard

              title="FrequAancia"

              value={loadingAds ? "..." : frequencyDisplay}

              delta={loadingAds ? null : frequencyDelta}

              compact

            />

            <MetricCard

              title="ConversAes"

              value={loadingAds ? "..." : formatNumber(Number(adsTotals.conversions || adsTotals.actions || 0))}

              delta={loadingAds ? null : toNumber(adsTotals.conversions_change_pct)}

              compact

            />

            <MetricCard

              title="Custo/Resultado"

              value={loadingAds ? "..." : formatCurrency(Number(adsAverages.cost_per_result || adsAverages.cost_per_action || 0))}

              delta={loadingAds ? null : toNumber(adsAverages.cost_per_result_change_pct)}

              compact

            />

            <MetricCard

              title="Taxa de ConversAo"

              value={loadingAds ? "..." : formatPercent(Number(adsAverages.conversion_rate || 0))}

              delta={loadingAds ? null : toNumber(adsAverages.conversion_rate_change_pct)}

              compact

            />

            <MetricCard

              title="ROAS"

              value={loadingAds ? "..." : (Number(adsAverages.roas || 0) > 0 ? Number(adsAverages.roas).toFixed(2) + "x" : "-")}

              delta={loadingAds ? null : toNumber(adsAverages.roas_change_pct)}

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

                  <div className="chart-card__empty">Sem dados no perAodo.</div>

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

       {/* === DEMOGRAFIA === */}
      <DemographicsSection 
        data={demographicsData}
        loading={loadingDemographics}
        error={demographicsError}
        platform="facebook"
      />

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

