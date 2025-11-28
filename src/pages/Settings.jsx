import { useCallback, useEffect, useMemo, useState } from 'react';

import { useOutletContext } from 'react-router-dom';

import { ChevronDown, Edit3, Plus, Trash2, Settings as SettingsIcon } from 'lucide-react';

import { useTheme } from '../context/ThemeContext';

import { useAccounts } from '../context/AccountsContext';

import NavigationHero from '../components/NavigationHero';



const NOTIFICATION_STORAGE_KEY = 'ui-notifications-enabled';

const SECTION_STATE = { theme: true, alerts: true, accounts: true };

const ACCOUNT_FORM_INITIAL = {

  label: '',

  facebookPageId: '',

  instagramUserId: '',

  adAccountId: '',

};



export default function Settings() {
  const outletContext = useOutletContext() || {};
  const { setTopbarConfig, resetTopbarConfig } = outletContext;

  const legalBaseUrl = useMemo(() => {
    const explicit = (process.env.REACT_APP_LEGAL_BASE_URL || '').replace(/\/$/, '');
    if (explicit) return explicit;
    const apiBase = (process.env.REACT_APP_API_URL || '').replace(/\/$/, '');
    if (apiBase) {
      const withoutApi = apiBase.replace(/\/api$/i, '');
      return withoutApi || apiBase;
    }
    if (typeof window !== 'undefined') return window.location.origin;
    return '';
  }, []);

  const buildLegalUrl = useCallback(
    (path) => {
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      return `${legalBaseUrl}${normalizedPath}`;
    },
    [legalBaseUrl],
  );

  useEffect(() => {
    if (!setTopbarConfig) return undefined;
    setTopbarConfig({ title: "Configuracoes", showFilters: false });
    return () => resetTopbarConfig?.();
  }, [setTopbarConfig, resetTopbarConfig]);

  const { theme, resolvedTheme, setTheme } = useTheme();

  const { accounts, addAccount, updateAccount, removeAccount } = useAccounts();



  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {

    if (typeof window === 'undefined') return true;

    const stored = window.localStorage.getItem(NOTIFICATION_STORAGE_KEY);

    if (stored === null) return true;

    return stored === 'true';

  });



  const [openSections, setOpenSections] = useState(SECTION_STATE);

  const [formData, setFormData] = useState(ACCOUNT_FORM_INITIAL);

  const [editingId, setEditingId] = useState(null);

  const [formError, setFormError] = useState('');



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



  const toggleSection = (key) => {

    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  };



  const handleFieldChange = (event) => {

    const { name, value } = event.target;

    setFormData((prev) => ({ ...prev, [name]: value }));

  };



  const resetForm = () => {

    setFormData(ACCOUNT_FORM_INITIAL);

    setEditingId(null);

    setFormError('');

  };



  const handleSubmit = (event) => {

    event.preventDefault();

    const trimmed = {

      label: formData.label.trim(),

      facebookPageId: formData.facebookPageId.trim(),

      instagramUserId: formData.instagramUserId.trim(),

      adAccountId: formData.adAccountId.trim(),

    };



    if (!trimmed.label || !trimmed.facebookPageId || !trimmed.instagramUserId || !trimmed.adAccountId) {

      setFormError('Preencha todos os campos obrigatorios.');

      return;

    }



    if (editingId) {

      updateAccount(editingId, trimmed);

    } else {

      addAccount(trimmed);

    }



    resetForm();

    setOpenSections((prev) => ({ ...prev, accounts: true }));

  };



  const handleEdit = (account) => {

    setFormData({

      label: account.label,

      facebookPageId: account.facebookPageId,

      instagramUserId: account.instagramUserId,

      adAccountId: account.adAccountId,

    });

    setEditingId(account.id);

    setFormError('');

    setOpenSections((prev) => ({ ...prev, accounts: true }));

  };



  const handleDelete = (accountId) => {

    if (accounts.length <= 1) {

      setFormError('Mantenha ao menos uma conta cadastrada.');

      return;

    }



    const confirmed = typeof window === 'undefined' ? true : window.confirm('Remover esta conta? Esta acao pode afetar os filtros dos dashboards.');

    if (!confirmed) return;

    removeAccount(accountId);

    if (editingId === accountId) {

      resetForm();

    }

  };



  return (
    <div className="instagram-dashboard--clean">
      <div className="ig-clean-container">
        <NavigationHero title="Configurações" icon={SettingsIcon} showGradient={false} />

        <h2 className="ig-clean-title">Configurações</h2>

        <div className="page-content">

        <div className="settings-layout">

          <section className={`settings-section ${openSections.theme ? 'is-open' : ''}`}>

            <button

              type="button"

              className="settings-section__header"

              onClick={() => toggleSection('theme')}

              aria-expanded={openSections.theme}

            >

              <div className="settings-section__header-text">

                <h2 className="settings-section__title">Tema do painel</h2>

                <p className="settings-section__subtitle">Escolha como o painel e apresentado no dia a dia.</p>

              </div>

              <ChevronDown className={`settings-section__icon ${openSections.theme ? 'is-open' : ''}`} size={18} />

            </button>

            {openSections.theme && (

              <div className="settings-section__body" role="radiogroup" aria-label="Tema do painel">

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

                <p className="settings-hint">

                  Preferencia atual: <strong>{theme}</strong>. Tema aplicado no momento: {resolvedThemeLabel}.

                </p>

              </div>

            )}

          </section>



          <section className={`settings-section ${openSections.alerts ? 'is-open' : ''}`}>

            <button

              type="button"

              className="settings-section__header"

              onClick={() => toggleSection('alerts')}

              aria-expanded={openSections.alerts}

            >

              <div className="settings-section__header-text">

                <h2 className="settings-section__title">Alertas de desempenho</h2>

                <p className="settings-section__subtitle">Receba avisos automaticos quando indicadores mudarem de forma relevante.</p>

              </div>

              <ChevronDown className={`settings-section__icon ${openSections.alerts ? 'is-open' : ''}`} size={18} />

            </button>

            {openSections.alerts && (

              <div className="settings-section__body">

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

            )}

          </section>



          <section className={`settings-section ${openSections.accounts ? 'is-open' : ''}`}>

            <button

              type="button"

              className="settings-section__header"

              onClick={() => toggleSection('accounts')}

              aria-expanded={openSections.accounts}

            >

              <div className="settings-section__header-text">

                <h2 className="settings-section__title">Contas conectadas</h2>

                <p className="settings-section__subtitle">Adicione, edite ou remova paginas que aparecem nos filtros.</p>

              </div>

              <ChevronDown className={`settings-section__icon ${openSections.accounts ? 'is-open' : ''}`} size={18} />

            </button>

            {openSections.accounts && (

              <div className="settings-section__body">

                <form className="accounts-form" onSubmit={handleSubmit}>

                  <div className="accounts-form__field">

                    <label htmlFor="account-name">Nome</label>

                    <input

                      id="account-name"

                      name="label"

                      value={formData.label}

                      onChange={handleFieldChange}

                      placeholder="Ex: Cliente - Marca"

                    />

                  </div>

                  <div className="accounts-form__field">

                    <label htmlFor="account-page-id">ID da pagina</label>

                    <input

                      id="account-page-id"

                      name="facebookPageId"

                      value={formData.facebookPageId}

                      onChange={handleFieldChange}

                      placeholder="1234567890"

                    />

                  </div>

                  <div className="accounts-form__field">

                    <label htmlFor="account-ig-id">ID Instagram</label>

                    <input

                      id="account-ig-id"

                      name="instagramUserId"

                      value={formData.instagramUserId}

                      onChange={handleFieldChange}

                      placeholder="1784..."

                    />

                  </div>

                  <div className="accounts-form__field">

                    <label htmlFor="account-ads-id">ID conta de anuncios</label>

                    <input

                      id="account-ads-id"

                      name="adAccountId"

                      value={formData.adAccountId}

                      onChange={handleFieldChange}

                      placeholder="act_..."

                    />

                  </div>



                  {formError && <p className="settings-form-error" role="alert">{formError}</p>}



                  <div className="accounts-form__actions">

                    <button type="submit" className="settings-button">

                      {editingId ? (

                        <>

                          <Edit3 size={16} /> Salvar alteracoes

                        </>

                      ) : (

                        <>

                          <Plus size={16} /> Adicionar conta

                        </>

                      )}

                    </button>

                    {editingId && (

                      <button type="button" className="settings-button settings-button--outline" onClick={resetForm}>

                        Cancelar

                      </button>

                    )}

                  </div>

                </form>



                {editingId ? (

                  <p className="settings-hint">Editando a conta selecionada. Clique em salvar para confirmar ou em cancelar para desfazer.</p>

                ) : (

                  <p className="settings-hint">Contas adicionadas ficam disponiveis no filtro superior dos dashboards.</p>

                )}



                <div className="accounts-list">

                  {accounts.length ? (

                    accounts.map((account) => (

                      <div key={account.id} className="accounts-card">

                        <div className="accounts-card__meta">

                          <span className="accounts-card__title">{account.label}</span>

                          <span>ID da pagina: {account.facebookPageId || ''}</span>

                          <span>ID Instagram: {account.instagramUserId || ''}</span>

                          <span>ID conta de anuncios: {account.adAccountId || ''}</span>

                        </div>

                        <div className="accounts-card__actions">

                          <button type="button" onClick={() => handleEdit(account)} aria-label={`Editar ${account.label}`}>

                            <Edit3 size={15} /> Editar

                          </button>

                          <button type="button" onClick={() => handleDelete(account.id)} aria-label={`Remover ${account.label}`}>

                            <Trash2 size={15} /> Remover

                          </button>

                        </div>

                      </div>

                    ))

                  ) : (

                    <p className="settings-hint">Nenhuma conta cadastrada ainda.</p>

                  )}

                </div>

              </div>

            )}

          </section>

        </div>

        </div>

        <footer style={{ marginTop: '2rem', textAlign: 'center' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <a
              href={buildLegalUrl('/terms-of-service')}
              style={{ color: '#7c3aed', textDecoration: 'underline', fontWeight: 500 }}
              target="_blank"
              rel="noreferrer"
            >
              Termos de Serviço
            </a>
            <a
              href={buildLegalUrl('/privacy-policy')}
              style={{ color: '#7c3aed', textDecoration: 'underline', fontWeight: 500 }}
              target="_blank"
              rel="noreferrer"
            >
              Políticas de Privacidade
            </a>
            <a
              href={buildLegalUrl('/privacy-policy-en')}
              style={{ color: '#7c3aed', textDecoration: 'underline', fontWeight: 500 }}
              target="_blank"
              rel="noreferrer"
            >
              Privacy Policy
            </a>
          </div>
        </footer>

      </div>

    </div>

  );

}


