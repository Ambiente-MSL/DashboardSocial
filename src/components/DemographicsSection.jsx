import { BarChart3, AlertCircle } from 'lucide-react';
import CityChart from './CityChart';
import AgeChart from './AgeChart';
import GenderChart from './GenderChart';

/**
 * Seção completa de demografia que agrupa gráficos de cidades, idade e gênero
 *
 * @param {Object} props
 * @param {Object} props.data - Dados demográficos {cities, ages, gender}
 * @param {boolean} props.loading - Estado de carregamento
 * @param {string} props.error - Mensagem de erro
 * @param {string} props.platform - Plataforma (facebook ou instagram)
 */
export default function DemographicsSection({ data, loading, error, platform = 'facebook' }) {
  // Loading state
  if (loading) {
    return (
      <section className="dashboard-section">
        <div className="section-header">
          <div className="section-title-group">
            <BarChart3 size={24} />
            <div>
              <h2 className="section-title">Demografia</h2>
              <p className="section-description">
                Distribuição da audiência por localização, idade e gênero
              </p>
            </div>
          </div>
        </div>

        <div className="demographics-grid">
          {[1, 2, 3].map(i => (
            <div key={i} className="chart-skeleton">
              <div className="skeleton-header" />
              <div className="skeleton-chart" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section className="dashboard-section">
        <div className="section-header">
          <div className="section-title-group">
            <BarChart3 size={24} />
            <div>
              <h2 className="section-title">Demografia</h2>
              <p className="section-description">
                Distribuição da audiência por localização, idade e gênero
              </p>
            </div>
          </div>
        </div>

        <div style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: 'rgba(239, 68, 68, 0.05)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '0.5rem',
        }}>
          <AlertCircle size={48} style={{ color: '#ef4444', marginBottom: '1rem' }} />
          <p style={{ color: '#ef4444', fontWeight: '500', marginBottom: '0.5rem' }}>
            Erro ao carregar dados demográficos
          </p>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
            {error}
          </p>
        </div>
      </section>
    );
  }

  // Empty state
  if (!data || (!data.cities && !data.ages && !data.gender)) {
    return (
      <section className="dashboard-section">
        <div className="section-header">
          <div className="section-title-group">
            <BarChart3 size={24} />
            <div>
              <h2 className="section-title">Demografia</h2>
              <p className="section-description">
                Distribuição da audiência por localização, idade e gênero
              </p>
            </div>
          </div>
        </div>

        <div style={{
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--muted)',
        }}>
          <BarChart3 size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <p>Dados demográficos não disponíveis no momento</p>
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-section">
      <div className="section-header">
        <div className="section-title-group">
          <BarChart3 size={24} />
          <div>
            <h2 className="section-title">Demografia</h2>
            <p className="section-description">
              Distribuição da audiência por localização, idade e gênero
            </p>
          </div>
        </div>
      </div>

      <div className="demographics-grid">
        {/* Gráfico de Cidades */}
        {data.cities && data.cities.length > 0 && (
          <div className="demographics-chart">
            <CityChart data={data.cities} />
          </div>
        )}

        {/* Gráfico de Faixa Etária */}
        {data.ages && data.ages.length > 0 && (
          <div className="demographics-chart">
            <AgeChart data={data.ages} />
          </div>
        )}

        {/* Gráfico de Gênero */}
        {data.gender && data.gender.length > 0 && (
          <div className="demographics-chart" style={{ position: 'relative' }}>
            <GenderChart data={data.gender} />
          </div>
        )}
      </div>

      {/* Totais */}
      {data.totals && (
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          display: 'flex',
          gap: '2rem',
          flexWrap: 'wrap',
          fontSize: '0.875rem',
        }}>
          {data.totals.cities > 0 && (
            <div>
              <span style={{ color: 'var(--muted)' }}>Total de cidades: </span>
              <strong>{data.totals.cities.toLocaleString('pt-BR')}</strong>
            </div>
          )}
          {data.totals.ages > 0 && (
            <div>
              <span style={{ color: 'var(--muted)' }}>Total por idade: </span>
              <strong>{data.totals.ages.toLocaleString('pt-BR')}</strong>
            </div>
          )}
          {data.totals.gender > 0 && (
            <div>
              <span style={{ color: 'var(--muted)' }}>Total por gênero: </span>
              <strong>{data.totals.gender.toLocaleString('pt-BR')}</strong>
            </div>
          )}
        </div>
      )}

      {/* Estilos inline para os skeletons e grid */}
      <style jsx>{`
        .demographics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
          margin-top: 1.5rem;
        }

        .demographics-chart {
          background-color: var(--surface);
          border: 1px solid var(--border);
          border-radius: 0.75rem;
          padding: 1.5rem;
        }

        .chart-container {
          position: relative;
        }

        .chart-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem 1rem;
          text-align: center;
        }

        .chart-skeleton {
          background-color: var(--surface);
          border: 1px solid var(--border);
          border-radius: 0.75rem;
          padding: 1.5rem;
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        .skeleton-header {
          width: 50%;
          height: 1.5rem;
          background-color: var(--border);
          border-radius: 0.25rem;
          margin-bottom: 1rem;
        }

        .skeleton-chart {
          width: 100%;
          height: 300px;
          background-color: var(--border);
          border-radius: 0.5rem;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        @media (max-width: 768px) {
          .demographics-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
