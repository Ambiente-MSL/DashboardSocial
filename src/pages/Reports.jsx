import { useOutletContext } from 'react-router-dom';
import Topbar from '../components/Topbar';
import Section from '../components/Section';
import ExportButtons from '../components/ExportButtons';
import useQueryState from '../hooks/useQueryState';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import ReportGrid from '../components/ReportGrid';
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';
import Papa from 'papaparse';

export default function Reports(){
  const { sidebarOpen, toggleSidebar } = useOutletContext();
  const [get] = useQueryState();

  const [templates, setTemplates] = useState([]);
  const [reports, setReports] = useState([]);
  const previewRef = useRef();

  useEffect(() => {
    fetchTemplates();
    fetchReports();
  }, []);

  async function fetchTemplates(){
    const { data, error } = await supabase.from('report_templates').select('*').order('created_at', {ascending: false});
    if (!error) setTemplates(data || []);
  }

  async function fetchReports(){
    const { data, error } = await supabase.from('reports').select('*').order('created_at', {ascending: false});
    if (!error) setReports(data || []);
  }

  // Export handlers
  const onExport = async (format, report) => {
    // prepare data payload (ex: render template by merging report.params)
    const payload = { report, account: get('account'), since: get('since'), until: get('until') };

    if (format === 'csv') {
      // Example: convert an array to CSV; adapt to your payload/data
      const rows = report?.params?.rows || [];
      const csv = Papa.unparse(rows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report?.name || 'report'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (format === 'pdf') {
      // render previewRef area to PDF; user can choose to print too
      const el = previewRef.current || document.body;
      const canvas = await html2canvas(el, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      const pdfBlob = pdf.output('blob');

      // trigger download
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report?.name || 'report'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      // opcional: upload para Supabase Storage
      // await uploadExportToStorage(pdfBlob, `${report?.id || 'tmp'}.pdf`);
      return;
    }

    if (format === 'print') {
      window.print();
      return;
    }
  };

  // opcional: função de upload para Storage
  async function uploadExportToStorage(blob, filename) {
    const filePath = `exports/${filename}`;
    const { data, error } = await supabase.storage.from('reports').upload(filePath, blob, { upsert: true });
    if (error) {
      console.error('Upload error', error);
      return null;
    }
    const { publicURL } = supabase.storage.from('reports').getPublicUrl(filePath);
    return publicURL;
  }

  return (
    <>
      <Topbar title="Relatórios" sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />

      <div className="page-content">
        <Section title="Origem dos dados">
        <div className="report-filters">
          <label className="btn"><input type="radio" name="scope" defaultChecked /> Facebook</label>
          <label className="btn"><input type="radio" name="scope" /> Instagram</label>
          <label className="btn"><input type="radio" name="scope" /> Ambos</label>
        </div>
      </Section>

      <Section title="Exportações">
        <ExportButtons onExport={(format) => onExport(format, reports[0] || { name: 'relatorio' })} />
        <div ref={previewRef} style={{ display: 'none' }}>
          {/* render a preview using templates[0] and report data if needed */}
        </div>
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
