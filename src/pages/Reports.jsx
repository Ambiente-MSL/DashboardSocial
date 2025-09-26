import { useOutletContext } from 'react-router-dom';
import Topbar from '../components/Topbar';
import Section from '../components/Section';
import ExportButtons from '../components/ExportButtons';
import useQueryState from '../hooks/useQueryState';

export default function Reports(){
  const { sidebarOpen, toggleSidebar } = useOutletContext();
  const [get] = useQueryState();

  const onExport = (format) => {
    alert(`Exportar ${format.toUpperCase()}  -  conta=${get('account')} since=${get('since')} until=${get('until')}`);
  };

  return (
    <>
      <Topbar title="Relatórios" sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />

      <Section title="Origem dos dados">
        <div className="flex flex-wrap gap-3">
          <label className="btn"><input type="radio" name="scope" defaultChecked /> Facebook</label>
          <label className="btn"><input type="radio" name="scope" /> Instagram</label>
          <label className="btn"><input type="radio" name="scope" /> Ambos</label>
        </div>
      </Section>

      <Section title="Exportações">
        <ExportButtons onExport={onExport} />
      </Section>
    </>
  );
}
