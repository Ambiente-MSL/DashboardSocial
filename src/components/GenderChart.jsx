import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { UserCircle2 } from 'lucide-react';

/**
 * Gráfico de donut para mostrar distribuição por gênero
 *
 * @param {Object} props
 * @param {Array} props.data - Array de objetos {key, label, value, percentage}
 * @param {string} props.title - Título do gráfico
 */
export default function GenderChart({ data, title = 'Distribuição por Gênero' }) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-empty">
        <UserCircle2 size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
        <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Sem dados de gênero disponíveis</p>
      </div>
    );
  }

  // Cores para cada gênero
  const COLORS = {
    male: '#3b82f6',     // blue-500 (Masculino)
    female: '#ec4899',   // pink-500 (Feminino)
    unknown: '#9ca3af',  // gray-400 (Não informado)
  };

  // Filtrar dados com valor > 0
  const chartData = data.filter(item => item.value > 0);

  if (chartData.length === 0) {
    return (
      <div className="chart-empty">
        <UserCircle2 size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
        <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Sem dados de gênero disponíveis</p>
      </div>
    );
  }

  // Calcular total para o label central
  const total = chartData.reduce((sum, item) => sum + item.value, 0);

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
            {data.payload.label}
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
        <UserCircle2 size={20} style={{ color: 'var(--primary)' }} />
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
            innerRadius={60}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.key] || '#cbd5e1'} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value, entry) => {
              const item = chartData.find(d => d.label === value);
              return `${value} (${item?.percentage || 0}%)`;
            }}
            wrapperStyle={{ fontSize: '0.75rem' }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Label central do donut */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--foreground)' }}>
          {total.toLocaleString('pt-BR')}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
          Total
        </div>
      </div>
    </div>
  );
}
