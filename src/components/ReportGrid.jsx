import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ReportGrid({ reports = [], templates = [], onRefresh, onExport }) {
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');

  function startEdit(r) {
    setEditing(r);
    setName(r?.name || '');
    setTemplateId(r?.template_id || '');
  }

  async function save() {
    if (typeof supabase === 'undefined' || supabase === null) {
      console.error('supabase client not found');
      return;
    }
    if (!name) {
      alert('Informe um nome para o relatório');
      return;
    }
    try {
      if (editing) {
        const { error } = await supabase.from('reports').update({
          name,
          template_id: templateId
        }).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('reports').insert({
          name,
          template_id: templateId
        });
        if (error) throw error;
      }
      setEditing(null);
      setName('');
      setTemplateId('');
      onRefresh?.();
    } catch (err) {
      console.error('ReportGrid save error', err);
      alert('Erro ao salvar relatório. Veja o console para detalhes.');
    }
  }

  async function remove(id) {
    if (!window.confirm('Excluir relatório?')) return;
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
      alert('Erro ao excluir relatório. Veja o console para detalhes.');
    }
  }

  return (
    <div>
      <div className="mb-4">
        <input placeholder="Nome" value={name} onChange={e => setName(e.target.value)} />
        <select value={templateId} onChange={e => setTemplateId(e.target.value)}>
          <option value="">-- template --</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button onClick={save}>{editing ? 'Atualizar' : 'Criar'}</button>
        {editing && <button onClick={() => setEditing(null)}>Cancelar</button>}
      </div>

      <div className="grid gap-3">
        {reports.map(r => (
          <div key={r.id} className="card p-3">
            <div className="flex justify-between">
              <div>
                <div className="font-bold">{r.name}</div>
                <div className="text-sm text-muted">{r.scope} • {r.account}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onExport && onExport('pdf', r)}>PDF</button>
                <button onClick={() => onExport && onExport('csv', r)}>CSV</button>
                <button onClick={() => startEdit(r)}>Editar</button>
                <button onClick={() => remove(r.id)}>Excluir</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}