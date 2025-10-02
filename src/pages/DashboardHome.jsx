import { useEffect, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Facebook, Instagram } from 'lucide-react';
import Topbar from '../components/Topbar';
import PlatformCard from '../components/PlatformCard';
import useQueryState from '../hooks/useQueryState';
import { accounts } from '../data/accounts';

const API_BASE_URL = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
const DEFAULT_ACCOUNT_ID = accounts[0]?.id || "";

export default function DashboardHome() {
  const { sidebarOpen, toggleSidebar } = useOutletContext();
  const [get] = useQueryState({ account: DEFAULT_ACCOUNT_ID });
  const accountId = get("account") || DEFAULT_ACCOUNT_ID;
  const accountConfig = useMemo(
    () => accounts.find((item) => item.id === accountId) || accounts[0],
    [accountId],
  );

  const since = get("since");
  const until = get("until");

  const [fbMetrics, setFbMetrics] = useState(null);
  const [igMetrics, setIgMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  // Função para calcular crescimento
  const calculateGrowth = (current, previous) => {
    if (!previous || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);

      try {
        // Buscar dados do Facebook
        if (accountConfig?.facebookPageId) {
          try {
            const fbParams = new URLSearchParams();
            fbParams.set("pageId", accountConfig.facebookPageId);
            if (since) fbParams.set("since", since);
            if (until) fbParams.set("until", until);

            const fbResponse = await fetch(`${API_BASE_URL}/api/facebook/metrics?${fbParams.toString()}`);
            if (fbResponse.ok) {
              const fbData = await fbResponse.json();

              // Extrair métricas principais
              const reachMetric = fbData.metrics?.find(m => m.key === 'reach');
              const engagementMetric = fbData.metrics?.find(m => m.key === 'post_engagement_total');
              const followersData = fbData.page_overview?.net_followers;

              setFbMetrics({
                reach: reachMetric?.value || 0,
                reachGrowth: reachMetric?.deltaPct,
                engagement: engagementMetric?.value || 0,
                engagementGrowth: engagementMetric?.deltaPct,
                followers: followersData || 0,
                followersGrowth: null,
              });
            }
          } catch (err) {
            console.error('Erro ao carregar métricas do Facebook:', err);
          }
        }

        // Buscar dados do Instagram
        if (accountConfig?.instagramUserId) {
          try {
            const igParams = new URLSearchParams();
            igParams.set("igUserId", accountConfig.instagramUserId);
            if (since) igParams.set("since", since);
            if (until) igParams.set("until", until);

            const igResponse = await fetch(`${API_BASE_URL}/api/instagram/metrics?${igParams.toString()}`);
            if (igResponse.ok) {
              const igData = await igResponse.json();

              // Extrair métricas principais
              const reachMetric = igData.metrics?.find(m => m.key === 'reach');
              const interactionsMetric = igData.metrics?.find(m => m.key === 'interactions');

              setIgMetrics({
                reach: reachMetric?.value || 0,
                reachGrowth: reachMetric?.deltaPct,
                engagement: interactionsMetric?.value || 0,
                engagementGrowth: interactionsMetric?.deltaPct,
                followers: null,
                followersGrowth: null,
              });
            }
          } catch (err) {
            console.error('Erro ao carregar métricas do Instagram:', err);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [accountConfig?.facebookPageId, accountConfig?.instagramUserId, since, until]);

  return (
    <>
      <Topbar title="Dashboard" sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
      <div className="page-content">
        <div className="dashboard-welcome">
          <h2 className="dashboard-welcome__title">Bem-vindo ao Monitor Social MSL</h2>
          <p className="dashboard-welcome__subtitle">
            Acompanhe o desempenho das suas redes sociais em tempo real
          </p>
        </div>

        <div className="platform-cards-grid">
          <PlatformCard
            platform="Facebook"
            to="/facebook"
            icon={Facebook}
            color="#1877f2"
            gradient="linear-gradient(135deg, #1877f2 0%, #0d5dba 100%)"
            metrics={fbMetrics}
            loading={loading}
          />

          <PlatformCard
            platform="Instagram"
            to="/instagram"
            icon={Instagram}
            color="#e4405f"
            gradient="linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)"
            metrics={igMetrics}
            loading={loading}
          />
        </div>
      </div>
    </>
  );
}
