import { useState, useMemo, useEffect } from "react";
import { Link, useLocation, useOutletContext } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ReferenceDot,
  Sector,
} from "recharts";
import {
  TrendingUp,
  DollarSign,
  Eye,
  MousePointerClick,
  Users,
  Target,
  Activity,
  Zap,
  BarChart3,
  FileText,
  Facebook,
  Instagram as InstagramIcon,
  Settings,
  Shield,
} from "lucide-react";

// Hero Tabs
const HERO_TABS = [
  { id: "instagram", label: "Instagram", href: "/instagram", icon: InstagramIcon },
  { id: "facebook", label: "Facebook", href: "/facebook", icon: Facebook },
  { id: "ads", label: "Ads", href: "/ads", icon: BarChart3 },
  { id: "reports", label: "Relatórios", href: "/relatorios", icon: FileText },
  { id: "admin", label: "Admin", href: "/admin", icon: Shield },
  { id: "settings", label: "Configurações", href: "/configuracoes", icon: Settings },
];

// Mock Data
const MOCK_OVERVIEW_STATS = {
  spend: { value: 12450.0, delta: 8.5, label: "Investimento Total" },
  impressions: { value: 485320, delta: 12.3, label: "Impressões" },
  reach: { value: 245680, delta: 15.7, label: "Alcance" },
  clicks: { value: 8542, delta: 10.2, label: "Cliques" },
  ctr: { value: 3.48, delta: 0.5, label: "CTR", suffix: "%" },
  cpc: { value: 1.46, delta: -5.2, label: "CPC", prefix: "R$" },
  conversions: { value: 1245, delta: 18.9, label: "Conversões" },
  cpa: { value: 10.0, delta: -8.3, label: "CPA", prefix: "R$" },
};

const MOCK_SPEND_SERIES = [
  { date: "01/02", value: 1580 },
  { date: "02/02", value: 1720 },
  { date: "03/02", value: 1650 },
  { date: "04/02", value: 1890 },
  { date: "05/02", value: 1950 },
  { date: "06/02", value: 1820 },
  { date: "07/02", value: 2100 },
  { date: "08/02", value: 1980 },
  { date: "09/02", value: 2250 },
  { date: "10/02", value: 2100 },
];

const MOCK_PERFORMANCE_SERIES = [
  { date: "01/02", impressions: 65000, clicks: 1800, conversions: 145 },
  { date: "02/02", impressions: 72000, clicks: 2050, conversions: 168 },
  { date: "03/02", impressions: 68000, clicks: 1920, conversions: 152 },
  { date: "04/02", impressions: 78000, clicks: 2200, conversions: 189 },
  { date: "05/02", impressions: 82000, clicks: 2350, conversions: 205 },
  { date: "06/02", impressions: 75000, clicks: 2100, conversions: 178 },
  { date: "07/02", impressions: 88000, clicks: 2500, conversions: 225 },
];

const MOCK_AGE_DISTRIBUTION = [
  { range: "18-24", value: 15, color: "#6366f1" },
  { range: "25-34", value: 35, color: "#8b5cf6" },
  { range: "35-44", value: 28, color: "#a855f7" },
  { range: "45-54", value: 15, color: "#c084fc" },
  { range: "55+", value: 7, color: "#d8b4fe" },
];

const MOCK_GENDER_DISTRIBUTION = [
  { name: "Homens", value: 45 },
  { name: "Mulheres", value: 55 },
];

const MOCK_DEVICE_DISTRIBUTION = [
  { name: "Mobile", value: 72 },
  { name: "Desktop", value: 23 },
  { name: "Tablet", value: 5 },
];

const MOCK_TOP_CAMPAIGNS = [
  {
    id: "1",
    name: "Campanha Verão 2025",
    objective: "Conversões",
    impressions: 125000,
    clicks: 3200,
    ctr: 2.56,
    spend: 4500,
    conversions: 380,
    cpa: 11.84,
  },
  {
    id: "2",
    name: "Lançamento Produto X",
    objective: "Tráfego",
    impressions: 98000,
    clicks: 2800,
    ctr: 2.86,
    spend: 3800,
    conversions: 290,
    cpa: 13.1,
  },
  {
    id: "3",
    name: "Promoção Relâmpago",
    objective: "Awareness",
    impressions: 87000,
    clicks: 2500,
    ctr: 2.87,
    spend: 3200,
    conversions: 245,
    cpa: 13.06,
  },
  {
    id: "4",
    name: "Engajamento Stories",
    objective: "Engajamento",
    impressions: 65000,
    clicks: 1950,
    ctr: 3.0,
    spend: 2100,
    conversions: 180,
    cpa: 11.67,
  },
];

const MOCK_CAMPAIGN_PERFORMANCE = [
  { name: "Conversão", value: 35, color: "#6366f1" },
  { name: "Tráfego", value: 28, color: "#8b5cf6" },
  { name: "Awareness", value: 22, color: "#a855f7" },
  { name: "Engajamento", value: 15, color: "#c084fc" },
];

const IG_DONUT_COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#c084fc", "#d8b4fe"];

const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        filter="url(#glow)"
      />
    </g>
  );
};

export default function AdsDashboard() {
  const location = useLocation();
  const outletContext = useOutletContext() || {};
  const { setTopbarConfig, resetTopbarConfig } = outletContext;

  const [activeSpendBar, setActiveSpendBar] = useState(-1);
  const [activeGenderIndex, setActiveGenderIndex] = useState(-1);
  const [activeDeviceIndex, setActiveDeviceIndex] = useState(-1);
  const [activeCampaignIndex, setActiveCampaignIndex] = useState(-1);

  // Configure Topbar
  useEffect(() => {
    if (!setTopbarConfig) return undefined;
    setTopbarConfig({ title: "Anúncios", showFilters: true });
    return () => resetTopbarConfig?.();
  }, [setTopbarConfig, resetTopbarConfig]);

  const formatNumber = (num) => {
    if (typeof num !== "number") return num;
    return new Intl.NumberFormat("pt-BR").format(num);
  };

  const formatCurrency = (num) => {
    if (typeof num !== "number") return num;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(num);
  };

  const peakSpendPoint = useMemo(() => {
    if (!MOCK_SPEND_SERIES.length) return null;
    return MOCK_SPEND_SERIES.reduce(
      (acc, point, index) => {
        if (point.value > acc.value) {
          return { value: point.value, index, date: point.date };
        }
        return acc;
      },
      { value: MOCK_SPEND_SERIES[0].value, index: 0, date: MOCK_SPEND_SERIES[0].date }
    );
  }, []);

  const highlightedSpendIndex = activeSpendBar >= 0 ? activeSpendBar : peakSpendPoint?.index ?? -1;
  const highlightedSpendPoint = highlightedSpendIndex >= 0 ? MOCK_SPEND_SERIES[highlightedSpendIndex] : null;

  return (
    <div className="instagram-dashboard instagram-dashboard--clean">
      {/* Container Limpo */}
      <div className="ig-clean-container">
        {/* Hero Gradient - Dark Blue */}
        <div
          className="ig-hero-gradient"
          aria-hidden="true"
          style={{
            background: 'linear-gradient(180deg, rgba(30, 58, 138, 0.15) 0%, rgba(29, 78, 216, 0.10) 50%, transparent 100%)'
          }}
        />

        {/* Header com Logo e Tabs */}
        <div className="ig-clean-header">
          <div className="ig-clean-header__brand">
            <div className="ig-clean-header__logo" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)' }}>
              <TrendingUp size={32} />
            </div>
            <h1>Anúncios</h1>
          </div>

          <nav className="ig-clean-tabs">
            {HERO_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.href ? location.pathname === tab.href : tab.id === "ads";
              const linkTarget = tab.href
                ? (location.search ? { pathname: tab.href, search: location.search } : tab.href)
                : null;
              return tab.href ? (
                <Link
                  key={tab.id}
                  to={linkTarget}
                  className={`ig-clean-tab${isActive ? " ig-clean-tab--active" : ""}`}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                </Link>
              ) : (
                <button
                  key={tab.id}
                  type="button"
                  className={`ig-clean-tab${isActive ? " ig-clean-tab--active" : ""}`}
                  disabled={!tab.href}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <h2 className="ig-clean-title">Visão Geral</h2>

        {/* Grid Principal */}
        <div className="ig-clean-grid">
          {/* Left Column - Overview Card */}
          <div className="ig-clean-grid__left">
            <section className="ig-profile-vertical">
              {/* Grid 3x3 de Métricas */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                padding: '20px'
              }}>
                {/* Investimento */}
                <div style={{
                  padding: '14px',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%)',
                  borderRadius: '12px',
                  border: '1px solid rgba(99, 102, 241, 0.2)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '6px',
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <DollarSign size={12} color="white" strokeWidth={2.5} />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Investimento
                    </span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
                    {formatCurrency(MOCK_OVERVIEW_STATS.spend.value)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                    +{MOCK_OVERVIEW_STATS.spend.delta}%
                  </div>
                </div>

                {/* Alcance */}
                <div style={{
                  padding: '14px',
                  background: 'rgba(255, 255, 255, 0.6)',
                  borderRadius: '12px',
                  border: '1px solid rgba(0, 0, 0, 0.08)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '6px',
                      background: 'rgba(139, 92, 246, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Users size={12} color="#8b5cf6" strokeWidth={2.5} />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Alcance
                    </span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
                    {formatNumber(MOCK_OVERVIEW_STATS.reach.value)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                    +{MOCK_OVERVIEW_STATS.reach.delta}%
                  </div>
                </div>

                {/* Frequência */}
                <div style={{
                  padding: '14px',
                  background: 'rgba(255, 255, 255, 0.6)',
                  borderRadius: '12px',
                  border: '1px solid rgba(0, 0, 0, 0.08)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '6px',
                      background: 'rgba(168, 85, 247, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Activity size={12} color="#a855f7" strokeWidth={2.5} />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Frequência
                    </span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
                    2.1x
                  </div>
                  <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                    +0.3x
                  </div>
                </div>

                {/* Impressões */}
                <div style={{
                  padding: '14px',
                  background: 'rgba(255, 255, 255, 0.6)',
                  borderRadius: '12px',
                  border: '1px solid rgba(0, 0, 0, 0.08)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '6px',
                      background: 'rgba(192, 132, 252, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Eye size={12} color="#c084fc" strokeWidth={2.5} />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Impressões
                    </span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
                    {formatNumber(MOCK_OVERVIEW_STATS.impressions.value)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                    +{MOCK_OVERVIEW_STATS.impressions.delta}%
                  </div>
                </div>

                {/* Cliques */}
                <div style={{
                  padding: '14px',
                  background: 'rgba(255, 255, 255, 0.6)',
                  borderRadius: '12px',
                  border: '1px solid rgba(0, 0, 0, 0.08)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '6px',
                      background: 'rgba(216, 180, 254, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <MousePointerClick size={12} color="#d8b4fe" strokeWidth={2.5} />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Cliques
                    </span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
                    {formatNumber(MOCK_OVERVIEW_STATS.clicks.value)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                    +{MOCK_OVERVIEW_STATS.clicks.delta}%
                  </div>
                </div>

                {/* Conversões */}
                <div style={{
                  padding: '14px',
                  background: 'rgba(255, 255, 255, 0.6)',
                  borderRadius: '12px',
                  border: '1px solid rgba(0, 0, 0, 0.08)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '6px',
                      background: 'rgba(99, 102, 241, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Zap size={12} color="#6366f1" strokeWidth={2.5} />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Conversões
                    </span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
                    {formatNumber(MOCK_OVERVIEW_STATS.conversions.value)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                    +{MOCK_OVERVIEW_STATS.conversions.delta}%
                  </div>
                </div>

                {/* CTR */}
                <div style={{
                  padding: '14px',
                  background: 'rgba(255, 255, 255, 0.6)',
                  borderRadius: '12px',
                  border: '1px solid rgba(0, 0, 0, 0.08)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '6px',
                      background: 'rgba(139, 92, 246, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Target size={12} color="#8b5cf6" strokeWidth={2.5} />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      CTR
                    </span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
                    {MOCK_OVERVIEW_STATS.ctr.value}%
                  </div>
                  <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                    +{MOCK_OVERVIEW_STATS.ctr.delta}%
                  </div>
                </div>

                {/* CPC */}
                <div style={{
                  padding: '14px',
                  background: 'rgba(255, 255, 255, 0.6)',
                  borderRadius: '12px',
                  border: '1px solid rgba(0, 0, 0, 0.08)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '6px',
                      background: 'rgba(168, 85, 247, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Activity size={12} color="#a855f7" strokeWidth={2.5} />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      CPC
                    </span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
                    {formatCurrency(MOCK_OVERVIEW_STATS.cpc.value)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>
                    {MOCK_OVERVIEW_STATS.cpc.delta}%
                  </div>
                </div>

                {/* CPA */}
                <div style={{
                  padding: '14px',
                  background: 'rgba(255, 255, 255, 0.6)',
                  borderRadius: '12px',
                  border: '1px solid rgba(0, 0, 0, 0.08)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '6px',
                      background: 'rgba(192, 132, 252, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <TrendingUp size={12} color="#c084fc" strokeWidth={2.5} />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      CPA
                    </span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
                    {formatCurrency(MOCK_OVERVIEW_STATS.cpa.value)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>
                    {MOCK_OVERVIEW_STATS.cpa.delta}%
                  </div>
                </div>
              </div>

              <div className="ig-profile-vertical__divider" />

              {/* Gender Distribution Donut */}
              <div className="ig-profile-vertical__engagement">
                <h4>Distribuição por Gênero</h4>
                <div className="ig-profile-vertical__engagement-chart">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={MOCK_GENDER_DISTRIBUTION}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        stroke="none"
                        activeIndex={activeGenderIndex}
                        activeShape={renderActiveShape}
                        onMouseEnter={(_, index) => setActiveGenderIndex(index)}
                        onMouseLeave={() => setActiveGenderIndex(-1)}
                      >
                        {MOCK_GENDER_DISTRIBUTION.map((_, index) => (
                          <Cell key={index} fill={IG_DONUT_COLORS[index % IG_DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [`${value}%`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="ig-engagement-legend" style={{ marginTop: "12px", gap: "14px" }}>
                  {MOCK_GENDER_DISTRIBUTION.map((slice, index) => (
                    <div key={slice.name} className="ig-engagement-legend__item" style={{ fontSize: "15px" }}>
                      <span
                        className="ig-engagement-legend__swatch"
                        style={{
                          backgroundColor: IG_DONUT_COLORS[index % IG_DONUT_COLORS.length],
                          width: "14px",
                          height: "14px",
                        }}
                      />
                      <span className="ig-engagement-legend__label">{slice.name}</span>
                      <span className="ig-engagement-legend__value">{slice.value}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ig-profile-vertical__divider" />

              {/* Device Distribution Donut */}
              <div className="ig-profile-vertical__engagement">
                <h4>Distribuição por Dispositivo</h4>
                <div className="ig-profile-vertical__engagement-chart">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={MOCK_DEVICE_DISTRIBUTION}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        stroke="none"
                        activeIndex={activeDeviceIndex}
                        activeShape={renderActiveShape}
                        onMouseEnter={(_, index) => setActiveDeviceIndex(index)}
                        onMouseLeave={() => setActiveDeviceIndex(-1)}
                      >
                        {MOCK_DEVICE_DISTRIBUTION.map((_, index) => (
                          <Cell key={index} fill={IG_DONUT_COLORS[index % IG_DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [`${value}%`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="ig-engagement-legend" style={{ marginTop: "12px", gap: "14px" }}>
                  {MOCK_DEVICE_DISTRIBUTION.map((slice, index) => (
                    <div key={slice.name} className="ig-engagement-legend__item" style={{ fontSize: "15px" }}>
                      <span
                        className="ig-engagement-legend__swatch"
                        style={{
                          backgroundColor: IG_DONUT_COLORS[index % IG_DONUT_COLORS.length],
                          width: "14px",
                          height: "14px",
                        }}
                      />
                      <span className="ig-engagement-legend__label">{slice.name}</span>
                      <span className="ig-engagement-legend__value">{slice.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Right Column - Charts */}
          <div className="ig-clean-grid__right">
            {/* Investimento Chart */}
            <section className="ig-growth-clean">
              <header className="ig-card-header">
                <div>
                  <h3>Investimento ao Longo do Tempo</h3>
                  <p className="ig-card-subtitle">Gastos diários em campanhas</p>
                </div>
              </header>

              <div className="ig-chart-area">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={MOCK_SPEND_SERIES}
                    margin={{ top: 16, right: 16, bottom: 32, left: 0 }}
                    barCategoryGap="35%"
                  >
                    <defs>
                      <linearGradient id="spendBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                      <linearGradient id="spendBarActive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f472b6" />
                        <stop offset="45%" stopColor="#d946ef" />
                        <stop offset="100%" stopColor="#6366f1" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 8" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#9ca3af", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#9ca3af", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => `R$ ${formatNumber(value)}`}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(99, 102, 241, 0.1)" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="ig-follower-tooltip">
                            <div className="ig-follower-tooltip__label">
                              Investimento: {formatCurrency(payload[0].value)}
                            </div>
                            <div className="ig-follower-tooltip__date">{payload[0].payload.date}</div>
                          </div>
                        );
                      }}
                    />
                    {highlightedSpendPoint && (
                      <>
                        <ReferenceLine
                          x={highlightedSpendPoint.date}
                          stroke="#111827"
                          strokeDasharray="4 4"
                          strokeOpacity={0.3}
                        />
                        <ReferenceLine
                          y={highlightedSpendPoint.value}
                          stroke="#111827"
                          strokeDasharray="4 4"
                          strokeOpacity={0.35}
                        />
                        <ReferenceDot
                          x={highlightedSpendPoint.date}
                          y={highlightedSpendPoint.value}
                          r={6}
                          fill="#111827"
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                      </>
                    )}
                    <Bar
                      dataKey="value"
                      radius={[12, 12, 0, 0]}
                      barSize={36}
                      onMouseEnter={(_, index) => setActiveSpendBar(index)}
                      onMouseLeave={() => setActiveSpendBar(-1)}
                    >
                      {MOCK_SPEND_SERIES.map((entry, index) => (
                        <Cell
                          key={entry.date}
                          fill={index === highlightedSpendIndex ? "url(#spendBarActive)" : "url(#spendBar)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Performance Metrics Chart */}
            <section className="ig-growth-clean">
              <header className="ig-card-header">
                <div>
                  <h3>Performance de Métricas</h3>
                  <p className="ig-card-subtitle">Impressões, Cliques e Conversões</p>
                </div>
              </header>

              <div className="ig-chart-area">
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={MOCK_PERFORMANCE_SERIES} margin={{ top: 16, right: 16, bottom: 32, left: 0 }}>
                    <defs>
                      <linearGradient id="impressionsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 8" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#9ca3af", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#9ca3af", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => {
                        if (value >= 1000) return `${Math.round(value / 1000)}k`;
                        return value;
                      }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="ig-follower-tooltip">
                            <div className="ig-follower-tooltip__date">{payload[0].payload.date}</div>
                            <div className="ig-follower-tooltip__label">
                              Impressões: {formatNumber(payload[0].payload.impressions)}
                            </div>
                            <div className="ig-follower-tooltip__label">
                              Cliques: {formatNumber(payload[0].payload.clicks)}
                            </div>
                            <div className="ig-follower-tooltip__label">
                              Conversões: {formatNumber(payload[0].payload.conversions)}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="impressions"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fill="url(#impressionsGradient)"
                    />
                    <Line type="monotone" dataKey="clicks" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="conversions" stroke="#a855f7" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Age Distribution */}
            <section className="ig-growth-clean">
              <header className="ig-card-header">
                <div>
                  <h3>Distribuição por Idade</h3>
                  <p className="ig-card-subtitle">Alcance por faixa etária</p>
                </div>
              </header>

              <div className="ig-chart-area">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={MOCK_AGE_DISTRIBUTION} margin={{ top: 16, right: 16, bottom: 16, left: 0 }}>
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 8" vertical={false} />
                    <XAxis
                      dataKey="range"
                      tick={{ fill: "#9ca3af", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#9ca3af", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="ig-follower-tooltip">
                            <div className="ig-follower-tooltip__label">
                              {payload[0].payload.range} anos
                            </div>
                            <div className="ig-follower-tooltip__date">{payload[0].value}%</div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={48}>
                      {MOCK_AGE_DISTRIBUTION.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Campaign Performance by Objective */}
            <section className="ig-growth-clean">
              <header className="ig-card-header">
                <div>
                  <h3>Performance por Objetivo</h3>
                  <p className="ig-card-subtitle">Distribuição de investimento</p>
                </div>
              </header>

              <div className="ig-chart-area">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={MOCK_CAMPAIGN_PERFORMANCE}
                    margin={{ top: 16, right: 16, bottom: 16, left: 80 }}
                    layout="vertical"
                  >
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 8" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: "#9ca3af", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: "#9ca3af", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      width={80}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="ig-follower-tooltip">
                            <div className="ig-follower-tooltip__label">{payload[0].payload.name}</div>
                            <div className="ig-follower-tooltip__date">{payload[0].value}%</div>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="value"
                      radius={[0, 8, 8, 0]}
                      barSize={32}
                      onMouseEnter={(_, index) => setActiveCampaignIndex(index)}
                      onMouseLeave={() => setActiveCampaignIndex(-1)}
                    >
                      {MOCK_CAMPAIGN_PERFORMANCE.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          opacity={activeCampaignIndex === -1 || activeCampaignIndex === index ? 1 : 0.5}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Top Campaigns Table */}
            <section className="ig-growth-clean">
              <header className="ig-card-header">
                <div>
                  <h3>Melhores Campanhas</h3>
                  <p className="ig-card-subtitle">Top 4 por performance</p>
                </div>
              </header>

              <div className="posts-table-container" style={{ marginTop: "16px" }}>
                <table className="posts-table">
                  <thead>
                    <tr>
                      <th>Nome da Campanha</th>
                      <th>Objetivo</th>
                      <th>Impressões</th>
                      <th>Cliques</th>
                      <th>CTR</th>
                      <th>Investimento</th>
                      <th>Conversões</th>
                      <th>CPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_TOP_CAMPAIGNS.map((campaign) => (
                      <tr key={campaign.id}>
                        <td className="posts-table__caption" style={{ fontWeight: 600 }}>
                          {campaign.name}
                        </td>
                        <td>{campaign.objective}</td>
                        <td>{formatNumber(campaign.impressions)}</td>
                        <td>{formatNumber(campaign.clicks)}</td>
                        <td>{campaign.ctr}%</td>
                        <td>{formatCurrency(campaign.spend)}</td>
                        <td>{formatNumber(campaign.conversions)}</td>
                        <td>{formatCurrency(campaign.cpa)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
