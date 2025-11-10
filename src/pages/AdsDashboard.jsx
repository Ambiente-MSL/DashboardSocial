import { useState, useMemo } from "react";
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
} from "lucide-react";
import NavigationHero from "../components/NavigationHero";

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

// Import Sector from recharts
import { Sector } from "recharts";

export default function AdsDashboard() {
  const [activeSpendBar, setActiveSpendBar] = useState(-1);
  const [activeGenderIndex, setActiveGenderIndex] = useState(-1);
  const [activeDeviceIndex, setActiveDeviceIndex] = useState(-1);
  const [activeCampaignIndex, setActiveCampaignIndex] = useState(-1);

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
    <>
      <NavigationHero title="Anúncios" icon={TrendingUp} />

      <div className="ig-dashboard">
        {/* Gradient Background - Gray */}
        <div className="ig-dashboard__bg">
          <div
            className="ig-gradient-orb ig-gradient-orb--1"
            style={{ background: "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)" }}
          />
          <div
            className="ig-gradient-orb ig-gradient-orb--2"
            style={{ background: "linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)" }}
          />
          <div
            className="ig-gradient-orb ig-gradient-orb--3"
            style={{ background: "linear-gradient(135deg, #4b5563 0%, #374151 100%)" }}
          />
        </div>

        {/* Content */}
        <div className="ig-dashboard__content">
          {/* Main Grid Layout */}
          <div className="ig-profile-layout">
            {/* Left Column - Overview Card */}
            <aside className="ig-profile-vertical">
              <div className="ig-profile-vertical__header">
                <div className="ig-profile-vertical__avatar-wrap" style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" }}>
                  <DollarSign size={32} color="white" />
                </div>
                <h3 className="ig-profile-vertical__title">Visão Geral</h3>
                <p className="ig-profile-vertical__subtitle">Métricas de Anúncios</p>
              </div>

              <div className="ig-profile-vertical__stats">
                <div className="ig-profile-vertical__stat">
                  <span className="ig-profile-vertical__stat-label">
                    <Eye size={14} />
                    Impressões
                  </span>
                  <span className="ig-profile-vertical__stat-value">
                    {formatNumber(MOCK_OVERVIEW_STATS.impressions.value)}
                  </span>
                  <span className="ig-profile-vertical__stat-delta ig-profile-vertical__stat-delta--positive">
                    +{MOCK_OVERVIEW_STATS.impressions.delta}%
                  </span>
                </div>

                <div className="ig-profile-vertical__stat">
                  <span className="ig-profile-vertical__stat-label">
                    <Users size={14} />
                    Alcance
                  </span>
                  <span className="ig-profile-vertical__stat-value">
                    {formatNumber(MOCK_OVERVIEW_STATS.reach.value)}
                  </span>
                  <span className="ig-profile-vertical__stat-delta ig-profile-vertical__stat-delta--positive">
                    +{MOCK_OVERVIEW_STATS.reach.delta}%
                  </span>
                </div>

                <div className="ig-profile-vertical__stat">
                  <span className="ig-profile-vertical__stat-label">
                    <MousePointerClick size={14} />
                    Cliques
                  </span>
                  <span className="ig-profile-vertical__stat-value">
                    {formatNumber(MOCK_OVERVIEW_STATS.clicks.value)}
                  </span>
                  <span className="ig-profile-vertical__stat-delta ig-profile-vertical__stat-delta--positive">
                    +{MOCK_OVERVIEW_STATS.clicks.delta}%
                  </span>
                </div>

                <div className="ig-profile-vertical__stat">
                  <span className="ig-profile-vertical__stat-label">
                    <Target size={14} />
                    CTR
                  </span>
                  <span className="ig-profile-vertical__stat-value">
                    {MOCK_OVERVIEW_STATS.ctr.value}%
                  </span>
                  <span className="ig-profile-vertical__stat-delta ig-profile-vertical__stat-delta--positive">
                    +{MOCK_OVERVIEW_STATS.ctr.delta}%
                  </span>
                </div>

                <div className="ig-profile-vertical__stat">
                  <span className="ig-profile-vertical__stat-label">
                    <Activity size={14} />
                    CPC
                  </span>
                  <span className="ig-profile-vertical__stat-value">
                    {formatCurrency(MOCK_OVERVIEW_STATS.cpc.value)}
                  </span>
                  <span className="ig-profile-vertical__stat-delta ig-profile-vertical__stat-delta--negative">
                    {MOCK_OVERVIEW_STATS.cpc.delta}%
                  </span>
                </div>

                <div className="ig-profile-vertical__stat">
                  <span className="ig-profile-vertical__stat-label">
                    <Zap size={14} />
                    Conversões
                  </span>
                  <span className="ig-profile-vertical__stat-value">
                    {formatNumber(MOCK_OVERVIEW_STATS.conversions.value)}
                  </span>
                  <span className="ig-profile-vertical__stat-delta ig-profile-vertical__stat-delta--positive">
                    +{MOCK_OVERVIEW_STATS.conversions.delta}%
                  </span>
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
            </aside>

            {/* Right Column - Charts */}
            <div className="ig-profile-main">
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
    </>
  );
}
