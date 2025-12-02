import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useLocation, useOutletContext } from "react-router-dom";
import { differenceInCalendarDays, endOfDay, startOfDay, subDays } from "date-fns";
import {
  ResponsiveContainer,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
} from "recharts";
import {
  BarChart3,
  FileText,
  Facebook,
  Instagram as InstagramIcon,
  Settings,
  Shield,
} from "lucide-react";
import useQueryState from "../hooks/useQueryState";
import { useAccounts } from "../context/AccountsContext";
import { DEFAULT_ACCOUNTS } from "../data/accounts";
import { useAuth } from "../context/AuthContext";
const API_BASE_URL = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
const FALLBACK_ACCOUNT_ID = DEFAULT_ACCOUNTS[0]?.id || "";

const FB_TOPBAR_PRESETS = [
  { id: "7d", label: "7 dias", days: 7 },
  { id: "1m", label: "1 mês", days: 30 },
  { id: "3m", label: "3 meses", days: 90 },
  { id: "6m", label: "6 meses", days: 180 },
  { id: "1y", label: "1 ano", days: 365 },
];
const DEFAULT_FACEBOOK_RANGE_DAYS = 7;

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
const DEFAULT_WEEKLY_FOLLOWERS = [3, 4, 5, 6, 7, 5, 4];
const DEFAULT_WEEKLY_POSTS = [2, 3, 4, 5, 6, 4, 3];

const DEFAULT_GENDER_STATS = [
  { name: "Homens", value: 40 },
  { name: "Mulheres", value: 60 },
];

const HERO_TABS = [
  { id: "instagram", label: "Instagram", href: "/instagram", icon: InstagramIcon },
  { id: "facebook", label: "Facebook", href: "/facebook", icon: Facebook },
  { id: "ads", label: "Ads", href: "/ads", icon: BarChart3 },
  { id: "reports", label: "Relatórios", href: "/relatorios", icon: FileText },
  { id: "admin", label: "Admin", href: "/admin", icon: Shield },
  { id: "settings", label: "Configurações", href: "/configuracoes", icon: Settings },
];

const FOLLOWER_GROWTH_SERIES = [
  { label: "Jan", value: 28000 },
  { label: "Fev", value: 58000 },
  { label: "Mar", value: 12000 },
  { label: "Abr", value: 36000 },
  { label: "Mai", value: 58000 },
  { label: "Jun", value: 18000 },
  { label: "Jul", value: 28000 },
  { label: "Ago", value: 88000 },
  { label: "Set", value: 26000 },
  { label: "Out", value: 34000 },
  { label: "Nov", value: 9000 },
  { label: "Dez", value: 52000 },
];

const toUnixSeconds = (date) => Math.floor(date.getTime() / 1000);

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

const safeParseJson = (text) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    console.warn("Falha ao converter resposta JSON", err);
    return null;
  }
};

const describeApiError = (payload, fallback) => {
  if (!payload) return fallback;
  if (payload.error) {
    return payload.graph?.code ? `${payload.error} (Graph code ${payload.graph.code})` : payload.error;
  }
  return payload.message || fallback;
};

const extractNumber = (value, fallback = 0) => {
  if (value === null || value === undefined) return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const formatNumber = (value) => {
  if (value === null || value === undefined) return "-";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  if (Math.abs(numeric) >= 1000) {
    return numeric.toLocaleString("pt-BR");
  }
  return numeric.toString();
};

const formatShortNumber = (value) => {
  if (!Number.isFinite(value)) return "0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString("pt-BR");
};

const buildWeeklyPattern = (values) => {
  const max = Math.max(...values, 0);
  return values.map((value, index) => ({
    label: WEEKDAY_LABELS[index] || "",
    value,
    percentage: max > 0 ? Math.round((value / max) * 100) : 0,
    active: max > 0 && value === max,
  }));
};

const parseQueryDate = (value) => {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const ms = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date;
};

const BubbleTooltip = ({ active, payload, suffix = "" }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const label = item?.name || item?.payload?.name || "";
  const value = Number(item?.value ?? item?.payload?.value ?? 0);

  return (
    <div className="ig-bubble-tooltip">
      <span>{label}</span>
      <strong>{`${value.toLocaleString("pt-BR")}${suffix}`}</strong>
    </div>
  );
};

export default function FacebookDashboard() {
  const outlet = useOutletContext() || {};
  const { setTopbarConfig, resetTopbarConfig } = outlet;
  const location = useLocation();
  const { apiFetch } = useAuth();
  const { accounts } = useAccounts();
  const availableAccounts = accounts.length ? accounts : DEFAULT_ACCOUNTS;
  const [getQuery, setQuery] = useQueryState({ account: FALLBACK_ACCOUNT_ID });
  const queryAccountId = getQuery("account");

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

  const accountSnapshotKey = useMemo(
    () => accountConfig?.facebookPageId || accountConfig?.id || "",
    [accountConfig?.id, accountConfig?.facebookPageId],
  );

  const [coverImage, setCoverImage] = useState(null);
  const [coverLoading, setCoverLoading] = useState(false);
  const [coverError, setCoverError] = useState("");
  const [pageInfo, setPageInfo] = useState(null);
  const [followersOverride, setFollowersOverride] = useState(null);

  const sinceParam = getQuery("since");
  const untilParam = getQuery("until");
  const sinceDate = useMemo(() => parseQueryDate(sinceParam), [sinceParam]);
  const untilDate = useMemo(() => parseQueryDate(untilParam), [untilParam]);
  const now = useMemo(() => new Date(), []);
  const defaultEnd = useMemo(() => endOfDay(subDays(startOfDay(now), 1)), [now]);

  const activePreset = useMemo(() => {
    if (!sinceDate || !untilDate) return "custom";
    const diff = differenceInCalendarDays(endOfDay(untilDate), startOfDay(sinceDate)) + 1;
    const preset = FB_TOPBAR_PRESETS.find((item) => item.days === diff);
    return preset?.id ?? "custom";
  }, [sinceDate, untilDate]);

  const handlePresetSelect = useCallback(
    (presetId) => {
      const preset = FB_TOPBAR_PRESETS.find((item) => item.id === presetId);
      if (!preset?.days || preset.days <= 0) return;
      const endDate = defaultEnd;
      const startDate = startOfDay(subDays(endDate, preset.days - 1));
      setQuery({
        since: toUnixSeconds(startDate),
        until: toUnixSeconds(endDate),
      });
    },
    [defaultEnd, setQuery],
  );

  const selectedRange = useMemo(() => {
    const until = untilDate ? endOfDay(untilDate) : defaultEnd;
    const since = sinceDate
      ? startOfDay(sinceDate)
      : startOfDay(subDays(until, DEFAULT_FACEBOOK_RANGE_DAYS - 1));
    return { since, until };
  }, [defaultEnd, sinceDate, untilDate]);

  useEffect(() => {
    if (sinceParam && untilParam) return;
    const defaultPreset = FB_TOPBAR_PRESETS.find((preset) => preset.id === "7d") || FB_TOPBAR_PRESETS[0];
    const endDate = defaultEnd;
    const startDate = startOfDay(subDays(endDate, (defaultPreset?.days ?? DEFAULT_FACEBOOK_RANGE_DAYS) - 1));
    setQuery({
      since: toUnixSeconds(startDate),
      until: toUnixSeconds(endDate),
    });
  }, [defaultEnd, setQuery, sinceParam, untilParam]);

  const handleDateChange = useCallback(
    (start, end) => {
      if (!start || !end) return;
      const normalizedStart = startOfDay(start);
      const normalizedEnd = endOfDay(end);
      setQuery({
        since: toUnixSeconds(normalizedStart),
        until: toUnixSeconds(normalizedEnd),
      });
    },
    [setQuery],
  );

  useEffect(() => {
    if (!setTopbarConfig) return undefined;
    setTopbarConfig({
      hidden: false,
      presets: FB_TOPBAR_PRESETS,
      selectedPreset: activePreset,
      onPresetSelect: handlePresetSelect,
      onDateChange: handleDateChange,
    });
    return () => resetTopbarConfig?.();
  }, [
    activePreset,
    handleDateChange,
    handlePresetSelect,
    resetTopbarConfig,
    setTopbarConfig,
  ]);

  const [pageMetrics, setPageMetrics] = useState([]);
  const [pageError, setPageError] = useState("");
  const [netFollowersSeries, setNetFollowersSeries] = useState([]);

  const [overviewSnapshot, setOverviewSnapshot] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewSource, setOverviewSource] = useState(null);

  const activeSnapshot = useMemo(
    () => (overviewSnapshot?.accountId === accountSnapshotKey && accountSnapshotKey ? overviewSnapshot : null),
    [accountSnapshotKey, overviewSnapshot],
  );

  useEffect(() => {
    setPageMetrics([]);
    setNetFollowersSeries([]);
    setOverviewSnapshot(null);
    setOverviewSource(null);
    setOverviewLoading(false);
    setPageError("");
    setPageInfo(null);
    setCoverImage(null);
    setCoverError("");
    setFollowersOverride(null);
  }, [accountSnapshotKey]);

  useEffect(() => {
    if (!accountConfig?.facebookPageId) {
      setPageMetrics([]);
      setNetFollowersSeries([]);
      setOverviewSource(null);
      setOverviewLoading(false);
      setPageError("Página do Facebook não configurada.");
      return () => {};
    }

    let cancelled = false;
    const loadPageInfo = async () => {
      try {
        const resp = await apiFetch(`/api/facebook/page-info?pageId=${encodeURIComponent(accountConfig.facebookPageId)}`);
        if (cancelled) return;
        setPageInfo(resp?.page || null);
      } catch (err) {
        if (cancelled) return;
        setPageInfo(null);
      }
    };
    const loadCover = async () => {
      setCoverLoading(true);
      setCoverError("");
      try {
        const resp = await apiFetch(
          `/api/covers?platform=facebook&account_id=${encodeURIComponent(accountConfig.facebookPageId)}`,
        );
        if (cancelled) return;
        setCoverImage(resp?.cover?.url || resp?.cover?.storage_url || null);
      } catch (err) {
        if (cancelled) return;
        setCoverImage(null);
        setCoverError(err?.message || "Não foi possível carregar a capa.");
      } finally {
        if (!cancelled) {
          setCoverLoading(false);
        }
      }
    };

    const loadFollowers = async () => {
      if (!accountConfig?.facebookPageId) return;
      try {
        const params = new URLSearchParams();
        params.set("pageId", accountConfig.facebookPageId);
        if (sinceParam) params.set("since", sinceParam);
        if (untilParam) params.set("until", untilParam);
        const resp = await apiFetch(`/api/facebook/followers?${params.toString()}`);
        if (cancelled) return;
        const val = resp?.followers?.value;
        if (val !== undefined && val !== null) {
          setFollowersOverride(Number(val));
        }
      } catch (err) {
        if (cancelled) return;
        // keep existing counts if fetch fails
      }
    };

    loadPageInfo();
    loadCover();
    loadFollowers();

    if (!sinceParam || !untilParam) {
      setOverviewSource(null);
      setOverviewLoading(true);
      return () => { cancelled = true; };
    }

    const controller = new AbortController();
    cancelled = false;

    const loadOverviewMetrics = async () => {
      setOverviewLoading(true);
      setPageError("");
      try {
        const params = new URLSearchParams();
        params.set("pageId", accountConfig.facebookPageId);
        params.set("since", sinceParam);
        params.set("until", untilParam);
        const url = `${API_BASE_URL}/api/facebook/metrics?${params.toString()}`;
        const response = await fetch(url, { signal: controller.signal });
        const raw = await response.text();
        const json = safeParseJson(raw) || {};
        if (!response.ok) {
          throw new Error(describeApiError(json, "Falha ao carregar métricas do Facebook."));
        }
        if (cancelled) return;
        setPageMetrics(Array.isArray(json.metrics) ? json.metrics : []);
        setNetFollowersSeries(Array.isArray(json.net_followers_series) ? json.net_followers_series : []);
        setOverviewSource(json);
      } catch (err) {
        if (controller.signal.aborted || cancelled) return;
        console.error(err);
        setPageMetrics([]);
        setNetFollowersSeries([]);
        setOverviewSource(null);
        setPageError(err.message || "Não foi possível carregar as métricas do Facebook.");
      } finally {
        if (!cancelled) {
          setOverviewLoading(false);
        }
      }
    };

    loadOverviewMetrics();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [accountConfig?.facebookPageId, sinceParam, untilParam, apiFetch]);
  const avatarUrl = useMemo(
    () => pageInfo?.picture_url || accountConfig?.profilePictureUrl || accountConfig?.pagePictureUrl || "",
    [pageInfo?.picture_url, accountConfig?.pagePictureUrl, accountConfig?.profilePictureUrl],
  );

  const heroCoverStyle = useMemo(() => ({
    position: "relative",
    backgroundImage: coverImage
      ? `linear-gradient(180deg, rgba(15,23,42,0.35) 0%, rgba(15,23,42,0.65) 100%), url(${coverImage})`
      : "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)",
    backgroundSize: "cover",
    backgroundPosition: "center",
    minHeight: "120px",
    borderRadius: "16px",
  }), [coverImage]);

  const handleCoverUpload = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file || !accountConfig?.facebookPageId) return;
    if (!file.type.startsWith("image/")) {
      alert("Envie um arquivo de imagem.");
      return;
    }
    setCoverLoading(true);
    setCoverError("");
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
        reader.readAsDataURL(file);
      });

      const resp = await apiFetch("/api/covers", {
        method: "POST",
        body: {
          platform: "facebook",
          account_id: accountConfig.facebookPageId,
          data_url: dataUrl,
          content_type: file.type,
          size_bytes: file.size,
        },
      });
      setCoverImage(resp?.cover?.url || resp?.cover?.storage_url || dataUrl);
    } catch (err) {
      setCoverError(err?.message || "Não foi possível salvar a capa.");
    } finally {
      setCoverLoading(false);
    }
  }, [accountConfig?.facebookPageId, apiFetch]);

  const handleCoverRemove = useCallback(async () => {
    if (!accountConfig?.facebookPageId) return;
    setCoverLoading(true);
    setCoverError("");
    try {
      await apiFetch(`/api/covers?platform=facebook&account_id=${encodeURIComponent(accountConfig.facebookPageId)}`, {
        method: "DELETE",
      });
      setCoverImage(null);
    } catch (err) {
      setCoverError(err?.message || "Não foi possível remover a capa.");
    } finally {
      setCoverLoading(false);
    }
  }, [accountConfig?.facebookPageId, apiFetch]);

  // Facebook metrics no longer trigger full API calls; only reach uses the backend.

  const pageMetricsByKey = useMemo(() => {
    const map = {};
    pageMetrics.forEach((metric) => {
      if (metric?.key) map[metric.key] = metric;
    });
    return map;
  }, [pageMetrics]);

  // Calculate overview metrics
  const followersFallback = extractNumber(
    followersOverride,
    extractNumber(overviewSource?.page_overview?.followers_total, 0)
  );
  const totalFollowers = extractNumber(pageMetricsByKey.followers_total?.value, followersFallback);
  const reachValue = extractNumber(
    pageMetricsByKey.reach?.value,
    extractNumber(overviewSource?.reach, 0),
  );
  const newFollowers = extractNumber(
    pageMetricsByKey.followers_gained?.value,
    extractNumber(overviewSource?.page_overview?.followers_gained, 0),
  );
  const postsCount = extractNumber(
    pageMetricsByKey.content_activity?.value,
    extractNumber(overviewSource?.page_overview?.content_activity, 0),
  );
  const engagementValue = extractNumber(
    pageMetricsByKey.post_engagement_total?.value,
    extractNumber(overviewSource?.engagement?.total, 0),
  );
  const impressionsValue = extractNumber(overviewSource?.impressions, 0);
  const pageViewsValue = extractNumber(
    pageMetricsByKey.page_views?.value,
    extractNumber(overviewSource?.page_overview?.page_views, 0),
  );
  const clicksValue = extractNumber(
    pageMetricsByKey.cta_clicks?.value ?? pageMetricsByKey.post_clicks?.value,
    extractNumber(overviewSource?.page_overview?.cta_clicks, 0),
  );
  const reachMetricValue = reachValue;
  const followersMetricValue = totalFollowers;

  const overviewMetrics = useMemo(
    () => ({
      followers: followersMetricValue ?? activeSnapshot?.followers ?? 0,
      reach: activeSnapshot?.reach ?? reachMetricValue ?? 0,
      engagement: engagementValue ?? 0,
      pageViews: pageViewsValue ?? 0,
    }),
    [
      activeSnapshot,
      clicksValue,
      engagementValue,
      followersMetricValue,
      pageViewsValue,
      reachMetricValue,
    ],
  );

  const reachPeriodLabel = useMemo(() => {
    if (!selectedRange.since || !selectedRange.until) return "Alcance";
    const sinceLabel = SHORT_DATE_FORMATTER.format(selectedRange.since);
    const untilLabel = SHORT_DATE_FORMATTER.format(selectedRange.until);
    return sinceLabel === untilLabel ? `Alcance (${sinceLabel})` : `Alcance (${sinceLabel} - ${untilLabel})`;
  }, [selectedRange.since, selectedRange.until]);

  const followersDailyDisplay = useMemo(() => (
    Number.isFinite(overviewMetrics.followersDaily)
      ? overviewMetrics.followersDaily.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      : "--"
  ), [overviewMetrics.followersDaily]);

  const engagementRateValue = useMemo(() => {
    if (!Number.isFinite(engagementValue) || engagementValue <= 0) return null;
    if (!Number.isFinite(reachMetricValue) || reachMetricValue <= 0) return null;
    return (engagementValue / reachMetricValue) * 100;
  }, [engagementValue, reachMetricValue]);
  const engagementRateDisplay = useMemo(() => (
    engagementRateValue != null
      ? `${engagementRateValue.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}%`
      : "--"
  ), [engagementRateValue]);

  // Engagement breakdown
  const engagementBreakdown = useMemo(() => {
    const metric = pageMetricsByKey.post_engagement_total;
    const breakdown = metric?.breakdown || overviewSource?.engagement || {};

    return [
      {
        name: "Reações",
        value: extractNumber(breakdown.reactions, 0),
      },
      {
        name: "Comentários",
        value: extractNumber(breakdown.comments, 0),
      },
      {
        name: "Compartilhamentos",
        value: extractNumber(breakdown.shares, 0),
      },
    ].filter(item => item.value > 0);
  }, [overviewSource, pageMetricsByKey]);

  // Gender distribution (placeholder since Facebook API calls were removed)
  const genderStatsSeries = DEFAULT_GENDER_STATS;

  // Reach timeline
  const reachTimelineData = useMemo(() => {
    if (!netFollowersSeries.length) {
      // Default mock data
      return [
        { dateKey: "2025-01-29", label: "29/01", value: 12000 },
        { dateKey: "2025-01-30", label: "30/01", value: 28000 },
        { dateKey: "2025-01-31", label: "31/01", value: 78000 },
        { dateKey: "2025-02-01", label: "01/02", value: 36000 },
        { dateKey: "2025-02-02", label: "02/02", value: 42000 },
        { dateKey: "2025-02-03", label: "03/02", value: 48000 },
        { dateKey: "2025-02-04", label: "04/02", value: 32000 },
      ];
    }

    return netFollowersSeries.map((entry) => {
      const dateStr = entry.date || "";
      const parsedDate = new Date(`${dateStr}T00:00:00`);
      return {
        dateKey: dateStr,
        label: SHORT_DATE_FORMATTER.format(parsedDate),
        value: extractNumber(entry.cumulative, 0),
      };
    });
  }, [netFollowersSeries]);

  const peakReachPoint = useMemo(() => {
    if (!reachTimelineData.length) return null;
    return reachTimelineData.reduce(
      (currentMax, entry) => (entry.value > currentMax.value ? entry : currentMax),
      reachTimelineData[0],
    );
  }, [reachTimelineData]);

  const accountInitial = (accountConfig?.label || accountConfig?.name || "FB").charAt(0).toUpperCase();
  const overviewIsLoading = overviewLoading;

  return (
    <div className="facebook-dashboard facebook-dashboard--clean">
      {pageError && <div className="alert alert--error">{pageError}</div>}

      {/* Container Limpo (fundo branco) */}
      <div className="ig-clean-container">
        <div className="ig-hero-gradient" aria-hidden="true" />
        {/* Header com Logo Facebook e Tabs */}
        <div className="ig-clean-header fb-topbar">
          <div className="ig-clean-header__brand">
            <div className="ig-clean-header__logo">
              <Facebook size={32} color="#1877F2" fill="#1877F2" />
            </div>
            <h1>Facebook</h1>
          </div>

          <nav className="ig-clean-tabs">
            {HERO_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.href ? location.pathname === tab.href : tab.id === "facebook";
              const linkTarget = tab.href
                ? (location.search ? { pathname: tab.href, search: location.search } : tab.href)
                : null;
              return tab.href ? (
                <Link
                  key={tab.id}
                  to={linkTarget}
                  className={`ig-clean-tab${isActive ? " ig-clean-tab--active" : ""}`}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                </Link>
              ) : (
                <button
                  key={tab.id}
                  type="button"
                  className={`ig-clean-tab${isActive ? " ig-clean-tab--active" : ""}`}
                  disabled={!tab.href}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <h2 className="ig-clean-title">Visão Geral</h2>

        {/* Grid Principal */}
        <div className="ig-clean-grid">
          <div className="ig-clean-grid__left">
            <section className="ig-profile-vertical">
              <div className="ig-profile-vertical__cover" style={heroCoverStyle}>
                {coverLoading && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "rgba(17,24,39,0.35)",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 600,
                      fontSize: "0.95rem",
                      zIndex: 2,
                    }}
                  >
                    Carregando capa...
                  </div>
                )}
                {coverError && (
                  <div
                    style={{
                      position: "absolute",
                      left: 12,
                      bottom: 12,
                      right: 12,
                      background: "rgba(255,255,255,0.92)",
                      color: "#b91c1c",
                      border: "1px solid #fecdd3",
                      borderRadius: "10px",
                      padding: "8px 10px",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                    }}
                  >
                    {coverError}
                  </div>
                )}
                <div style={{ position: "absolute", right: 12, bottom: 12, display: "flex", gap: "8px" }}>
                  <label
                    htmlFor="fb-cover-upload"
                    style={{
                      background: "rgba(255,255,255,0.9)",
                      color: "#111827",
                      borderRadius: "8px",
                      padding: "6px 10px",
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      border: "1px solid #e5e7eb",
                      fontWeight: 600,
                    }}
                  >
                    Enviar capa
                  </label>
                  {coverImage && (
                    <button
                      type="button"
                      onClick={handleCoverRemove}
                      style={{
                        background: "rgba(255,255,255,0.9)",
                        color: "#b91c1c",
                        borderRadius: "8px",
                        padding: "6px 10px",
                        fontSize: "0.85rem",
                        border: "1px solid #fecdd3",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Remover
                    </button>
                  )}
                  <input
                    id="fb-cover-upload"
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleCoverUpload}
                  />
                </div>
              </div>

              <div className="ig-profile-vertical__avatar-wrapper">
                <div className="ig-profile-vertical__avatar">
                  {avatarUrl ? <img src={avatarUrl} alt="Profile" /> : <span>{accountInitial}</span>}
                </div>
              </div>

              <div className="ig-profile-vertical__body">
                <h3 className="ig-profile-vertical__username" style={{ marginTop: '-10px' }}>
                  {accountConfig?.label || accountConfig?.name || "Página Facebook"}
                </h3>

                <div className="ig-profile-vertical__stats-grid">
                  <div className="ig-overview-stat">
                    <div className="ig-overview-stat__value">
                      {overviewIsLoading ? "..." : formatNumber(overviewMetrics.followers)}
                    </div>
                    <div className="ig-overview-stat__label">Total de seguidores</div>
                  </div>
                  <div className="ig-overview-stat">
                    <div className="ig-overview-stat__value">
                      {overviewIsLoading ? "..." : formatNumber(overviewMetrics.reach)}
                    </div>
                    <div className="ig-overview-stat__label">
                      {overviewIsLoading ? "Alcance (carregando)" : reachPeriodLabel}
                    </div>
                  </div>
                </div>

                <div className="ig-overview-activity" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  <div className="ig-overview-stat">
                    <div className="ig-overview-stat__value">{formatNumber(overviewMetrics.engagement || 0)}</div>
                    <div className="ig-overview-stat__label">Engajamento total</div>
                  </div>

                  <div className="ig-overview-stat">
                    <div className="ig-overview-stat__value">{formatNumber(overviewMetrics.pageViews || 0)}</div>
                    <div className="ig-overview-stat__label">Visualizações de página</div>
                  </div>

                </div>

                <div className="ig-profile-vertical__divider" />

                <div className="ig-profile-vertical__engagement">
                  <h4>Engajamento por Conteúdo</h4>
                  {engagementBreakdown.length ? (
                    <>
                      <div className="ig-profile-vertical__engagement-chart">
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie
                              data={engagementBreakdown}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={55}
                              outerRadius={85}
                              paddingAngle={3}
                              stroke="none"
                            >
                              <Cell fill="#1877F2" />
                              <Cell fill="#0A66C2" />
                              <Cell fill="#42A5F5" />
                            </Pie>
                            <Tooltip formatter={(value, name) => [Number(value).toLocaleString("pt-BR"), name]} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="ig-engagement-legend">
                        {engagementBreakdown.map((slice, index) => (
                          <div key={slice.name || index} className="ig-engagement-legend__item">
                            <span
                              className="ig-engagement-legend__swatch"
                              style={{ backgroundColor: index === 0 ? "#1877F2" : index === 1 ? "#0A66C2" : "#42A5F5" }}
                            />
                            <span className="ig-engagement-legend__label">{slice.name}</span>
                          </div>
                        ))}
                      </div>

                      <div className="ig-engagement-summary">
                        <div className="ig-engagement-summary__value">{engagementRateDisplay}</div>
                        <div className="ig-engagement-summary__label">Total de engajamento do período</div>
                      </div>
                    </>
                  ) : (
                    <div className="ig-empty-state">Sem dados</div>
                  )}
                </div>

                {/* Posts em Destaque - Placeholder */}
                <div className="ig-profile-vertical__divider" />
                <div className="ig-profile-vertical__top-posts">
                  <h4>Top posts</h4>
                  <div className="ig-top-posts-list">
                    <div className="ig-empty-state">
                      <p style={{ fontSize: '14px', color: '#666', textAlign: 'center', padding: '20px 0' }}>
                        Seção de Top Posts será implementada em breve
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="ig-clean-grid__right">
            {/* Card de Crescimento do Perfil */}
            <section className="ig-growth-clean">
              <header className="ig-card-header">
                <div>
                  <h2 className="ig-clean-title2">Crescimento do perfil</h2>
                  <h3>Alcance</h3>
                </div>
              </header>

              <div className="ig-chart-area">
                {reachTimelineData.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart
                      data={reachTimelineData}
                      margin={{ top: 24, right: 28, left: 12, bottom: 12 }}
                    >
                      <defs>
                        <linearGradient id="fbReachGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#1877F2" />
                          <stop offset="100%" stopColor="#0A66C2" />
                        </linearGradient>
                        <linearGradient id="fbReachGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgba(24, 119, 242, 0.32)" />
                          <stop offset="100%" stopColor="rgba(10, 102, 194, 0)" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="4 8" stroke="#f3f4f6" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: '#111827' }}
                        fontSize={12}
                        tickLine={false}
                        axisLine={{ stroke: '#e5e7eb' }}
                      />
                      <YAxis
                        tick={{ fill: '#111827' }}
                        fontSize={12}
                        tickLine={false}
                        axisLine={{ stroke: '#e5e7eb' }}
                        tickFormatter={(value) => formatShortNumber(value)}
                        domain={['dataMin', (dataMax) => (Number.isFinite(dataMax) ? Math.ceil(dataMax * 1.1) : dataMax)]}
                      />
                      <Tooltip
                        cursor={{ stroke: 'rgba(17, 24, 39, 0.2)', strokeDasharray: '4 4' }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const [{ payload: item, value }] = payload;
                          const numericValue = Number(value ?? item?.value ?? 0);
                          const label = item?.label ?? "Período";
                          const isPeak =
                            !!peakReachPoint &&
                            item?.dateKey === peakReachPoint.dateKey &&
                            numericValue === peakReachPoint.value;
                          return (
                            <div className="ig-tooltip">
                              <span className="ig-tooltip__title">{label}</span>
                              <div className="ig-tooltip__row">
                                <span>Contas alcançadas</span>
                                <strong>{numericValue.toLocaleString("pt-BR")}</strong>
                              </div>
                              {isPeak ? (
                                <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>
                                  Pico do período
                                </div>
                              ) : null}
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        fill="url(#fbReachGlow)"
                        stroke="none"
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="url(#fbReachGradient)"
                        strokeWidth={7}
                        strokeOpacity={0.2}
                        dot={false}
                        isAnimationActive={false}
                        activeDot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="url(#fbReachGradient)"
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 6, fill: '#ffffff', stroke: '#1877F2', strokeWidth: 2 }}
                      />
                      {peakReachPoint ? (
                        <>
                          <ReferenceLine
                            x={peakReachPoint.label}
                            stroke="#111827"
                            strokeDasharray="4 4"
                            strokeOpacity={0.45}
                          />
                          <ReferenceLine
                            y={peakReachPoint.value}
                            stroke="#111827"
                            strokeDasharray="4 4"
                            strokeOpacity={0.45}
                          />
                          <ReferenceDot
                            x={peakReachPoint.label}
                            y={peakReachPoint.value}
                            r={6}
                            fill="#111827"
                            stroke="#ffffff"
                            strokeWidth={2}
                          />
                        </>
                      ) : null}
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="ig-empty-state">Sem dados disponíveis</div>
                )}
              </div>
            </section>

            {/* Card de Crescimento de Seguidores */}
            <section className="ig-growth-clean fb-growth-followers fb-follower-growth-card">
              <header className="ig-card-header">
                <div>
                  <h3>Crescimento de Seguidores</h3>
                  <p className="ig-card-subtitle">Evolução mensal</p>
                </div>
              </header>

              <div className="ig-chart-area">
                {FOLLOWER_GROWTH_SERIES.length ? (
                  <>
                    <div style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
                      <div style={{ minWidth: Math.max(FOLLOWER_GROWTH_SERIES.length * 60, 100) + '%' }}>
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={FOLLOWER_GROWTH_SERIES} margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                            <defs>
                              <linearGradient id="fbBarGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#1877F2" stopOpacity={1} />
                                <stop offset="100%" stopColor="#0A66C2" stopOpacity={1} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                            <XAxis
                              dataKey="label"
                              tick={{ fill: '#111827' }}
                              fontSize={11}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fill: '#111827' }}
                              fontSize={11}
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(value) => {
                                if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                                return value;
                              }}
                            />
                            <Tooltip
                              cursor={{ fill: 'rgba(24, 119, 242, 0.1)' }}
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const data = payload[0];
                                return (
                                  <div className="ig-follower-tooltip">
                                    <div className="ig-follower-tooltip__label">Total seguidores: {data.value?.toLocaleString('pt-BR')}</div>
                                    <div className="ig-follower-tooltip__date">{data.payload.label}</div>
                                  </div>
                                );
                              }}
                            />
                            <Bar
                              dataKey="value"
                              fill="url(#fbBarGradient)"
                              radius={[8, 8, 0, 0]}
                              maxBarSize={40}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="ig-chart-slider">
                      <div className="ig-chart-slider__track">
                        <div className="ig-chart-slider__handle fb-chart-slider__handle--left" />
                        <div className="ig-chart-slider__handle fb-chart-slider__handle--right" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="ig-empty-state">Sem histórico recente.</div>
                )}
              </div>
            </section>

            <div className="ig-analytics-grid fb-analytics-grid--pair">
              <section className="ig-card-white fb-analytics-card">
                <div className="ig-analytics-card__header">
                  <h4>Estatística por gênero</h4>
                  <button type="button" className="ig-card-filter">Mar 26 - Abr 01 ▾</button>
                </div>
                <div className="ig-analytics-card__body">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      {/* Blue circle (background) */}
                      <Pie
                        data={[{ value: 100 }]}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        outerRadius={85}
                        innerRadius={0}
                        fill="#1877F2"
                        stroke="none"
                        isAnimationActive={false}
                      />
                      {/* Light blue circle (foreground - overlapping) */}
                      <Pie
                        data={genderStatsSeries}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={85}
                        innerRadius={0}
                        startAngle={90}
                        endAngle={90 + (genderStatsSeries[0]?.value || 0) * 3.6}
                        fill="#42A5F5"
                        stroke="none"
                        paddingAngle={0}
                      />
                      <Tooltip content={(props) => <BubbleTooltip {...props} suffix="%" />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="ig-analytics-legend">
                    {genderStatsSeries.map((slice, index) => (
                      <div key={slice.name || index} className="ig-analytics-legend__item">
                        <span
                          className="ig-analytics-legend__swatch"
                          style={{ backgroundColor: index === 0 ? "#42A5F5" : "#1877F2" }}
                        />
                        <span className="ig-analytics-legend__label">{slice.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="ig-card-white fb-analytics-card">
                <div className="ig-analytics-card__header">
                  <h4>Idade</h4>
                  <button type="button" className="ig-card-filter">Mar 26 - Abr 01 ▾</button>
                </div>
                <div className="ig-analytics-card__body">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={[
                        { age: "13-17", male: 20, female: 30 },
                        { age: "18-24", male: 60, female: 80 },
                        { age: "25-34", male: 70, female: 75 },
                        { age: "35-44", male: 40, female: 35 },
                        { age: "45++", male: 30, female: 25 },
                      ]}
                      layout="vertical"
                      margin={{ left: 0, right: 0, top: 5, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#111827' }} fontSize={12} />
                      <YAxis type="category" dataKey="age" tick={{ fill: '#111827' }} fontSize={12} width={60} />
                      <Tooltip
                        cursor={{ fill: 'rgba(24, 119, 242, 0.1)' }}
                        formatter={(value) => Number(value).toLocaleString("pt-BR")}
                      />
                      <Bar dataKey="male" fill="#1877F2" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="female" fill="#42A5F5" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Palavras-chave - Largura Total */}
        <div className="ig-analytics-grid">
          <section className="ig-card-white fb-analytics-card" style={{ gridColumn: '1 / -1' }}>
            <div className="ig-analytics-card__header">
              <h4>Palavras chaves mais comentadas</h4>
              <button type="button" className="ig-card-filter">Mar 26 - Abr 01 ▾</button>
            </div>
            <div className="ig-analytics-card__body">
              <div className="ig-word-cloud fb-word-cloud--large">
                <span className="ig-word-cloud__word fb-word-cloud__word--xl" style={{ color: '#1877F2' }}>eventos</span>
                <span className="ig-word-cloud__word fb-word-cloud__word--lg" style={{ color: '#0A66C2' }}>negócios</span>
                <span className="ig-word-cloud__word fb-word-cloud__word--lg" style={{ color: '#42A5F5' }}>comunidade</span>
                <span className="ig-word-cloud__word fb-word-cloud__word--md" style={{ color: '#1976D2' }}>produtos</span>
                <span className="ig-word-cloud__word fb-word-cloud__word--md" style={{ color: '#0A66C2' }}>ofertas</span>
                <span className="ig-word-cloud__word fb-word-cloud__word--sm" style={{ color: '#42A5F5' }}>promoção</span>
                <span className="ig-word-cloud__word fb-word-cloud__word--md" style={{ color: '#1877F2' }}>família</span>
                <span className="ig-word-cloud__word fb-word-cloud__word--sm" style={{ color: '#42A5F5' }}>vida</span>
                <span className="ig-word-cloud__word fb-word-cloud__word--xl" style={{ color: '#0A66C2' }}>amigos</span>
                <span className="ig-word-cloud__word fb-word-cloud__word--sm" style={{ color: '#1976D2' }}>grupo</span>
                <span className="ig-word-cloud__word fb-word-cloud__word--md" style={{ color: '#1877F2' }}>curtir</span>
                <span className="ig-word-cloud__word fb-word-cloud__word--lg" style={{ color: '#42A5F5' }}>compartilhar</span>
                <span className="ig-word-cloud__word fb-word-cloud__word--sm" style={{ color: '#0A66C2' }}>seguir</span>
                <span className="ig-word-cloud__word fb-word-cloud__word--md" style={{ color: '#1976D2' }}>página</span>
                <span className="ig-word-cloud__word fb-word-cloud__word--sm" style={{ color: '#1877F2' }}>post</span>
                <span className="ig-word-cloud__word fb-word-cloud__word--md" style={{ color: '#0A66C2' }}>conteúdo</span>
                <span className="ig-word-cloud__word fb-word-cloud__word--sm" style={{ color: '#42A5F5' }}>notícias</span>
                <span className="ig-word-cloud__word fb-word-cloud__word--lg" style={{ color: '#1877F2' }}>atualização</span>
                <span className="ig-word-cloud__word fb-word-cloud__word--sm" style={{ color: '#1976D2' }}>novidade</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
