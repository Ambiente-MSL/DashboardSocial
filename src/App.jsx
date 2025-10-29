import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import { useAuth } from './context/AuthContext';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, loading } = useAuth();
  const location = useLocation();

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const pageTitle = useMemo(() => {
    const path = location.pathname || '/';
    const map = {
      '/': 'Visao Geral',
      '/facebook': 'Facebook',
      '/instagram': 'Instagram',
      '/relatorios': 'Relatorios',
      '/configuracoes': 'Configuracoes',
      '/admin': 'Admin',
    };
    return map[path] ?? 'Dashboard';
  }, [location.pathname]);

  const showFilters = useMemo(() => {
    const filterRoutes = new Set(['/facebook', '/instagram']);
    return filterRoutes.has(location.pathname);
  }, [location.pathname]);

  const defaultTopbarConfig = useMemo(
    () => ({
      title: pageTitle,
      showFilters,
    }),
    [pageTitle, showFilters],
  );

  const [topbarOverrides, setTopbarOverrides] = useState({});

  useEffect(() => {
    if (loading || !user) return;
    setTopbarOverrides({});
  }, [loading, location.pathname, user]);

  const setTopbarConfig = useCallback((config) => {
    setTopbarOverrides(config || {});
  }, []);

  const resetTopbarConfig = useCallback(() => {
    setTopbarOverrides({});
  }, []);

  const topbarProps = useMemo(() => {
    const merged = {
      ...defaultTopbarConfig,
      ...topbarOverrides,
      sidebarOpen,
      onToggleSidebar: toggleSidebar,
      sticky: true,
    };
    return merged;
  }, [defaultTopbarConfig, topbarOverrides, sidebarOpen, toggleSidebar]);

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
        <div className="app-main__backdrop" aria-hidden="true" />
        <div className="app-main__content">
          {(() => {
            const { hidden, ...rest } = topbarProps;
            return hidden ? null : <Topbar {...rest} />;
          })()}
          <div className="app-main__body">
            <Outlet context={{ sidebarOpen, toggleSidebar, setTopbarConfig, resetTopbarConfig }} />
          </div>
        </div>
      </main>
    </div>
  );
}
