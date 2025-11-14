// src/components/ReportGrid.jsx
import { useState } from "react";
import { Trash2, Copy, Play, FileText } from "lucide-react";

export default function ReportGrid({
  reports = [],
  templates = [],
  onRefresh,
  onExport,
  onCreateReport,
  onDeleteReport,
  onDuplicateReport,
}) {
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [actionError, setActionError] = useState("");
  const [pendingCreate, setPendingCreate] = useState(false);
  const [busyReportId, setBusyReportId] = useState(null);

  const handleCreate = async () => {
    if (!name || !templateId || !onCreateReport) return;
    setActionError("");
    setPendingCreate(true);
    try {
      const template = templates.find((t) => t.id === templateId);
      await onCreateReport({
        name,
        templateId,
        params: template?.default_params || template?.params || {},
      });
      setName("");
      setTemplateId("");
      onRefresh?.();
    } catch (err) {
      setActionError(err?.message || "Erro ao criar relatório.");
    } finally {
      setPendingCreate(false);
    }
  };

  const handleDelete = async (id) => {
    if (!onDeleteReport) return;
    setActionError("");
    setBusyReportId(id);
    try {
      await onDeleteReport(id);
      onRefresh?.();
    } catch (err) {
      setActionError(err?.message || "Erro ao excluir relatório.");
    } finally {
      setBusyReportId(null);
    }
  };

  const handleDuplicate = async (rep) => {
    if (!rep) return;
    setActionError("");
    setBusyReportId(rep.id);
    try {
      const payload = {
        name: `${rep.name} (cópia)`,
        templateId: rep.template_id,
        params: rep.params,
      };
      if (onDuplicateReport) {
        await onDuplicateReport(payload);
      } else if (onCreateReport) {
        await onCreateReport(payload);
      }
      onRefresh?.();
    } catch (err) {
      setActionError(err?.message || "Erro ao duplicar relatório.");
    } finally {
      setBusyReportId(null);
    }
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <h4>Gerenciar relatórios</h4>
        <p>Defina um nome e associe um template.</p>
        <div className="report-creator">
          <input
            type="text"
            placeholder="Nome do relatório"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">Selecionar template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button className="btn" onClick={handleCreate} disabled={pendingCreate}>
            {pendingCreate ? "Criando..." : "Criar"}
          </button>
        </div>
        {actionError && (
          <p className="auth-error" style={{ marginTop: 8 }}>
            {actionError}
          </p>
        )}
      </div>

      {reports.length === 0 ? (
        <p className="muted" style={{ padding: 16 }}>
          Nenhum relatório cadastrado no momento.
        </p>
      ) : (
        <div className="grid grid--3">
          {reports.map((r) => (
            <article key={r.id} className="card">
              <header className="card__header">
                <h4 className="card__title">
                  <FileText size={16} /> {r.name}
                </h4>
              </header>
              <section className="card__body">
                <p className="muted">
                  Template: {templates.find((t) => t.id === r.template_id)?.name || "—"}
                </p>
              </section>
              <footer className="card__footer">
                <button className="btn btn--ghost" onClick={() => onExport("pdf", r)}>
                  <Play size={16} /> PDF
                </button>
                <button className="btn btn--ghost" onClick={() => onExport("csv", r)}>
                  CSV
                </button>
                <button className="btn btn--ghost" onClick={() => onExport("xlsx", r)}>
                  Excel
                </button>
                <button
                  className="btn-icon"
                  title="Duplicar"
                  onClick={() => handleDuplicate(r)}
                  disabled={busyReportId === r.id}
                >
                  <Copy size={16} />
                </button>
                <button
                  className="btn-icon"
                  title="Excluir"
                  onClick={() => handleDelete(r.id)}
                  disabled={busyReportId === r.id}
                >
                  <Trash2 size={16} />
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
