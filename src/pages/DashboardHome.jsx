import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Topbar from '../components/Topbar';
import Section from '../components/Section';
import AccountSelect from '../components/AccountSelect';
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
  const [get, setQuery] = useQueryState({ account: DEFAULT_ACCOUNT_ID });
  const accountId = get('account') || DEFAULT_ACCOUNT_ID;
  const accountConfig = useMemo(
    () => accounts.find((item) => item.id === accountId) || accounts[0],
    [accountId],
  );

  const since = get('since');
  const until = get('until');

  useEffect(() => {
    if (!get('since') || !get('until')) {
      const now = Math.floor(Date.now() / 1000);
      const defaultUntil = now;
      const defaultSince = now - 6 * 86400;
      setQuery({
        since: String(defaultSince),
        until: String(defaultUntil),
      });
    }
  }, [get, setQuery]);

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
          const followersMetric = getMetric(data, 'followers_total');
          const followerNet = safeNumber(data.page_overview?.net_followers);
          const followersTotal = safeNumber(followersMetric?.value ?? data.page_overview?.followers_total);

          nextFacebook = {
            reach: safeNumber(reachMetric?.value),
            reachGrowth: reachMetric?.deltaPct,
            engagement: safeNumber(engagementMetric?.value),
            engagementGrowth: engagementMetric?.deltaPct,
            pageViews: safeNumber(pageViewsMetric?.value),
            followersNet: followerNet,
            followersTotal,
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
          const followerMetric = getMetric(data, 'followers_total');

          nextInstagram = {
            reach: safeNumber(reachMetric?.value),
            reachGrowth: reachMetric?.deltaPct,
            engagement: safeNumber(interactionsMetric?.value),
            engagementGrowth: interactionsMetric?.deltaPct,
            profileViews: safeNumber(profileViewsMetric?.value),
            followersTotal: safeNumber(followerMetric?.value),
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

  return (
    <>
      <Topbar
        title="Visao Geral"
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
        showFilters={false}
        lastSync={lastSyncAt}
        rightExtras={<AccountSelect />}
      />
      <div className="page-content">
        {error && (
          <div className="overview-alert">
            <strong>Algumas fontes nao retornaram dados:</strong> {error}
          </div>
        )}

        <Section
          title="Resumo geral da conta"
          description="Principais indicadores da página e perfil selecionados."
          right={<span className="overview-current-account">{accountConfig?.label}</span>}>
          {loading && !facebookSummary && !instagramSummary ? (
            <div className="overview-loading">Carregando visao geral...</div>
          ) : (
            <div className="overview-highlight">
              <div className="overview-highlight-card overview-highlight-card--instagram">
                <span className="overview-highlight-label">Seguidores no Instagram</span>
                <span className="overview-highlight-value">
                  {formatNumber(instagramSummary?.followersTotal)}
                </span>
                <span className="overview-highlight-foot">
                  Atualizado em {formatDateTime(instagramSummary?.cacheAt)}
                </span>
              </div>
              <div className="overview-highlight-card overview-highlight-card--facebook">
                <span className="overview-highlight-label">Curtidas da pagina</span>
                <span className="overview-highlight-value">
                  {formatNumber(facebookSummary?.followersTotal)}
                </span>
                <span className="overview-highlight-foot">
                  Atualizado em {formatDateTime(facebookSummary?.cacheAt)}
                </span>
              </div>
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
