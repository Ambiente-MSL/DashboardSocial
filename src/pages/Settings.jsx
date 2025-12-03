import { useCallback, useEffect, useMemo, useState } from 'react';

import { useOutletContext } from 'react-router-dom';

import { ChevronDown, Edit3, Plus, Trash2, Settings as SettingsIcon } from 'lucide-react';

import { useTheme } from '../context/ThemeContext';

import { useAccounts } from '../context/AccountsContext';

import NavigationHero from '../components/NavigationHero';
import { buildLegalUrl } from '../lib/legalLinks';



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

  useEffect(() => {
    if (!setTopbarConfig) return undefined;
    setTopbarConfig({ title: "Configuracoes", showFilters: false });
    return () => resetTopbarConfig?.();
  }, [setTopbarConfig, resetTopbarConfig]);

  const { theme, resolvedTheme, setTheme } = useTheme();

  const { accounts, addAccount, updateAccount, removeAccount } = useAccounts();
  const discoveredAdAccounts = useMemo(() => {
    const map = new Map();
    accounts.forEach((account) => {
      if (Array.isArray(account?.adAccounts)) {
        account.adAccounts.forEach((ad) => {
          if (!ad || !ad.id) return;
          const id = String(ad.id);
          if (!map.has(id)) {
            map.set(id, {
              id,
              name: ad.name || id,
              currency: ad.currency || "",
            });
          }
        });
      }
    });
    return Array.from(map.values());
  }, [accounts]);
  const discoveredPages = useMemo(
    () => accounts.filter((acc) => acc.facebookPageId).map((acc) => ({
      id: acc.facebookPageId,
      label: acc.label || acc.facebookPageId,
      instagramUserId: acc.instagramUserId || "",
      adAccounts: acc.adAccounts || [],
    })),
    [accounts],
  );
  const discoveredIgAccounts = useMemo(
    () => accounts.filter((acc) => acc.instagramUserId).map((acc) => ({
      id: acc.instagramUserId,
      label: acc.instagramUsername || acc.label || acc.instagramUserId,
      pageId: acc.facebookPageId || "",
    })),
    [accounts],
  );



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

  const handlePrefill = (account) => {
    if (!account) return;
    setFormData({
      label: account.label || "",
      facebookPageId: account.facebookPageId || "",
      instagramUserId: account.instagramUserId || "",
      adAccountId: account.adAccountId || "",
    });
    setEditingId(null);
    setFormError("");
  };



  const resetForm = () => {

    setFormData(ACCOUNT_FORM_INITIAL);

    setEditingId(null);

    setFormError('');

  };



  const handleSubmit = async (event) => {

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



    try {
      if (editingId) {
        await updateAccount(editingId, trimmed);
      } else {
        await addAccount(trimmed);
      }
      resetForm();
      setOpenSections((prev) => ({ ...prev, accounts: true }));
    } catch (err) {
      setFormError('Não foi possível salvar a conta. Tente novamente.');
    }

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



  const handleDelete = async (accountId) => {

    if (accounts.length <= 1) {

      setFormError('Mantenha ao menos uma conta cadastrada.');

      return;

    }



    const confirmed = typeof window === 'undefined' ? true : window.confirm('Remover esta conta? Esta acao pode afetar os filtros dos dashboards.');

    if (!confirmed) return;

    await removeAccount(accountId);

    if (editingId === accountId) {

      resetForm();

    }

  };



  return (
    <div className="instagram-dashboard--clean">
      <div className="ig-clean-container">
        <NavigationHero title="Configurações" icon={SettingsIcon} showGradient={false} />

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

                {/* Painel de contas descobertas */}
                {accounts.length > 0 && (
                  <div style={{ marginBottom: '1rem', padding: '12px', border: '1px solid #e5e7eb', borderRadius: '12px', background: '#f9fafb' }}>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 160px', minWidth: 160 }}>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Páginas</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{discoveredPages.length}</div>
                      </div>
                      <div style={{ flex: '1 1 160px', minWidth: 160 }}>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Contas Instagram</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{discoveredIgAccounts.length}</div>
                      </div>
                      <div style={{ flex: '1 1 160px', minWidth: 160 }}>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Contas de anúncios</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{discoveredAdAccounts.length}</div>
                      </div>
                    </div>

                    <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                      {discoveredPages.map((page) => (
                        <div key={page.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '10px 12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                            <div>
                              <div style={{ fontWeight: 700 }}>{page.label}</div>
                              <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Page ID: {page.id}</div>
                              {page.instagramUserId ? (
                                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>IG ID: {page.instagramUserId}</div>
                              ) : (
                                <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>IG não vinculado</div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handlePrefill({
                                label: page.label,
                                facebookPageId: page.id,
                                instagramUserId: page.instagramUserId,
                                adAccountId: page.adAccounts?.[0]?.id || '',
                              })}
                              className="settings-button settings-button--outline"
                              style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                            >
                              Usar
                            </button>
                          </div>
                          {Array.isArray(page.adAccounts) && page.adAccounts.length > 0 ? (
                            <ul style={{ margin: '8px 0 0 0', paddingLeft: '16px', fontSize: '0.85rem', color: '#4b5563' }}>
                              {page.adAccounts.map((ad) => (
                                <li key={ad.id}>{ad.name || ad.id} — {ad.id}</li>
                              ))}
                            </ul>
                          ) : (
                            <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#9ca3af' }}>Sem contas de anúncios vinculadas</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                      list="ad-accounts-options"
                    />
                    {discoveredAdAccounts.length > 0 && (
                      <>
                        <datalist id="ad-accounts-options">
                          {discoveredAdAccounts.map((ad) => (
                            <option key={ad.id} value={ad.id}>
                              {ad.name || ad.id}
                            </option>
                          ))}
                        </datalist>
                        <p className="settings-hint">
                          Selecione uma das contas de anúncios descobertas ou digite um ID manualmente.
                        </p>
                      </>
                    )}
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

                ) : null}

              </div>

            )}

          </section>

        </div>

        </div>

        <footer style={{ marginTop: '2rem', textAlign: 'center' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <a
              href={buildLegalUrl('/legal/terms-of-service.html')}
              style={{ color: '#7c3aed', textDecoration: 'underline', fontWeight: 500 }}
              target="_blank"
              rel="noreferrer"
            >
              Termos de Serviço
            </a>
            <a
              href={buildLegalUrl('/legal/privacy-policy.html')}
              style={{ color: '#7c3aed', textDecoration: 'underline', fontWeight: 500 }}
              target="_blank"
              rel="noreferrer"
            >
              Políticas de Privacidade
            </a>
            <a
              href={buildLegalUrl('/legal/privacy-policy-en.html')}
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


