import { useOutletContext } from 'react-router-dom';
import Topbar from '../components/Topbar';

export default function Settings(){
  const { sidebarOpen, toggleSidebar } = useOutletContext();

  return (
    <>
      <Topbar title="Configurações" sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
      <div className="page-content">
        <div className="card">
          <div className="text-lg font-semibold">Preferências gerais do painel</div>
          <p className="muted mt-2">Painel de controle para tema, idioma e integrações.</p>
        </div>
      </div>
    </>
  );
}
