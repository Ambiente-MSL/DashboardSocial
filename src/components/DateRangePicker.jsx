import { useMemo, useState, useEffect, useRef } from "react";
import { addDays, endOfDay, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Filter, X } from "lucide-react";
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
const toInputValue = (d) => (d ? format(d, "yyyy-MM-dd") : "");

export default function DateRangePicker() {
  const now = useMemo(() => new Date(), []);
  const defaultEnd = useMemo(() => endOfDay(now), [now]);
  const defaultStart = useMemo(() => startOfDay(addDays(defaultEnd, -6)), [defaultEnd]);

  const [get, set] = useQueryState({});
  const qSince = get("since") || "";
  const qUntil = get("until") || "";

  const initialStart = startOfDay(parseDateParam(qSince) ?? defaultStart);
  const initialEnd = endOfDay(parseDateParam(qUntil) ?? defaultEnd);

  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [isOpen, setIsOpen] = useState(false);
  const [tempStart, setTempStart] = useState(toInputValue(initialStart));
  const [tempEnd, setTempEnd] = useState(toInputValue(initialEnd));
  const dropdownRef = useRef(null);
  const firstSync = useRef(false);

  // Sincronização inicial com URL
  useEffect(() => {
    if (firstSync.current) return;
    if (!qSince && !qUntil && startDate && endDate) {
      set({ since: String(toUnixSeconds(startDate)), until: String(toUnixSeconds(endDate)) });
    }
    firstSync.current = true;
  }, [qSince, qUntil, startDate, endDate, set]);

  // Atualizar datas quando query params mudam
  useEffect(() => {
    const ns = parseDateParam(qSince);
    const ne = parseDateParam(qUntil);
    if (ns && ne) {
      const s = startOfDay(ns);
      const e = endOfDay(ne);
      setStartDate(s);
      setEndDate(e);
      setTempStart(toInputValue(s));
      setTempEnd(toInputValue(e));
    } else if (!qSince && !qUntil) {
      setStartDate(defaultStart);
      setEndDate(defaultEnd);
      setTempStart(toInputValue(defaultStart));
      setTempEnd(toInputValue(defaultEnd));
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
    } else {
      set({ since: null, until: null });
    }
  };

  const applyDates = () => {
    if (tempStart && tempEnd) {
      const s = startOfDay(new Date(tempStart));
      const e = endOfDay(new Date(tempEnd));
      setStartDate(s);
      setEndDate(e);
      updateQuery(s, e);
    }
    setIsOpen(false);
  };

  const clearDates = () => {
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    setTempStart(toInputValue(defaultStart));
    setTempEnd(toInputValue(defaultEnd));
    updateQuery(defaultStart, defaultEnd);
    setIsOpen(false);
  };

  const selectPreset = (days) => {
    const s = startOfDay(addDays(defaultEnd, -(days - 1)));
    const e = defaultEnd;
    setStartDate(s);
    setEndDate(e);
    setTempStart(toInputValue(s));
    setTempEnd(toInputValue(e));
    updateQuery(s, e);
  };

  const presets = [
    { days: 7, label: '7d' },
    { days: 15, label: '15d' },
    { days: 30, label: '30d' },
    { days: 60, label: '60d' }
  ];

  const activeDays = startDate && endDate
    ? Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1
    : null;

  return (
    <div className="date-range-wrapper">
      {presets.map(({ days, label }) => (
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
          <Filter size={16} className="date-range-btn__icon" />
        </button>

        {isOpen && (
          <div className="date-range-dropdown">
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
              <div className="date-input-group">
                <label htmlFor="start-date">Data inicial</label>
                <input
                  id="start-date"
                  type="date"
                  value={tempStart}
                  onChange={(e) => setTempStart(e.target.value)}
                  className="date-input"
                />
              </div>

              <div className="date-input-group">
                <label htmlFor="end-date">Data final</label>
                <input
                  id="end-date"
                  type="date"
                  value={tempEnd}
                  onChange={(e) => setTempEnd(e.target.value)}
                  className="date-input"
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
                onClick={applyDates}
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
