import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useLocation, useOutletContext } from "react-router-dom";
import { differenceInCalendarDays, endOfDay, startOfDay, subDays } from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  BarChart3,
  BellRing,
  Bookmark,
  CalendarDays,
  Clock,
  Flame,
  FileText,
  Facebook,
  Hash,
  Heart,
  Instagram as InstagramIcon,
  MessageCircle,
  Play,
  Share2,
  TrendingUp,
  Settings,
  Shield,
} from "lucide-react";
import useQueryState from "../hooks/useQueryState";
import { useAccounts } from "../context/AccountsContext";
import { DEFAULT_ACCOUNTS } from "../data/accounts";
import AccountSelect from "../components/AccountSelect";
import DateRangePicker from "../components/DateRangePicker";

const API_BASE_URL = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
const FALLBACK_ACCOUNT_ID = DEFAULT_ACCOUNTS[0]?.id || "";
const HASHTAG_REGEX = /#([A-Za-z0-9_]+)/g;
const STOP_WORDS = new Set([
  "a", "ao", "aos", "as", "com", "da", "das", "de", "do", "dos", "e", "em", "no", "nos", "na", "nas", "o", "os", "para",
  "por", "que", "se", "sem", "um", "uma", "uns", "umas", "foi", "sao", "ser", "como", "mais", "mas", "ja", "vai",
  "tem", "ter", "pra", "nosso", "nossa", "seu", "sua", "the", "and", "of",
]);

const IG_TOPBAR_PRESETS = [
  { id: "7d", label: "7 Days", days: 7 },
  { id: "1m", label: "1 Month", days: 30 },
  { id: "3m", label: "3 Months", days: 90 },
];

const HERO_TABS = [
  { id: "instagram", label: "Instagram", href: "/instagram", icon: InstagramIcon },
  { id: "facebook", label: "Facebook", href: "/facebook", icon: Facebook },
  { id: "ads", label: "Ads", icon: BarChart3 },
  { id: "reports", label: "Relatorios", href: "/relatorios", icon: FileText },
  { id: "admin", label: "Admin", href: "/admin", icon: Shield },
  { id: "settings", label: "Configuracoes", href: "/configuracoes", icon: Settings },
];

const toUnixSeconds = (date) => Math.floor(date.getTime() / 1000);

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" });

const mapByKey = (items) => {
  const map = {};
  (items || []).forEach((item) => {
    if (item && item.key) map[item.key] = item;
  });
  return map;
};

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

const normalizeNumericString = (value) => (
  String(value)
    .replace(/\s+/g, "")
    .replace(/[.,](?=\d{3}(\D|$))/g, "")
    .replace(",", ".")
);

const tryParseNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const normalized = normalizeNumericString(value);
    if (!normalized.length) return null;
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (Array.isArray(value)) return value.length;
  if (typeof value === "object") {
    const candidatePaths = [
      ["value"],
      ["count"],
      ["total"],
      ["totalCount"],
      ["total_count"],
      ["summary", "total"],
      ["summary", "totalCount"],
      ["summary", "total_count"],
      ["summary", "count"],
      ["summary", "value"],
    ];
    for (const path of candidatePaths) {
      let current = value;
      for (const key of path) {
        if (current === null || current === undefined) break;
        current = current[key];
      }
      const parsed = tryParseNumber(current);
      if (parsed !== null) return parsed;
    }
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const extractNumber = (value, fallback = 0) => {
  const parsed = tryParseNumber(value);
  return parsed !== null ? parsed : fallback;
};

const pickFirstNumber = (candidates, fallback = 0) => {
  for (const candidate of candidates) {
    const parsed = tryParseNumber(candidate);
    if (parsed !== null) return parsed;
  }
  return fallback;
};

const getNestedValue = (object, path) => {
  if (!object) return null;
  const segments = Array.isArray(path) ? path : String(path).split(".");
  let current = object;
  for (const segment of segments) {
    if (current === null || current === undefined) return null;
    current = current[segment];
  }
  return current;
};

const POST_METRIC_PATHS = {
  likes: [
    ["likeCount"],
    ["like_count"],
    ["likes"],
    ["metrics", "likes"],
    ["metrics", "likes", "value"],
    ["insights", "likes"],
    ["insights", "likes", "value"],
  ],
  comments: [
    ["commentsCount"],
    ["comments_count"],
    ["commentCount"],
    ["comment_count"],
    ["comments"],
    ["comments", "summary"],
    ["comments", "summary", "count"],
    ["comments", "summary", "total"],
    ["comments", "summary", "total_count"],
    ["commentsSummary"],
    ["commentsSummary", "count"],
    ["commentsSummary", "total"],
    ["commentsSummary", "total_count"],
    ["comments_summary"],
    ["comments_summary", "count"],
    ["comments_summary", "total"],
    ["comments_summary", "total_count"],
    ["metrics", "comments"],
    ["metrics", "comments", "value"],
    ["insights", "comments"],
    ["insights", "comments", "value"],
  ],
  shares: [
    ["shares"],
    ["shareCount"],
    ["share_count"],
    ["metrics", "shares"],
    ["metrics", "shares", "value"],
    ["insights", "shares"],
    ["insights", "shares", "value"],
  ],
  saves: [
    ["saved"],
    ["saves"],
    ["saveCount"],
    ["save_count"],
    ["metrics", "saves"],
    ["metrics", "saves", "value"],
    ["insights", "saves"],
    ["insights", "saves", "value"],
  ],
};

const resolvePostMetric = (post, metric, fallback = 0) => {
  const paths = POST_METRIC_PATHS[metric] || [];
  const candidates = paths.map((path) => getNestedValue(post, path));
  return pickFirstNumber(candidates, fallback);
};

const sumInteractions = (post) => {
  const likes = resolvePostMetric(post, "likes");
  const comments = resolvePostMetric(post, "comments");
  const shares = resolvePostMetric(post, "shares");
  const saves = resolvePostMetric(post, "saves");
  return likes + comments + shares + saves;
};

const truncate = (text, length = 120) => {
  if (!text) return "";
  return text.length <= length ? text : `${text.slice(0, length - 3)}...`;
};
const parseQueryDate = (value) => {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const ms = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeDateKey = (input) => {
  if (!input) return null;
  const date = typeof input === "number"
    ? new Date(input > 1_000_000_000_000 ? input : input * 1000)
    : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const seriesFromMetric = (metric) => {
  if (!metric) return [];
  const candidateKeys = ["timeline", "timeseries", "series", "history", "values", "data"];
  for (const key of candidateKeys) {
    const entries = metric[key];
    if (Array.isArray(entries) && entries.length) {
      return entries
        .map((entry) => {
          const dateKey = normalizeDateKey(
            entry.date ||
            entry.end_time ||
            entry.endTime ||
            entry.timestamp ||
            entry.period ||
            entry.label,
          );
          if (!dateKey) return null;
          const value = extractNumber(entry.value ?? entry.count ?? entry.total ?? entry.metric ?? entry.amount, 0);
          return { date: dateKey, value };
        })
        .filter(Boolean);
    }
  }
  return [];
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

const classifyMediaType = (post) => {
  const rawMediaType = String(post.mediaType || post.media_type || "").toUpperCase();
  const mediaProductType = String(post.mediaProductType || post.media_product_type || "").toUpperCase();
  if (rawMediaType === "CAROUSEL_ALBUM" || mediaProductType === "CAROUSEL_ALBUM") return "CAROUSEL";
  if (rawMediaType === "VIDEO" || rawMediaType === "REEL" || mediaProductType === "REEL") return "VIDEO";
  return "IMAGE";
};

const analyzeBestTimes = (posts) => {
  if (!Array.isArray(posts) || posts.length === 0) {
    return {
      bestDay: "",
      bestTimeRange: "",
      avgEngagement: 0,
      confidence: "baixa",
    };
  }

  const dayTotals = new Map();
  const hourTotals = new Map();

  posts.forEach((post) => {
    if (!post.timestamp) return;
    const date = new Date(post.timestamp);
    if (Number.isNaN(date.getTime())) return;
    const engagement = sumInteractions(post);

    const dayName = date.toLocaleDateString("pt-BR", { weekday: "long" });
    const dayLabel = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    const hour = date.getHours();

    dayTotals.set(dayLabel, (dayTotals.get(dayLabel) || 0) + engagement);
    hourTotals.set(hour, (hourTotals.get(hour) || 0) + engagement);
  });

  const bestDay = Array.from(dayTotals.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  let bestHourStart = 0;
  let bestHourValue = -Infinity;
  for (let hour = 0; hour <= 21; hour += 1) {
    const total = (hourTotals.get(hour) || 0)
      + (hourTotals.get(hour + 1) || 0)
      + (hourTotals.get(hour + 2) || 0);
    if (total > bestHourValue) {
      bestHourValue = total;
      bestHourStart = hour;
    }
  }

  const bestTimeRange = `${String(bestHourStart).padStart(2, "0")}:00 - ${String(bestHourStart + 3).padStart(2, "0")}:00`;
  const avgEngagement = Math.round(posts.reduce((sum, post) => sum + sumInteractions(post), 0) / posts.length);
  let confidence = "baixa";
  if (posts.length >= 30) confidence = "alta";
  else if (posts.length >= 15) confidence = "media";

  return { bestDay, bestTimeRange, avgEngagement, confidence };
};

const buildKeywordFrequency = (posts) => {
  const counts = new Map();
  posts.forEach((post) => {
    if (!post.caption) return;
    const normalized = post.caption
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, " ");
    const words = normalized.split(/[^a-z0-9a-y]+/i).filter((word) => word.length > 2 && !STOP_WORDS.has(word));
    words.forEach((word) => {
      counts.set(word, (counts.get(word) || 0) + 1);
    });
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word, value]) => ({ word, value }));
};

const buildHashtagFrequency = (posts) => {
  const counts = new Map();
  posts.forEach((post) => {
    if (!post.caption) return;
    const matches = post.caption.matchAll(HASHTAG_REGEX);
    for (const match of matches) {
      const tag = match[1]?.toLowerCase();
      if (tag) counts.set(`#${tag}`, (counts.get(`#${tag}`) || 0) + 1);
    }
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }));
};

const IG_DONUT_COLORS = ["#8b5cf6", "#f97316", "#ec4899", "#14b8a6"];
const IG_CONTENT_LABEL = {
  IMAGE: "Imagem",
  VIDEO: "Video",
  CAROUSEL: "Carrossel",
};
export default function InstagramDashboard() {
  const outlet = useOutletContext() || {};
  const { setTopbarConfig, resetTopbarConfig } = outlet;
  const location = useLocation();
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

  const sinceParam = getQuery("since");
  const untilParam = getQuery("until");
  const sinceDate = useMemo(() => parseQueryDate(sinceParam), [sinceParam]);
  const untilDate = useMemo(() => parseQueryDate(untilParam), [untilParam]);
  const now = useMemo(() => new Date(), []);
  const defaultEnd = useMemo(() => endOfDay(subDays(startOfDay(now), 1)), [now]);

  const activePreset = useMemo(() => {
    if (!sinceDate || !untilDate) return "custom";
    const diff = differenceInCalendarDays(endOfDay(untilDate), startOfDay(sinceDate)) + 1;
    const preset = IG_TOPBAR_PRESETS.find((item) => item.days === diff);
    return preset?.id ?? "custom";
  }, [sinceDate, untilDate]);

  const handlePresetSelect = useCallback(
    (presetId) => {
      const preset = IG_TOPBAR_PRESETS.find((item) => item.id === presetId);
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

  const topbarFilters = useMemo(
    () => (
      <div className="ig-topbar-controls">
        <div className="ig-topbar-controls__chips">
          {IG_TOPBAR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`ig-topbar-controls__chip${activePreset === preset.id ? " ig-topbar-controls__chip--active" : ""}`}
              onClick={() => handlePresetSelect(preset.id)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="ig-topbar-controls__date">
          <CalendarDays size={16} />
          <DateRangePicker />
        </div>
        <div className="ig-topbar-controls__account">
          <AccountSelect />
        </div>
        <button type="button" className="ig-topbar-controls__bell" aria-label="Notificacoes">
          <BellRing size={16} />
          <span className="ig-topbar-controls__bell-dot" />
        </button>
      </div>
    ),
    [activePreset, handlePresetSelect],
  );

  const [metrics, setMetrics] = useState([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState("");

  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState("");

  const [igSummary, setIgSummary] = useState({
    accountsEngaged: null,
    profileViews: null,
    websiteClicks: null,
  });

  const [accountInfo, setAccountInfo] = useState(null);
  const [followerSeries, setFollowerSeries] = useState([]);
  const [followerCounts, setFollowerCounts] = useState(null);

  useEffect(() => {
    if (!setTopbarConfig) return undefined;
    setTopbarConfig({
      title: "Instagram",
      showFilters: false,
      customFilters: topbarFilters,
      rightExtras: null,
    });
    return () => resetTopbarConfig?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topbarFilters]);

  useEffect(() => {
    if (!accountConfig?.instagramUserId) {
      setMetrics([]);
      setFollowerSeries([]);
      setMetricsError("Conta do Instagram nao configurada.");
      setIgSummary({ accountsEngaged: null, profileViews: null, websiteClicks: null });
      return;
    }

    const controller = new AbortController();
    (async () => {
      setLoadingMetrics(true);
      setMetricsError("");
      try {
        const params = new URLSearchParams();
        if (sinceParam) params.set("since", sinceParam);
        if (untilParam) params.set("until", untilParam);
        params.set("igUserId", accountConfig.instagramUserId);
        const url = `${API_BASE_URL}/api/instagram/metrics?${params.toString()}`;
        const resp = await fetch(url, { signal: controller.signal });
        const json = safeParseJson(await resp.text()) || {};
        if (!resp.ok) throw new Error(describeApiError(json, "Falha ao carregar metricas do Instagram."));
        setMetrics(json.metrics || []);
        setFollowerSeries(Array.isArray(json.follower_series) ? json.follower_series : []);
        setFollowerCounts(json.follower_counts || null);
        setIgSummary({
          accountsEngaged: tryParseNumber(json.accounts_engaged),
          profileViews: tryParseNumber(json.profile_views),
          websiteClicks: tryParseNumber(json.website_clicks),
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          setMetrics([]);
          setFollowerSeries([]);
          setFollowerCounts(null);
          setIgSummary({ accountsEngaged: null, profileViews: null, websiteClicks: null });
          setMetricsError(err.message || "Nao foi possivel atualizar.");
        }
      } finally {
        setLoadingMetrics(false);
      }
    })();

    return () => controller.abort();
  }, [accountConfig?.instagramUserId, sinceParam, untilParam]);

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
        const params = new URLSearchParams({ igUserId: accountConfig.instagramUserId, limit: "20" });
        const url = `${API_BASE_URL}/api/instagram/posts?${params.toString()}`;
        const resp = await fetch(url, { signal: controller.signal });
        const json = safeParseJson(await resp.text()) || {};
        if (!resp.ok) throw new Error(describeApiError(json, "Falha ao carregar posts do Instagram."));
        setPosts(json.posts || []);
        setAccountInfo(json.account || null);
      } catch (err) {
        if (err.name !== "AbortError") {
          setPosts([]);
          setAccountInfo(null);
          setPostsError(err.message || "Nao foi possivel carregar os posts.");
        }
      } finally {
        setLoadingPosts(false);
      }
    })();

    return () => controller.abort();
  }, [accountConfig?.instagramUserId]);

  const metricsByKey = useMemo(() => mapByKey(metrics), [metrics]);
  const interactionsMetric = metricsByKey.interactions;
  const reachMetric = metricsByKey.reach;
  const followersMetric = metricsByKey.followers_total;
  const followerGrowthMetric = metricsByKey.follower_growth;

  const timelineReachSeries = useMemo(() => seriesFromMetric(reachMetric), [reachMetric]);
  const timelineInteractionsSeries = useMemo(() => seriesFromMetric(interactionsMetric), [interactionsMetric]);

  const followerSeriesNormalized = useMemo(() => (followerSeries || [])
    .map((entry) => {
      const dateKey = normalizeDateKey(entry.date || entry.end_time || entry.endTime);
      if (!dateKey) return null;
      return { date: dateKey, value: extractNumber(entry.value, null) };
    })
    .filter(Boolean), [followerSeries]);

  const timelineData = useMemo(() => {
    const buckets = new Map();

    const register = (series, key) => {
      series.forEach(({ date, value }) => {
        if (!date) return;
        if (!buckets.has(date)) {
          buckets.set(date, { dateKey: date });
        }
        buckets.get(date)[key] = value;
      });
    };

    register(timelineReachSeries, "reach");
    register(timelineInteractionsSeries, "interactions");
    register(followerSeriesNormalized, "followers");

    return Array.from(buckets.values())
      .sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1))
      .map((bucket) => ({
        ...bucket,
        label: SHORT_DATE_FORMATTER.format(new Date(`${bucket.dateKey}T00:00:00`)),
      }));
  }, [timelineReachSeries, timelineInteractionsSeries, followerSeriesNormalized]);

  const filteredPosts = useMemo(() => {
    if (!posts.length) return [];
    if (!sinceDate && !untilDate) return posts;
    return posts.filter((post) => {
      if (!post.timestamp) return true;
      const date = new Date(post.timestamp);
      if (Number.isNaN(date.getTime())) return true;
      if (sinceDate && date < sinceDate) return false;
      if (untilDate && date > untilDate) return false;
      return true;
    });
  }, [posts, sinceDate, untilDate]);

  const totalFollowers = useMemo(() => {
    const accountFollowers = pickFirstNumber(
      [
        accountInfo?.followers_count,
        accountInfo?.followers,
        getNestedValue(accountInfo, ["followers", "count"]),
        getNestedValue(accountInfo, ["insights", "followers"]),
        getNestedValue(accountInfo, ["insights", "followers", "value"]),
      ],
      null,
    );
    if (accountFollowers !== null) return accountFollowers;

    const countsFollowers = tryParseNumber(followerCounts?.end ?? followerCounts?.total);
    if (countsFollowers !== null) return countsFollowers;

    const metricValue = tryParseNumber(followersMetric?.value);
    if (metricValue !== null) return metricValue;

    if (followerSeriesNormalized.length) {
      const latestPoint = followerSeriesNormalized[followerSeriesNormalized.length - 1];
      const latestValue = tryParseNumber(latestPoint?.value);
      if (latestValue !== null) return latestValue;
    }

    return 0;
  }, [accountInfo, followerCounts, followersMetric?.value, followerSeriesNormalized]);

  const reachValue = extractNumber(reachMetric?.value, 0);
  const interactionsValue = extractNumber(interactionsMetric?.value, 0);
  const interactionsDelta = interactionsMetric?.deltaPct ?? null;

  const avgFollowersPerDay = useMemo(() => {
    if (followerSeriesNormalized.length >= 2) {
      const first = followerSeriesNormalized[0];
      const last = followerSeriesNormalized[followerSeriesNormalized.length - 1];
      const diff = extractNumber(last.value) - extractNumber(first.value);
      const days = Math.max(1, followerSeriesNormalized.length - 1);
      return Math.round(diff / days);
    }
    const fallback = extractNumber(followerGrowthMetric?.value, 0);
    return fallback ? Math.round(fallback / 30) : 0;
  }, [followerSeriesNormalized, followerGrowthMetric?.value]);

  const postsCount = filteredPosts.length;

  const contentBreakdown = useMemo(() => {
    if (!filteredPosts.length) return [];
    const totals = new Map();
    filteredPosts.forEach((post) => {
      const kind = classifyMediaType(post);
      totals.set(kind, (totals.get(kind) || 0) + sumInteractions(post));
    });
    return Array.from(totals.entries()).map(([type, value]) => ({
      name: IG_CONTENT_LABEL[type] || type,
      value,
    }));
  }, [filteredPosts]);

  const bestTimes = useMemo(() => analyzeBestTimes(filteredPosts), [filteredPosts]);

  const topPosts = useMemo(() => (filteredPosts.length
    ? [...filteredPosts].sort((a, b) => sumInteractions(b) - sumInteractions(a)).slice(0, 6)
    : []), [filteredPosts]);

  const followerGrowthData = useMemo(() => followerSeriesNormalized.map((item) => ({
    label: SHORT_DATE_FORMATTER.format(new Date(`${item.date}T00:00:00`)),
    followers: item.value,
  })), [followerSeriesNormalized]);

  const genderDistribution = useMemo(() => {
    const breakdown =
      metricsByKey.audience_gender?.breakdown ||
      metricsByKey.gender?.breakdown ||
      metricsByKey.audience_gender_age?.breakdown ||
      metricsByKey.gender_distribution?.value ||
      accountInfo?.audience_gender;

    if (!breakdown) return [];
    const entries = Array.isArray(breakdown)
      ? breakdown
      : Object.entries(breakdown).map(([name, value]) => ({ name, value }));

    return entries
      .map((entry) => ({
        name: entry.name || entry.key || entry.label,
        value: extractNumber(entry.value ?? entry.count ?? entry.total, 0),
      }))
      .filter((entry) => entry.name && entry.value > 0);
  }, [metricsByKey, accountInfo]);

  const postsPerDayData = useMemo(() => {
    if (!filteredPosts.length) return [];
    const counter = new Map();
    filteredPosts.forEach((post) => {
      if (!post.timestamp) return;
      const date = new Date(post.timestamp);
      if (Number.isNaN(date.getTime())) return;
      const key = date.toISOString().slice(0, 10);
      counter.set(key, (counter.get(key) || 0) + 1);
    });
    return Array.from(counter.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, value]) => ({
        label: SHORT_DATE_FORMATTER.format(new Date(`${date}T00:00:00`)),
        value,
      }));
  }, [filteredPosts]);

  const keywordList = useMemo(() => buildKeywordFrequency(filteredPosts), [filteredPosts]);
  const hashtagList = useMemo(() => buildHashtagFrequency(filteredPosts), [filteredPosts]);

  const accountInitial = (accountInfo?.username || accountInfo?.name || "IG").charAt(0).toUpperCase();

  return (
    <div className="instagram-dashboard instagram-dashboard--clean">
      {metricsError && <div className="alert alert--error">{metricsError}</div>}
      {postsError && <div className="alert alert--error">{postsError}</div>}

      {/* Topbar Global Unificada */}
      <div className="global-topbar">
        <div className="global-topbar__left">
          <div className="global-topbar__logo">
            <img src="/favicon2.png" alt="MSL Monitor" />
          </div>
        </div>

        <div className="global-topbar__center">
          <div className="global-topbar__icon">
            <BellRing size={18} style={{ color: '#ec4899' }} />
          </div>

          <div className="global-topbar__date-picker">
            <CalendarDays size={16} />
            <span>26 Mar, 2019 - 26 Abr, 2019</span>
            <ChevronDown size={14} />
          </div>

          <div className="global-topbar__filters">
            {IG_TOPBAR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`global-topbar__chip${activePreset === preset.id ? " global-topbar__chip--active" : ""}`}
                onClick={() => handlePresetSelect(preset.id)}
              >
                {preset.id === '7d' ? '7 Dias' : preset.id === '1m' ? '1 Mês' : '3 Meses'}
              </button>
            ))}
          </div>
        </div>

        <div className="global-topbar__right">
          <div className="global-topbar__user-dropdown">
            <div className="global-topbar__avatar">
              {accountInfo?.profile_picture_url ? (
                <img src={accountInfo.profile_picture_url} alt="User" />
              ) : (
                <span>{accountInitial}</span>
              )}
            </div>
            <div className="global-topbar__user-info">
              <span className="global-topbar__username">
                {accountConfig?.label || accountInfo?.username || "Mauro Benevides"}
              </span>
              <span className="global-topbar__account-type">
                {availableAccounts.length > 1 ? `${availableAccounts.length} contas` : 'Conta principal'}
              </span>
            </div>
            <ChevronDown size={14} />

            {/* Dropdown de Contas */}
            <div className="global-topbar__accounts-dropdown">
              {availableAccounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  className={`global-topbar__account-item${acc.id === accountId ? ' global-topbar__account-item--active' : ''}`}
                  onClick={() => setQuery({ account: acc.id })}
                >
                  <div className="global-topbar__account-avatar">
                    {acc.instagramUsername?.[0]?.toUpperCase() || acc.label?.[0]?.toUpperCase() || 'C'}
                  </div>
                  <div className="global-topbar__account-info">
                    <span className="global-topbar__account-name">{acc.label || 'Conta'}</span>
                    <span className="global-topbar__account-username">{acc.instagramUsername || '@conta'}</span>
                  </div>
                  {acc.id === accountId && (
                    <div className="global-topbar__account-check">✓</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Container Limpo (fundo branco) */}
      <div className="ig-clean-container">
        {/* Header com Logo Instagram e Tabs */}
        <div className="ig-clean-header">
          <div className="ig-clean-header__brand">
            <div className="ig-clean-header__logo">
              <InstagramIcon size={32} />
            </div>
            <h1>Instagram</h1>
          </div>

          <nav className="ig-clean-tabs">
            {HERO_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.href ? location.pathname === tab.href : tab.id === "instagram";
              return tab.href ? (
                <Link
                  key={tab.id}
                  to={tab.href}
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
          {/* Card de Perfil Vertical */}
          <section className="ig-profile-vertical">
            <div className="ig-profile-vertical__cover" />

            <div className="ig-profile-vertical__avatar-wrapper">
              <div className="ig-profile-vertical__avatar">
                {accountInfo?.profile_picture_url ? (
                  <img src={accountInfo.profile_picture_url} alt="Profile" />
                ) : (
                  <span>{accountInitial}</span>
                )}
              </div>
            </div>

            <div className="ig-profile-vertical__body">
              <h3 className="ig-profile-vertical__username">
                @{accountInfo?.username || accountInfo?.name || "insta_sample"}
              </h3>

              <div className="ig-profile-vertical__stats-grid">
                <div className="ig-stat-box">
                  <div className="ig-stat-box__value">{formatNumber(totalFollowers)}</div>
                  <div className="ig-stat-box__label">Total Seguidores</div>
                </div>
                <div className="ig-stat-box">
                  <div className="ig-stat-box__value">{formatNumber(reachValue)}</div>
                  <div className="ig-stat-box__label">Alcance 30 dias</div>
                </div>
              </div>

              <div className="ig-profile-vertical__chart-section">
                <div className="ig-stat-box">
                  <div className="ig-stat-box__value">{avgFollowersPerDay > 0 ? avgFollowersPerDay.toFixed(2) : "0,00"}</div>
                  <div className="ig-stat-box__label">Seguidores Diários</div>
                </div>

                <div className="ig-weekday-chart">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                    <div key={day + idx} className="ig-weekday-bar">
                      <div
                        className={`ig-weekday-bar__fill${idx === 1 || idx === 3 ? ' ig-weekday-bar__fill--active' : ''}`}
                        style={{ height: `${Math.random() * 60 + 20}%` }}
                      />
                      <span>{day}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ig-stat-box">
                <div className="ig-stat-box__value">{postsCount}</div>
                <div className="ig-stat-box__label">Posts Criados</div>
                <select className="ig-stat-box__dropdown">
                  <option>Esta semana</option>
                  <option>Este mês</option>
                  <option>Este ano</option>
                </select>
              </div>

              <div className="ig-weekday-chart">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                  <div key={`week2-${idx}`} className="ig-weekday-bar">
                    <div
                      className={`ig-weekday-bar__fill${idx === 3 ? ' ig-weekday-bar__fill--active' : ''}`}
                      style={{ height: `${Math.random() * 60 + 20}%` }}
                    />
                    <span>{day}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Card de Crescimento do Perfil */}
          <section className="ig-growth-clean">
            <header className="ig-card-header">
              <div>
                <h3>Crescimento do Perfil</h3>
                <p className="ig-card-subtitle">Alcance</p>
              </div>
              <div className="ig-filter-pills">
                {IG_TOPBAR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`ig-filter-pill${activePreset === preset.id ? " ig-filter-pill--active" : ""}`}
                    onClick={() => handlePresetSelect(preset.id)}
                  >
                    {preset.label}
                  </button>
                ))}
                <button className="ig-filter-pill ig-filter-pill--active">1 Year</button>
                <button className="ig-filter-pill">Maximum</button>
              </div>
            </header>

            <div className="ig-chart-area">
              {timelineData.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={timelineData}>
                    <defs>
                      <linearGradient id="cleanPurple" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="cleanOrange" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#fb923c" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#fb923c" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="cleanRed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" stroke="#9ca3af" fontSize={12} />
                    <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(value) => value.toLocaleString("pt-BR")} />
                    <Tooltip />
                    <Area type="monotone" dataKey="reach" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#cleanPurple)" />
                    <Area type="monotone" dataKey="interactions" stroke="#f43f5e" strokeWidth={2.5} fill="url(#cleanRed)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="ig-empty-state">Sem dados disponíveis</div>
              )}
            </div>
          </section>
        </div>

        {/* Segunda Linha: Engajamento + Melhor Horário + Total Engajamento */}
        <div className="ig-clean-grid-triple">
          {/* Engajamento por Conteúdo */}
          <div className="ig-card-white">
            <h4>Engajamento por Conteúdo</h4>
            <div className="ig-chart-container">
              {contentBreakdown.length ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={contentBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {contentBreakdown.map((_, index) => (
                        <Cell key={index} fill={IG_DONUT_COLORS[index % IG_DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="ig-empty-state">Sem dados</div>
              )}
            </div>
          </div>

          {/* Melhor Horário para Postar */}
          <div className="ig-card-white">
            <h4>Melhor Horário para postar</h4>
            <div className="ig-best-time-grid">
              <div className="ig-best-time-card ig-best-time-card--cyan">
                <div className="ig-best-time-card__label">Melhor Horário para postar</div>
                <div className="ig-best-time-card__value">{bestTimes.bestTimeRange}</div>
              </div>
              <div className="ig-best-time-card ig-best-time-card--pink">
                <div className="ig-best-time-card__label">Melhor dia</div>
                <div className="ig-best-time-card__value">{bestTimes.bestDay}</div>
              </div>
            </div>
          </div>

          {/* Total de Engajamento */}
          <div className="ig-card-white ig-card-dark">
            <h4 style={{color: 'white'}}>25.65%</h4>
            <p style={{color: '#9ca3af', fontSize: '14px'}}>Total de engajamento do período</p>
          </div>
        </div>

        {/* Terceira Linha: Top Posts */}
        <div className="ig-card-white ig-card-full">
          <h4>Top posts</h4>
          <div className="ig-top-posts-grid">
            {loadingPosts && !topPosts.length ? (
              <div className="ig-empty-state">Carregando...</div>
            ) : topPosts.length ? (
              topPosts.map((post) => {
                const likes = resolvePostMetric(post, "likes");
                const comments = resolvePostMetric(post, "comments");
                const saves = resolvePostMetric(post, "saves");
                const shares = resolvePostMetric(post, "shares");
                const previewUrl = [
                  post.previewUrl,
                  post.preview_url,
                  post.thumbnailUrl,
                  post.thumbnail_url,
                  post.mediaUrl,
                  post.media_url,
                ].find((url) => url && !/\.(mp4|mov)$/i.test(url));

                return (
                  <div key={post.id || post.timestamp} className="ig-top-post-item">
                    <div className="ig-top-post-item__thumb">
                      {previewUrl ? (
                        <img src={previewUrl} alt="Post" />
                      ) : (
                        <div className="ig-empty-thumb">Sem imagem</div>
                      )}
                    </div>
                    <div className="ig-top-post-item__caption">
                      {truncate(post.caption || "Sem legenda", 80)}
                    </div>
                    <div className="ig-top-post-item__stats">
                      <span><Heart size={14} /> {formatNumber(likes)}</span>
                      <span><MessageCircle size={14} /> {formatNumber(comments)}</span>
                      <span><Share2 size={14} /> {formatNumber(shares)}</span>
                      <span><Bookmark size={14} /> {formatNumber(saves)}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="ig-empty-state">Nenhum post disponível</div>
            )}
          </div>
        </div>
      </div>

      {/* Ocultar seções antigas duplicadas */}
      <div style={{display: 'none'}}>
      <div className="ig-grid ig-grid--triple">
        <div className="ig-card">
          <header className="ig-card__header">
            <div>
              <h3>Engajamento por conteudo</h3>
              <p>Distribuicao por formato</p>
            </div>
          </header>
          <div className="ig-card__chart ig-card__chart--sm">
            {contentBreakdown.length && contentBreakdown.some((item) => item.value > 0) ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={contentBreakdown}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {contentBreakdown.map((_, index) => (
                      <Cell key={index} fill={IG_DONUT_COLORS[index % IG_DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${Number(value).toLocaleString("pt-BR")}`, name]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="ig-card__empty">Sem dados de engajamento por formato.</div>
            )}
          </div>
        </div>

        <div className="ig-card ig-engagement-card">
          <header className="ig-card__header">
            <div>
              <h3>Engajamento total</h3>
              <p>Somatorio do periodo selecionado</p>
            </div>
          </header>
          <div className="ig-engagement-card__content">
            <span className="ig-engagement-card__value">{loadingMetrics ? "..." : interactionsValue.toLocaleString("pt-BR")}</span>
            <span className={`ig-engagement-card__delta${interactionsDelta === null ? "" : interactionsDelta >= 0 ? " ig-engagement-card__delta--up" : " ig-engagement-card__delta--down"}`}>
              {interactionsDelta === null ? "Sem comparacao" : `${interactionsDelta >= 0 ? "+" : ""}${interactionsDelta.toFixed(1)}% vs periodo anterior`}
            </span>
            <div className="ig-engagement-card__meta">
              <div>
                <span>Contas engajadas</span>
                <strong>{igSummary.accountsEngaged != null ? igSummary.accountsEngaged.toLocaleString("pt-BR") : ""}</strong>
              </div>
              <div>
                <span>Visitas ao perfil</span>
                <strong>{igSummary.profileViews != null ? igSummary.profileViews.toLocaleString("pt-BR") : ""}</strong>
              </div>
              <div>
                <span>Cliques no site</span>
                <strong>{igSummary.websiteClicks != null ? igSummary.websiteClicks.toLocaleString("pt-BR") : ""}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="ig-card ig-best-times">
          <header className="ig-card__header">
            <div>
              <h3>Melhor momento para postar</h3>
              <p>Baseado nos posts recentes</p>
            </div>
          </header>
          <div className="ig-best-times__grid">
            <div className="ig-best-times__card">
              <Flame size={16} />
              <div>
                <span className="ig-best-times__label">Melhor dia</span>
                <strong>{bestTimes.bestDay}</strong>
              </div>
            </div>
            <div className="ig-best-times__card">
              <Clock size={16} />
              <div>
                <span className="ig-best-times__label">Janela ideal</span>
                <strong>{bestTimes.bestTimeRange}</strong>
              </div>
            </div>
            <div className="ig-best-times__card">
              <TrendingUp size={16} />
              <div>
                <span className="ig-best-times__label">Engajamento medio</span>
                <strong>{bestTimes.avgEngagement.toLocaleString("pt-BR")}</strong>
              </div>
            </div>
          </div>
          <footer className="ig-best-times__footer">
            Baseado em {filteredPosts.length} posts  confianca {bestTimes.confidence}
          </footer>
        </div>
      </div>

      <div className="ig-card ig-top-posts">
        <header className="ig-card__header">
          <div>
            <h3>Top posts</h3>
            <p>Conteudos com maior desempenho</p>
          </div>
        </header>
        <div className="ig-top-posts__list">
          {loadingPosts && !topPosts.length ? (
            <div className="ig-card__empty">Carregando posts...</div>
          ) : topPosts.length ? (
            topPosts.map((post) => {
              const likes = resolvePostMetric(post, "likes");
              const comments = resolvePostMetric(post, "comments");
              const saves = resolvePostMetric(post, "saves");
              const shares = resolvePostMetric(post, "shares");
              const interactions = sumInteractions(post);
              const type = classifyMediaType(post);
              const timestamp = post.timestamp ? new Date(post.timestamp) : null;
              const label = timestamp ? timestamp.toLocaleDateString("pt-BR") : "";

              const previewCandidates = [
                post.previewUrl,
                post.preview_url,
                post.thumbnailUrl,
                post.thumbnail_url,
                post.posterUrl,
                post.poster_url,
                post.mediaUrl,
                post.media_url,
              ].filter(Boolean);
              const previewUrl = previewCandidates.find((url) => !/\.(mp4|mov|mpe?g|m4v|avi|wmv|flv)(\?|$)/i.test(url));

              return (
                <article key={post.id || post.permalink || post.timestamp} className="ig-top-post-card">
                  <div className="ig-top-post-card__media">
                    {previewUrl ? (
                      post.permalink ? (
                        <a href={post.permalink} target="_blank" rel="noreferrer">
                          <img src={previewUrl} alt={truncate(post.caption || "Post", 40)} />
                        </a>
                      ) : (
                        <img src={previewUrl} alt={truncate(post.caption || "Post", 40)} />
                      )
                    ) : (
                      <div className="ig-top-post-card__placeholder">Sem preview</div>
                    )}
                    {type === "VIDEO" && (
                      <span className="ig-top-post-card__badge">
                        <Play size={14} />
                      </span>
                    )}
                  </div>
                  <div className="ig-top-post-card__body">
                    <header>
                      <span className="ig-top-post-card__meta">{label}  {IG_CONTENT_LABEL[type] || type}</span>
                      <h4>{truncate(post.caption, 90) || "Sem legenda"}</h4>
                    </header>
                    <dl className="ig-top-post-card__metrics">
                      <div>
                        <dt><Heart size={14} /></dt>
                        <dd>{likes.toLocaleString("pt-BR")}</dd>
                      </div>
                      <div>
                        <dt><MessageCircle size={14} /></dt>
                        <dd>{comments.toLocaleString("pt-BR")}</dd>
                      </div>
                      <div>
                        <dt><Bookmark size={14} /></dt>
                        <dd>{saves.toLocaleString("pt-BR")}</dd>
                      </div>
                      <div>
                        <dt><Share2 size={14} /></dt>
                        <dd>{shares.toLocaleString("pt-BR")}</dd>
                      </div>
                    </dl>
                  </div>
                  <footer className="ig-top-post-card__footer">
                    <span>Total</span>
                    <strong>{interactions.toLocaleString("pt-BR")} interacoes</strong>
                  </footer>
                </article>
              );
            })
          ) : (
            <div className="ig-card__empty">Nenhum post encontrado no periodo.</div>
          )}
        </div>
      </div>
      <div className="ig-grid ig-grid--three">
        <div className="ig-card">
          <header className="ig-card__header">
            <div>
              <h3>Crescimento de seguidores</h3>
              <p>Serie diaria informada pelo Instagram</p>
            </div>
          </header>
          <div className="ig-card__chart ig-card__chart--sm">
            {followerGrowthData.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={followerGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="label" stroke="var(--text-secondary)" />
                  <YAxis stroke="var(--text-secondary)" tickFormatter={(value) => value.toLocaleString("pt-BR")} />
                  <Tooltip formatter={(value) => Number(value).toLocaleString("pt-BR")} />
                  <Bar dataKey="followers" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="ig-card__empty">Sem historico recente de seguidores.</div>
            )}
          </div>
        </div>

        <div className="ig-card">
          <header className="ig-card__header">
            <div>
              <h3>Distribuicao por genero</h3>
              <p>Participacao relativa da audiencia</p>
            </div>
          </header>
          <div className="ig-card__chart ig-card__chart--sm">
            {genderDistribution.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={genderDistribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {genderDistribution.map((_, index) => (
                      <Cell key={index} fill={IG_DONUT_COLORS[index % IG_DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${Number(value).toLocaleString("pt-BR")}`, name]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="ig-card__empty">Sem dados demograficos suficientes.</div>
            )}
          </div>
        </div>

        <div className="ig-card">
          <header className="ig-card__header">
            <div>
              <h3>Publicacoes por dia</h3>
              <p>Volume de posts no periodo selecionado</p>
            </div>
          </header>
          <div className="ig-card__chart ig-card__chart--sm">
            {postsPerDayData.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={postsPerDayData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="label" stroke="var(--text-secondary)" />
                  <YAxis stroke="var(--text-secondary)" allowDecimals={false} />
                  <Tooltip formatter={(value) => Number(value).toLocaleString("pt-BR")} />
                  <Bar dataKey="value" fill="#f97316" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="ig-card__empty">Sem publicacoes registradas no periodo.</div>
            )}
          </div>
        </div>
      </div>

      <div className="ig-grid ig-grid--dual">
        <div className="ig-card">
          <header className="ig-card__header">
            <div>
              <h3>Palavras em destaque</h3>
              <p>Termos mais recorrentes nas legendas</p>
            </div>
          </header>
          <div className="ig-keywords">
            {keywordList.length ? (
              keywordList.map((item) => (
                <span key={item.word} className="ig-keywords__item">
                  {item.word}
                  <small>{item.value}</small>
                </span>
              ))
            ) : (
              <div className="ig-card__empty">Sem termos suficientes para analise.</div>
            )}
          </div>
        </div>

        <div className="ig-card">
          <header className="ig-card__header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Hash size={16} style={{ color: 'var(--color-primary)' }} />
                <h3>Hashtags mais usadas</h3>
              </div>
              <p>Top 10 por recorrencia</p>
            </div>
          </header>
          <div className="ig-card__chart ig-card__chart--sm">
            {hashtagList.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={hashtagList} layout="vertical" margin={{ left: 12, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis type="number" stroke="var(--text-secondary)" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={140} stroke="var(--text-secondary)" />
                  <Tooltip formatter={(value) => [`${value}`, "Ocorrencias"]} />
                  <Bar dataKey="value" fill="#ec4899" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="ig-card__empty">Sem hashtags registradas.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


