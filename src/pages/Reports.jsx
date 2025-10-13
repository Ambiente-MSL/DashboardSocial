// src/pages/Reports.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import Topbar from "../components/Topbar";
import Section from "../components/Section";
import ExportButtons from "../components/ExportButtons";
import useQueryState from "../hooks/useQueryState";
import { supabase } from "../lib/supabaseClient";
import ReportGrid from "../components/ReportGrid";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import Papa from "papaparse";
import { utils as XLSXutils, writeFile as XLSXwriteFile } from "xlsx";

const API_BASE_URL = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");

export default function Reports() {
  const { sidebarOpen, toggleSidebar } = useOutletContext();
  const [get] = useQueryState();

  const account = get("account");
  const since = get("since");
  const until = get("until");

  const [scope, setScope] = useState("facebook"); // facebook | instagram | ambos
  const [templates, setTemplates] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const previewRef = useRef();

  useEffect(() => {
    fetchTemplates();
    fetchReports();
  }, []);

  async function fetchTemplates() {
    const { data, error } = await supabase
      .from("report_templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setTemplates(data || []);
  }

  async function fetchReports() {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setReports(data || []);
  }

  // ---------------------
  // DATA PIPELINE
  // ---------------------
  const call = async (path, params) => {
    const url = new URL(`${API_BASE_URL}${path}`);
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v != null && v !== "") url.searchParams.set(k, v);
    });
    const r = await fetch(url.toString());
    const t = await r.text();
    try {
      return JSON.parse(t);
    } catch {
      return {};
    }
  };

  const getFacebookData = async () => {
    // orgânico + pago (ads)
    const pageId = account ? undefined : undefined; // já vem do backend pela env se não enviar
    const [org, ads] = await Promise.all([
      call("/api/facebook/metrics", { pageId, since, until }),
      call("/api/ads/highlights", { since: toIso(since), until: toIso(until) }),
    ]);
    return { org, ads };
  };

  const getInstagramData = async () => {
    const [insights, organic] = await Promise.all([
      call("/api/instagram/metrics", { since, until }),
      call("/api/instagram/organic", { since, until }),
    ]);
    return { insights, organic };
  };

  const getDataForScope = async () => {
    if (scope === "facebook") {
      return { facebook: await getFacebookData() };
    }
    if (scope === "instagram") {
      return { instagram: await getInstagramData() };
    }
    const [fb, ig] = await Promise.all([getFacebookData(), getInstagramData()]);
    return { facebook: fb, instagram: ig };
  };

  const toIso = (v) => {
    if (!v) return undefined;
    const n = Number(v);
    const ms = n > 1_000_000_000_000 ? n : n * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  };

  // ---------------------
  // EXPORTS
  // ---------------------
  const onExport = async (format, report = reports[0]) => {
    setLoading(true);
    try {
      const data = await getDataForScope();
      if (format === "csv") {
        exportCSV(report, data);
      } else if (format === "xlsx") {
        exportXLSX(report, data);
      } else if (format === "pdf") {
        await exportPDF(report, data);
      } else if (format === "print") {
        window.print();
      }
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = (report, data) => {
    // monta uma tabela simples com pares chave-valor do resumo
    const rows = flattenForTable(data);
    const csv = Papa.unparse(rows);
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `${report?.name || "relatorio"}.csv`);
  };

  const exportXLSX = (report, data) => {
    const rows = flattenForTable(data);
    const sheet = XLSXutils.json_to_sheet(rows);
    const wb = XLSXutils.book_new();
    XLSXutils.book_append_sheet(wb, sheet, "Relatório");
    XLSXwriteFile(wb, `${report?.name || "relatorio"}.xlsx`);
  };

  const exportPDF = async (report, data) => {
    // renderiza um preview simples do relatório no DOM “invisível” e captura em PDF
    const el = previewRef.current;
    if (el) {
      el.innerHTML = renderHtmlPreview(report, data);
      await new Promise((res) => setTimeout(res, 50)); // deixa o browser pintar
    }
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#0b1220" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: [canvas.width, canvas.height],
    });
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
    const blob = pdf.output("blob");
    downloadBlob(blob, `${report?.name || "relatorio"}.pdf`);

    // opcional: subir para Storage
    // await uploadExportToStorage(blob, `${report?.id || "tmp"}.pdf`);
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const flattenForTable = (data) => {
    // transforma o objeto grande em linhas {grupo, metrica, valor}
    const rows = [];
    const walk = (obj, path = []) => {
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        Object.entries(obj).forEach(([k, v]) => walk(v, path.concat(k)));
      } else {
        rows.push({ grupo: path.slice(0, -1).join(" / "), metrica: path[path.length - 1], valor: obj });
      }
    };
    walk(data);
    return rows;
  };

  const renderHtmlPreview = (report, data) => {
    // preview simples; personalize com HTML/CSS do seu template
    return `
      <div style="padding:24px;color:#e6edf3;font-family:Inter,system-ui,Arial;background:#0b1220;width:900px">
        <h2 style="margin:0 0 8px 0">${report?.name || "Relatório"}</h2>
        <p style="margin:0 0 24px 0;opacity:.75">Conta: ${account || "Padrão"} | Período: ${since || "-"} → ${until || "-"}</p>
        <h3>Resumo</h3>
        <pre style="white-space:pre-wrap;background:#0e1729;border:1px solid #1a2340;border-radius:12px;padding:12px">${JSON.stringify(data, null, 2)}</pre>
      </div>
    `;
  };

  return (
    <>
      <Topbar title="Relatórios" sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />

      <div className="page-content">
        <Section title="Origem dos dados">
          <div className="report-filters">
            <label className={`btn ${scope === "facebook" ? "btn--active" : ""}`}>
              <input
                type="radio"
                name="scope"
                checked={scope === "facebook"}
                onChange={() => setScope("facebook")}
              />
              Facebook
            </label>
            <label className={`btn ${scope === "instagram" ? "btn--active" : ""}`}>
              <input
                type="radio"
                name="scope"
                checked={scope === "instagram"}
                onChange={() => setScope("instagram")}
              />
              Instagram
            </label>
            <label className={`btn ${scope === "ambos" ? "btn--active" : ""}`}>
              <input
                type="radio"
                name="scope"
                checked={scope === "ambos"}
                onChange={() => setScope("ambos")}
              />
              Ambos
            </label>
          </div>
        </Section>

        <Section title="Exportações" description="Gere o arquivo diretamente com os filtros atuais.">
          <ExportButtons onExport={onExport} disabled={loading || reports.length === 0} />
          {/* área invisível para renderização do preview do PDF */}
          <div ref={previewRef} style={{ position: "absolute", left: -99999, top: -99999 }} />
        </Section>

        <Section title="Meus Relatórios">
          <ReportGrid
            reports={reports}
            templates={templates}
            onRefresh={fetchReports}
            onExport={onExport}
          />
        </Section>
      </div>
    </>
  );
}
