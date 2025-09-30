import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css"
import { addDays, endOfDay, format, isSameDay, isWithinInterval, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import useQueryState from "../hooks/useQueryState";

// utilidades
const parseDateParam = (value) => {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const ms = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
};
const toUnixSeconds = (date) => Math.floor(date.getTime() / 1000);
const fmt = (d) => (d ? format(d, "dd/MM/yyyy") : "");

const RangeInput = forwardRef(
  ({ startText, endText, placeholder, onClick, onKeyDown, isOpen }, ref) => (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={`flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-left hover:border-slate-400 dark:hover:border-slate-600 transition shadow-sm
      ${isOpen ? "ring-2 ring-brand-500" : ""}`}
    >
      <Calendar size={16} className="text-slate-500" />
      <span className="text-sm text-slate-800 dark:text-slate-200">
        {startText && endText ? `${startText} — ${endText}` : placeholder}
      </span>
    </button>
  )
);
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

  // container bonitão
  const CalendarFrame = ({ className, children }) => (
  <div className={`${className || ""} rdp-container rdp-container--bg`}>
      {/* presets topo */}
      <div className="rdp-presets">
        {[7, 15, 30, 60].map((d) => (
          <button
            key={d}
            type="button"
            className="rdp-preset-btn"
            onClick={() => {
              const s = startOfDay(addDays(defaultEnd, -(d - 1)));
              const e = defaultEnd;
              setRange([s, e]);
              updateQuery(s, e);
              datePickerRef.current?.setOpen(false);
            }}
          >
            <span className="rdp-preset-label">Últimos</span>
            <strong className="rdp-preset-days">{d}d</strong>
          </button>
        ))}
      </div>
      {children}
      <div className="rdp-footer">
        <button
          type="button"
          className="rdp-btn"
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
            // garante que a query seja atualizada quando o usuário clicar aplicar
            if (startDate && endDate) updateQuery(startDate, endDate);
            datePickerRef.current?.setOpen(false);
          }}
        >
          Aplicar
        </button>
      </div>
      {/* estilos mínimos específicos para melhorar visual do range */}
      <style>{`
        .rdp-container { width: 360px; padding: 12px; }
        .rdp-container--bg { background: #ffffff; border-radius: 12px; box-shadow: 0 8px 24px rgba(2,6,23,0.6); border: 1px solid rgba(255,255,255,0.04); }
        .rdp-presets { display:flex; gap:10px; margin-bottom:10px; }
        .rdp-preset-btn { flex:1; background:transparent; border-radius:10px; padding:6px 10px; border:1px solid rgba(255,255,255,0.06); font-size:12px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:2px; }
        .rdp-preset-label { font-size:11px; color:#94a3b8; }
        .rdp-preset-days { font-size:14px; color:#0ea5a4; }
        .rdp-preset-btn:hover { background:rgba(2,6,23,0.04); }
        .rdp-footer { display:flex; justify-content:space-between; gap:8px; margin-top:10px; }
        .rdp-btn { padding:8px 12px; border-radius:10px; border:1px solid rgba(2,6,23,0.06); background:#fff; cursor:pointer; }
        .rdp-btn--primary { background:linear-gradient(180deg,#06b6d4,#0891b2); color:#fff; border: none; }
        .rdp-day--inrange { background: linear-gradient(90deg, rgba(6,182,212,0.12), rgba(8,145,178,0.12)); border-radius:0 !important; }
        .rdp-day--endpoint { background: #06b6d4; color: white !important; border-radius:6px !important; }
        .rdp-wrapper .react-datepicker__day--in-range { background: transparent; }
        /* popper wrapper force background if parent theme dark */
        .rdp-popper, .rdp-container--bg { background: #ffffff !important; }
      `}</style>
    </div>
  );

  return (
    <div className="inline-flex">
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
        calendarStartDay={1}
        fixedHeight
        dateFormat="dd/MM/yyyy"
        showPopperArrow={false}
        wrapperClassName="rdp-wrapper"
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
