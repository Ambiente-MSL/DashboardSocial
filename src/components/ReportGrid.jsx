import React, { useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function ReportGrid({ reports = [], templates = [], onRefresh, onExport }) {
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');

  const templateMap = useMemo(() => {
    const map = new Map();
    templates.forEach((template) => {
      if (template?.id) {
        map.set(template.id, template);
      }
    });
    return map;
  }, [templates]);

  function startEdit(report) {
    setEditing(report);
    setName(report?.name || '');
    setTemplateId(report?.template_id || '');
  }

  async function save() {
    if (typeof supabase === 'undefined' || supabase === null) {
      console.error('supabase client not found');
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      alert('Informe um nome para o relatorio');
      return;
    }

    try {
      if (editing) {
        const { error } = await supabase
          .from('reports')
          .update({
            name: trimmedName,
            template_id: templateId || null,
          })
          .eq('id', editing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('reports').insert({
          name: trimmedName,
          template_id: templateId || null,
        });

        if (error) throw error;
      }

      setEditing(null);
      setName('');
      setTemplateId('');
      onRefresh?.();
    } catch (err) {
      console.error('ReportGrid save error', err);
      alert('Erro ao salvar relatorio. Veja o console para detalhes.');
    }
  }

  async function remove(id) {
    if (!window.confirm('Excluir relatorio?')) return;
    if (typeof supabase === 'undefined' || supabase === null) {
      console.error('supabase client not found');
      return;
    }

    try {
      const { error } = await supabase.from('reports').delete().eq('id', id);
      if (error) throw error;
      onRefresh?.();
    } catch (err) {
      console.error('ReportGrid delete error', err);
      alert('Erro ao excluir relatorio. Veja o console para detalhes.');
    }
  }

  const actionLabel = editing ? 'Atualizar' : 'Criar';

  return (
    <div className="report-grid">
      <div className="report-grid__form">
        <div className="report-grid__form-header">
          <div>
            <h3 className="report-card__title">Gerenciar relatorios</h3>
            <p className="report-grid__legend">
              Defina um nome e associe um template para exportar seus relatorios personalizados.
            </p>
          </div>
          {editing && <span className="badge badge--accent">Editando</span>}
        </div>

        <div className="report-grid__fields">
          <div className="report-grid__field">
            <label htmlFor="report-name">Nome do relatorio</label>
            <input
              id="report-name"
              placeholder="Relatorio mensal"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="report-grid__field">
            <label htmlFor="report-template">Template</label>
            <select
              id="report-template"
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
            >
              <option value="">Selecionar template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="report-grid__actions">
          {editing && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setEditing(null);
                setName('');
                setTemplateId('');
              }}
            >
              Cancelar
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={save}>
            {actionLabel}
          </button>
        </div>
      </div>

      {reports.length > 0 ? (
        <div className="report-grid__list">
          {reports.map((report) => {
            const isEditing = editing?.id === report.id;
            const templateName = templateMap.get(report.template_id)?.name || 'Template nao definido';
            const createdAt = formatDate(report.created_at);

            return (
              <article key={report.id} className="report-card">
                <div className="report-card__header">
                  <div className="report-card__title-group">
                    <h3 className="report-card__title">{report.name}</h3>
                    <span className="report-card__subtitle">{templateName}</span>
                  </div>
                  {isEditing && <span className="badge badge--accent">Editando</span>}
                </div>

                <div className="report-card__meta">
                  {report.scope && <span className="report-card__tag">{report.scope}</span>}
                  {report.account && <span className="report-card__tag">{report.account}</span>}
                  {createdAt && <span className="report-card__tag">Criado em {createdAt}</span>}
                </div>

                <div className="report-card__actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => onExport && onExport('pdf', report)}
                  >
                    PDF
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => onExport && onExport('csv', report)}
                  >
                    CSV
                  </button>
                  <button type="button" className="btn btn--subtle" onClick={() => startEdit(report)}>
                    Editar
                  </button>
                  <button type="button" className="btn btn--danger" onClick={() => remove(report.id)}>
                    Excluir
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="report-grid__empty">Nenhum relatorio cadastrado no momento.</div>
      )}
    </div>
  );
}
