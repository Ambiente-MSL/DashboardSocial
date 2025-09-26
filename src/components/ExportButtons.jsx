export default function ExportButtons({ onExport }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn" onClick={()=>onExport('csv')}>Exportar CSV</button>
      <button className="btn" onClick={()=>onExport('pdf')}>Exportar PDF</button>
      <button className="btn" onClick={()=>onExport('xlsx')}>Exportar Excel</button>
    </div>
  );
}