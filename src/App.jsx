import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { useAuth } from './context/AuthContext';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, loading } = useAuth();
  const location = useLocation();
  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  if (loading) {
    return (
      <div className="auth-screen">
        <div className="auth-card auth-card--compact">
          <h2 className="auth-heading">Carregando dashboard...</h2>
          <p className="auth-subtext">Estamos preparando seus dados. Aguarde um instante.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <div className="app-layout">
      <div className={`sidebar-container${sidebarOpen ? '' : ' sidebar-container--collapsed'}`}>
        <Sidebar open={sidebarOpen} onToggleSidebar={toggleSidebar} />
      </div>
      <main className="app-main">
        <Outlet context={{ sidebarOpen, toggleSidebar }} />
      </main>
    </div>
  );
}
