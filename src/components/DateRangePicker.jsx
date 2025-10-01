import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { addDays, endOfDay, format, isSameDay, isWithinInterval, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";
import useQueryState from "../hooks/useQueryState";

const parseDateParam = (value) => {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const ms = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
};

const toUnixSeconds = (date) => Math.floor(date.getTime() / 1000);
const fmt = (d) => (d ? format(d, "MMM dd, yy", { locale: ptBR }).toUpperCase() : "");

const RangeInput = forwardRef(({ startText, endText, placeholder, onClick, onKeyDown, isOpen }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    onKeyDown={onKeyDown}
    className="date-range-btn"
    data-open={isOpen || undefined}
  >
    <span className="date-range-btn__text">
      {startText && endText ? `${startText} — ${endText}` : placeholder}
    </span>
    <Filter size={16} className="date-range-btn__icon" />
  </button>
));
RangeInput.displayName = "RangeInput";

export default function DateRangePicker() {
  // últimos 7 dias
  const now = useMemo(() => new Date(), []);
  const defaultEnd = useMemo(() => endOfDay(now), [now]);
  const defaultStart = useMemo(() => startOfDay(addDays(defaultEnd, -6)), [defaultEnd]);

  const [get, set] = useQueryState({});
  const qSince = get("since") || "";
  const qUntil = get("until") || "";

  const initialStart = startOfDay(parseDateParam(qSince) ?? defaultStart);
  const initialEnd = endOfDay(parseDateParam(qUntil) ?? defaultEnd);

  const [[startDate, endDate], setRange] = useState([initialStart, initialEnd]);
  const [isOpen, setIsOpen] = useState(false);
  const datePickerRef = useRef(null);
  const firstSync = useRef(false);

  useEffect(() => {
    if (firstSync.current) return;
    if (!qSince && !qUntil && startDate && endDate) {
      set({ since: String(toUnixSeconds(startDate)), until: String(toUnixSeconds(endDate)) });
    }
    firstSync.current = true;
  }, [qSince, qUntil, startDate, endDate, set]);

  useEffect(() => {
    const ns = parseDateParam(qSince);
    const ne = parseDateParam(qUntil);
    if (ns && ne) {
      const s = startOfDay(ns);
      const e = endOfDay(ne);
      if (!isSameDay(s, startDate) || !isSameDay(e, endDate)) setRange([s, e]);
      return;
    }
    if (!qSince && !qUntil) setRange([defaultStart, defaultEnd]);
  }, [qSince, qUntil, defaultStart, defaultEnd, startDate, endDate]);

  const updateQuery = (s, e) => {
    if (s && e) set({ since: String(toUnixSeconds(s)), until: String(toUnixSeconds(e)) });
    else set({ since: null, until: null });
  };

  const onChangeRange = (dates) => {
    const [s, e] = dates || [];
    if (!s) {
      setRange([null, null]);
      updateQuery(null, null);
      return;
    }
    const ns = startOfDay(s);
    const ne = e ? endOfDay(e) : null;
    setRange([ns, ne]);
    if (ne) updateQuery(ns, ne);
  };

  // destaque de dias
  const dayClassName = (d) => {
    if (!startDate || !endDate) return undefined;
    const isStart = isSameDay(d, startDate);
    const isEnd = isSameDay(d, endDate);
    const inRange =
      !isStart &&
      !isEnd &&
      isWithinInterval(d, {
        start: startOfDay(startDate),
        end: endOfDay(endDate),
      });

    if (isStart || isEnd) return "rdp-day--endpoint";
    if (inRange) return "rdp-day--inrange";
    return undefined;
  };

  const CalendarFrame = ({ className, children }) => (
    <div className={`rdp-container ${className || ""}`}>
      {children}
      <div className="rdp-footer">
        <button
          type="button"
          className="rdp-btn rdp-btn--secondary"
          onClick={() => {
            setRange([null, null]);
            updateQuery(null, null);
            datePickerRef.current?.setOpen(false);
          }}
        >
          Limpar
        </button>
        <button
          type="button"
          className="rdp-btn rdp-btn--primary"
          onClick={() => {
            if (startDate && endDate) updateQuery(startDate, endDate);
            datePickerRef.current?.setOpen(false);
          }}
        >
          Aplicar período
        </button>
      </div>
    </div>
  );

  const presets = [
    { days: 7, label: '7d' },
    { days: 15, label: '15d' },
    { days: 30, label: '30d' },
    { days: 60, label: '60d' }
  ];

  return (
    <div className="date-range-wrapper">
      {presets.map(({ days, label }) => {
        const isActive = startDate && endDate &&
          Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1 === days;
        return (
          <button
            key={days}
            type="button"
            className={`date-range-preset ${isActive ? 'date-range-preset--active' : ''}`}
            onClick={() => {
              const s = startOfDay(addDays(defaultEnd, -(days - 1)));
              const e = defaultEnd;
              setRange([s, e]);
              updateQuery(s, e);
            }}
          >
            {label}
          </button>
        );
      })}
      <DatePicker
        ref={datePickerRef}
        locale={ptBR}
        selected={startDate ?? null}
        onChange={onChangeRange}
        startDate={startDate ?? null}
        endDate={endDate ?? null}
        selectsRange
        monthsShown={1}
        shouldCloseOnSelect={false}
        calendarStartDay={0}
        dateFormat="dd/MM/yyyy"
        showPopperArrow={false}
        popperClassName="rdp-popper"
        calendarContainer={CalendarFrame}
        renderCustomHeader={({
          date,
          decreaseMonth,
          increaseMonth,
          prevMonthButtonDisabled,
          nextMonthButtonDisabled,
        }) => (
          <div className="rdp-header">
            <button
              type="button"
              className="rdp-nav"
              onClick={decreaseMonth}
              disabled={prevMonthButtonDisabled}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="rdp-title">{format(date, "MMMM yyyy", { locale: ptBR })}</span>
            <button
              type="button"
              className="rdp-nav"
              onClick={increaseMonth}
              disabled={nextMonthButtonDisabled}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
        formatWeekDay={(d) => {
          try {
            return format(d, "EEE", { locale: ptBR }).replace(".", "").slice(0, 3).toUpperCase();
          } catch {
            return "";
          }
        }}
        dayClassName={dayClassName}
        customInput={
          <RangeInput
            startText={fmt(startDate)}
            endText={fmt(endDate)}
            placeholder="Selecione o período"
            isOpen={isOpen}
          />
        }
        onCalendarOpen={() => setIsOpen(true)}
        onCalendarClose={() => setIsOpen(false)}
      />
    </div>
  );
}
