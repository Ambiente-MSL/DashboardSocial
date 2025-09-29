import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import { addDays, endOfDay, format, isSameDay, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

import useQueryState from "../hooks/useQueryState";

const PRESETS = [
  { label: "7 dias", days: 7 },
  { label: "14 dias", days: 14 },
  { label: "28 dias", days: 28 },
  { label: "90 dias", days: 90 },
];

const BETWEEN_LABEL = "at\u00E9";

const parseDateParam = (value) => {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const milliseconds = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  const parsed = new Date(milliseconds);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toUnixSeconds = (date) => Math.floor(date.getTime() / 1000);

const formatLabel = (date) => (date ? format(date, "dd/MM/yyyy") : "");

const matchPreset = (start, end) => {
  if (!start || !end) return null;
  const endNormalized = endOfDay(end);
  const startNormalized = startOfDay(start);
  return PRESETS.find(({ days }) => {
    const expectedStart = startOfDay(addDays(endNormalized, -(days - 1)));
    return isSameDay(expectedStart, startNormalized) && isSameDay(endNormalized, end);
  })?.days ?? null;
};

const RangeInput = forwardRef(
  (
    {
      startText,
      endText,
      placeholderStart,
      placeholderEnd,
      onClick,
      onKeyDown,
      isOpen,
    },
    ref,
  ) => (
    <div
      ref={ref}
      onKeyDown={onKeyDown}
      className={`range-toolbar__inputs${isOpen ? " range-toolbar__inputs--open" : ""}`}
    >
      <button type="button" className="range-input" onClick={onClick}>
        <span className={startText ? "range-input__value" : "range-input__placeholder"}>
          {startText || placeholderStart}
        </span>
        <Calendar size={16} />
      </button>
      <span className="range-toolbar__separator">{BETWEEN_LABEL}</span>
      <button type="button" className="range-input" onClick={onClick}>
        <span className={endText ? "range-input__value" : "range-input__placeholder"}>
          {endText || placeholderEnd}
        </span>
        <Calendar size={16} />
      </button>
    </div>
  ),
);

RangeInput.displayName = "RangeInput";

export default function DateRangePicker() {
  const now = useMemo(() => new Date(), []);
  const defaultEnd = useMemo(() => endOfDay(now), [now]);
  const defaultStart = useMemo(() => startOfDay(addDays(defaultEnd, -6)), [defaultEnd]);

  const [get, set] = useQueryState({});
  const sinceParam = get("since") || "";
  const untilParam = get("until") || "";

  const initialStart = startOfDay(parseDateParam(sinceParam) ?? defaultStart);
  const initialEnd = endOfDay(parseDateParam(untilParam) ?? defaultEnd);

  const [[startDate, endDate], setRange] = useState([initialStart, initialEnd]);
  const [activePreset, setActivePreset] = useState(() => matchPreset(initialStart, initialEnd));
  const [isOpen, setIsOpen] = useState(false);

  const datePickerRef = useRef(null);
  const initialSyncRef = useRef(false);

  useEffect(() => {
    if (initialSyncRef.current) return;
    if (!sinceParam && !untilParam && startDate && endDate) {
      set({ since: String(toUnixSeconds(startDate)), until: String(toUnixSeconds(endDate)) });
    }
    initialSyncRef.current = true;
  }, [endDate, set, sinceParam, startDate, untilParam]);

  useEffect(() => {
    const nextStart = parseDateParam(sinceParam);
    const nextEnd = parseDateParam(untilParam);
    if (nextStart && nextEnd) {
      const normalizedStart = startOfDay(nextStart);
      const normalizedEnd = endOfDay(nextEnd);
      const startChanged = !startDate || !isSameDay(startDate, normalizedStart);
      const endChanged = !endDate || !isSameDay(endDate, normalizedEnd);
      if (startChanged || endChanged) {
        setRange([normalizedStart, normalizedEnd]);
      }
    }
    if (!sinceParam && !untilParam) {
      if (startDate && endDate) {
        const alreadyDefault = isSameDay(startDate, defaultStart) && isSameDay(endDate, defaultEnd);
        if (!alreadyDefault) {
          setRange([defaultStart, defaultEnd]);
        }
      }
      return;
    }
  }, [defaultEnd, defaultStart, endDate, sinceParam, startDate, untilParam]);

  useEffect(() => {
    setActivePreset(matchPreset(startDate, endDate));
  }, [endDate, startDate]);

  const updateQuery = (start, end) => {
    if (start && end) {
      set({ since: String(toUnixSeconds(start)), until: String(toUnixSeconds(end)) });
    } else {
      set({ since: null, until: null });
    }
  };

  const applyPreset = (days) => {
    const end = endOfDay(new Date());
    const start = startOfDay(addDays(end, -(days - 1)));
    setRange([start, end]);
    setActivePreset(days);
    updateQuery(start, end);
    datePickerRef.current?.setOpen(false);
  };

  const handleClear = () => {
    setRange([null, null]);
    setActivePreset(null);
    updateQuery(null, null);
    datePickerRef.current?.setOpen(false);
  };

  const handleToday = () => {
    const todayEnd = endOfDay(new Date());
    const todayStart = startOfDay(todayEnd);
    setRange([todayStart, todayEnd]);
    setActivePreset(null);
    updateQuery(todayStart, todayEnd);
    datePickerRef.current?.setOpen(false);
  };

  const handleRangeChange = (dates) => {
    const [start, end] = dates;
    if (!start) {
      setRange([null, null]);
      setActivePreset(null);
      updateQuery(null, null);
      return;
    }
    const normalizedStart = startOfDay(start);
    const normalizedEnd = end ? endOfDay(end) : null;
    setRange([normalizedStart, normalizedEnd]);
    if (normalizedEnd) {
      updateQuery(normalizedStart, normalizedEnd);
    } else {
      setActivePreset(null);
    }
  };

  const CalendarFrame = ({ className, children }) => (
    <div className={`${className} range-picker__calendar`}>
      {children}
      <div className="range-picker__footer">
        <button type="button" className="range-picker__footer-btn" onClick={handleClear}>
          Limpar
        </button>
        <button
          type="button"
          className="range-picker__footer-btn range-picker__footer-btn--primary"
          onClick={handleToday}
        >
          Hoje
        </button>
      </div>
    </div>
  );

  return (
    <div className="range-toolbar">
      <div className="range-toolbar__presets">
        {PRESETS.map(({ label, days }) => (
          <button
            key={label}
            type="button"
            className={`range-toolbar__preset${activePreset === days ? " range-toolbar__preset--active" : ""}`}
            onClick={() => applyPreset(days)}
          >
            {label}
          </button>
        ))}
        <span className="range-toolbar__label">INTERVALO PERSONALIZADO</span>
      </div>

      <DatePicker
        ref={datePickerRef}
        locale={ptBR}
        selected={startDate}
        onChange={handleRangeChange}
        startDate={startDate}
        endDate={endDate}
        selectsRange
        monthsShown={1}
        shouldCloseOnSelect={false}
        calendarStartDay={1}
        fixedHeight
        dateFormat="dd/MM/yyyy"
        showPopperArrow={false}
        popperClassName="range-picker__popper"
        calendarContainer={CalendarFrame}
        renderCustomHeader={({
          date,
          decreaseMonth,
          increaseMonth,
          prevMonthButtonDisabled,
          nextMonthButtonDisabled,
        }) => {
          const monthLabel = format(date, "MMMM yyyy", { locale: ptBR });
          return (
            <div className="range-picker__header">
              <div className="range-picker__nav-row">
                <button
                  type="button"
                  className="range-picker__nav"
                  onClick={decreaseMonth}
                  disabled={prevMonthButtonDisabled}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="range-picker__month-label">{monthLabel}</span>
                <button
                  type="button"
                  className="range-picker__nav"
                  onClick={increaseMonth}
                  disabled={nextMonthButtonDisabled}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          );
        }}
        formatWeekDay={(date) => format(date, "EE", { locale: ptBR }).replace(".", "").toUpperCase()}
        customInput={(
          <RangeInput
            startText={formatLabel(startDate)}
            endText={formatLabel(endDate)}
            placeholderStart="dd/mm/aaaa"
            placeholderEnd="dd/mm/aaaa"
            isOpen={isOpen}
          />
        )}
        onCalendarOpen={() => setIsOpen(true)}
        onCalendarClose={() => setIsOpen(false)}
      />
    </div>
  );
}
