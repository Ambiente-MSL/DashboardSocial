import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
  Sector,
} from "recharts";
import {
  BarChart3,
  Bookmark,
  FileText,
  Facebook,
  Hash,
  Heart,
  Instagram as InstagramIcon,
  MessageCircle,
  Share2,
  Settings,
  Shield,
} from "lucide-react";
import useQueryState from "../hooks/useQueryState";
import { useAccounts } from "../context/AccountsContext";
import { DEFAULT_ACCOUNTS } from "../data/accounts";
import { supabase } from "../lib/supabaseClient";

const API_BASE_URL = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
const FALLBACK_ACCOUNT_ID = DEFAULT_ACCOUNTS[0]?.id || "";
const COVER_BUCKET = "fotos_capa";
const HASHTAG_REGEX = /#([A-Za-z0-9_]+)/g;
const STOP_WORDS = new Set([
  "a", "ao", "aos", "as", "com", "da", "das", "de", "do", "dos", "e", "em", "no", "nos", "na", "nas", "o", "os", "para",
  "por", "que", "se", "sem", "um", "uma", "uns", "umas", "foi", "sao", "ser", "como", "mais", "mas", "ja", "vai",
  "tem", "ter", "pra", "nosso", "nossa", "seu", "sua", "the", "and", "of",
]);

const IG_TOPBAR_PRESETS = [
  { id: "7d", label: "7 dias", days: 7 },
  { id: "1m", label: "1 mes", days: 30 },
  { id: "3m", label: "3 meses", days: 90 },
  { id: "6m", label: "6 meses", days: 180 },
  { id: "1y", label: "1 ano", days: 365 },
];

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTH_SHORT_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const DEFAULT_GENDER_STATS = [
  { name: "Homens", value: 30 },
  { name: "Mulheres", value: 70 },
];

const DEFAULT_PROFILE_REACH_SERIES = [
  { dateKey: "2025-01-29", label: "29/01", value: 12000 },
  { dateKey: "2025-01-30", label: "30/01", value: 28000 },
  { dateKey: "2025-01-31", label: "31/01", value: 78000 },
  { dateKey: "2025-02-01", label: "01/02", value: 36000 },
  { dateKey: "2025-02-02", label: "02/02", value: 42000 },
  { dateKey: "2025-02-03", label: "03/02", value: 48000 },
  { dateKey: "2025-02-04", label: "04/02", value: 32000 },
  { dateKey: "2025-02-05", label: "05/02", value: 89000 },
  { dateKey: "2025-02-06", label: "06/02", value: 27000 },
];

// const HEATMAP_WEEK_LABELS = ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6"];
// const HEATMAP_DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
// const DEFAULT_HEATMAP_MATRIX = HEATMAP_DAY_LABELS.map((day, dayIndex) => ({
//   day,
//   values: HEATMAP_WEEK_LABELS.map((_, weekIndex) => ((dayIndex + weekIndex) % 6) + 1),
// }));

const buildWeeklyPattern = (values) => {
  const max = Math.max(...values, 0);
  return values.map((value, index) => ({
    label: WEEKDAY_LABELS[index] || "",
    value,
    percentage: max > 0 ? Math.round((value / max) * 100) : 0,
    active: max > 0 && value === max,
  }));
};

const FOLLOWER_GROWTH_PRESETS = [
  { id: "7d", label: "7 dias", days: 7 },
  { id: "1m", label: "1 mes", days: 30 },
  { id: "3m", label: "3 meses", days: 90 },
  { id: "6m", label: "6 meses", days: 180 },
  { id: "1y", label: "1 ano", days: 365 },
  { id: "max", label: "Maximo" },
];
const DEFAULT_FOLLOWER_GROWTH_PRESET = "1m";

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

const HERO_TABS = [
  { id: "instagram", label: "Instagram", href: "/instagram", icon: InstagramIcon },
  { id: "facebook", label: "Facebook", href: "/facebook", icon: Facebook },
  { id: "ads", label: "Ads", icon: BarChart3 },
  { id: "reports", label: "Relatórios", href: "/relatorios", icon: FileText },
  { id: "admin", label: "Admin", href: "/admin", icon: Shield },
  { id: "settings", label: "Configurações", href: "/configuracoes", icon: Settings },
];

const toUnixSeconds = (date) => Math.floor(date.getTime() / 1000);

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

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
  reach: [
    ["reach"],
    ["reachCount"],
    ["reach_count"],
    ["metrics", "reach"],
    ["metrics", "reach", "value"],
    ["metrics", "reach", "total"],
    ["metrics", "reach", "summary", "total"],
    ["insights", "reach"],
    ["insights", "reach", "value"],
    ["insights", "reach", "total"],
    ["insights", "reach", "summary", "total"],
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

const normalizeSeriesContainer = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    if (Array.isArray(raw.data)) return raw.data;
    if (Array.isArray(raw.values)) return raw.values;
    if (Array.isArray(raw.timeline)) return raw.timeline;
    if (Array.isArray(raw.points)) return raw.points;
    return Object.entries(raw).map(([dateKey, value]) => ({
      __dateKey: dateKey,
      value,
    }));
  }
  return [];
};

const normalizeSeriesEntry = (entry) => {
  if (entry == null) return null;
  if (Array.isArray(entry)) {
    if (entry.length === 0) return null;
    if (entry.length === 1) return { value: entry[0] };
    return { __dateKey: entry[0], value: entry[1] };
  }
  if (typeof entry === "number" || typeof entry === "string") {
    return { value: entry };
  }
  if (typeof entry === "object") {
    return entry;
  }
  return null;
};

const seriesFromMetric = (metric) => {
  if (!metric) return [];
  const candidateKeys = ["timeline", "timeseries", "series", "history", "values", "data"];
  for (const key of candidateKeys) {
    const entries = normalizeSeriesContainer(metric[key]);
    if (!entries.length) continue;
    const normalized = entries
      .map((rawEntry) => {
        const entry = normalizeSeriesEntry(rawEntry);
        if (!entry) return null;
        const dateKey = normalizeDateKey(
          entry.date ||
          entry.end_time ||
          entry.endTime ||
          entry.timestamp ||
          entry.period ||
          entry.label ||
          entry.__dateKey,
        );
        if (!dateKey) return null;
        const value = extractNumber(
          entry.value ?? entry.count ?? entry.total ?? entry.metric ?? entry.amount ?? entry.sum,
          null,
        );
        if (value == null) return null;
        return { date: dateKey, value };
      })
      .filter(Boolean);
    if (normalized.length) return normalized;
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
  VIDEO: "Vídeo",
  CAROUSEL: "Carrossel",
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

const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
};

const renderActiveGenderShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
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

  const accountSnapshotKey = useMemo(
    () => accountConfig?.instagramUserId || accountConfig?.id || "",
    [accountConfig?.id, accountConfig?.instagramUserId],
  );

  const coverStoragePath = useMemo(() => {
    if (!accountSnapshotKey) return null;
    return `instagram/${accountSnapshotKey}/cover`;
  }, [accountSnapshotKey]);

  const sinceParam = getQuery("since");
  const untilParam = getQuery("until");
  const sinceDate = useMemo(() => parseQueryDate(sinceParam), [sinceParam]);
  const untilDate = useMemo(() => parseQueryDate(untilParam), [untilParam]);
  const now = useMemo(() => new Date(), []);
  const defaultEnd = useMemo(() => endOfDay(subDays(startOfDay(now), 1)), [now]);

  useEffect(() => {
    if (sinceDate && untilDate) return;
    const defaultPreset = IG_TOPBAR_PRESETS.find((item) => item.id === "1m") || IG_TOPBAR_PRESETS[0];
    if (!defaultPreset?.days || defaultPreset.days <= 0) return;
    const endDate = defaultEnd;
    const startDate = startOfDay(subDays(endDate, defaultPreset.days - 1));
    setQuery({
      since: toUnixSeconds(startDate),
      until: toUnixSeconds(endDate),
    });
  }, [defaultEnd, setQuery, sinceDate, untilDate]);

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
      presets: IG_TOPBAR_PRESETS,
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
  const [metrics, setMetrics] = useState([]);
  const [metricsError, setMetricsError] = useState("");

  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState("");

  const [accountInfo, setAccountInfo] = useState(null);
  const [followerSeries, setFollowerSeries] = useState([]);
  const [followerCounts, setFollowerCounts] = useState(null);
  const [overviewSnapshot, setOverviewSnapshot] = useState(null);
  const [reachCacheSeries, setReachCacheSeries] = useState([]);
  const coverInputRef = useRef(null);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverError, setCoverError] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const [latestFollowers, setLatestFollowers] = useState(null);
  const [followerGrowthPreset, setFollowerGrowthPreset] = useState(DEFAULT_FOLLOWER_GROWTH_PRESET);
  const [activeFollowerGrowthBar, setActiveFollowerGrowthBar] = useState(-1);
  const latestFollowersRequestRef = useRef(0);
  const [activeEngagementIndex, setActiveEngagementIndex] = useState(-1);
  const [activeGenderIndex, setActiveGenderIndex] = useState(-1);

  const activeSnapshot = useMemo(
    () => (overviewSnapshot?.accountId === accountSnapshotKey && accountSnapshotKey ? overviewSnapshot : null),
    [accountSnapshotKey, overviewSnapshot],
  );

  useEffect(() => {
    setMetrics([]);
    setFollowerSeries([]);
    setFollowerCounts(null);
    setPosts([]);
    setAccountInfo(null);
    setReachCacheSeries([]);
    setCoverImageUrl("");
    setCoverError("");
    setOverviewSnapshot(null);
    setLatestFollowers(null);
    setFollowerGrowthPreset(DEFAULT_FOLLOWER_GROWTH_PRESET);
  }, [accountSnapshotKey]);

  useEffect(() => {
    const path = coverStoragePath;
    if (!path) {
      setCoverImageUrl("");
      setCoverError("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.storage
          .from(COVER_BUCKET)
          .createSignedUrl(path, 3600);
        if (error) throw error;
        if (!cancelled) {
          const signedUrl = data?.signedUrl ? `${data.signedUrl}&cb=${Date.now()}` : "";
          setCoverImageUrl(signedUrl);
          setCoverError("");
        }
      } catch (err) {
        if (cancelled) return;
        const message = err?.message || String(err || "");
        const notFound = /not\s+found|no such/gim.test(message);
        if (!notFound) {
          console.warn("Falha ao carregar capa do perfil", err);
          setCoverError("Não foi possível carregar a capa.");
        } else {
          setCoverError("");
        }
        setCoverImageUrl("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coverStoragePath]);

  const handleCoverButtonClick = useCallback(() => {
    setCoverError("");
    coverInputRef.current?.click();
  }, []);

  const handleCoverUpload = useCallback(
    async (event) => {
      const file = event.target?.files?.[0];
      if (!file || !coverStoragePath) {
        if (event.target) event.target.value = "";
        return;
      }
      setCoverUploading(true);
      setCoverError("");
      try {
        const { error: uploadError } = await supabase.storage
          .from(COVER_BUCKET)
          .upload(coverStoragePath, file, {
            cacheControl: "3600",
            upsert: true,
            contentType: file.type || "image/jpeg",
          });
        if (uploadError) throw uploadError;
        const { data, error: signedError } = await supabase.storage
          .from(COVER_BUCKET)
          .createSignedUrl(coverStoragePath, 3600);
        if (signedError) throw signedError;
        const signedUrl = data?.signedUrl ? `${data.signedUrl}&cb=${Date.now()}` : "";
        setCoverImageUrl(signedUrl);
      } catch (err) {
        console.error("Falha ao enviar capa do perfil", err);
        setCoverError(err?.message || "Não foi possível salvar a capa.");
      } finally {
        setCoverUploading(false);
        if (event.target) {
          event.target.value = "";
        }
      }
    },
    [coverStoragePath],
  );

  const coverStyle = useMemo(() => {
    if (!coverImageUrl) return undefined;
    return {
      backgroundImage: `linear-gradient(180deg, rgba(15, 23, 42, 0.25) 0%, rgba(15, 23, 42, 0.55) 100%), url(${coverImageUrl})`,
    };
  }, [coverImageUrl]);

  const loadLatestFollowers = useCallback(async () => {
    latestFollowersRequestRef.current += 1;
    const requestToken = latestFollowersRequestRef.current;
    const igUserId = accountConfig?.instagramUserId;

    if (!igUserId) {
      if (requestToken === latestFollowersRequestRef.current) {
        setLatestFollowers(null);
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from("ig_metrics_daily")
        .select("value")
        .eq("account_id", igUserId)
        .eq("platform", "instagram")
        .eq("metric_key", "followers_total")
        .order("metric_date", { ascending: false })
        .limit(1);
      if (error) throw error;
      if (requestToken !== latestFollowersRequestRef.current) return;
      const record = (data || [])[0];
      const numeric = tryParseNumber(record?.value);
      setLatestFollowers(numeric != null ? numeric : null);
    } catch (err) {
      if (requestToken !== latestFollowersRequestRef.current) return;
      console.warn("Falha ao carregar seguidores do Supabase", err);
      setLatestFollowers(null);
    }
  }, [accountConfig?.instagramUserId]);

  useEffect(() => {
    loadLatestFollowers();
  }, [loadLatestFollowers]);

  useEffect(() => {
    if (!accountConfig?.instagramUserId) {
      setMetrics([]);
      setFollowerSeries([]);
      setReachCacheSeries([]);
      setMetricsError("Conta do Instagram não configurada.");
      return;
    }

    if (!sinceParam || !untilParam) {
      setMetrics([]);
      setFollowerSeries([]);
      setReachCacheSeries([]);
      setMetricsError("");
      return;
    }

    const controller = new AbortController();
    (async () => {
      setMetricsError("");
      setReachCacheSeries([]);
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
        const reachSeries = Array.isArray(json.reach_timeseries)
          ? json.reach_timeseries
            .map((entry) => {
              if (!entry) return null;
              const dateRaw = entry.date || entry.metric_date || entry.end_time || entry.start_time || entry.label;
              if (!dateRaw) return null;
              const numericValue = extractNumber(entry.value, null);
              if (numericValue === null) return null;
              return {
                date: dateRaw,
                value: numericValue,
              };
            })
            .filter(Boolean)
          : [];
        setReachCacheSeries(reachSeries);
      } catch (err) {
        if (err.name !== "AbortError") {
          setMetrics([]);
          setFollowerSeries([]);
          setFollowerCounts(null);
          setReachCacheSeries([]);
          setMetricsError(err.message || "Não foi possível atualizar.");
        }
      }
    })();

    return () => controller.abort();
  }, [accountConfig?.instagramUserId, sinceParam, untilParam]);

  useEffect(() => {
    if (!accountConfig?.instagramUserId) {
      setPosts([]);
      setAccountInfo(null);
      setPostsError("Conta do Instagram não configurada.");
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
          setPostsError(err.message || "Não foi possível carregar os posts.");
        }
      } finally {
        setLoadingPosts(false);
      }
    })();

    return () => controller.abort();
  }, [accountConfig?.instagramUserId]);

  const metricsByKey = useMemo(() => mapByKey(metrics), [metrics]);
  const reachMetric = metricsByKey.reach;
  const followersMetric = metricsByKey.followers_total;
  const followerGrowthMetric = metricsByKey.follower_growth;
  const engagementRateMetric = metricsByKey.engagement_rate;

  const reachMetricValue = useMemo(() => extractNumber(reachMetric?.value, null), [reachMetric?.value]);
  const timelineReachSeries = useMemo(() => seriesFromMetric(reachMetric), [reachMetric]);
  const followerSeriesNormalized = useMemo(() => (followerSeries || [])
    .map((entry) => {
      const dateKey = normalizeDateKey(entry.date || entry.end_time || entry.endTime);
      if (!dateKey) return null;
      return { date: dateKey, value: extractNumber(entry.value, null) };
    })
    .filter(Boolean), [followerSeries]);

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



  const reachTimelineFromCache = useMemo(() => {
    if (!reachCacheSeries.length) return [];
    return [...reachCacheSeries]
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .map(({ date, value }) => {
        const numericValue = extractNumber(value, 0);
        const parsedDate = new Date(`${date}T00:00:00`);
        return {
          dateKey: date,
          label: SHORT_DATE_FORMATTER.format(parsedDate),
          value: numericValue,
        };
      })
      .filter((entry) => Number.isFinite(entry.value));
  }, [reachCacheSeries]);

  const reachTimelineFromMetric = useMemo(() => {
    if (!timelineReachSeries.length) return [];
    return [...timelineReachSeries]
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .map(({ date, value }) => {
        const numericValue = extractNumber(value, 0);
        const parsedDate = new Date(`${date}T00:00:00`);
        return {
          dateKey: date,
          label: SHORT_DATE_FORMATTER.format(parsedDate),
          value: numericValue,
        };
      })
      .filter((entry) => Number.isFinite(entry.value));
  }, [timelineReachSeries]);

  const reachTimelineFromPosts = useMemo(() => {
    if (!filteredPosts.length) return [];
    const totals = new Map();
    filteredPosts.forEach((post) => {
      if (!post.timestamp) return;
      const dateObj = new Date(post.timestamp);
      if (Number.isNaN(dateObj.getTime())) return;
      const reachMetricValue = resolvePostMetric(post, "reach", null);
      const numericValue = reachMetricValue != null ? extractNumber(reachMetricValue, null) : null;
      if (numericValue == null) return;
      const key = dateObj.toISOString().slice(0, 10);
      totals.set(key, (totals.get(key) || 0) + numericValue);
    });
    return Array.from(totals.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dateKey, value]) => ({
        dateKey,
        label: SHORT_DATE_FORMATTER.format(new Date(`${dateKey}T00:00:00`)),
        value,
      }));
  }, [filteredPosts]);

  const reachSeriesBase = useMemo(() => {
    if (reachTimelineFromCache.length) return reachTimelineFromCache;
    if (reachTimelineFromMetric.length) return reachTimelineFromMetric;
    if (reachTimelineFromPosts.length) return reachTimelineFromPosts;
    return [];
  }, [reachTimelineFromCache, reachTimelineFromMetric, reachTimelineFromPosts]);

  const normalizedReachSeries = useMemo(() => {
    if (!reachSeriesBase.length) return [];
    const sinceKey = sinceDate ? normalizeDateKey(sinceDate) : null;
    const untilKey = untilDate ? normalizeDateKey(untilDate) : null;

    const resolveEntryDateKey = (entry) => {
      if (entry?.dateKey) return entry.dateKey;
      if (entry?.date) return normalizeDateKey(entry.date);
      if (entry?.end_time) return normalizeDateKey(entry.end_time);
      if (entry?.start_time) return normalizeDateKey(entry.start_time);
      if (entry?.label) {
        const parsed = normalizeDateKey(entry.label);
        if (parsed) return parsed;
      }
      return null;
    };

    return reachSeriesBase
      .map((entry) => ({
        ...entry,
        value: extractNumber(entry.value, 0),
      }))
      .filter((entry) => {
        const entryKey = resolveEntryDateKey(entry);
        if (!entryKey) return true;
        if (sinceKey && entryKey < sinceKey) return false;
        if (untilKey && entryKey > untilKey) return false;
        return true;
      });
  }, [reachSeriesBase, sinceDate, untilDate]);

  const profileReachData = useMemo(() => (
    normalizedReachSeries.length ? normalizedReachSeries : DEFAULT_PROFILE_REACH_SERIES
  ), [normalizedReachSeries]);

  const profileReachTotal = useMemo(() => normalizedReachSeries.reduce(
    (acc, entry) => acc + (Number.isFinite(entry.value) ? entry.value : 0),
    0,
  ), [normalizedReachSeries]);

  const reachValue = useMemo(() => {
    if (reachMetricValue != null && reachMetricValue > 0) return reachMetricValue;
    if (normalizedReachSeries.length) {
      if (profileReachTotal > 0) return profileReachTotal;
      if (reachMetricValue != null) return reachMetricValue;
      return 0;
    }
    return reachMetricValue ?? 0;
  }, [normalizedReachSeries, profileReachTotal, reachMetricValue]);

  const peakReachPoint = useMemo(() => {
    if (!profileReachData.length) return null;
    return profileReachData.reduce(
      (currentMax, entry) => (entry.value > currentMax.value ? entry : currentMax),
      profileReachData[0],
    );
  }, [profileReachData]);

  useEffect(() => {
    setOverviewSnapshot(null);
    setLatestFollowers(null);
  }, [accountSnapshotKey]);

  const totalFollowers = useMemo(() => {
    const candidateValues = [
      latestFollowers,
      activeSnapshot?.followers,
      accountInfo?.followers_count,
      accountInfo?.followers,
      getNestedValue(accountInfo, ["followers", "count"]),
      getNestedValue(accountInfo, ["insights", "followers"]),
      getNestedValue(accountInfo, ["insights", "followers", "value"]),
      followerCounts?.end ?? followerCounts?.total,
      followersMetric?.value,
    ];

    if (followerSeriesNormalized.length) {
      const lastPoint = followerSeriesNormalized[followerSeriesNormalized.length - 1];
      candidateValues.push(lastPoint?.value);
    }

    let zeroFallback = null;
    for (const rawValue of candidateValues) {
      const parsed = tryParseNumber(rawValue);
      if (parsed === null) continue;
      if (parsed > 0) return parsed;
      if (parsed === 0 && zeroFallback === null) {
        zeroFallback = 0;
      }
    }

    return zeroFallback ?? 0;
  }, [
    accountInfo,
    activeSnapshot,
    followerCounts,
    followerSeriesNormalized,
    followersMetric,
    latestFollowers,
  ]);

  const engagementRateValue = tryParseNumber(engagementRateMetric?.value);

  const followerGrowthStats = useMemo(() => {
    const totalsByWeekday = Array.from({ length: 7 }, () => 0);
    if (followerSeriesNormalized.length >= 2) {
      let accumulatedGrowth = 0;
      for (let index = 1; index < followerSeriesNormalized.length; index += 1) {
        const previous = followerSeriesNormalized[index - 1];
        const current = followerSeriesNormalized[index];
        const diff = extractNumber(current.value, 0) - extractNumber(previous.value, 0);
        const positiveGrowth = diff > 0 ? diff : 0;
        accumulatedGrowth += positiveGrowth;
        if (positiveGrowth <= 0) continue;
        const dayRef = new Date(`${current.date}T00:00:00`);
        if (Number.isNaN(dayRef.getTime())) continue;
        const weekday = dayRef.getDay();
        totalsByWeekday[weekday] += positiveGrowth;
      }
      const samples = Math.max(1, followerSeriesNormalized.length - 1);
      return {
        average: Math.round(accumulatedGrowth / samples),
        weeklyPattern: buildWeeklyPattern(totalsByWeekday),
      };
    }
    const fallbackGrowth = Math.max(0, extractNumber(followerGrowthMetric?.value, 0));
    return {
      average: fallbackGrowth ? Math.round(fallbackGrowth / 30) : 0,
      weeklyPattern: buildWeeklyPattern(totalsByWeekday),
    };
  }, [followerSeriesNormalized, followerGrowthMetric?.value]);

  const avgFollowersPerDay = followerGrowthStats.average;
  const weeklyFollowersPattern = followerGrowthStats.weeklyPattern;

  const weeklyPostsPattern = useMemo(() => {
    if (!filteredPosts.length) {
      return buildWeeklyPattern(Array.from({ length: 7 }, () => 0));
    }
    const totalsByWeekday = Array.from({ length: 7 }, () => 0);
    filteredPosts.forEach((post) => {
      if (!post.timestamp) return;
      const dateObj = new Date(post.timestamp);
      if (Number.isNaN(dateObj.getTime())) return;
      totalsByWeekday[dateObj.getDay()] += 1;
    });
    return buildWeeklyPattern(totalsByWeekday);
  }, [filteredPosts]);

  const postsCount = filteredPosts.length;

  useEffect(() => {
    if (!accountSnapshotKey) return;
    setOverviewSnapshot({
      accountId: accountSnapshotKey,
      followers: Number.isFinite(totalFollowers) ? totalFollowers : 0,
      reach: Number.isFinite(reachValue) ? reachValue : 0,
      followersDaily: Number.isFinite(avgFollowersPerDay) ? avgFollowersPerDay : 0,
      posts: postsCount,
    });
  }, [
    accountSnapshotKey,
    avgFollowersPerDay,
    postsCount,
    reachValue,
    totalFollowers,
  ]);

  const overviewMetrics = useMemo(
    () => ({
      followers: activeSnapshot?.followers ?? totalFollowers ?? 0,
      reach: activeSnapshot?.reach ?? reachValue ?? 0,
      followersDaily: activeSnapshot?.followersDaily ?? avgFollowersPerDay ?? 0,
      posts: activeSnapshot?.posts ?? postsCount ?? 0,
    }),
    [activeSnapshot, avgFollowersPerDay, postsCount, reachValue, totalFollowers],
  );

  const followersDailyDisplay = useMemo(() => (
    Number.isFinite(overviewMetrics.followersDaily)
      ? overviewMetrics.followersDaily.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      : "--"
  ), [overviewMetrics.followersDaily]);

  const engagementRateDisplay = useMemo(() => (
    engagementRateValue != null
      ? `${engagementRateValue.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}%`
      : "--"
  ), [engagementRateValue]);

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

  const followerGrowthPresetConfig = useMemo(
    () => FOLLOWER_GROWTH_PRESETS.find((preset) => preset.id === followerGrowthPreset)
      || FOLLOWER_GROWTH_PRESETS.find((preset) => preset.id === DEFAULT_FOLLOWER_GROWTH_PRESET)
      || FOLLOWER_GROWTH_PRESETS[0],
    [followerGrowthPreset],
  );

  const followerGrowthSeriesSorted = useMemo(() => {
    if (!followerSeriesNormalized.length) return [];
    return followerSeriesNormalized
      .filter((entry) => entry?.date && Number.isFinite(entry.value))
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [followerSeriesNormalized]);

  const followerGrowthSeriesForPreset = useMemo(() => {
    if (!followerGrowthSeriesSorted.length) return [];
    const preset = followerGrowthPresetConfig;
    if (!preset?.days || preset.id === "max") {
      return followerGrowthSeriesSorted;
    }
    const latestEntry = followerGrowthSeriesSorted[followerGrowthSeriesSorted.length - 1];
    const latestDate = latestEntry?.date ? new Date(`${latestEntry.date}T00:00:00`) : null;
    if (!latestDate || Number.isNaN(latestDate.getTime())) {
      const sliceCount = Math.min(preset.days, followerGrowthSeriesSorted.length);
      return followerGrowthSeriesSorted.slice(-sliceCount);
    }
    const cutoff = new Date(latestDate);
    cutoff.setDate(cutoff.getDate() - (preset.days - 1));
    const filtered = followerGrowthSeriesSorted.filter((entry) => {
      const entryDate = entry?.date ? new Date(`${entry.date}T00:00:00`) : null;
      if (!entryDate || Number.isNaN(entryDate.getTime())) return true;
      return entryDate >= cutoff;
    });
    const MAX_POINTS = 64;
    if (filtered.length > MAX_POINTS) {
      return filtered.slice(filtered.length - MAX_POINTS);
    }
    return filtered;
  }, [followerGrowthPresetConfig, followerGrowthSeriesSorted]);

  const followerGrowthChartData = useMemo(() => {
    if (followerGrowthSeriesForPreset.length) {
      return followerGrowthSeriesForPreset.map((entry, index) => {
        const dateKey = entry.date || null;
        const parsedDate = dateKey ? new Date(`${dateKey}T00:00:00`) : null;
        const validDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;
        const monthLabel = validDate ? MONTH_SHORT_PT[validDate.getMonth()] || "" : "";
        const dayLabel = validDate ? String(validDate.getDate()) : "";
        const label = validDate && monthLabel ? `${dayLabel}/${monthLabel}` : entry.label || `${index + 1}`;
        const tooltipDate = validDate && monthLabel
          ? `${String(validDate.getDate()).padStart(2, "0")} - ${monthLabel} - ${validDate.getFullYear()}`
          : dateKey || label;
        return {
          label,
          value: extractNumber(entry.value, 0),
          tooltipDate,
        };
      });
    }

    const preset = followerGrowthPresetConfig;
    const fallbackSeries = (() => {
      if (!preset?.days || preset.id === "max") {
        return FOLLOWER_GROWTH_SERIES;
      }
      const approxCount = Math.min(
        FOLLOWER_GROWTH_SERIES.length,
        Math.max(4, Math.round(preset.days / 7)),
      );
      return FOLLOWER_GROWTH_SERIES.slice(-approxCount);
    })();

    return fallbackSeries.map((entry, index) => ({
      label: entry.label || `${index + 1}`,
      value: extractNumber(entry.value, 0),
      tooltipDate: entry.label || `#${index + 1}`,
    }));
  }, [followerGrowthSeriesForPreset, followerGrowthPresetConfig]);

  const followerGrowthDomain = useMemo(() => {
    if (!followerGrowthChartData.length) return [0, "auto"];
    const maxValue = followerGrowthChartData.reduce(
      (max, point) => Math.max(max, extractNumber(point.value, 0)),
      0,
    );
    if (maxValue <= 0) return [0, "auto"];
    const magnitude = 10 ** Math.floor(Math.log10(maxValue || 1));
    const rawStep = magnitude / 2;
    const step = Math.max(1, Math.round(rawStep));
    const adjustedMax = Math.ceil(maxValue / step) * step;
    return [0, adjustedMax];
  }, [followerGrowthChartData]);

  const followerGrowthTicks = useMemo(() => {
    if (!Array.isArray(followerGrowthDomain)) {
      return undefined;
    }
    const [, max] = followerGrowthDomain;
    if (typeof max !== "number" || max <= 0) return undefined;
    const magnitude = 10 ** Math.floor(Math.log10(max || 1));
    const rawStep = magnitude / 2;
    const step = Math.max(1, Math.round(rawStep));
    const ticks = [];
    for (let value = 0; value <= max; value += step) {
      ticks.push(value);
    }
    if (ticks[ticks.length - 1] !== max) {
      ticks.push(max);
    }
    return ticks;
  }, [followerGrowthDomain]);

  const followerGrowthPeakPoint = useMemo(() => {
    if (!followerGrowthChartData.length) return null;
    return followerGrowthChartData.reduce(
      (acc, point, index) => {
        const numeric = extractNumber(point.value, 0);
        if (numeric > acc.value) {
          return { value: numeric, index, label: point.label, tooltipDate: point.tooltipDate };
        }
        return acc;
      },
      {
        value: extractNumber(followerGrowthChartData[0].value, 0),
        index: 0,
        label: followerGrowthChartData[0].label,
        tooltipDate: followerGrowthChartData[0].tooltipDate,
      },
    );
  }, [followerGrowthChartData]);

  const highlightedFollowerGrowthIndex = activeFollowerGrowthBar >= 0
    ? activeFollowerGrowthBar
    : followerGrowthPeakPoint?.index ?? -1;

  const highlightedFollowerGrowthPoint = highlightedFollowerGrowthIndex >= 0
    ? followerGrowthChartData[highlightedFollowerGrowthIndex] ?? null
    : null;

  useEffect(() => {
    setActiveFollowerGrowthBar(-1);
  }, [accountSnapshotKey, followerGrowthChartData, followerGrowthPreset]);

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

  const genderStatsSeries = useMemo(() => (
    genderDistribution.length
      ? genderDistribution.map((entry) => ({
        name: entry.name || "",
        value: Number(entry.value ?? 0),
      }))
      : DEFAULT_GENDER_STATS
  ), [genderDistribution]);

  // const heatmapData = useMemo(() => DEFAULT_HEATMAP_MATRIX, []);

  // const maxHeatmapValue = useMemo(() => (
  //   heatmapData.reduce((acc, row) => {
  //     const rowMax = Math.max(...row.values);
  //     return rowMax > acc ? rowMax : acc;
  //   }, 0)
  // ), [heatmapData]);

  const keywordList = useMemo(() => buildKeywordFrequency(filteredPosts), [filteredPosts]);
  const hashtagList = useMemo(() => buildHashtagFrequency(filteredPosts), [filteredPosts]);

  const accountInitial = (accountInfo?.username || accountInfo?.name || "IG").charAt(0).toUpperCase();

  return (
    <div className="instagram-dashboard instagram-dashboard--clean">
      {metricsError && <div className="alert alert--error">{metricsError}</div>}
      {postsError && <div className="alert alert--error">{postsError}</div>}

      {/* Container Limpo (fundo branco) */}
      <div className="ig-clean-container">
        <div className="ig-hero-gradient" aria-hidden="true" />
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
              <div className="ig-profile-vertical__cover" style={coverStyle}>
                <div className="ig-profile-vertical__cover-actions">
                  <button
                    type="button"
                    className="ig-profile-vertical__cover-button"
                    onClick={handleCoverButtonClick}
                    disabled={coverUploading}
                  >
                    {coverUploading ? "Salvando..." : "Mudar imagem"}
                  </button>
                </div>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="ig-profile-vertical__file-input"
                  onChange={handleCoverUpload}
                />
              </div>

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
                {coverError ? (
                  <p className="ig-profile-vertical__cover-error">{coverError}</p>
                ) : null}
                <h3 className="ig-profile-vertical__username">
                  @{accountInfo?.username || accountInfo?.name || "insta_sample"}
                </h3>

                <div className="ig-profile-vertical__stats-grid">
                  <div className="ig-overview-stat">
                    <div className="ig-overview-stat__value">{formatNumber(overviewMetrics.followers)}</div>
                    <div className="ig-overview-stat__label">Total de seguidores</div>
                  </div>
                  <div className="ig-overview-stat">
                    <div className="ig-overview-stat__value">{formatNumber(overviewMetrics.reach)}</div>
                  <div className="ig-overview-stat__label">Alcance (30 dias)</div>
                  </div>
                </div>

                <div className="ig-overview-activity">
                  <div className="ig-overview-metric">
                    <div className="ig-overview-metric__row">
                      <div className="ig-overview-metric__info">
                        <div className="ig-overview-metric__value">{followersDailyDisplay}</div>
                        <div className="ig-overview-metric__label">Seguidores diários</div>
                      </div>
                      <div className="ig-weekly-chart">
                        {weeklyFollowersPattern.map((day, index) => (
                          <div
                            key={`followers-${day.label}-${index}`}
                            className={`ig-weekly-chart__item${day.active ? " ig-weekly-chart__item--active" : ""}${
                              index === 0 ? " ig-weekly-chart__item--sunday" : ""
                            }`}
                          >
                            <div
                              className="ig-weekly-chart__bar"
                              style={{ height: `${Math.max(day.percentage, 16)}%` }}
                            />
                            <span className="ig-weekly-chart__label">{day.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="ig-overview-metric">
                    <div className="ig-overview-metric__row">
                      <div className="ig-overview-metric__info">
                        <div className="ig-overview-metric__value">{formatNumber(overviewMetrics.posts)}</div>
                        <div className="ig-overview-metric__label">Posts criados</div>
                        <select className="ig-overview-metric__select">
                          <option>Esta semana</option>
                          <option>Últimas 4 semanas</option>
                          <option>Último trimestre</option>
                        </select>
                      </div>
                      <div className="ig-weekly-chart ig-weekly-chart--compact">
                        {weeklyPostsPattern.map((day, index) => (
                          <div
                            key={`posts-${day.label}-${index}`}
                            className={`ig-weekly-chart__item${day.active ? " ig-weekly-chart__item--active" : ""}${
                              index === 0 ? " ig-weekly-chart__item--sunday" : ""
                            }`}
                          >
                            <div
                              className="ig-weekly-chart__bar"
                              style={{ height: `${Math.max(day.percentage, 16)}%` }}
                            />
                            <span className="ig-weekly-chart__label">{day.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ig-profile-vertical__divider" />

                <div className="ig-profile-vertical__engagement">
                  <h4>Engajamento por Conteúdo</h4>
                  {contentBreakdown.length ? (
                    <>
                      <div className="ig-profile-vertical__engagement-chart">
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie
                              data={contentBreakdown}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={55}
                              outerRadius={85}
                              paddingAngle={3}
                              stroke="none"
                              activeIndex={activeEngagementIndex}
                              activeShape={renderActiveShape}
                              onMouseEnter={(_, index) => setActiveEngagementIndex(index)}
                              onMouseLeave={() => setActiveEngagementIndex(-1)}
                            >
                              {contentBreakdown.map((_, index) => (
                                <Cell key={index} fill={IG_DONUT_COLORS[index % IG_DONUT_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value, name) => [Number(value).toLocaleString("pt-BR"), name]} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="ig-engagement-legend">
                        {contentBreakdown.map((slice, index) => (
                          <div key={slice.name || index} className="ig-engagement-legend__item">
                            <span
                              className="ig-engagement-legend__swatch"
                              style={{ backgroundColor: IG_DONUT_COLORS[index % IG_DONUT_COLORS.length] }}
                            />
                            <span className="ig-engagement-legend__label">{slice.name}</span>
                          </div>
                        ))}
                      </div>

                      <div className="ig-engagement-summary">
                        <div className="ig-engagement-summary__value">{engagementRateDisplay}</div>
                        <div className="ig-engagement-summary__label">Total de engajamento do período</div>
                      </div>

                      <div className="ig-engagement-mini-grid">
                        <div className="ig-engagement-mini-card ig-engagement-mini-card--teal">
                          <span className="ig-engagement-mini-card__label">Melhor horário para postar</span>
                          <span className="ig-engagement-mini-card__value">{bestTimes.bestTimeRange || "--"}</span>
                        </div>
                        <div className="ig-engagement-mini-card ig-engagement-mini-card--pink">
                          <span className="ig-engagement-mini-card__label">Melhor dia</span>
                          <span className="ig-engagement-mini-card__value">{bestTimes.bestDay || "--"}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="ig-empty-state">Sem dados</div>
                  )}
                </div>

                {/* Posts em Destaque */}
                <div className="ig-profile-vertical__divider" />
                <div className="ig-profile-vertical__top-posts">
                  <h4>Top posts</h4>
                  <div className="ig-top-posts-list">
                    {loadingPosts && !topPosts.length ? (
                      <div className="ig-empty-state">Carregando...</div>
                    ) : topPosts.length ? (
                      topPosts.slice(0, 4).map((post) => {
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

                        const postDate = post.timestamp ? new Date(post.timestamp) : null;
                        const dateStr = postDate ? postDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
                        const timeStr = postDate ? postDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
                        const postUrl = post.permalink || post.url || `https://www.instagram.com/p/${post.id || ''}`;

                        const handleThumbClick = () => {
                          if (postUrl) {
                            window.open(postUrl, '_blank', 'noopener,noreferrer');
                          }
                        };

                        return (
                          <div key={post.id || post.timestamp} className="ig-top-post-compact">
                            <div className="ig-top-post-compact__main">
                              <div className="ig-top-post-compact__left">
                                <div
                                  className="ig-top-post-compact__thumb"
                                  onClick={handleThumbClick}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      handleThumbClick();
                                    }
                                  }}
                                >
                                  {previewUrl ? (
                                    <img src={previewUrl} alt="Post" />
                                  ) : (
                                    <div className="ig-empty-thumb">Sem imagem</div>
                                  )}
                                </div>
                                <div className="ig-top-post-compact__datetime">
                                  {dateStr} {timeStr}
                                </div>
                              </div>
                              <div className="ig-top-post-compact__right">
                                <div className="ig-top-post-compact__metrics-column">
                                  <span className="ig-metric ig-metric--like">
                                    <Heart size={20} fill="#ef4444" color="#ef4444" />
                                    <span className="ig-metric__value">{formatNumber(likes)}</span>
                                  </span>
                                  <span className="ig-metric ig-metric--share">
                                    <Share2 size={20} color="#f97316" />
                                    <span className="ig-metric__value">{formatNumber(shares)}</span>
                                  </span>
                                  <span className="ig-metric ig-metric--comment">
                                    <MessageCircle size={20} fill="#a855f7" color="#a855f7" />
                                    <span className="ig-metric__value">{formatNumber(comments)}</span>
                                  </span>
                                  <span className="ig-metric ig-metric--save">
                                    <Bookmark size={20} fill="#3b82f6" color="#3b82f6" />
                                    <span className="ig-metric__value">{formatNumber(saves)}</span>
                                  </span>
                                </div>
                                <div className="ig-top-post-compact__caption">
                                  {truncate(post.caption || "Aqui vai o texto da legenda que post está sendo apresentado se não tiver espaço...", 120)}
                                </div>
                              </div>
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
                  <button className="ig-filter-pill ig-filter-pill--active">1 ano</button>
                  <button className="ig-filter-pill">Máximo</button>
                </div>
              </header>

              <div className="ig-chart-area">
                {profileReachData.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart
                      data={profileReachData}
                      margin={{ top: 24, right: 28, left: 12, bottom: 12 }}
                    >
                      <defs>
                        <linearGradient id="igReachGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#ec4899" />
                          <stop offset="100%" stopColor="#f97316" />
                        </linearGradient>
                        <linearGradient id="igReachGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgba(236, 72, 153, 0.32)" />
                          <stop offset="100%" stopColor="rgba(249, 115, 22, 0)" />
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
                        tickFormatter={(value) => value.toLocaleString("pt-BR")}
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
                        fill="url(#igReachGlow)"
                        stroke="none"
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="url(#igReachGradient)"
                        strokeWidth={7}
                        strokeOpacity={0.2}
                        dot={false}
                        isAnimationActive={false}
                        activeDot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="url(#igReachGradient)"
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 6, fill: '#ffffff', stroke: '#ef4444', strokeWidth: 2 }}
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
            <section className="ig-growth-clean ig-growth-followers ig-follower-growth-card">
              <header className="ig-card-header">
                <div>
                  <h3>Crescimento de Seguidores</h3>
                <p className="ig-card-subtitle">Evolução mensal</p>
                </div>
                <div className="ig-filter-pills">
                  {FOLLOWER_GROWTH_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`ig-filter-pill${preset.id === followerGrowthPreset ? " ig-filter-pill--active" : ""}`}
                      onClick={() => setFollowerGrowthPreset(preset.id)}
                      aria-pressed={preset.id === followerGrowthPreset}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </header>

              <div className="ig-chart-area">
                {followerGrowthChartData.length ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={followerGrowthChartData}
                      margin={{ top: 16, right: 16, bottom: 32, left: 0 }}
                      barCategoryGap="35%"
                    >
                        <defs>
                          <linearGradient id="igFollowerGrowthBar" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#d8b4fe" />
                            <stop offset="100%" stopColor="#c084fc" />
                          </linearGradient>
                          <linearGradient id="igFollowerGrowthBarActive" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f472b6" />
                            <stop offset="45%" stopColor="#d946ef" />
                            <stop offset="100%" stopColor="#6366f1" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 8" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: "#9ca3af", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                          interval={0}
                          height={32}
                        />
                        <YAxis
                          tick={{ fill: "#9ca3af", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(value) => {
                            if (value >= 1000000) {
                              const millions = (value / 1000000).toFixed(1);
                              return `${millions.endsWith(".0") ? millions.slice(0, -2) : millions}M`;
                            }
                            if (value >= 1000) return `${Math.round(value / 1000)}k`;
                            return value;
                          }}
                          ticks={followerGrowthTicks}
                          domain={followerGrowthDomain}
                        />
                        <Tooltip
                          cursor={{ fill: "rgba(216, 180, 254, 0.25)" }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const dataPoint = payload[0];
                            const tooltipValue = formatNumber(extractNumber(dataPoint.value, 0));
                            const tooltipDate = dataPoint.payload?.tooltipDate || dataPoint.payload?.label;
                            return (
                              <div className="ig-follower-tooltip">
                                <div className="ig-follower-tooltip__label">
                                  Total seguidores: {tooltipValue}
                                </div>
                                <div className="ig-follower-tooltip__date">{tooltipDate}</div>
                              </div>
                            );
                          }}
                        />
                        {highlightedFollowerGrowthPoint ? (
                          <>
                            <ReferenceLine
                              x={highlightedFollowerGrowthPoint.label}
                              stroke="#111827"
                              strokeDasharray="4 4"
                              strokeOpacity={0.3}
                            />
                            <ReferenceLine
                              y={extractNumber(highlightedFollowerGrowthPoint.value, 0)}
                              stroke="#111827"
                              strokeDasharray="4 4"
                              strokeOpacity={0.35}
                            />
                            <ReferenceDot
                              x={highlightedFollowerGrowthPoint.label}
                              y={extractNumber(highlightedFollowerGrowthPoint.value, 0)}
                              r={6}
                              fill="#111827"
                              stroke="#ffffff"
                              strokeWidth={2}
                            />
                          </>
                        ) : null}
                        <Bar
                          dataKey="value"
                          radius={[12, 12, 0, 0]}
                          barSize={36}
                          minPointSize={6}
                          onMouseEnter={(_, index) => setActiveFollowerGrowthBar(index)}
                          onMouseLeave={() => setActiveFollowerGrowthBar(-1)}
                        >
                          {followerGrowthChartData.map((entry, index) => (
                            <Cell
                              key={`${entry.label || "point"}-${index}`}
                              fill={index === highlightedFollowerGrowthIndex
                                ? "url(#igFollowerGrowthBarActive)"
                                : "url(#igFollowerGrowthBar)"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                ) : (
                  <div className="ig-empty-state">Sem dados disponiveis.</div>
                )}
              </div>
        </section>

        <div className="ig-analytics-grid ig-analytics-grid--pair">
          <section className="ig-card-white ig-analytics-card">
            <div className="ig-analytics-card__header">
              <h4>Estatística por gênero</h4>
              <button type="button" className="ig-card-filter">Mar 26 - Abr 01 ▾</button>
            </div>
            <div className="ig-analytics-card__body">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  {/* Purple circle (background) */}
                  <Pie
                    data={[{ value: 100 }]}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    outerRadius={activeGenderIndex === 1 ? 93 : 85}
                    innerRadius={0}
                    fill="#8b5cf6"
                    stroke="none"
                    isAnimationActive={true}
                    onMouseEnter={() => setActiveGenderIndex(1)}
                    onMouseLeave={() => setActiveGenderIndex(-1)}
                  />
                  {/* Teal circle (foreground - overlapping) */}
                  <Pie
                    data={genderStatsSeries}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={activeGenderIndex === 0 ? 93 : 85}
                    innerRadius={0}
                    startAngle={90}
                    endAngle={90 + (genderStatsSeries[0]?.value || 0) * 3.6}
                    fill="#14b8a6"
                    stroke="none"
                    paddingAngle={0}
                    isAnimationActive={true}
                    onMouseEnter={() => setActiveGenderIndex(0)}
                    onMouseLeave={() => setActiveGenderIndex(-1)}
                  />
                  <Tooltip content={(props) => <BubbleTooltip {...props} suffix="%" />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="ig-analytics-legend">
                {genderStatsSeries.map((slice, index) => (
                  <div key={slice.name || index} className="ig-analytics-legend__item">
                    <span
                      className="ig-analytics-legend__swatch"
                      style={{ backgroundColor: index === 0 ? "#14b8a6" : "#8b5cf6" }}
                    />
                    <span className="ig-analytics-legend__label">{slice.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="ig-card-white ig-analytics-card">
            <div className="ig-analytics-card__header">
              <h4>Quantidade de publicações por dia</h4>
              <select className="ig-card-filter" defaultValue="abril">
                <option value="janeiro">Janeiro 2024</option>
                <option value="fevereiro">Fevereiro 2024</option>
                <option value="marco">Março 2024</option>
                <option value="abril">Abril 2024</option>
                <option value="maio">Maio 2024</option>
                <option value="junho">Junho 2024</option>
                <option value="julho">Julho 2024</option>
                <option value="agosto">Agosto 2024</option>
                <option value="setembro">Setembro 2024</option>
                <option value="outubro">Outubro 2024</option>
              </select>
            </div>
            <div className="ig-analytics-card__body">
              <div className="ig-calendar">
                <div className="ig-calendar__weekdays">
                  <span className="ig-calendar__weekday">Dom</span>
                  <span className="ig-calendar__weekday">Seg</span>
                  <span className="ig-calendar__weekday">Ter</span>
                  <span className="ig-calendar__weekday">Qua</span>
                  <span className="ig-calendar__weekday">Qui</span>
                  <span className="ig-calendar__weekday">Sex</span>
                  <span className="ig-calendar__weekday">Sáb</span>
                </div>
                <div className="ig-calendar__grid">
                  {/* Abril 2024 - começa na segunda-feira (1º dia) */}
                  {/* Dias vazios do mês anterior */}
                  <div className="ig-calendar__day ig-calendar__day--empty" />

                  {/* Dias de Abril */}
                  {Array.from({ length: 30 }, (_, i) => {
                    const day = i + 1;
                    const posts = Math.floor(Math.random() * 6); // Mock: 0-5 publicações
                    const level = posts === 0 ? 0 : Math.ceil((posts / 5) * 4);

                    return (
                      <div
                        key={day}
                        className={`ig-calendar__day ig-calendar__day--level-${level}`}
                        data-tooltip={`${posts} publicaç${posts === 1 ? 'ão' : 'ões'}`}
                      >
                        <span className="ig-calendar__day-number">{day}</span>
                      </div>
                    );
                  })}

                  {/* Dias vazios do próximo mês para completar a grade */}
                  <div className="ig-calendar__day ig-calendar__day--empty" />
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="ig-analytics-grid ig-analytics-grid--pair">
          <section className="ig-card-white ig-analytics-card">
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
                    cursor={{ fill: 'rgba(139, 92, 246, 0.1)' }}
                    formatter={(value) => Number(value).toLocaleString("pt-BR")}
                  />
                  <Bar dataKey="male" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="female" fill="#ec4899" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="ig-card-white ig-analytics-card">
            <div className="ig-analytics-card__header">
              <h4>Top Cidades</h4>
              <button type="button" className="ig-card-filter">Mar 26 - Abr 01 ▾</button>
            </div>
            <div className="ig-analytics-card__body">
              <div className="ig-top-cities">
                <div className="ig-top-cities__header">
                  <div className="ig-top-cities__total">
                    <span className="ig-top-cities__total-number">1.500</span>
                    <div className="ig-top-cities__trend">
                      <svg width="80" height="30" viewBox="0 0 80 30">
                        <path
                          d="M 0 25 Q 20 20, 40 15 T 80 5"
                          fill="none"
                          stroke="#14b8a6"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="ig-top-cities__legend">
                    <span className="ig-top-cities__legend-item">
                      <span className="ig-top-cities__legend-dot" style={{ backgroundColor: "#14b8a6" }} />
                      Crato
                    </span>
                  </div>
                </div>
                <div className="ig-top-cities__list">
                  <div className="ig-top-city-item">
                    <span className="ig-top-city-item__icon" style={{ backgroundColor: "#3b82f6" }}>📍</span>
                    <span className="ig-top-city-item__name">Fortaleza</span>
                    <span className="ig-top-city-item__value">350</span>
                  </div>
                  <div className="ig-top-city-item">
                    <span className="ig-top-city-item__icon" style={{ backgroundColor: "#ef4444" }}>📍</span>
                    <span className="ig-top-city-item__name">Crato</span>
                    <span className="ig-top-city-item__value">200</span>
                  </div>
                  <div className="ig-top-city-item">
                    <span className="ig-top-city-item__icon" style={{ backgroundColor: "#f97316" }}>📍</span>
                    <span className="ig-top-city-item__name">Massape</span>
                    <span className="ig-top-city-item__value">500</span>
                  </div>
                  <div className="ig-top-city-item">
                    <span className="ig-top-city-item__icon" style={{ backgroundColor: "#14b8a6" }}>📍</span>
                    <span className="ig-top-city-item__name">France</span>
                    <span className="ig-top-city-item__value">700</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

      </div>
      </div>

      {/* Palavras-chave e Hashtags - Largura Total */}
      <div className="ig-analytics-grid ig-analytics-grid--pair">
        <section className="ig-card-white ig-analytics-card ig-analytics-card--large">
          <div className="ig-analytics-card__header">
            <h4>Palavras chaves mais comentadas</h4>
            <button type="button" className="ig-card-filter">Mar 26 - Abr 01 ▾</button>
          </div>
          <div className="ig-analytics-card__body">
            <div className="ig-word-cloud ig-word-cloud--large">
              <span className="ig-word-cloud__word ig-word-cloud__word--xl" style={{ color: '#ef4444' }}>dance</span>
              <span className="ig-word-cloud__word ig-word-cloud__word--lg" style={{ color: '#f97316' }}>travel</span>
              <span className="ig-word-cloud__word ig-word-cloud__word--lg" style={{ color: '#ec4899' }}>photography</span>
              <span className="ig-word-cloud__word ig-word-cloud__word--md" style={{ color: '#a855f7' }}>design</span>
              <span className="ig-word-cloud__word ig-word-cloud__word--md" style={{ color: '#f97316' }}>fashion</span>
              <span className="ig-word-cloud__word ig-word-cloud__word--sm" style={{ color: '#fbbf24' }}>makeup</span>
              <span className="ig-word-cloud__word ig-word-cloud__word--md" style={{ color: '#ef4444' }}>indian</span>
              <span className="ig-word-cloud__word ig-word-cloud__word--sm" style={{ color: '#ec4899' }}>life</span>
              <span className="ig-word-cloud__word ig-word-cloud__word--xl" style={{ color: '#f97316' }}>frocks</span>
              <span className="ig-word-cloud__word ig-word-cloud__word--sm" style={{ color: '#fbbf24' }}>girl</span>
              <span className="ig-word-cloud__word ig-word-cloud__word--md" style={{ color: '#a855f7' }}>travel</span>
              <span className="ig-word-cloud__word ig-word-cloud__word--lg" style={{ color: '#ef4444' }}>hot</span>
              <span className="ig-word-cloud__word ig-word-cloud__word--sm" style={{ color: '#ec4899' }}>beautiful</span>
              <span className="ig-word-cloud__word ig-word-cloud__word--md" style={{ color: '#fbbf24' }}>shorthair</span>
              <span className="ig-word-cloud__word ig-word-cloud__word--sm" style={{ color: '#a855f7' }}>brunette</span>
              <span className="ig-word-cloud__word ig-word-cloud__word--md" style={{ color: '#f97316' }}>ctress</span>
              <span className="ig-word-cloud__word ig-word-cloud__word--sm" style={{ color: '#ef4444' }}>model</span>
              <span className="ig-word-cloud__word ig-word-cloud__word--lg" style={{ color: '#ec4899' }}>shopping</span>
              <span className="ig-word-cloud__word ig-word-cloud__word--sm" style={{ color: '#fbbf24' }}>short</span>
            </div>
          </div>
        </section>

        <section className="ig-card-white ig-analytics-card ig-analytics-card--large">
          <div className="ig-analytics-card__header">
            <h4>Hashtags mais usadas</h4>
            <button type="button" className="ig-card-filter">Mar 26 - Abr 01 ▾</button>
          </div>
          <div className="ig-analytics-card__body">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={hashtagList.slice(0, 10)} layout="vertical" margin={{ left: 12, right: 12, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#111827' }} fontSize={12} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#111827' }} fontSize={12} width={100} />
                <Tooltip
                  cursor={{ fill: 'rgba(236, 72, 153, 0.1)' }}
                  formatter={(value) => [String(value), "Ocorrências"]}
                />
                <Bar dataKey="value" fill="#ec4899" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Hashtags e palavras-chave (seção antiga - manter para compatibilidade) */}
      <div className="ig-clean-grid" style={{ display: 'none' }}>
        <div className="ig-card-white">
          <div className="ig-card__title">
            <Hash size={16} />
            <span>Hashtags mais usadas</span>
          </div>
          <div className="ig-chart-container">
            {hashtagList.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={hashtagList} layout="vertical" margin={{ left: 12, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis type="number" tick={{ fill: '#111827' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fill: '#111827' }} />
                  <Tooltip formatter={(value) => [String(value), "Ocorrências"]} />
                  <Bar dataKey="value" fill="#ec4899" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="ig-empty-state">Sem hashtags registradas.</div>
            )}
          </div>
          <div className="ig-keywords">
            {keywordList.length ? (
              keywordList.slice(0, 10).map((item) => (
                <span key={item.word} className="ig-keywords__item">
                  {item.word}
                  <small>{item.value}</small>
                </span>
              ))
            ) : (
              <span className="ig-keywords__empty">Sem palavras em destaque.</span>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
