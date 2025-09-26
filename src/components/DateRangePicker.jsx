import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import { addDays, endOfDay, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import useQueryState from "../hooks/useQueryState";

const QUICK_PRESETS = [
  { label: "Últimos 7 dias", days: 7 },
  { label: "Últimos 15 dias", days: 15 },
  { label: "Últimos 30 dias", days: 30 },
];

const MONTHS_SHOWN = 2;

const parseDateParam = (value, fallback) => {
  if (!value) return fallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const milliseconds = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  return new Date(milliseconds);
};

const toUnixSeconds = (date) => Math.floor(date.getTime() / 1000);

const formatRange = (start, end) => {
  if (!start || !end) return "Selecionar período";
  const startLabel = format(start, "dd MMM yyyy", { locale: ptBR });
  const endLabel = format(end, "dd MMM yyyy", { locale: ptBR });
  return `${startLabel} – ${endLabel}`;
};

const RangeButton = forwardRef(({ label, onClick }, ref) => (
  <button type="button" className="filter-pill" onClick={onClick} ref={ref}>
    <Calendar size={16} />
    <span>{label}</span>
  </button>
));

RangeButton.displayName = "RangeButton";

const formatWeekdayLabel = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }
  try {
    return format(date, "EE", { locale: ptBR }).replace(".", "").toLowerCase();
  } catch (err) {
    console.error("Falha ao formatar rótulo de dia", err);
    return "";
  }
};

export default function DateRangePicker() {
  const now = useMemo(() => new Date(), []);
  const defaultEnd = endOfDay(now);
  const defaultStart = startOfDay(addDays(defaultEnd, -6));

  const [get, set] = useQueryState({});
  const initialStart = startOfDay(parseDateParam(get("since"), defaultStart));
  const initialEnd = endOfDay(parseDateParam(get("until"), defaultEnd));

  const [[startDate, endDate], setRange] = useState([initialStart, initialEnd]);
  const datePickerRef = useRef(null);

  useEffect(() => {
    if (startDate && endDate) {
      set({ since: toUnixSeconds(startDate), until: toUnixSeconds(endDate) });
    }
  }, [startDate, endDate, set]);

  const label = formatRange(startDate, endDate);

  const applyPreset = (days) => {
    const end = endOfDay(new Date());
    const start = startOfDay(addDays(end, -(days - 1)));
    setRange([start, end]);
    set({ since: toUnixSeconds(start), until: toUnixSeconds(end) });
    datePickerRef.current?.setOpen(false);
  };

  return (
    <DatePicker
      ref={datePickerRef}
      locale={ptBR}
      selected={startDate}
      onChange={(dates) => {
        const [start, end] = dates;
        if (start) {
          const normalizedStart = startOfDay(start);
          const normalizedEnd = end ? endOfDay(end) : endOfDay(start);
          setRange([normalizedStart, normalizedEnd]);
          if (end) {
            set({ since: toUnixSeconds(normalizedStart), until: toUnixSeconds(normalizedEnd) });
          }
        }
      }}
      startDate={startDate}
      endDate={endDate}
      selectsRange
      shouldCloseOnSelect={false}
      monthsShown={MONTHS_SHOWN}
      fixedHeight
      calendarStartDay={1}
      showPopperArrow={false}
      popperPlacement="bottom-end"
      customInput={<RangeButton label={label} />}
      calendarClassName="range-picker__calendar"
      popperClassName="dropdown-popover range-picker__popper"
      formatWeekDay={formatWeekdayLabel}
      renderDayContents={(day) => <span className="range-picker__day">{day}</span>}
      renderCustomHeader={({
        monthDate,
        decreaseMonth,
        increaseMonth,
        prevMonthButtonDisabled,
        nextMonthButtonDisabled,
        customHeaderCount,
      }) => {
        const isFirst = customHeaderCount === 0;
        const showPrev = isFirst;
        const showNext = customHeaderCount === MONTHS_SHOWN - 1;
        const monthLabel = format(monthDate, "MMMM yyyy", { locale: ptBR });
        const headerClass = `range-picker__header${isFirst ? "" : " range-picker__header--secondary"}`;

        return (
          <div className={headerClass}>
            <div className="range-picker__nav-row">
              <button
                type="button"
                className={`range-picker__nav${showPrev ? "" : " range-picker__nav--ghost"}`}
                onClick={decreaseMonth}
                disabled={!showPrev || prevMonthButtonDisabled}
                aria-hidden={!showPrev}
                tabIndex={showPrev ? 0 : -1}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="range-picker__month-label">{monthLabel}</span>
              <button
                type="button"
                className={`range-picker__nav${showNext ? "" : " range-picker__nav--ghost"}`}
                onClick={increaseMonth}
                disabled={!showNext || nextMonthButtonDisabled}
                aria-hidden={!showNext}
                tabIndex={showNext ? 0 : -1}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            {isFirst && (
              <div className="range-picker__presets">
                {QUICK_PRESETS.map(({ label: presetLabel, days }) => (
                  <button
                    key={presetLabel}
                    type="button"
                    className="range-picker__preset"
                    onClick={() => applyPreset(days)}
                  >
                    {presetLabel}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      }}
    />
  );
}
