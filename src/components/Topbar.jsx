import { useState } from "react";
import { Bell, Menu, Moon, RefreshCw, Sun, X } from "lucide-react";
import DateRangePicker from "./DateRangePicker";
import AccountSelect from "./AccountSelect";
import { useTheme } from "../context/ThemeContext";

export default function Topbar({
  title,
  sidebarOpen,
  onToggleSidebar,
  showFilters = false,
  onRefresh,
  refreshing = false,
  lastSync,
  rightExtras = null,
}) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [showNotifications, setShowNotifications] = useState(false);

  const isDark = resolvedTheme === "dark";

  const formatLastSync = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  };

  const lastSyncLabel = formatLastSync(lastSync);

  return (
    <>
      <div className="action-bar">
        <div className="action-bar__left">
          {onToggleSidebar && (
            <button
              type="button"
              className="action-bar__icon-btn"
              onClick={onToggleSidebar}
              aria-label={sidebarOpen ? "Recolher menu lateral" : "Expandir menu lateral"}
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
          {rightExtras && <div className="action-bar__extra">{rightExtras}</div>}
          {onRefresh && (
            <div className="action-bar__refresh">
              <button
                type="button"
                className="action-bar__icon-btn action-bar__icon-btn--refresh"
                onClick={onRefresh}
                disabled={refreshing}
                aria-label="Atualizar dados"
                aria-busy={refreshing ? "true" : undefined}
                data-loading={refreshing || undefined}
              >
                <RefreshCw size={18} />
              </button>
              {lastSyncLabel && <span className="action-bar__sync-text">Atualizado {lastSyncLabel}</span>}
            </div>
          )}

          <div className="action-bar__notifications">
            <button
              type="button"
              className="action-bar__icon-btn action-bar__icon-btn--badge"
              onClick={() => setShowNotifications((prev) => !prev)}
              aria-label="Notificações"
            >
              <Bell size={18} />
              <span className="action-bar__badge">3</span>
            </button>
            {showNotifications && (
              <div className="action-bar__dropdown">
                <div className="action-bar__dropdown-header">
                  <h3>Notificações</h3>
                  <button type="button" onClick={() => setShowNotifications(false)} className="action-bar__close-btn">
                    <X size={14} />
                  </button>
                </div>
                <div className="action-bar__dropdown-content">
                  <div className="notification-item">
                    <div className="notification-item__dot" />
                    <div className="notification-item__content">
                      <p className="notification-item__title">Novo post com alto engajamento</p>
                      <span className="notification-item__time">5 min atrás</span>
                    </div>
                  </div>
                  <div className="notification-item">
                    <div className="notification-item__dot" />
                    <div className="notification-item__content">
                      <p className="notification-item__title">Meta de alcance atingida</p>
                      <span className="notification-item__time">1 hora atrás</span>
                    </div>
                  </div>
                  <div className="notification-item">
                    <div className="notification-item__dot notification-item__dot--read" />
                    <div className="notification-item__content">
                      <p className="notification-item__title">Relatório mensal disponível</p>
                      <span className="notification-item__time">2 horas atrás</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button type="button" className="action-bar__icon-btn" onClick={toggleTheme} aria-label="Alternar tema">
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="filter-bar">
          <AccountSelect />
          <DateRangePicker />
        </div>
      )}
    </>
  );
}
