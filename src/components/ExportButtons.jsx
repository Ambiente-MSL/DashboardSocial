// src/components/ExportButtons.jsx
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";

export default function ExportButtons({ onExport, disabled }) {
  return (
    <div className="export-buttons">
      <button className="btn btn--pill" onClick={() => onExport('csv')} disabled={disabled}>
        <Download size={16} /> Exportar CSV
      </button>
      <button className="btn btn--pill" onClick={() => onExport('pdf')} disabled={disabled}>
        <FileText size={16} /> Exportar PDF
      </button>
      <button className="btn btn--pill" onClick={() => onExport('xlsx')} disabled={disabled}>
        <FileSpreadsheet size={16} /> Exportar Excel
      </button>
      <button className="btn btn--pill" onClick={() => onExport('print')} disabled={disabled}>
        <Printer size={16} /> Imprimir
      </button>
    </div>
  );
}
