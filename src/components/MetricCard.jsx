import { TrendingUp, TrendingDown } from "lucide-react";

export default function MetricCard({
  title,
  value = '-',
  delta = null,
  hint = null,
  variant = 'default',
  compact = false,
  className = '',
  children,
}) {
  const up = typeof delta === 'number' ? delta >= 0 : null;
  const displayValue = Number.isFinite(value) ? value.toLocaleString('pt-BR') : value;
  const deltaLabel = up !== null ? `${Math.abs(delta).toFixed(2)}%` : null;

  const classes = ['card', 'metric-card'];
  const isCompact = compact || variant === 'compact';
  if (variant && variant !== 'default') {
    classes.push(`metric-card--${variant}`);
  }
  if (isCompact) {
    classes.push('metric-card--compact');
  }
  if (className) {
    classes.push(...className.split(' ').filter(Boolean));
  }

  return (
    <div className={classes.join(' ')} style={{ overflow: 'hidden' }}>
      <div className="metric-card__header">
        <h4
          className="metric-card__title"
          style={{ fontFamily: 'var(--font-sans, "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Roboto)', letterSpacing: '.1px' }}
        >
          {title}
        </h4>
        {hint && <span className="metric-card__hint muted">{hint}</span>}
      </div>
      <div className="metric-card__value-row">
        <span className="metric-card__value value">{displayValue}</span>
        {deltaLabel && (
          <span className={`metric-card__delta${up ? '' : ' metric-card__delta--down'}`}>
            {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {deltaLabel}
          </span>
        )}
      </div>
      {children ? <div className="metric-card__body">{children}</div> : null}
    </div>
  );
}
