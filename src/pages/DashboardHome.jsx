import { useOutletContext } from 'react-router-dom';
import Topbar from '../components/Topbar';

export default function DashboardHome() {
  const { sidebarOpen, toggleSidebar } = useOutletContext();

  return (
    <>
      <Topbar title="Dashboard" sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
      <div className="card">
        <div className="text-lg font-semibold">Bem-vindo ao Monitor Social MSL</div>
        <p className="muted mt-2">Use o menu lateral para acessar Facebook, Instagram ou gerar relatórios.</p>
      </div>
    </>
  );
}
