// src/pages/Reports.jsx
import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { FileText } from "lucide-react";
import NavigationHero from "../components/NavigationHero";
import useQueryState from "../hooks/useQueryState";
import { supabase } from "../lib/supabaseClient";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import Papa from "papaparse";
import { utils as XLSXutils, writeFile as XLSXwriteFile } from "xlsx";

const API_BASE_URL = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");

export default function Reports() {
  const outletContext = useOutletContext() || {};
  const { setTopbarConfig, resetTopbarConfig } = outletContext;
  const [get] = useQueryState();

  useEffect(() => {
    if (!setTopbarConfig) return undefined;
    setTopbarConfig({ title: "Relatorios", showFilters: false });
    return () => resetTopbarConfig?.();
  }, [setTopbarConfig, resetTopbarConfig]);

  const account = get("account");
  const since = get("since");
  const until = get("until");

  const [scope, setScope] = useState("facebook"); // facebook | instagram | ambos
  const [templates, setTemplates] = useState([]);
  const [reports, setReports] = useState([
    // Dados de exemplo para visualização
    {
      id: 1,
      name: "relatório mensal",
      platform: "instagram",
      created_at: "2023-08-15T10:30:00Z"
    },
    {
      id: 2,
      name: "MODELO RELATÓRIO",
      platform: "instagram",
      created_at: "2023-04-25T14:20:00Z"
    },
    {
      id: 3,
      name: "MODELO RELATÓRIO",
      platform: "instagram",
      created_at: "2023-04-25T09:15:00Z"
    },
    {
      id: 4,
      name: "Relatório Personalizado",
      platform: "ambos",
      created_at: "2023-05-14T16:45:00Z"
    }
  ]);
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
    // orgAnico + pago (ads)
    const pageId = account ? undefined : undefined; // jA vem do backend pela env se nAo enviar
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
    XLSXutils.book_append_sheet(wb, sheet, "RelatA3rio");
    XLSXwriteFile(wb, `${report?.name || "relatorio"}.xlsx`);
  };

  const exportPDF = async (report, data) => {
    // renderiza um preview simples do relatA3rio no DOM ainvisAvela e captura em PDF
    const el = previewRef.current;
    if (el) {
      el.innerHTML = renderHtmlPreview(report, data);
      await new Promise((res) => setTimeout(res, 50)); // deixa o browser pintar
    }
    const rootStyles = getComputedStyle(document.documentElement);
    const backgroundColor = rootStyles.getPropertyValue("--bg")?.trim() || "transparent";
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor });
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
      <div style="padding:24px;color:var(--fg);font-family:'Lato',system-ui,Arial;background:var(--bg);width:900px">
        <h2 style="margin:0 0 8px 0">${report?.name || "RelatA3rio"}</h2>
        <p style="margin:0 0 24px 0;opacity:.75">Conta: ${account || "PadrAo"} | PerAodo: ${since || "-"} a ${until || "-"}</p>
        <h3>Resumo</h3>
        <pre style="white-space:pre-wrap;background:var(--panel);border:1px solid var(--stroke);border-radius:12px;padding:12px;color:var(--fg)">${JSON.stringify(data, null, 2)}</pre>
      </div>
    `;
  };

  return (
    <div className="instagram-dashboard--clean">
      <div className="ig-clean-container">
        {/* Navigation Hero - mantém o hero de navegação */}
        <NavigationHero title="Relatórios" icon={FileText} showGradient={false} />

        <div className="reports-container">
        {/* Header */}
        <div className="reports-header">
          <div className="reports-title-section">
            <FileText size={32} className="reports-icon" />
            <h1 className="reports-title">MEUS RELATÓRIOS</h1>
            <p className="reports-subtitle">aqui você pode verificar os relatórios que você já gerou e exportou</p>
          </div>

          <button className="btn-new-report">
            <FileText size={20} />
            NOVO MODELO DE RELATÓRIO
          </button>
        </div>

        {/* Instruções */}
        <div className="reports-instructions">
          <div className="instruction-item">
            <span className="instruction-icon">📝</span>
            Alterar logo nos relatórios
          </div>
        </div>

        {/* Tabela de Relatórios */}
        <div className="reports-table-container">
          <table className="reports-table">
            <thead>
              <tr>
                <th className="col-tipo">TIPO</th>
                <th className="col-nome">NOME</th>
                <th className="col-canais">CANAIS</th>
                <th className="col-data">
                  DATA
                  <span className="sort-icon">▲</span>
                </th>
                <th className="col-acoes"></th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-state">
                    Nenhum relatório encontrado. Crie seu primeiro relatório!
                  </td>
                </tr>
              ) : (
                reports.map((report, idx) => (
                  <tr key={report.id || idx}>
                    <td className="col-tipo">
                      <FileText size={24} className="report-type-icon" />
                    </td>
                    <td className="col-nome">{report.name || report.title || "Relatório sem nome"}</td>
                    <td className="col-canais">
                      <div className="channel-icons">
                        {(report.platform === "instagram" || report.platform === "ambos") && (
                          <div className="channel-icon instagram">
                            <span>📷</span>
                          </div>
                        )}
                        {(report.platform === "facebook" || report.platform === "ambos") && (
                          <div className="channel-icon facebook">
                            <span>f</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="col-data">
                      {report.created_at
                        ? new Date(report.created_at).toLocaleDateString("pt-BR")
                        : "-"}
                    </td>
                    <td className="col-acoes">
                      <button className="btn-action" title="Configurações">
                        ⚙️
                      </button>
                      <button className="btn-action-more">▼</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Preview invisível para PDF */}
        <div ref={previewRef} style={{ position: "absolute", left: -99999, top: -99999 }} />
        </div>
      </div>
    </div>
  );
}

