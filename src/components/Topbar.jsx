import { useCallback, useMemo } from "react";
import { differenceInCalendarDays, endOfDay, startOfDay, subDays } from "date-fns";
import { CalendarDays, ChevronDown, Menu, Sparkles, X } from "lucide-react";
import DateRangePicker from "./DateRangePicker";
import AccountSelect from "./AccountSelect";
import { useAuth } from "../context/AuthContext";
import useQueryState from "../hooks/useQueryState";

const DATE_PRESETS = [
  { id: "7d", label: "7 Days", days: 7 },
  { id: "1m", label: "1 Month", days: 30 },
  { id: "3m", label: "3 Months", days: 90 },
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

const createDisplayName = (user) => {
  const meta = user?.user_metadata || user?.app_metadata || {};
  return (
    meta.nome ||
    meta.name ||
    meta.full_name ||
    user?.email ||
    "Usuario"
  );
};

const createInitials = (value) => {
  if (!value) return "U";
  const parts = String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "U";
  const initials = `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`;
  return initials.toUpperCase();
};

export default function Topbar({
  title,
  sidebarOpen,
  onToggleSidebar,
  showFilters = false,
  customFilters = null,
  rightExtras,
  sticky = true,
}) {
  const { user } = useAuth();
  const [getQuery, setQuery] = useQueryState({});

  const now = useMemo(() => new Date(), []);
  const defaultEnd = useMemo(() => endOfDay(subDays(startOfDay(now), 1)), [now]);

  const [activeSince, activeUntil] = useMemo(
    () => [parseDateParam(getQuery("since")), parseDateParam(getQuery("until"))],
    [getQuery],
  );

  const applyPreset = useCallback((days) => {
    const endDate = defaultEnd;
    const startDate = startOfDay(subDays(endDate, days - 1));
    setQuery({
      since: toUnixSeconds(startDate),
      until: toUnixSeconds(endDate),
    });
  }, [defaultEnd, setQuery]);

  const activePreset = useMemo(() => {
    if (!activeSince || !activeUntil) return "custom";
    const diff = differenceInCalendarDays(
      endOfDay(activeUntil),
      startOfDay(activeSince),
    ) + 1;
    const matched = DATE_PRESETS.find((preset) => preset.days === diff);
    return matched?.id ?? "custom";
  }, [activeSince, activeUntil]);

  const handlePresetClick = useCallback((days) => () => applyPreset(days), [applyPreset]);

  const displayName = useMemo(() => createDisplayName(user), [user]);
  const avatarInitials = useMemo(() => createInitials(displayName), [displayName]);

  const extraControls = rightExtras === undefined ? <AccountSelect /> : rightExtras;
  const hasControls = showFilters || !!customFilters;

  return (
    <header className={`topbar${sticky ? " topbar--sticky" : ""}`}>
      <div className="topbar__section topbar__section--left">
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
        <div className="topbar__brand-chip">
          <span className="topbar__logo">
            <Sparkles size={16} />
          </span>
          {title ? <span className="topbar__brand-text">{title}</span> : null}
        </div>
        {hasControls && (
          <div className="topbar__controls">
            {showFilters && (
              <>
                <div className="topbar__chips">
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
                </div>
                <div className="topbar__range">
                  <CalendarDays size={14} />
                  <DateRangePicker />
                </div>
              </>
            )}
            {customFilters}
          </div>
        )}
      </div>
      <div className="topbar__section topbar__section--right topbar__section--right--flush">
        {extraControls}
        <div className="topbar__avatar" role="presentation">
          <span className="topbar__avatar-badge">{avatarInitials}</span>
          <span className="topbar__avatar-name">{displayName}</span>
          <ChevronDown size={14} className="topbar__avatar-icon" />
        </div>
      </div>
    </header>
  );
}
