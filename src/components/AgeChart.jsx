import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Users } from 'lucide-react';

/**
 * Gráfico de pizza para mostrar distribuição por faixa etária
 *
 * @param {Object} props
 * @param {Array} props.data - Array de objetos {range, value, percentage}
 * @param {string} props.title - Título do gráfico
 */
export default function AgeChart({ data, title = 'Distribuição por Idade' }) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-empty">
        <Users size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
        <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Sem dados de faixa etária disponíveis</p>
      </div>
    );
  }

  // Cores para cada faixa etária
  const COLORS = {
    '18-24': '#8b5cf6', // purple-500
    '25-34': '#3b82f6', // blue-500
    '35-44': '#10b981', // green-500
    '45-54': '#f59e0b', // amber-500
    '55+': '#ef4444',   // red-500
  };

  // Filtrar dados com valor > 0
  const chartData = data.filter(item => item.value > 0);

  if (chartData.length === 0) {
    return (
      <div className="chart-empty">
        <Users size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
        <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Sem dados de faixa etária disponíveis</p>
      </div>
    );
  }

  // Tooltip customizado
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          padding: '0.75rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        }}>
          <p style={{ fontWeight: '600', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
            Faixa: {data.payload.range}
          </p>
          <p style={{ color: data.payload.fill, fontSize: '0.875rem' }}>
            <strong>{data.value.toLocaleString('pt-BR')}</strong> ({data.payload.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  // Label customizado para mostrar percentual
  const renderLabel = (entry) => {
    if (entry.percentage < 5) return ''; // Não mostrar label se percentual < 5%
    return `${entry.percentage}%`;
  };

  return (
    <div className="chart-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <Users size={20} style={{ color: 'var(--primary)' }} />
        <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: 0 }}>{title}</h3>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderLabel}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.range] || '#cbd5e1'} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value, entry) => {
              const item = chartData.find(d => d.range === value);
              return `${value} (${item?.percentage || 0}%)`;
            }}
            wrapperStyle={{ fontSize: '0.75rem' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
