// src/components/ReportGrid.jsx
import { useState } from "react";
import { Trash2, Copy, Play, FileText } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export default function ReportGrid({ reports, templates, onRefresh, onExport }) {
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");

  const createReport = async () => {
    if (!name || !templateId) return;
    const template = templates.find(t => t.id === templateId);
    const params = template?.default_params || {};
    const { error } = await supabase.from("reports").insert({
      name,
      template_id: templateId,
      params
    });
    if (!error) {
      setName("");
      setTemplateId("");
      onRefresh?.();
    }
  };

  const deleteReport = async (id) => {
    const { error } = await supabase.from("reports").delete().eq("id", id);
    if (!error) onRefresh?.();
  };

  const duplicateReport = async (rep) => {
    const { error } = await supabase.from("reports").insert({
      name: rep.name + " (cópia)",
      template_id: rep.template_id,
      params: rep.params
    });
    if (!error) onRefresh?.();
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
            onChange={e => setName(e.target.value)}
          />
          <select value={templateId} onChange={e => setTemplateId(e.target.value)}>
            <option value="">Selecionar template</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button className="btn" onClick={createReport}>Criar</button>
        </div>
      </div>

      {reports.length === 0 ? (
        <p className="muted" style={{ padding: 16 }}>Nenhum relatório cadastrado no momento.</p>
      ) : (
        <div className="grid grid--3">
          {reports.map((r) => (
            <article key={r.id} className="card">
              <header className="card__header">
                <h4 className="card__title"><FileText size={16}/> {r.name}</h4>
              </header>
              <section className="card__body">
                <p className="muted">Template: {templates.find(t => t.id === r.template_id)?.name || '—'}</p>
              </section>
              <footer className="card__footer">
                <button className="btn btn--ghost" onClick={() => onExport('pdf', r)}><Play size={16}/> PDF</button>
                <button className="btn btn--ghost" onClick={() => onExport('csv', r)}>CSV</button>
                <button className="btn btn--ghost" onClick={() => onExport('xlsx', r)}>Excel</button>
                <button className="btn-icon" title="Duplicar" onClick={() => duplicateReport(r)}><Copy size={16}/></button>
                <button className="btn-icon" title="Excluir" onClick={() => deleteReport(r.id)}><Trash2 size={16}/></button>
              </footer>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
