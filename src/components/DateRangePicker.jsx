import { useMemo, useState, useEffect, useRef } from "react";
import { addDays, endOfDay, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Calendar, X } from "lucide-react";
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
const fmt = (d) => (d ? format(d, "dd MMM yy", { locale: ptBR }).toUpperCase() : "");

export default function DateRangePicker({ onRangeChange, variant = "default" }) {
  // Usar momento atual
  const now = useMemo(() => new Date(), []);
  const todayStart = useMemo(() => startOfDay(now), [now]);

  // Considerar os últimos 7 dias completos (até o dia anterior) para garantir consistência
  const defaultEnd = useMemo(() => endOfDay(addDays(todayStart, -1)), [todayStart]);
  const defaultStart = useMemo(() => startOfDay(addDays(defaultEnd, -6)), [defaultEnd]);

  const [get, set] = useQueryState({});
  const qSince = get("since") || "";
  const qUntil = get("until") || "";

  const initialStart = startOfDay(parseDateParam(qSince) ?? defaultStart);
  const initialEnd = endOfDay(parseDateParam(qUntil) ?? defaultEnd);

  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const firstSync = useRef(false);

  // Sincronização inicial com URL
  useEffect(() => {
    if (firstSync.current) return;
    if (!qSince && !qUntil && startDate && endDate) {
      set({ since: String(toUnixSeconds(startDate)), until: String(toUnixSeconds(endDate)) });
    }
    firstSync.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qSince, qUntil]);

  // Atualizar datas quando query params mudam
  useEffect(() => {
    const ns = parseDateParam(qSince);
    const ne = parseDateParam(qUntil);
    if (ns && ne) {
      const s = startOfDay(ns);
      const e = endOfDay(ne);
      setStartDate(s);
      setEndDate(e);
    } else if (!qSince && !qUntil) {
      setStartDate(defaultStart);
      setEndDate(defaultEnd);
    }
  }, [qSince, qUntil, defaultStart, defaultEnd]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const updateQuery = (s, e) => {
    if (s && e) {
      set({ since: String(toUnixSeconds(s)), until: String(toUnixSeconds(e)) });
      onRangeChange?.(s, e);
    } else {
      set({ since: null, until: null });
      const defaultStartDate = defaultStart;
      const defaultEndDate = defaultEnd;
      onRangeChange?.(defaultStartDate, defaultEndDate);
    }
  };

  const handleDateChange = (dates) => {
    const [start, end] = dates;
    setStartDate(start);
    setEndDate(end);

    // Aplicar automaticamente quando ambas as datas são selecionadas
    if (start && end) {
      const s = startOfDay(start);
      const e = endOfDay(end);
      updateQuery(s, e);
      setTimeout(() => setIsOpen(false), 300);
    }
  };

  const clearDates = () => {
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    updateQuery(defaultStart, defaultEnd);
    setIsOpen(false);
  };

  const selectPreset = (days) => {
    const s = startOfDay(addDays(defaultEnd, -(days - 1)));
    const e = defaultEnd;
    setStartDate(s);
    setEndDate(e);
    updateQuery(s, e);
    setIsOpen(false);
  };

  const presets = [
    { days: 7, label: 'Últimos 7 dias' },
    { days: 15, label: 'Últimos 15 dias' },
    { days: 30, label: 'Últimos 30 dias' },
    { days: 60, label: 'Últimos 60 dias' },
    { days: 90, label: 'Últimos 90 dias' }
  ];

  const activeDays = startDate && endDate
    ? Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1
    : null;

  const wrapperClass = `date-range-wrapper${variant === "compact" ? " date-range-wrapper--compact" : ""}`;

  return (
    <div className={wrapperClass}>
      {variant !== "compact" && presets.slice(0, 4).map(({ days, label }) => (
        <button
          key={days}
          type="button"
          className={`date-range-preset ${activeDays === days ? 'date-range-preset--active' : ''}`}
          onClick={() => selectPreset(days)}
        >
          {label}
        </button>
      ))}

      <div className="date-range-custom" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="date-range-btn"
          data-open={isOpen || undefined}
        >
          <span className="date-range-btn__text">
            {startDate && endDate ? `${fmt(startDate)} — ${fmt(endDate)}` : "Selecione o período"}
          </span>
          {variant !== "compact" && <Calendar size={16} className="date-range-btn__icon" />}
        </button>

        {isOpen && (
          <div className="date-range-dropdown date-range-dropdown--modern date-range-dropdown--calendar-only">
            <div className="date-range-dropdown__header">
              <span>Selecionar período</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="date-range-dropdown__close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="date-range-dropdown__body">
              <div className="date-range-calendar-wrapper">
                <DatePicker
                  selected={startDate}
                  onChange={handleDateChange}
                  startDate={startDate}
                  endDate={endDate}
                  selectsRange
                  inline
                  locale={ptBR}
                  maxDate={new Date()}
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  calendarClassName="custom-datepicker"
                />
              </div>
            </div>

            <div className="date-range-dropdown__footer">
              <button
                type="button"
                className="date-range-dropdown__btn date-range-dropdown__btn--secondary"
                onClick={clearDates}
              >
                Limpar
              </button>
              <button
                type="button"
                className="date-range-dropdown__btn date-range-dropdown__btn--primary"
                onClick={() => setIsOpen(false)}
                disabled={!startDate || !endDate}
              >
                Aplicar período
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
