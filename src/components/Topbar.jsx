import { useMemo } from "react";
import PropTypes from "prop-types";
import { endOfDay, startOfDay, subDays, differenceInCalendarDays } from "date-fns";
import { Bell, CalendarDays } from "lucide-react";
import DateRangePicker from "./DateRangePicker";
import AccountSelect from "./AccountSelect";
import useQueryState from "../hooks/useQueryState";

const DEFAULT_PRESETS = [
  { id: "7d", label: "7 Dias", days: 7 },
  { id: "1m", label: "1 Mês", days: 30 },
  { id: "3m", label: "3 Meses", days: 90 },
  { id: "6m", label: "6 Meses", days: 180 },
  { id: "1y", label: "1 Ano", days: 365 },
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

function useQueryRange() {
  const [get, set] = useQueryState({});
  const sinceParam = get("since");
  const untilParam = get("until");
  const since = parseDateParam(sinceParam);
  const until = parseDateParam(untilParam);
  return {
    since,
    until,
    setRange(start, end) {
      set({
        since: start ? String(toUnixSeconds(start)) : null,
        until: end ? String(toUnixSeconds(end)) : null,
      });
    },
  };
}

export default function Topbar({
  presets = DEFAULT_PRESETS,
  selectedPreset,
  onPresetSelect,
  onDateChange,
  userName,
  avatarUrl,
  notificationCount = 0,
  className = "",
}) {

  const { since, until, setRange } = useQueryRange();
  const now = useMemo(() => new Date(), []);
  const defaultEnd = useMemo(() => endOfDay(subDays(startOfDay(now), 1)), [now]);

  const uncontrolledPreset = useMemo(() => {
    if (!since || !until) return "custom";
    const diff = differenceInCalendarDays(endOfDay(until), startOfDay(since)) + 1;
    const match = presets.find((preset) => preset.days === diff);
    return match?.id ?? "custom";
  }, [since, until, presets]);

  const activePreset = selectedPreset ?? uncontrolledPreset;

  const handlePresetClick = (preset) => () => {
    if (!preset) return;
    if (typeof onPresetSelect === "function") {
      onPresetSelect(preset.id, preset);
    } else {
      const endDate = defaultEnd;
      const startDate = startOfDay(subDays(endDate, preset.days - 1));
      setRange(startDate, endDate);
    }
  };

  const handleRangeChange = (start, end) => {
    if (typeof onDateChange === "function") {
      onDateChange(start, end);
    } else {
      setRange(start, end);
    }
  };

  const displayNotification = Number.isFinite(notificationCount) && notificationCount > 0;

  return (
    <header className={`topbar topbar--dark ${className}`.trim()}>
      <div className="topbar__inner">
        <div className="topbar__controls">
          <div className="topbar__notif">
            <button type="button" className="topbar__notif-btn" aria-label="NotificaÃ§Ãµes">
              <Bell size={16} />
              {displayNotification && <span className="topbar__notif-badge">{notificationCount}</span>}
            </button>
          </div>

          <div className="topbar__chips topbar__chips--compact">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`topbar__chip${activePreset === preset.id ? " topbar__chip--active" : ""}`}
                onClick={handlePresetClick(preset)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="topbar__range topbar__range--compact">
            <CalendarDays size={16} />
            <DateRangePicker variant="compact" onRangeChange={handleRangeChange} />
          </div>

          <div className="topbar__account">
            <AccountSelect />
          </div>
        </div>
      </div>
    </header>
  );
}

Topbar.propTypes = {
  presets: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      days: PropTypes.number.isRequired,
    }),
  ),
  selectedPreset: PropTypes.string,
  onPresetSelect: PropTypes.func,
  onDateChange: PropTypes.func,
  userName: PropTypes.string,
  avatarUrl: PropTypes.string,
  notificationCount: PropTypes.number,
  className: PropTypes.string,
};
