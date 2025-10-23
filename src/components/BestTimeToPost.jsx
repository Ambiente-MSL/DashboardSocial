import { Clock, TrendingUp, Calendar } from 'lucide-react';
import { useMemo } from 'react';

const BestTimeToPost = ({ posts, loading }) => {
  // Analisa os posts para encontrar o melhor dia e horário
  const analysis = useMemo(() => {
    if (!posts || posts.length === 0) {
      return {
        bestDay: 'Quarta-feira',
        bestTime: '18:00 - 21:00',
        avgEngagement: 0,
        confidence: 'baixa',
        dayData: {},
        hourData: {},
      };
    }

    const dayEngagement = {
      'Domingo': { total: 0, count: 0 },
      'Segunda-feira': { total: 0, count: 0 },
      'Terça-feira': { total: 0, count: 0 },
      'Quarta-feira': { total: 0, count: 0 },
      'Quinta-feira': { total: 0, count: 0 },
      'Sexta-feira': { total: 0, count: 0 },
      'Sábado': { total: 0, count: 0 },
    };

    const hourEngagement = {};
    for (let i = 0; i < 24; i++) {
      hourEngagement[i] = { total: 0, count: 0 };
    }

    // Analisa cada post
    posts.forEach(post => {
      const timestamp = post.timestamp;
      if (!timestamp) return;

      const date = new Date(timestamp);
      const dayName = date.toLocaleDateString('pt-BR', { weekday: 'long' });
      const dayCapitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);
      const hour = date.getHours();

      // Calcula engajamento total (curtidas + comentários + compartilhamentos + salvos)
      const likes = Number(post.like_count || post.likeCount || post.likes || 0);
      const comments = Number(
        post.comments_count ||
        post.commentsCount ||
        post.comments?.summary?.total_count ||
        post.comments?.count ||
        0
      );
      const shares = Number(post.shares || post.share_count || 0);
      const saves = Number(post.saved || post.saves || post.save_count || 0);

      const engagement = likes + comments + shares + saves;

      // Acumula por dia da semana
      if (dayEngagement[dayCapitalized]) {
        dayEngagement[dayCapitalized].total += engagement;
        dayEngagement[dayCapitalized].count++;
      }

      // Acumula por hora
      if (hourEngagement[hour]) {
        hourEngagement[hour].total += engagement;
        hourEngagement[hour].count++;
      }
    });

    // Calcula médias
    const dayAverages = {};
    Object.keys(dayEngagement).forEach(day => {
      const data = dayEngagement[day];
      dayAverages[day] = data.count > 0 ? data.total / data.count : 0;
    });

    const hourAverages = {};
    Object.keys(hourEngagement).forEach(hour => {
      const data = hourEngagement[hour];
      hourAverages[hour] = data.count > 0 ? data.total / data.count : 0;
    });

    // Encontra melhor dia
    const bestDay = Object.keys(dayAverages).reduce((a, b) =>
      dayAverages[a] > dayAverages[b] ? a : b
    );

    // Encontra faixa de melhor horário (3 horas consecutivas)
    let bestHourStart = 0;
    let bestAvgForRange = 0;

    for (let i = 0; i <= 21; i++) {
      const avg = (hourAverages[i] + hourAverages[i + 1] + hourAverages[i + 2]) / 3;
      if (avg > bestAvgForRange) {
        bestAvgForRange = avg;
        bestHourStart = i;
      }
    }

    const bestTimeStart = `${String(bestHourStart).padStart(2, '0')}:00`;
    const bestTimeEnd = `${String(bestHourStart + 3).padStart(2, '0')}:00`;
    const bestTime = `${bestTimeStart} - ${bestTimeEnd}`;

    // Calcula engajamento médio geral
    const totalEngagement = posts.reduce((sum, post) => {
      const likes = Number(post.like_count || post.likeCount || post.likes || 0);
      const comments = Number(
        post.comments_count ||
        post.commentsCount ||
        post.comments?.summary?.total_count ||
        0
      );
      const shares = Number(post.shares || post.share_count || 0);
      const saves = Number(post.saved || post.saves || 0);
      return sum + likes + comments + shares + saves;
    }, 0);

    const avgEngagement = Math.round(totalEngagement / posts.length);

    // Calcula confiança baseada na quantidade de posts
    let confidence = 'baixa';
    if (posts.length >= 30) confidence = 'alta';
    else if (posts.length >= 15) confidence = 'média';

    return {
      bestDay,
      bestTime,
      avgEngagement,
      confidence,
      dayData: dayAverages,
      hourData: hourAverages,
    };
  }, [posts]);

  if (loading) {
    return (
      <div className="best-time-card">
        <div className="best-time-card__header">
          <Clock size={20} className="best-time-card__icon" />
          <h3 className="best-time-card__title">Melhor horário para postar</h3>
        </div>
        <div className="best-time-card__loading">
          <div className="spinner"></div>
          <span>Analisando dados...</span>
        </div>
      </div>
    );
  }

  const confidenceColor = {
    baixa: '#f59e0b',
    média: '#3b82f6',
    alta: '#10b981',
  };

  const confidenceText = {
    baixa: 'Baseado em poucos dados',
    média: 'Baseado em dados moderados',
    alta: 'Baseado em dados robustos',
  };

  return (
    <div className="best-time-card">
      <div className="best-time-card__header">
        <Clock size={20} className="best-time-card__icon" />
        <h3 className="best-time-card__title">Melhor horário para postar</h3>
      </div>

      <div className="best-time-card__body">
        {/* Melhor dia */}
        <div className="best-time-stat">
          <div className="best-time-stat__label">
            <Calendar size={16} />
            <span>Melhor dia</span>
          </div>
          <div className="best-time-stat__value">{analysis.bestDay}</div>
        </div>

        {/* Melhor horário */}
        <div className="best-time-stat">
          <div className="best-time-stat__label">
            <Clock size={16} />
            <span>Melhor horário</span>
          </div>
          <div className="best-time-stat__value">{analysis.bestTime}</div>
        </div>

        {/* Engajamento médio */}
        <div className="best-time-stat">
          <div className="best-time-stat__label">
            <TrendingUp size={16} />
            <span>Engajamento médio</span>
          </div>
          <div className="best-time-stat__value">
            {analysis.avgEngagement.toLocaleString('pt-BR')}
          </div>
        </div>
      </div>

      {/* Indicador de confiança */}
      <div className="best-time-card__footer">
        <div
          className="best-time-confidence"
          style={{
            backgroundColor: `${confidenceColor[analysis.confidence]}15`,
            borderColor: confidenceColor[analysis.confidence]
          }}
        >
          <div
            className="best-time-confidence__dot"
            style={{ backgroundColor: confidenceColor[analysis.confidence] }}
          />
          <span style={{ color: confidenceColor[analysis.confidence] }}>
            {confidenceText[analysis.confidence]}
          </span>
        </div>
        <p className="best-time-card__note">
          Análise baseada em {posts?.length || 0} posts recentes
        </p>
      </div>
    </div>
  );
};

export default BestTimeToPost;
