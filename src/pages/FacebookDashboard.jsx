import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import Topbar from "../components/Topbar";
import Section from "../components/Section";
import KpiGrid from "../components/KpiGrid";
import MetricCard from "../components/MetricCard";
import useQueryState from "../hooks/useQueryState";

const API_BASE_URL = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");

const toNumber = (value) => {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const toIsoDate = (value) => {
  const num = toNumber(value);
  if (!Number.isFinite(num)) return null;
  const ms = num > 1_000_000_000_000 ? num : num * 1000;
  return new Date(ms).toISOString().slice(0, 10);
};

const mapByKey = (arr) => {
  const map = {};
  (arr || []).forEach((item) => {
    if (item && item.key) map[item.key] = item;
  });
  return map;
};

const safeParseJson = (text) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("Falha ao converter resposta JSON", err);
    return null;
  }
};

const describeApiError = (payload, fallback) => {
  if (!payload) return fallback;
  if (payload.error) {
    const graph = payload.graph;
    if (graph?.code) {
      return `${payload.error} (Graph code ${graph.code})`;
    }
    return payload.error;
  }
  if (payload.message) return payload.message;
  return fallback;
};

const SUMMARY_CARDS = [
  {
    key: "reach",
    title: "Alcance do período",
    hint: "Total de perfis únicos alcançados no intervalo selecionado.",
  },
  {
    key: "impressions",
    title: "Impressões totais",
    hint: "Quantidade de visualizações registradas pelos posts.",
  },
  {
    key: "post_engagement",
    title: "Interações nos posts",
    hint: "Soma de reações, comentários e compartilhamentos.",
  },
  {
    key: "profile_link_clicks",
    title: "Cliques no perfil",
    hint: "Cliques que levaram ao perfil da página.",
  },
];

const ADS_CARDS = [
  {
    key: "video_cpm_3s",
    title: "CPM vídeo 3s",
    hint: "Custo por mil visualizações de 3 segundos.",
  },
  {
    key: "video_cpm_10s",
    title: "CPM vídeo 10s",
    hint: "Custo por mil visualizações de 10 segundos.",
  },
  {
    key: "video_cpm_1min",
    title: "CPM vídeo 60s",
    hint: "Custo por mil visualizações de 60 segundos.",
  },
];

export default function FacebookDashboard() {
  const { sidebarOpen, toggleSidebar } = useOutletContext();
  const [get] = useQueryState();
  const since = get("since");
  const until = get("until");
  const account = get("account");

  const [pageMetrics, setPageMetrics] = useState([]);
  const [adsMetrics, setAdsMetrics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const loadData = async () => {
      setLoading(true);
      setError("");
      try {
        const pageParams = new URLSearchParams();
        const adsParams = new URLSearchParams();

        if (since) {
          pageParams.set("since", since);
          const isoSince = toIsoDate(since);
          if (isoSince) adsParams.set("since", isoSince);
        }
        if (until) {
          pageParams.set("until", until);
          const isoUntil = toIsoDate(until);
          if (isoUntil) adsParams.set("until", isoUntil);
        }
        if (account) {
          pageParams.set("account", account);
          adsParams.set("account", account);
        }

        const pageUrl = `${API_BASE_URL}/api/facebook/metrics${pageParams.toString() ? `?${pageParams.toString()}` : ""}`;
        const adsUrl = `${API_BASE_URL}/api/ads/highlights${adsParams.toString() ? `?${adsParams.toString()}` : ""}`;

        const [pageRes, adsRes] = await Promise.all([
          fetch(pageUrl, { signal: controller.signal }),
          fetch(adsUrl, { signal: controller.signal }),
        ]);

        const [pageText, adsText] = await Promise.all([pageRes.text(), adsRes.text()]);
        const pageJson = safeParseJson(pageText) || {};
        const adsJson = safeParseJson(adsText) || {};

        if (!pageRes.ok) {
          throw new Error(describeApiError(pageJson, "Falha ao carregar métricas da página."));
        }
        if (!adsRes.ok) {
          throw new Error(describeApiError(adsJson, "Falha ao carregar métricas de anúncios."));
        }

        setPageMetrics(pageJson.metrics || []);
        setAdsMetrics(adsJson.metrics || []);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(err);
          setError(err.message || "Não foi possível atualizar os indicadores do Facebook.");
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
    return () => controller.abort();
  }, [since, until, account]);

  const pageByKey = useMemo(() => mapByKey(pageMetrics), [pageMetrics]);
  const adsByKey = useMemo(() => mapByKey(adsMetrics), [adsMetrics]);

  const bestAd = adsByKey.best_ad?.value;

  const formatValue = (metric, options = {}) => {
    if (loading) return "...";
    if (!metric) return "-";
    const value = metric.value;
    if (value == null) return "-";
    if (options.currency && typeof value === "number") {
      return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
    if (typeof value === "number") {
      return value.toLocaleString("pt-BR");
    }
    return String(value);
  };

  const metricDelta = (metric) => (loading ? null : metric?.deltaPct);

  return (
    <>
      <Topbar title="Facebook" sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />

      {error && <div className="alert alert--error">{error}</div>}

      <Section
        title="Resumo orgânico"
        description="Visão geral rápida dos principais resultados orgânicos da página."
      >
        <KpiGrid>
          {SUMMARY_CARDS.map(({ key, title, hint }) => (
            <MetricCard
              key={key}
              title={title}
              value={formatValue(pageByKey[key])}
              delta={metricDelta(pageByKey[key])}
              hint={hint}
            />
          ))}
        </KpiGrid>
      </Section>

      <Section
        title="Desempenho de anúncios"
        description="Indicadores consolidados do período selecionado no Gerenciador de Anúncios."
      >
        <KpiGrid>
          <MetricCard
            title="Melhor anúncio"
            value={loading ? "..." : bestAd?.ad_name || "Sem dados"}
            hint="Criativo com maior CTR no período."
          >
            {bestAd && !loading ? (
              <ul className="metric-card__extra">
                <li>ID: {bestAd.ad_id}</li>
                <li>CTR: {bestAd.ctr ? `${Number(bestAd.ctr).toFixed(2)}%` : "-"}</li>
                <li>Impressões: {bestAd.impressions ? Number(bestAd.impressions).toLocaleString("pt-BR") : "-"}</li>
                <li>
                  Investimento:{" "}
                  {bestAd.spend
                    ? Number(bestAd.spend).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })
                    : "-"}
                </li>
              </ul>
            ) : (
              <span className="metric-card__extra">Aguardando dados do Meta Ads.</span>
            )}
          </MetricCard>

          {ADS_CARDS.map(({ key, title, hint }) => (
            <MetricCard
              key={key}
              title={title}
              value={formatValue(adsByKey[key], { currency: true })}
              hint={hint}
            />
          ))}
        </KpiGrid>
      </Section>
    </>
  );
}