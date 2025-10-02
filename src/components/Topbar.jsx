import { useState } from 'react';
import { Bell, Menu, Moon, Search, Sun, X } from 'lucide-react';
import DateRangePicker from './DateRangePicker';
import AccountSelect from './AccountSelect';
import { useTheme } from '../context/ThemeContext';

export default function Topbar({ title, sidebarOpen, onToggleSidebar, showFilters = false }) {
  const { theme, toggleTheme } = useTheme();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isDark = theme === 'dark';

  const handleSearch = (e) => {
    e.preventDefault();
    // Implementar lógica de busca de métricas
    console.log('Buscar:', searchQuery);
  };

  return (
    <>
      {/* Barra superior de ações */}
      <div className="action-bar">
        <div className="action-bar__left">
          {onToggleSidebar && (
            <button
              type="button"
              className="action-bar__icon-btn"
              onClick={onToggleSidebar}
              aria-label={sidebarOpen ? 'Recolher menu lateral' : 'Expandir menu lateral'}
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          )}
          <div className="action-bar__title">
            <h1>{title}</h1>
            <span className="action-bar__breadcrumb">Início &gt; {title}</span>
          </div>
        </div>

        <div className="action-bar__right">
          {/* Busca de métricas */}
          <div className="action-bar__search-wrapper">
            {showSearch && (
              <form onSubmit={handleSearch} className="action-bar__search-form">
                <input
                  type="text"
                  placeholder="Buscar métricas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="action-bar__search-input"
                  autoFocus
                />
              </form>
            )}
            <button
              type="button"
              className="action-bar__icon-btn"
              onClick={() => setShowSearch(!showSearch)}
              aria-label="Buscar métricas"
            >
              <Search size={18} />
            </button>
          </div>

          {/* Notificações */}
          <div className="action-bar__notifications">
            <button
              type="button"
              className="action-bar__icon-btn action-bar__icon-btn--badge"
              onClick={() => setShowNotifications(!showNotifications)}
              aria-label="Notificações"
            >
              <Bell size={18} />
              <span className="action-bar__badge">3</span>
            </button>
            {showNotifications && (
              <div className="action-bar__dropdown">
                <div className="action-bar__dropdown-header">
                  <h3>Notificações</h3>
                  <button
                    type="button"
                    onClick={() => setShowNotifications(false)}
                    className="action-bar__close-btn"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="action-bar__dropdown-content">
                  <div className="notification-item">
                    <div className="notification-item__dot"></div>
                    <div className="notification-item__content">
                      <p className="notification-item__title">Novo post com alto engajamento</p>
                      <span className="notification-item__time">5 min atrás</span>
                    </div>
                  </div>
                  <div className="notification-item">
                    <div className="notification-item__dot"></div>
                    <div className="notification-item__content">
                      <p className="notification-item__title">Meta de alcance atingida</p>
                      <span className="notification-item__time">1 hora atrás</span>
                    </div>
                  </div>
                  <div className="notification-item">
                    <div className="notification-item__dot notification-item__dot--read"></div>
                    <div className="notification-item__content">
                      <p className="notification-item__title">Relatório mensal disponível</p>
                      <span className="notification-item__time">2 horas atrás</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tema */}
          <button
            type="button"
            className="action-bar__icon-btn"
            onClick={toggleTheme}
            aria-label={isDark ? 'Modo claro' : 'Modo escuro'}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>

      {/* Barra de filtros - apenas em páginas específicas */}
      {showFilters && (
        <div className="filter-bar">
          <AccountSelect />
          <DateRangePicker />
        </div>
      )}
    </>
  );
}
