export default function ExportButtons({ onExport }) {
  return (
    <div className="report-exports">
      <button type="button" className="btn btn--ghost" onClick={() => onExport?.('csv')}>
        Exportar CSV
      </button>
      <button type="button" className="btn btn--primary" onClick={() => onExport?.('pdf')}>
        Exportar PDF
      </button>
      <button type="button" className="btn btn--ghost" onClick={() => onExport?.('xlsx')}>
        Exportar Excel
      </button>
    </div>
  );
}
