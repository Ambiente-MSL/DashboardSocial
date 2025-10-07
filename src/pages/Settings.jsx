import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Topbar from '../components/Topbar';
import { useTheme } from '../context/ThemeContext';

const NOTIFICATION_STORAGE_KEY = 'ui-notifications-enabled';

export default function Settings() {
  const { sidebarOpen, toggleSidebar } = useOutletContext();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (stored === null) return true;
    return stored === 'true';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, String(notificationsEnabled));
  }, [notificationsEnabled]);

  const themeOptions = useMemo(
    () => [
      {
        value: 'light',
        label: 'Claro',
        description: 'Interface clara, ideal para ambientes luminosos.'
      },
      {
        value: 'dark',
        label: 'Escuro',
        description: 'Realce de contrastes para trabalhar com pouca luz.'
      },
      {
        value: 'auto',
        label: 'Automatico',
        description: 'Segue a preferencia de tema do sistema operacional.'
      }
    ],
    []
  );

  const alertExamples = useMemo(
    () => [
      {
        id: 'reach-drop',
        type: 'warning',
        title: 'Alcance em queda',
        message: 'O alcance caiu 35% em relacao a semana anterior.'
      },
      {
        id: 'post-engagement',
        type: 'positive',
        title: 'Post em alta',
        message: 'Novo post com +10% de engajamento que a media.'
      },
      {
        id: 'budget-cap',
        type: 'critical',
        title: 'Campanha limitada',
        message: 'Campanha X atingiu o limite de orcamento.'
      }
    ],
    []
  );

  const activeAlerts = notificationsEnabled ? alertExamples : [];
  const resolvedThemeLabel = resolvedTheme === 'dark' ? 'escuro' : 'claro';

  return (
    <>
      <Topbar title="Configuracoes" sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
      <div className="page-content">
        <div className="settings-grid">
          <div className="card settings-card">
            <div className="settings-card__header">
              <h2 className="settings-card__title">Tema do painel</h2>
              <p className="settings-card__subtitle">
                Escolha como o painel e apresentado no dia a dia.
              </p>
            </div>

            <div className="settings-options" role="radiogroup" aria-label="Tema do painel">
              {themeOptions.map((option) => {
                const isActive = theme === option.value;
                return (
                  <label
                    key={option.value}
                    className={`settings-radio ${isActive ? 'settings-radio--active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="theme-preference"
                      value={option.value}
                      checked={theme === option.value}
                      onChange={() => setTheme(option.value)}
                    />
                    <span className="settings-radio__label">{option.label}</span>
                    <span className="settings-radio__hint">{option.description}</span>
                  </label>
                );
              })}
            </div>

            <p className="settings-hint">
              Preferencia atual: <strong>{theme}</strong>. Tema aplicado no momento: {resolvedThemeLabel}.
            </p>
          </div>

          <div className="card settings-card">
            <div className="settings-card__header">
              <h2 className="settings-card__title">Alertas de desempenho</h2>
              <p className="settings-card__subtitle">
                Receba avisos automaticos quando indicadores mudarem de forma relevante.
              </p>
            </div>

            <button
              type="button"
              className={`settings-toggle ${notificationsEnabled ? 'settings-toggle--on' : ''}`}
              onClick={() => setNotificationsEnabled((prev) => !prev)}
              aria-pressed={notificationsEnabled}
            >
              {notificationsEnabled ? 'Alertas ativados' : 'Alertas desativados'}
            </button>

            {notificationsEnabled ? (
              <div className="settings-alerts" aria-live="polite">
                {activeAlerts.map((alert) => (
                  <div key={alert.id} className={`settings-alert settings-alert--${alert.type}`}>
                    <div>
                      <div className="settings-alert__title">{alert.title}</div>
                      <div className="settings-alert__message">{alert.message}</div>
                    </div>
                    <span className="settings-alert__badge">monitoramento</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="settings-hint">Os alertas estao desativados.</p>
            )}

            <p className="settings-hint">
              Os alertas consideram variacoes de alcance, engajamento e limites de campanhas. Ajuste as regras no painel de relatorios para refinar quando cada aviso deve ser enviado.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
