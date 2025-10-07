import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import Topbar from '../components/Topbar';
import Section from '../components/Section';
import useQueryState from '../hooks/useQueryState';
import { accounts } from '../data/accounts';

const API_BASE_URL = (process.env.REACT_APP_API_URL || '').replace(/\/$/, '');
const DEFAULT_ACCOUNT_ID = accounts[0]?.id || '';

const safeNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const formatNumber = (value, fallback = 'N/A') => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num.toLocaleString('pt-BR');
};

const formatCurrency = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 'N/A';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDelta = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 'N/A';
  const rounded = Math.abs(num).toFixed(1);
  const prefix = num > 0 ? '+' : num < 0 ? '-' : '';
  return `${prefix} ${rounded.replace('.', ',')}%`;
};

const formatDateTime = (iso) => {
  if (!iso) return 'N/A';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

const toIsoDate = (value) => {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const ms = num > 1_000_000_000_000 ? num : num * 1000;
  return new Date(ms).toISOString().slice(0, 10);
};

const getMetric = (payload, key) => payload?.metrics?.find((item) => item.key === key) || null;

export default function DashboardHome() {
  const { sidebarOpen, toggleSidebar } = useOutletContext();
  const [get] = useQueryState({ account: DEFAULT_ACCOUNT_ID });
  const accountId = get('account') || DEFAULT_ACCOUNT_ID;
  const accountConfig = useMemo(
    () => accounts.find((item) => item.id === accountId) || accounts[0],
    [accountId],
  );

  const since = get('since');
  const until = get('until');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [facebookSummary, setFacebookSummary] = useState(null);
  const [instagramSummary, setInstagramSummary] = useState(null);
  const [adsSummary, setAdsSummary] = useState(null);

  useEffect(() => {
    let active = true;

    const fetchJson = async (url) => {
      const response = await fetch(url);
      const raw = await response.text();
      let json = null;
      if (raw) {
        try {
          json = JSON.parse(raw);
        } catch (err) {
          json = null;
        }
      }
      if (!response.ok) {
        const message =
          json?.error ||
          json?.message ||
          (json && typeof json === 'object' && json.error?.message) ||
          `HTTP ${response.status}`;
        throw new Error(message);
      }
      return json || {};
    };

    const loadOverview = async () => {
      setLoading(true);
      setError(null);

      const warnings = [];
      let nextFacebook = null;
      let nextInstagram = null;
      let nextAds = null;

      if (accountConfig?.facebookPageId) {
        try {
          const params = new URLSearchParams();
          params.set('pageId', accountConfig.facebookPageId);
          if (since) params.set('since', since);
          if (until) params.set('until', until);

          const data = await fetchJson(`${API_BASE_URL}/api/facebook/metrics?${params.toString()}`);
          const reachMetric = getMetric(data, 'reach');
          const engagementMetric = getMetric(data, 'post_engagement_total');
          const pageViewsMetric = getMetric(data, 'page_views');
          const followerNet = safeNumber(data.page_overview?.net_followers);

          nextFacebook = {
            reach: safeNumber(reachMetric?.value),
            reachGrowth: reachMetric?.deltaPct,
            engagement: safeNumber(engagementMetric?.value),
            engagementGrowth: engagementMetric?.deltaPct,
            pageViews: safeNumber(pageViewsMetric?.value),
            followersNet: followerNet,
            cacheAt: data.cache?.fetched_at || null,
          };
        } catch (err) {
          warnings.push(`Facebook: ${err.message}`);
        }
      }

      if (accountConfig?.instagramUserId) {
        try {
          const params = new URLSearchParams();
          params.set('igUserId', accountConfig.instagramUserId);
          if (since) params.set('since', since);
          if (until) params.set('until', until);

          const data = await fetchJson(`${API_BASE_URL}/api/instagram/metrics?${params.toString()}`);
          const reachMetric = getMetric(data, 'reach');
          const interactionsMetric = getMetric(data, 'interactions');
          const profileViewsMetric = getMetric(data, 'profile_views');

          nextInstagram = {
            reach: safeNumber(reachMetric?.value),
            reachGrowth: reachMetric?.deltaPct,
            engagement: safeNumber(interactionsMetric?.value),
            engagementGrowth: interactionsMetric?.deltaPct,
            profileViews: safeNumber(profileViewsMetric?.value),
            cacheAt: data.cache?.fetched_at || null,
          };
        } catch (err) {
          warnings.push(`Instagram: ${err.message}`);
        }
      }

  if (accountConfig?.adAccountId) {
        try {
          const params = new URLSearchParams({ actId: accountConfig.adAccountId });
          const isoSince = toIsoDate(since);
          const isoUntil = toIsoDate(until);
          if (isoSince) params.set('since', isoSince);
          if (isoUntil) params.set('until', isoUntil);

          const data = await fetchJson(`${API_BASE_URL}/api/ads/highlights?${params.toString()}`);
          nextAds = {
            spend: safeNumber(data.totals?.spend),
            clicks: safeNumber(data.totals?.clicks),
            reach: safeNumber(data.totals?.reach),
            bestAd: data.best_ad || null,
            cacheAt: data.cache?.fetched_at || null,
          };
        } catch (err) {
          warnings.push(`Ads: ${err.message}`);
        }
      }

      if (active) {
        setFacebookSummary(nextFacebook);
        setInstagramSummary(nextInstagram);
        setAdsSummary(nextAds);
        setError(warnings.length ? warnings.join(' - ') : null);
        setLoading(false);
      }
    };

    loadOverview();

    return () => {
      active = false;
    };
  }, [
    accountConfig?.facebookPageId,
    accountConfig?.instagramUserId,
    accountConfig?.adAccountId,
    since,
    until,
  ]);

  const totals = useMemo(() => {
    const totalReach = safeNumber(facebookSummary?.reach) + safeNumber(instagramSummary?.reach);
    const totalEngagement =
      safeNumber(facebookSummary?.engagement) + safeNumber(instagramSummary?.engagement);
    const totalSpend = safeNumber(adsSummary?.spend);
    return { totalReach, totalEngagement, totalSpend };
  }, [facebookSummary, instagramSummary, adsSummary]);

  const lastSyncAt = useMemo(() => {
    const timestamps = [facebookSummary?.cacheAt, instagramSummary?.cacheAt, adsSummary?.cacheAt]
      .map((value) => {
        if (!value) return null;
        const time = Date.parse(value);
        return Number.isFinite(time) ? time : null;
      })
      .filter((value) => value != null);
    if (!timestamps.length) return null;
    return new Date(Math.max(...timestamps)).toISOString();
  }, [facebookSummary?.cacheAt, instagramSummary?.cacheAt, adsSummary?.cacheAt]);

  const renderMetricItems = (items) => (
    <div className="overview-metric-grid">
      {items.map((item) => (
        <div className="overview-metric-item" key={item.label}>
          <span className="overview-metric-label">{item.label}</span>
          <span className="overview-metric-value">{item.value}</span>
          {item.delta && <span className="overview-metric-delta">{item.delta}</span>}
        </div>
      ))}
    </div>
  );

  return (
    <>
      <Topbar
        title="Visao Geral"
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
        showFilters
      />
      <div className="page-content">
        {error && (
          <div className="overview-alert">
            <strong>Algumas fontes nao retornaram dados:</strong> {error}
          </div>
        )}

        <Section
          title="Resumo rapido"
          description="Indicadores combinados das contas conectadas nesse periodo."
        >
          {loading && !facebookSummary && !instagramSummary ? (
            <div className="overview-loading">Carregando visao geral...</div>
          ) : (
            <div className="overview-summary-grid">
              <div className="overview-summary-card">
                <span className="overview-summary-label">Alcance total</span>
                <span className="overview-summary-value">{formatNumber(totals.totalReach)}</span>
                <span className="overview-summary-foot">
                  Soma de Facebook e Instagram no intervalo selecionado.
                </span>
              </div>
              <div className="overview-summary-card">
                <span className="overview-summary-label">Interacoes totais</span>
                <span className="overview-summary-value">
                  {formatNumber(totals.totalEngagement)}
                </span>
                <span className="overview-summary-foot">
                  Curtidas, comentarios, compartilhamentos e salvamentos.
                </span>
              </div>
              <div className="overview-summary-card">
                <span className="overview-summary-label">Investimento em anuncios</span>
                <span className="overview-summary-value">
                  {formatCurrency(totals.totalSpend)}
                </span>
                <span className="overview-summary-foot">
                  Valor total gasto na conta de anuncios selecionada.
                </span>
              </div>
              <div className="overview-summary-card">
                <span className="overview-summary-label">Ultima sincronizacao</span>
                <span className="overview-summary-value">{formatDateTime(lastSyncAt)}</span>
                <span className="overview-summary-foot">
                  Atualizacoes automaticas ocorrem a cada 24h ou sob demanda.
                </span>
              </div>
            </div>
          )}
        </Section>

        <Section title="Desempenho por plataforma">
          <div className="overview-platform-grid">
            <div className="overview-platform-card card">
              <header className="overview-platform-card__header">
                <div>
                  <h3>Facebook</h3>
                  <span className="overview-platform-subtitle">
                    Ultima atualizacao: {formatDateTime(facebookSummary?.cacheAt)}
                  </span>
                </div>
                <Link className="overview-card-link" to="/facebook">
                  Ver detalhes
                </Link>
              </header>
              {facebookSummary ? (
                renderMetricItems([
                  {
                    label: 'Alcance',
                    value: formatNumber(facebookSummary.reach),
                    delta: formatDelta(facebookSummary.reachGrowth),
                  },
                  {
                    label: 'Engajamento',
                    value: formatNumber(facebookSummary.engagement),
                    delta: formatDelta(facebookSummary.engagementGrowth),
                  },
                  {
                    label: 'Visualizacoes da pagina',
                    value: formatNumber(facebookSummary.pageViews),
                  },
                  {
                    label: 'Seguidores liquidos',
                    value: formatNumber(facebookSummary.followersNet),
                  },
                ])
              ) : (
                <div className="overview-empty">Configure uma pagina do Facebook para ver dados.</div>
              )}
            </div>

            <div className="overview-platform-card card">
              <header className="overview-platform-card__header">
                <div>
                  <h3>Instagram</h3>
                  <span className="overview-platform-subtitle">
                    Ultima atualizacao: {formatDateTime(instagramSummary?.cacheAt)}
                  </span>
                </div>
                <Link className="overview-card-link" to="/instagram">
                  Ver detalhes
                </Link>
              </header>
              {instagramSummary ? (
                renderMetricItems([
                  {
                    label: 'Alcance',
                    value: formatNumber(instagramSummary.reach),
                    delta: formatDelta(instagramSummary.reachGrowth),
                  },
                  {
                    label: 'Interacoes',
                    value: formatNumber(instagramSummary.engagement),
                    delta: formatDelta(instagramSummary.engagementGrowth),
                  },
                  {
                    label: 'Views de perfil',
                    value: formatNumber(instagramSummary.profileViews),
                  },
                ])
              ) : (
                <div className="overview-empty">Associe um perfil do Instagram para acompanhar.</div>
              )}
            </div>

            <div className="overview-platform-card card">
              <header className="overview-platform-card__header">
                <div>
                  <h3>Ads</h3>
                  <span className="overview-platform-subtitle">
                    Ultima atualizacao: {formatDateTime(adsSummary?.cacheAt)}
                  </span>
                </div>
                <Link className="overview-card-link" to="/facebook">
                  Painel de anuncios
                </Link>
              </header>
              {adsSummary ? (
                renderMetricItems([
                  { label: 'Investimento', value: formatCurrency(adsSummary.spend) },
                  { label: 'Cliques', value: formatNumber(adsSummary.clicks) },
                  { label: 'Alcance', value: formatNumber(adsSummary.reach) },
                  {
                    label: 'Melhor anuncio',
                    value: adsSummary.bestAd?.ad_name || 'N/A',
                  },
                ])
              ) : (
                <div className="overview-empty">Conecte uma conta de anuncios para consolidar gastos.</div>
              )}
            </div>
          </div>
        </Section>

        <Section title="Status das sincronizacoes" surface={false}>
          <div className="overview-status-grid">
            <div className="overview-status-item">
              <span className="overview-status-label">Facebook</span>
              <span className="overview-status-value">{formatDateTime(facebookSummary?.cacheAt)}</span>
            </div>
            <div className="overview-status-item">
              <span className="overview-status-label">Instagram</span>
              <span className="overview-status-value">{formatDateTime(instagramSummary?.cacheAt)}</span>
            </div>
            <div className="overview-status-item">
              <span className="overview-status-label">Ads</span>
              <span className="overview-status-value">{formatDateTime(adsSummary?.cacheAt)}</span>
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}
