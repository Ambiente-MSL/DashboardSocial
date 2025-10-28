import { useCallback, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { differenceInCalendarDays, endOfDay, startOfDay, subDays } from "date-fns";
import { Menu, Moon, RefreshCw, Sun, X } from "lucide-react";
import DateRangePicker from "./DateRangePicker";
import AccountSelect from "./AccountSelect";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import useQueryState from "../hooks/useQueryState";

const PLATFORM_TABS = [
  { to: "/", label: "Visao Geral", end: true },
  { to: "/instagram", label: "Instagram" },
  { to: "/facebook", label: "Facebook" },
  { to: "/relatorios", label: "Relatorios" },
  { to: "/configuracoes", label: "Configuracoes" },
  { to: "/admin", label: "Admin" },
];

const DATE_PRESETS = [
  { id: "7d", label: "7d", days: 7 },
  { id: "1m", label: "1m", days: 30 },
  { id: "3m", label: "3m", days: 90 },
];

const parseDateParam = (value) => {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const ms = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
};

const toUnixSeconds = (date) => Math.floor(date.getTime() / 1000);

const formatLastSync = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

export default function Topbar({
  title,
  sidebarOpen,
  onToggleSidebar,
  showFilters = false,
  onRefresh,
  refreshing = false,
  lastSync,
  rightExtras = null,
  customFilters = null,
  rightContent = null,
  sticky = true,
}) {
  const location = useLocation();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [getQuery, setQuery] = useQueryState({});

  const isDark = resolvedTheme === "dark";

  const now = useMemo(() => new Date(), []);
  const defaultEnd = useMemo(
    () => endOfDay(subDays(startOfDay(now), 1)),
    [now],
  );

  const [activeSince, activeUntil] = useMemo(
    () => [parseDateParam(getQuery("since")), parseDateParam(getQuery("until"))],
    [getQuery],
  );

  const applyPreset = useCallback(
    (days) => {
      const endDate = defaultEnd;
      const startDate = startOfDay(subDays(endDate, days - 1));
      setQuery({
        since: toUnixSeconds(startDate),
        until: toUnixSeconds(endDate),
      });
    },
    [defaultEnd, setQuery],
  );

  const activePreset = useMemo(() => {
    if (!activeSince || !activeUntil) return "custom";
    const diff = differenceInCalendarDays(
      endOfDay(activeUntil),
      startOfDay(activeSince),
    ) + 1;
    const matched = DATE_PRESETS.find((preset) => preset.days === diff);
    return matched?.id ?? "custom";
  }, [activeSince, activeUntil]);

  const handlePresetClick = useCallback(
    (days) => () => applyPreset(days),
    [applyPreset],
  );

  const handleCustomPreset = useCallback(() => {
    const trigger = document.querySelector(".date-range-btn");
    trigger?.click();
  }, []);

  const displayName = useMemo(() => {
    const meta = user?.user_metadata || user?.app_metadata || {};
    return (
      meta.nome ||
      meta.name ||
      meta.full_name ||
      user?.email ||
      "Usuario"
    );
  }, [user]);

  const avatarInitials = useMemo(() => {
    if (!displayName) return "U";
    const parts = String(displayName)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "U";
    const initials = `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`;
    return initials.toUpperCase();
  }, [displayName]);

  const lastSyncLabel = formatLastSync(lastSync);

  const filtersContent = rightContent ?? (showFilters ? (
    <div className="topbar__filters">
      <div className="topbar__presets">
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`topbar__preset${activePreset === preset.id ? " topbar__preset--active" : ""}`}
            onClick={handlePresetClick(preset.days)}
            aria-pressed={activePreset === preset.id}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          className={`topbar__preset${activePreset === "custom" ? " topbar__preset--active" : ""}`}
          onClick={handleCustomPreset}
          aria-pressed={activePreset === "custom"}
        >
          Custom
        </button>
      </div>
      <div className="topbar__filter-controls">
        {customFilters}
        <AccountSelect />
        <DateRangePicker />
      </div>
    </div>
  ) : customFilters ? (
    <div className="topbar__filters">
      <div className="topbar__filter-controls">{customFilters}</div>
    </div>
  ) : null);

  return (
    <header className={`topbar${sticky ? " topbar--sticky" : ""}`}>
      <div className="topbar__primary">
        <div className="topbar__brand">
          {onToggleSidebar && (
            <button
              type="button"
              className="topbar__icon-btn"
              onClick={onToggleSidebar}
              aria-label={sidebarOpen ? "Recolher menu lateral" : "Expandir menu lateral"}
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          )}
          <div className="topbar__title">
            <span className="topbar__subtitle">Monitor / Social Dashboard</span>
            <h1>{title}</h1>
          </div>
        </div>

        <div className="topbar__actions">
          {rightExtras}
          {onRefresh && (
            <div className="topbar__sync">
              <button
                type="button"
                className="topbar__icon-btn topbar__icon-btn--refresh"
                onClick={onRefresh}
                disabled={refreshing}
                aria-label="Atualizar dados"
                aria-busy={refreshing ? "true" : undefined}
                data-loading={refreshing || undefined}
              >
                <RefreshCw size={18} />
              </button>
              {lastSyncLabel && (
                <span className="topbar__sync-text">Atualizado {lastSyncLabel}</span>
              )}
            </div>
          )}

          <button
            type="button"
            className="topbar__icon-btn"
            onClick={toggleTheme}
            aria-label="Alternar tema"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="topbar__avatar" role="presentation">
            <span className="topbar__avatar-badge">{avatarInitials}</span>
            <span className="topbar__avatar-name">{displayName}</span>
          </div>
        </div>
      </div>

      <div className="topbar__secondary">
        <nav className="topbar__tabs">
          {PLATFORM_TABS.map((tab) => {
            const destination = location.search ? { pathname: tab.to, search: location.search } : tab.to;
            return (
              <NavLink
                key={tab.to}
                to={destination}
                end={tab.end}
                className={({ isActive }) => `topbar-tab${isActive ? " topbar-tab--active" : ""}`}
              >
                {tab.label}
              </NavLink>
            );
          })}
        </nav>
        {filtersContent}
      </div>
    </header>
  );
}
