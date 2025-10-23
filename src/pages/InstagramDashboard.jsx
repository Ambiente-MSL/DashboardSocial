// src/pages/InstagramDashboard.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { GripVertical, Heart, MessageCircle, Play } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import Topbar from "../components/Topbar";
import Section from "../components/Section";
import MetricCard from "../components/MetricCard";
import InstagramRanking from "../components/InstagramRanking";
import BestTimeToPost from "../components/BestTimeToPost";
import useQueryState from "../hooks/useQueryState";
import { useAccounts } from "../context/AccountsContext";
import { DEFAULT_ACCOUNTS } from "../data/accounts";

const API_BASE_URL = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
const FALLBACK_ACCOUNT_ID = DEFAULT_ACCOUNTS[0]?.id || "";
const TABLE_SCALE_MIN = 0.75;
const TABLE_SCALE_MAX = 1.35;
const TABLE_RESIZE_SENSITIVITY = 360;
const TABLE_COLUMNS_TEMPLATE = [
  {
    id: "date",
    label: "Data",
    colClass: "posts-table__col posts-table__col--date",
    headerClass: "",
    cellClass: "posts-table__date",
    minWidth: 140,
    maxWidth: 280,
    defaultWidth: 180,
  },
  {
    id: "preview",
    label: "Preview",
    colClass: "posts-table__col posts-table__col--preview",
    headerClass: "",
    cellClass: "posts-table__preview",
    minWidth: 120,
    maxWidth: 260,
    defaultWidth: 160,
  },
  {
    id: "caption",
    label: "Legenda",
    colClass: "posts-table__col posts-table__col--caption",
    headerClass: "",
    cellClass: "posts-table__caption",
    minWidth: 360,
    maxWidth: 900,
    defaultWidth: 560,
  },
  {
    id: "likes",
    label: "Curtidas",
    colClass: "posts-table__col posts-table__col--metric",
    headerClass: "posts-table__header--metric",
    cellClass: "posts-table__metric",
    minWidth: 150,
    maxWidth: 280,
    defaultWidth: 180,
  },
  {
    id: "comments",
    label: "Comentários",
    colClass: "posts-table__col posts-table__col--metric",
    headerClass: "posts-table__header--metric",
    cellClass: "posts-table__metric",
    minWidth: 150,
    maxWidth: 280,
    defaultWidth: 180,
  },
];

const reorderColumns = (columns, sourceId, targetId) => {
  if (sourceId === targetId) return columns;
  const next = [...columns];
  const sourceIndex = next.findIndex((col) => col.id === sourceId);
  const targetIndex = next.findIndex((col) => col.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return columns;
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
};

const mapByKey = (items) => {
  const map = {};
  (items || []).forEach((item) => {
    if (item && item.key) map[item.key] = item;
  });
  return map;
};

const safeParseJson = (text) => {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
};

const describeApiError = (payload, fallback) => {
  if (!payload) return fallback;
  if (payload.error) return payload.graph?.code ? `${payload.error} (Graph code ${payload.graph.code})` : payload.error;
  return payload.message || fallback;
};

const truncate = (text, length = 120) => !text ? "" : (text.length <= length ? text : `${text.slice(0, length - 3)}...`);

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

const toNumberOrNull = (value) => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const isLikelyVideoUrl = (url) =>
  typeof url === "string" && /\.(mp4|mov|mpe?g|m4v|avi|wmv|flv)(\?|$)/i.test(url);

const sumInteractions = (post) => {
  const likes = resolvePostMetric(post, "likes");
  const comments = resolvePostMetric(post, "comments");
  const shares = resolvePostMetric(post, "shares");
  const saves = resolvePostMetric(post, "saves");
  return likes + comments + shares + saves;
};

const formatMetricValue = (metric, { loading } = {}) => {
  if (loading) return "...";
  if (!metric || metric.value == null) return "-";
  return typeof metric.value === "number" ? metric.value.toLocaleString("pt-BR") : String(metric.value);
};
const metricDelta = (metric, { loading } = {}) => (loading ? null : (metric?.deltaPct ?? null));
const formatDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium"}).format(d);
};

export default function InstagramDashboard() {
  const { sidebarOpen, toggleSidebar } = useOutletContext();
  const { accounts } = useAccounts();
  const availableAccounts = accounts.length ? accounts : DEFAULT_ACCOUNTS;
  const [get, setQuery] = useQueryState({ account: FALLBACK_ACCOUNT_ID });
  const queryAccountId = get("account");

  useEffect(() => {
    if (!availableAccounts.length) return;
    if (!queryAccountId || !availableAccounts.some((account) => account.id === queryAccountId)) {
      setQuery({ account: availableAccounts[0].id });
    }
  }, [availableAccounts, queryAccountId, setQuery]);

  const accountId = queryAccountId && availableAccounts.some((account) => account.id === queryAccountId)
    ? queryAccountId
    : availableAccounts[0]?.id || "";

  const accountConfig = useMemo(
    () => availableAccounts.find((i) => i.id === accountId) || null,
    [availableAccounts, accountId],
  );

  const since = get("since");
  const until = get("until");

  const [metrics, setMetrics] = useState([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState("");

  const [posts, setPosts] = useState([]);
  const [visiblePosts, setVisiblePosts] = useState(5);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState("");
  const [tableScale, setTableScale] = useState(1);
  const resizeCleanupRef = useRef(null);
  const columnResizeCleanupRef = useRef(null);
  const columnsTemplateRef = useRef(TABLE_COLUMNS_TEMPLATE);
  const [tableColumns, setTableColumns] = useState(columnsTemplateRef.current);
  const dragColumnIdRef = useRef(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [columnWidths, setColumnWidths] = useState(() => {
    const widths = {};
    columnsTemplateRef.current.forEach((column) => {
      const fallback = column.defaultWidth ?? column.minWidth ?? 160;
      widths[column.id] = fallback;
    });
    return widths;
  });
  const [igSummary, setIgSummary] = useState({
    accountsEngaged: null,
    profileViews: null,
    websiteClicks: null,
  });

  const [accountInfo, setAccountInfo] = useState(null);
  const [followerSeries, setFollowerSeries] = useState([]);

  useEffect(() => {
    if (!accountConfig?.instagramUserId) {
      setMetrics([]); setFollowerSeries([]); setMetricsError("Conta do Instagram nao configurada.");
      setIgSummary({ accountsEngaged: null, profileViews: null, websiteClicks: null });
      return;
    }
    const controller = new AbortController();
    (async () => {
      setLoadingMetrics(true); setMetricsError("");
      try {
        const params = new URLSearchParams();
        if (since) params.set("since", since);
        if (until) params.set("until", until);
        params.set("igUserId", accountConfig.instagramUserId);
        const url = `${API_BASE_URL}/api/instagram/metrics?${params.toString()}`;
        const resp = await fetch(url, { signal: controller.signal });
        const json = safeParseJson(await resp.text()) || {};
        if (!resp.ok) throw new Error(describeApiError(json, "Falha ao carregar metricas do Instagram."));
        setMetrics(json.metrics || []);
        setFollowerSeries(Array.isArray(json.follower_series) ? json.follower_series : []);
        setIgSummary({
          accountsEngaged: toNumberOrNull(json.accounts_engaged),
          profileViews: toNumberOrNull(json.profile_views),
          websiteClicks: toNumberOrNull(json.website_clicks),
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          setMetrics([]);
          setFollowerSeries([]);
          setIgSummary({ accountsEngaged: null, profileViews: null, websiteClicks: null });
          setMetricsError(err.message || "Nao foi possivel atualizar.");
        }
      } finally { setLoadingMetrics(false); }
    })();
    return () => controller.abort();
  }, [accountConfig?.instagramUserId, since, until]);

  useEffect(() => {
    if (!accountConfig?.instagramUserId) {
      setPosts([]); setAccountInfo(null); setPostsError("Conta do Instagram nao configurada."); return;
    }
    const controller = new AbortController();
    (async () => {
      setLoadingPosts(true); setPostsError("");
      try {
        const params = new URLSearchParams({ igUserId: accountConfig.instagramUserId, limit: "15" });
        const url = `${API_BASE_URL}/api/instagram/posts?${params.toString()}`;
        const resp = await fetch(url, { signal: controller.signal });
        const json = safeParseJson(await resp.text()) || {};
        if (!resp.ok) throw new Error(describeApiError(json, "Falha ao carregar posts do Instagram."));
        setPosts(json.posts || []); setAccountInfo(json.account || null); setVisiblePosts(5);
      } catch (err) {
        if (err.name !== "AbortError") {
          setPosts([]); setAccountInfo(null); setPostsError(err.message || "Nao foi possivel carregar os posts.");
        }
      } finally { setLoadingPosts(false); }
    })();
    return () => controller.abort();
  }, [accountConfig?.instagramUserId]);

  useEffect(
    () => () => {
      if (typeof resizeCleanupRef.current === "function") {
        resizeCleanupRef.current();
      }
      if (typeof columnResizeCleanupRef.current === "function") {
        columnResizeCleanupRef.current();
      }
    },
    [],
  );

  const metricsByKey = useMemo(() => mapByKey(metrics), [metrics]);
  const interactionsMetric = metricsByKey.interactions;
  const likesMetric = metricsByKey.likes;
  const commentsMetric = metricsByKey.comments;
  const sharesMetric = metricsByKey.shares;
  const savesMetric = metricsByKey.saves;

  const interactionsValue = extractNumber(interactionsMetric?.value);
  const engagementBreakdown = useMemo(
    () => metricsByKey.engagement_rate?.breakdown || {
      likes: extractNumber(likesMetric?.value),
      comments: extractNumber(commentsMetric?.value),
      shares: extractNumber(sharesMetric?.value),
      saves: extractNumber(savesMetric?.value),
    },
    [metricsByKey.engagement_rate?.breakdown, likesMetric, commentsMetric, sharesMetric, savesMetric],
  );

  // ===== KPIs padronizados (mesmo look do FB) =====
  const kpiCards = useMemo(
    () => ([
      { key: "interactions", title: "Interações", metric: interactionsMetric },
      { key: "engagement_total", title: "Engajamento total", metric: { value: interactionsValue } },
      { key: "likes", title: "Curtidas", metric: likesMetric },
      { key: "comments", title: "Comentários", metric: commentsMetric },
      { key: "shares", title: "Compart.", metric: sharesMetric },
      { key: "saves", title: "Salvos", metric: savesMetric },
      // Preencha com mais KPIs se o endpoint fornecer (alcance, impress?es etc.)
    ]),
    [interactionsMetric, interactionsValue, likesMetric, commentsMetric, sharesMetric, savesMetric],
  );


  const secondaryCards = useMemo(
    () => ([
      { key: "followers_total", title: "Seguidores", metric: metricsByKey.followers_total },
      { key: "follower_growth", title: "Crescimento de seguidores", metric: metricsByKey.follower_growth },
      { key: "reach", title: "Alcance", metric: metricsByKey.reach },
      { key: "accounts_engaged", title: "Contas engajadas", metric: igSummary.accountsEngaged != null ? { value: igSummary.accountsEngaged } : null },
      { key: "profile_views", title: "Visitas ao perfil", metric: igSummary.profileViews != null ? { value: igSummary.profileViews } : null },
      { key: "website_clicks", title: "Cliques no site", metric: igSummary.websiteClicks != null ? { value: igSummary.websiteClicks } : null },
    ]),
    [metricsByKey, igSummary.accountsEngaged, igSummary.profileViews, igSummary.websiteClicks],
  );

  // ===== Donut (composição do engajamento) =====
  const donutData = useMemo(() => ([
    { name: "Curtidas", value: extractNumber(engagementBreakdown.likes) },
    { name: "Comentários", value: extractNumber(engagementBreakdown.comments) },
    { name: "Compart.", value: extractNumber(engagementBreakdown.shares) },
    { name: "Salvos", value: extractNumber(engagementBreakdown.saves) },
  ]), [engagementBreakdown]);

  const DONUT_COLORS = ["#60a5fa", "#a855f7", "#f59e0b", "#34d399"];

  // ===== Gráficos =====
  const followerLineData = useMemo(
    () => followerSeries.map((e) => ({ label: formatDate(e.date ?? e.end_time), value: extractNumber(e.value) })),
    [followerSeries],
  );

  const barChartData = useMemo(
    () => posts.slice(0, 6).map((post, index) => ({
      label: `Post ${index + 1}`,
      interactions: sumInteractions(post),
      reach: extractNumber(post.reach),
    })),
    [posts],
  );

  // Top 3 posts por interações totais para o ranking sidebar
  const rankedPosts = useMemo(() => {
    return [...posts]
      .sort((a, b) => sumInteractions(b) - sumInteractions(a))
      .slice(0, 3);
  }, [posts]);

  const displayedPosts = posts.slice(0, visiblePosts);
  const tableStyle = useMemo(
    () => ({ "--posts-table-scale": Number.isFinite(tableScale) ? tableScale : 1 }),
    [tableScale],
  );

  const normalizeChildren = useCallback((children) => {
    if (!children) return [];
    if (Array.isArray(children)) return children;
    if (Array.isArray(children.data)) return children.data;
    return [];
  }, []);

  const buildPostRow = useCallback((post) => {
    const rawMediaType = String(post.mediaType || post.media_type || "").toUpperCase();
    const mediaProductType = String(post.mediaProductType || post.media_product_type || "").toUpperCase();
    const isVideo = rawMediaType === "VIDEO" || rawMediaType === "REEL" || rawMediaType === "IGTV" || mediaProductType === "REEL";
    const children = normalizeChildren(post.children);

    const previewCandidates = [
      post.previewUrl,
      post.preview_url,
      post.thumbnailUrl,
      post.thumbnail_url,
      post.posterUrl,
      post.poster_url,
      post.mediaPreviewUrl,
      post.media_preview_url,
    ];

    children.forEach((child) => {
      const childMediaType = String(child.mediaType || child.media_type || "").toUpperCase();
      previewCandidates.push(
        child.previewUrl,
        child.preview_url,
        child.thumbnailUrl,
        child.thumbnail_url,
        child.posterUrl,
        child.poster_url,
      );
      if (childMediaType !== "VIDEO" && childMediaType !== "REEL" && childMediaType !== "IGTV") {
        const childMedia = child.mediaUrl || child.media_url;
        if (childMedia && !isLikelyVideoUrl(childMedia)) previewCandidates.push(childMedia);
      }
    });

    let previewUrl = previewCandidates.find((url) => url && !isLikelyVideoUrl(url));

    if (!previewUrl && !isVideo) {
      const mediaCandidate = post.mediaUrl || post.media_url;
      if (mediaCandidate && !isLikelyVideoUrl(mediaCandidate)) previewUrl = mediaCandidate;
    }

    const publishedAt = formatDate(post.timestamp);
    const likes = resolvePostMetric(post, "likes");
    const comments = resolvePostMetric(post, "comments");
    const captionText = truncate(post.caption, 80) || "Sem legenda";
    const altText = truncate(post.caption || "Post", 40);
    const permalink = post.permalink || null;

    const previewContent = previewUrl ? (
      permalink ? (
        <a href={permalink} target="_blank" rel="noreferrer" className="posts-table__link">
          <img src={previewUrl} alt={altText} />
        </a>
      ) : (
        <img src={previewUrl} alt={altText} />
      )
    ) : (
      <div className="posts-table__placeholder">Sem preview</div>
    );

    return {
      key: post.id || permalink || `${post.timestamp || ""}-${post.mediaType || ""}`,
      cells: {
        date: publishedAt,
        preview: (
          <>
            {previewContent}
            {isVideo && <Play size={12} className="posts-table__badge" />}
          </>
        ),
        caption: captionText,
        likes: (
          <span className="posts-table__metric-content">
            <Heart size={14} /> {likes.toLocaleString("pt-BR")}
          </span>
        ),
        comments: (
          <span className="posts-table__metric-content">
            <MessageCircle size={14} /> {comments.toLocaleString("pt-BR")}
          </span>
        ),
      },
    };
  }, [normalizeChildren]);

  const postRows = useMemo(() => displayedPosts.map(buildPostRow), [displayedPosts, buildPostRow]);

  const getColumnWidthPx = useCallback(
    (column) => {
      const fallback = column.defaultWidth ?? column.minWidth ?? 160;
      const base = columnWidths[column.id] ?? fallback;
      const maxWidth = column.maxWidth ?? Number.POSITIVE_INFINITY;
      const clampedBase = clamp(base, column.minWidth ?? 0, maxWidth);
      return clampedBase * tableScale;
    },
    [columnWidths, tableScale],
  );

  const handleColumnResizePointerDown = useCallback((columnId, event) => {
    event.preventDefault();
    event.stopPropagation();
    if (columnResizeCleanupRef.current) {
      columnResizeCleanupRef.current();
    }

    const columnMeta = columnsTemplateRef.current.find((column) => column.id === columnId);
    if (!columnMeta) return;

    const fallback = columnMeta.defaultWidth ?? columnMeta.minWidth ?? 160;
    const startWidthBase = columnWidths[columnId] ?? fallback;
    const startX = event.clientX ?? 0;
    const pointerId = event.pointerId ?? -1;
    const target = event.currentTarget;
    const originalCursor = document.body.style.cursor;
    const originalUserSelect = document.body.style.userSelect;

    const handleMove = (moveEvent) => {
      const dx = (moveEvent.clientX ?? 0) - startX;
      const deltaBase = dx / (tableScale || 1);
      const nextBase = clamp(
        startWidthBase + deltaBase,
        columnMeta.minWidth ?? 0,
        columnMeta.maxWidth ?? Number.POSITIVE_INFINITY,
      );
      setColumnWidths((prev) => {
        const current = prev[columnId] ?? fallback;
        if (Math.abs(current - nextBase) < 0.5) return prev;
        return { ...prev, [columnId]: nextBase };
      });
    };

    const endResize = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", endResize);
      window.removeEventListener("pointercancel", endResize);
      document.body.style.cursor = originalCursor;
      document.body.style.userSelect = originalUserSelect;
      if (target.releasePointerCapture) {
        try { target.releasePointerCapture(pointerId); } catch { /* noop */ }
      }
      columnResizeCleanupRef.current = null;
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", endResize);
    window.addEventListener("pointercancel", endResize);
    if (target.setPointerCapture) {
      try { target.setPointerCapture(pointerId); } catch { /* noop */ }
    }
    columnResizeCleanupRef.current = endResize;
  }, [columnWidths, tableScale]);

  const handleResizeStart = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (resizeCleanupRef.current) {
      resizeCleanupRef.current();
    }
    const startScale = tableScale;
    const startX = event.clientX ?? 0;
    const startY = event.clientY ?? 0;
    const pointerId = event.pointerId ?? -1;
    const target = event.currentTarget;
    const originalUserSelect = document.body.style.userSelect;
    const originalCursor = document.body.style.cursor;

    const handleMove = (moveEvent) => {
      const dx = (moveEvent.clientX ?? 0) - startX;
      const dy = (moveEvent.clientY ?? 0) - startY;
      const delta = (dx + dy) / TABLE_RESIZE_SENSITIVITY;
      const nextScale = clamp(startScale + delta, TABLE_SCALE_MIN, TABLE_SCALE_MAX);
      setTableScale((prev) => (Math.abs(prev - nextScale) < 0.001 ? prev : nextScale));
    };

    const endResize = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", endResize);
      window.removeEventListener("pointercancel", endResize);
      document.body.style.userSelect = originalUserSelect;
      document.body.style.cursor = originalCursor;
      if (target.releasePointerCapture) {
        try { target.releasePointerCapture(pointerId); } catch { /* noop */ }
      }
      resizeCleanupRef.current = null;
    };

    document.body.style.userSelect = "none";
    document.body.style.cursor = "se-resize";
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", endResize);
    window.addEventListener("pointercancel", endResize);
    if (target.setPointerCapture) {
      try { target.setPointerCapture(pointerId); } catch { /* noop */ }
    }
    resizeCleanupRef.current = endResize;
  }, [tableScale]);

  const handleColumnDragStart = useCallback((columnId, event) => {
    dragColumnIdRef.current = columnId;
    setDragOverColumn(null);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      try { event.dataTransfer.setData("text/plain", columnId); } catch { /* noop */ }
    }
  }, []);

  const handleColumnDragOver = useCallback((event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  }, []);

  const handleColumnDragEnter = useCallback((columnId, event) => {
    event.preventDefault();
    if (columnId !== dragColumnIdRef.current) setDragOverColumn(columnId);
  }, []);

  const handleColumnDragLeave = useCallback((columnId) => {
    setDragOverColumn((current) => (current === columnId ? null : current));
  }, []);

  const handleColumnDrop = useCallback((columnId, event) => {
    event.preventDefault();
    const sourceId = dragColumnIdRef.current || (event.dataTransfer ? event.dataTransfer.getData("text/plain") : null);
    if (!sourceId || sourceId === columnId) {
      setDragOverColumn(null);
      return;
    }
    setTableColumns((prev) => reorderColumns(prev, sourceId, columnId));
    setDragOverColumn(null);
    dragColumnIdRef.current = null;
  }, []);

  const handleColumnDragEnd = useCallback(() => {
    setDragOverColumn(null);
    dragColumnIdRef.current = null;
  }, []);

  const accountBadge = accountInfo ? (
    <div className="media-account">
      <div className="media-account__avatar">
        {accountInfo.profile_picture_url ? (
          <img src={accountInfo.profile_picture_url} alt={accountInfo.username || accountInfo.id} />
        ) : (
          <span>{(accountInfo.username || accountInfo.id || "IG").charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="media-account__meta">
        <span className="media-account__name">{accountInfo.username || accountInfo.id}</span>
        {Number.isFinite(Number(accountInfo.followers_count)) && (
          <span className="media-account__followers">
            {Number(accountInfo.followers_count).toLocaleString("pt-BR")} seguidores
          </span>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <Topbar title="Instagram" sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} showFilters />
      <div className="page-content page-content--unified">
        {metricsError && <div className="alert alert--error">{metricsError}</div>}

        <Section title="Instagram" description="">
          {/* ====== BADGE + BEST TIME ====== */}
          <div className="ig-header-compact">
            {accountBadge}
            <BestTimeToPost posts={posts} loading={loadingPosts} />
          </div>

          {/* ====== GRID DE KPIS + RANKING ====== */}
          <div className="ig-top-section">
            <div className="ig-top-section__metrics">
              <div className="dashboard-kpis">
                {kpiCards.map(({ key, title, metric }) => (
                  <MetricCard
                    key={key}
                    title={title}
                    value={formatMetricValue(metric, { loading: loadingMetrics })}
                    delta={metricDelta(metric, { loading: loadingMetrics })}
                    compact
                  />
                ))}
              </div>
              <div className="dashboard-kpis-extended">
                {secondaryCards.map(({ key, title, metric }) => (
                  <MetricCard
                    key={`extra-${key}`}
                    title={title}
                    value={formatMetricValue(metric, { loading: loadingMetrics })}
                    compact
                  />
                ))}
              </div>
            </div>

            {/* ====== RANKING SIDEBAR ====== */}
            <InstagramRanking posts={rankedPosts} loading={loadingPosts} />
          </div>
        </Section>
        {/* ====== ÚLTIMOS POSTS ====== */}
        <Section title="Últimos posts" description="Acompanhe o desempenho recente.">
          {postsError && <div className="alert alert--error">{postsError}</div>}
          {loadingPosts && posts.length === 0 ? (
            <div className="table-loading">Carregando posts...</div>
          ) : displayedPosts.length ? (
            <>
              <div className="posts-table-container" style={tableStyle}>
                <table className="posts-table">
                  <colgroup>
                    {tableColumns.map((column) => {
                      const widthPx = getColumnWidthPx(column);
                      return (
                        <col
                          key={column.id}
                          className={column.colClass}
                          style={{ width: `${widthPx}px`, minWidth: `${widthPx}px`, maxWidth: `${widthPx}px` }}
                        />
                      );
                    })}
                  </colgroup>
                  <thead>
                    <tr>
                      {tableColumns.map((column) => (
                        <th
                          key={column.id}
                          scope="col"
                          className={[
                            "posts-table__header",
                            column.headerClass || "",
                            dragOverColumn === column.id ? "posts-table__header--drag-over" : "",
                          ].filter(Boolean).join(" ")}
                          draggable
                          title="Arraste para reordenar"
                          onDragStart={(event) => handleColumnDragStart(column.id, event)}
                          onDragOver={handleColumnDragOver}
                          onDragEnter={(event) => handleColumnDragEnter(column.id, event)}
                          onDragLeave={() => handleColumnDragLeave(column.id)}
                          onDrop={(event) => handleColumnDrop(column.id, event)}
                          onDragEnd={handleColumnDragEnd}
                        >
                          <span className="posts-table__header-content">
                            <GripVertical size={12} className="posts-table__header-grip" aria-hidden="true" />
                            <span className="posts-table__header-label">{column.label}</span>
                          </span>
                          <span
                            role="separator"
                            aria-orientation="vertical"
                            aria-label={`Ajustar largura da coluna ${column.label}`}
                            className="posts-table__header-handle"
                            onPointerDown={(event) => handleColumnResizePointerDown(column.id, event)}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {postRows.map((row) => (
                      <tr key={row.key}>
                        {tableColumns.map((column) => {
                          const widthPx = getColumnWidthPx(column);
                          return (
                            <td
                              key={column.id}
                              className={column.cellClass}
                              style={{ width: `${widthPx}px`, minWidth: `${widthPx}px`, maxWidth: `${widthPx}px` }}
                            >
                              {row.cells[column.id] ?? null}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div
                  className="posts-table-resizer"
                  onPointerDown={handleResizeStart}
                  aria-hidden="true"
                  title="Arraste para redimensionar"
                />
              </div>
              {posts.length > displayedPosts.length && (
                <div className="posts-table__footer">
                  <button
                    type="button"
                    className="posts-table__more"
                    onClick={() => setVisiblePosts((prev) => Math.min(prev + 5, posts.length))}
                  >
                    Ver mais
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="muted">Nenhum post recente encontrado.</p>
          )}
        </Section>

        {/* ====== GRÁFICOS - 3 COLUNAS ====== */}
        <Section title="" description="">
          <div className="charts-row">
            {/* Donut */}
            <div className="chart-card">
              <div className="fb-line-card__header" style={{ marginBottom: 12 }}>
                <h3>Composição de resultados</h3>
                <span className="muted">Distribuição do engajamento no período</span>
              </div>
              <div style={{ position: "relative", width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {donutData.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
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
                      formatter={(v) => Number(v).toLocaleString("pt-BR")}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Centro do donut */}
                <div className="fb-donut-card__center">
                  <strong>{interactionsValue.toLocaleString("pt-BR")}</strong>
                  <span>Total combinado</span>
                </div>
              </div>
            </div>

            {/* Linha - Evolução de seguidores */}
            <div className="chart-card chart-card--sm">
              <div className="fb-line-card__header" style={{ marginBottom: 12 }}>
                <h3>Evolução de seguidores</h3>
                <p className="muted">Série diária informada pelo Instagram.</p>
              </div>
              {loadingMetrics ? (
                <div className="chart-card__empty">Carregando...</div>
              ) : followerLineData.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={followerLineData} margin={{ left: 8, right: 12, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis dataKey="label" stroke="var(--text-muted)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                    <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickFormatter={(v) => v.toLocaleString("pt-BR")} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#f7fafc',
                        color: '#0f1720',
                        border: '1px solid #e3e8ef',
                        borderRadius: '10px',
                        boxShadow: '0 6px 20px rgba(0,0,0,.25)'
                      }}
                      formatter={(v) => Number(v).toLocaleString("pt-BR")}
                    />
                    <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="chart-card__empty">Sem dados suficientes.</div>
              )}
            </div>

            {/* Barras - Interações por post */}
            <div className="chart-card chart-card--sm">
              <div className="fb-line-card__header" style={{ marginBottom: 12 }}>
                <h3>Interações por post</h3>
                <p className="muted">Comparativo entre alcance e interações.</p>
              </div>
              {loadingPosts ? (
                <div className="chart-card__empty">Carregando...</div>
              ) : barChartData.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barChartData} margin={{ left: 8, right: 12, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis dataKey="label" stroke="var(--text-muted)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                    <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickFormatter={(v) => v.toLocaleString("pt-BR")} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#f7fafc',
                        color: '#0f1720',
                        border: '1px solid #e3e8ef',
                        borderRadius: '10px',
                        boxShadow: '0 6px 20px rgba(0,0,0,.25)'
                      }}
                      formatter={(v) => Number(v).toLocaleString("pt-BR")}
                    />
                    <Bar dataKey="interactions" fill="#34d399" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="reach" fill="#4b5563" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="chart-card__empty">Sem interações recentes.</div>
              )}
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}







