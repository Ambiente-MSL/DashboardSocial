import { TrendingUp, TrendingDown, Info } from "lucide-react";

export default function MetricCard({ title, value = '-', delta = null, hint = null, children }) {
  const up = typeof delta === 'number' ? delta >= 0 : null;
  const displayValue = Number.isFinite(value) ? value.toLocaleString('pt-BR') : value;
  const deltaLabel = up !== null ? `${Math.abs(delta).toFixed(2)}%` : null;

  return (
    <div className="card metric-card">
      <div className="metric-card__header">
        <span className="metric-card__title">{title}</span>
        {hint && <Info size={16} className="metric-card__icon" title={hint} />}
      </div>
      <div className="metric-card__value-row">
        <span className="metric-card__value">{displayValue}</span>
        {deltaLabel && (
          <span className={`metric-card__delta${up ? '' : ' metric-card__delta--down'}`}>
            {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {deltaLabel}
          </span>
        )}
      </div>
      {children && <div className="metric-card__extra">{children}</div>}
    </div>
  );
}
