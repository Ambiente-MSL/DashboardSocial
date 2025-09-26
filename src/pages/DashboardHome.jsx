import { useOutletContext } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import Topbar from '../components/Topbar';
import { useTheme } from '../context/ThemeContext';

export default function DashboardHome() {
  const { sidebarOpen, toggleSidebar } = useOutletContext();
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <>
      <Topbar title="Dashboard" sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Bem-vindo ao Monitor Social MSL</div>
          <button type="button" className="btn" onClick={toggleTheme}>
            {isLight ? <Moon size={16} /> : <Sun size={16} />}
            {isLight ? 'Modo escuro' : 'Modo claro'}
          </button>
        </div>
        <p className="muted mt-2">Use o menu lateral para acessar Facebook, Instagram ou gerar relatórios.</p>
      </div>
    </>
  );
}
