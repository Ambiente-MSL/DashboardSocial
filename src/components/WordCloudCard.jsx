import { useEffect, useMemo, useRef } from "react";
import useSWR from "swr";
import * as echarts from "echarts";
import "echarts-wordcloud";

const WORD_COLORS = ["#ec4899", "#a855f7", "#6366f1", "#f97316", "#14b8a6", "#facc15"];

const fetcher = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Falha ao carregar nuvem de palavras.");
  }
  return response.json();
};

/**
 * Renderiza somente o conteudo da nuvem de palavras (sem wrappers de layout).
 */
export default function WordCloudCard({
  apiBaseUrl = "",
  igUserId,
  since,
  until,
  top = 120,
}) {
  const sanitizedBaseUrl = useMemo(() => (apiBaseUrl || "").replace(/\/$/, ""), [apiBaseUrl]);

  const requestKey = useMemo(() => {
    if (!igUserId) return null;
    const params = new URLSearchParams({ igUserId });
    if (since) params.set("since", since);
    if (until) params.set("until", until);
    if (top) params.set("top", String(top));
    const path = `/api/instagram/comments/wordcloud?${params.toString()}`;
    return sanitizedBaseUrl ? `${sanitizedBaseUrl}${path}` : path;
  }, [igUserId, since, until, top, sanitizedBaseUrl]);

  const { data, error, isLoading } = useSWR(requestKey, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.dispose();
        chartRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current) {
        chartRef.current.resize();
      }
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }
    if (!data || !Array.isArray(data.words) || data.words.length === 0) {
      if (chartRef.current) {
        chartRef.current.dispose();
        chartRef.current = null;
      }
      return undefined;
    }

    const chart = chartRef.current || echarts.init(containerRef.current, undefined, { renderer: "canvas" });
    chartRef.current = chart;

    const counts = data.words.map((item) => item.count);
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);
    const spread = maxCount - minCount;
    const emphasize = (count) => {
      if (!Number.isFinite(count)) return 0;
      if (spread <= 0) return count;
      const normalized = (count - minCount) / spread;
      const weighted = Math.pow(normalized, 1.35);
      return minCount + spread * weighted;
    };

    const seriesData = data.words.map((item) => ({
      name: item.word,
      value: emphasize(item.count),
      originalCount: item.count,
    }));

    const baseMin = 20;
    const baseMax = 76;
    const sizeRange = spread <= 0
      ? [Math.round((baseMin + baseMax) / 2), Math.round((baseMin + baseMax) / 2)]
      : [baseMin, baseMax];

    chart.setOption({
      tooltip: {
        trigger: "item",
        formatter: (params) => {
          const original = params.data?.originalCount ?? params.value;
          return `${params.name}: ${original}`;
        },
      },
      series: [
        {
          type: "wordCloud",
          shape: "circle",
          width: "100%",
          height: "100%",
          gridSize: 6,
          rotationRange: [-20, 20],
          layoutAnimation: true,
          sizeRange,
          textStyle: {
            fontWeight: 600,
            color: () => WORD_COLORS[Math.floor(Math.random() * WORD_COLORS.length)],
          },
          emphasis: {
            focus: "self",
            textStyle: {
              shadowBlur: 10,
              shadowColor: "rgba(30, 41, 59, 0.35)",
            },
          },
          data: seriesData,
        },
      ],
    });

    chart.resize();
    return undefined;
  }, [data]);

  if (!igUserId) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-slate-500">
        Selecione um perfil para visualizar os comentarios.
      </div>
    );
  }

  if (isLoading) {
    return <div className="h-[300px] animate-pulse rounded-2xl bg-slate-100" />;
  }

  if (error) {
    return (
      <div className="flex h-[300px] flex-col items-center justify-center text-center text-sm text-rose-500">
        <p>Falha ao carregar a nuvem de palavras.</p>
        <p className="mt-1 text-xs text-rose-400">{error.message}</p>
      </div>
    );
  }

  if (!data || !Array.isArray(data.words) || data.words.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-slate-500">
        Sem dados no periodo.
      </div>
    );
  }

  return (
    <div className="flex h-[320px] w-full flex-col gap-3">
      {typeof data.total_comments === "number" ? (
        <p className="text-xs text-slate-500">
          {data.total_comments} comentario{data.total_comments === 1 ? "" : "s"} analisado{data.total_comments === 1 ? "" : "s"} no periodo.
        </p>
      ) : null}
      <div ref={containerRef} className="min-h-0 flex-1" />
    </div>
  );
}
