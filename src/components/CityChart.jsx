import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MapPin } from 'lucide-react';

/**
 * Gráfico de barras horizontais para mostrar distribuição por cidades
 *
 * @param {Object} props
 * @param {Array} props.data - Array de objetos {name, value, percentage}
 * @param {string} props.title - Título do gráfico
 */
export default function CityChart({ data, title = 'Principais Cidades' }) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-empty">
        <MapPin size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
        <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Sem dados de cidades disponíveis</p>
      </div>
    );
  }

  // Cores para as barras (gradiente de azul)
  const colors = [
    '#3b82f6', // blue-500
    '#60a5fa', // blue-400
    '#93c5fd', // blue-300
    '#bfdbfe', // blue-200
    '#dbeafe', // blue-100
    '#eff6ff', // blue-50
    '#f0f9ff', // blue-50/50
    '#f8fafc', // slate-50
  ];

  // Tooltip customizado
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          padding: '0.75rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        }}>
          <p style={{ fontWeight: '600', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
            {data.name}
          </p>
          <p style={{ color: 'var(--primary)', fontSize: '0.875rem' }}>
            <strong>{data.value.toLocaleString('pt-BR')}</strong> ({data.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <MapPin size={20} style={{ color: 'var(--primary)' }} />
        <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: 0 }}>{title}</h3>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
          <XAxis type="number" stroke="var(--muted)" fontSize={12} />
          <YAxis
            type="category"
            dataKey="name"
            stroke="var(--muted)"
            fontSize={12}
            width={150}
            tick={{ fill: 'var(--foreground)' }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--surface)' }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
