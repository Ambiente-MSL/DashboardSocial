import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, UserCog, AlertCircle, CheckCircle, BarChart3, FileText, Settings, Instagram as InstagramIcon, Facebook } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const HERO_TABS = [
  { id: "instagram", label: "Instagram", href: "/instagram", icon: InstagramIcon },
  { id: "facebook", label: "Facebook", href: "/facebook", icon: Facebook },
  { id: "ads", label: "Ads", href: "/ads", icon: BarChart3 },
  { id: "reports", label: "Relatórios", href: "/relatorios", icon: FileText },
  { id: "admin", label: "Admin", href: "/admin", icon: Shield },
  { id: "settings", label: "Configurações", href: "/configuracoes", icon: Settings },
];

export default function Admin() {
  const location = useLocation();
  const { user, role, apiFetch } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [updating, setUpdating] = useState(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const payload = await apiFetch('/api/admin/users');
      setUsers(Array.isArray(payload?.users) ? payload.users : []);
    } catch (err) {
      console.error('Erro ao buscar usuarios:', err);
      setError('Erro ao carregar lista de usuarios: ' + (err?.message || 'falha desconhecida'));
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (userId, newRole) => {
    if (!newRole) return;
    try {
      setUpdating(userId);
      setError('');
      setSuccess('');

      await apiFetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: { role: newRole },
      });

      setSuccess(`Role atualizada para ${newRole} com sucesso!`);
      await fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Erro ao atualizar role:', err);
      setError('Erro ao atualizar role: ' + (err?.message || 'falha desconhecida'));
    } finally {
      setUpdating(null);
    }
  };

  if (role !== 'admin') {
    return (
      <div className="admin-dashboard admin-dashboard--clean">
        <div className="ig-clean-container">
          <div className="ig-hero-gradient" aria-hidden="true" />

          {/* Header com Logo Admin e Tabs */}
          <div className="ig-clean-header">
            <div className="ig-clean-header__brand">
              <div className="ig-clean-header__logo">
                <Shield size={32} color="#ec4899" />
              </div>
              <h1>Admin</h1>
            </div>

            <nav className="ig-clean-tabs">
              {HERO_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.href ? location.pathname === tab.href : tab.id === "admin";
                const linkTarget = tab.href
                  ? (location.search ? { pathname: tab.href, search: location.search } : tab.href)
                  : null;
                return tab.href ? (
                  <Link
                    key={tab.id}
                    to={linkTarget}
                    className={`ig-clean-tab${isActive ? " ig-clean-tab--active" : ""}`}
                  >
                    <Icon size={18} />
                    <span>{tab.label}</span>
                  </Link>
                ) : null;
              })}
            </nav>
          </div>

          <div className="ig-main-layout">
            <div className="ig-content-area">
              <div className="ig-card-white" style={{ textAlign: 'center', padding: '3rem' }}>
                <Shield size={48} style={{ marginBottom: '1rem', color: '#ec4899' }} />
                <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '600' }}>Acesso Negado</h2>
                <p style={{ color: '#6b7280', marginBottom: '0.5rem' }}>
                  Você não tem permissão para acessar esta página.
                </p>
                <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                  Apenas usuários com role <strong>admin</strong> podem gerenciar usuários.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard admin-dashboard--clean">
      <div className="ig-clean-container">
        <div className="ig-hero-gradient" aria-hidden="true" />

        {/* Header com Logo Admin e Tabs */}
        <div className="ig-clean-header">
          <div className="ig-clean-header__brand">
            <div className="ig-clean-header__logo">
              <Shield size={32} color="#ec4899" />
            </div>
            <h1>Admin</h1>
          </div>

          <nav className="ig-clean-tabs">
            {HERO_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.href ? location.pathname === tab.href : tab.id === "admin";
              const linkTarget = tab.href
                ? (location.search ? { pathname: tab.href, search: location.search } : tab.href)
                : null;
              return tab.href ? (
                <Link
                  key={tab.id}
                  to={linkTarget}
                  className={`ig-clean-tab${isActive ? " ig-clean-tab--active" : ""}`}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                </Link>
              ) : null;
            })}
          </nav>
        </div>

        <div className="ig-main-layout">
          <div className="ig-content-area">
            <section className="ig-card-white" style={{ marginBottom: '2rem' }}>
              <div className="ig-analytics-card__header" style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem' }}>
                <h4 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>Gerenciamento de Usuários</h4>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  Gerencie roles e permissões dos usuários do sistema.
                </p>
              </div>

              <div style={{ padding: '1.5rem' }}>
          {error && (
            <div style={{
              padding: '1rem',
              marginBottom: '1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#ef4444'
            }}>
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div style={{
              padding: '1rem',
              marginBottom: '1rem',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#22c55e'
            }}>
              <CheckCircle size={20} />
              <span>{success}</span>
            </div>
          )}

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Role Atual</th>
                  <th>Data de Criacao</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                      Carregando usuarios...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', fontStyle: 'italic', color: 'var(--muted)' }}>
                      Nenhum usuario cadastrado.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <UserCog size={16} />
                          <strong>{u.nome || 'Sem nome'}</strong>
                          {u.id === user?.id && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>(voce)</span>
                          )}
                        </div>
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
                        {u.email}
                      </td>
                      <td>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '1rem',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          backgroundColor: u.role === 'admin' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                          color: u.role === 'admin' ? '#3b82f6' : '#6b7280'
                        }}>
                          {u.role}
                        </span>
                      </td>
                      <td>{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          disabled={updating === u.id || u.id === user?.id}
                          style={{
                            padding: '0.5rem',
                            borderRadius: '0.375rem',
                            border: '1px solid var(--border)',
                            backgroundColor: 'var(--surface)',
                            color: 'var(--foreground)',
                            cursor: updating === u.id || u.id === user?.id ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <option value="analista">Analista</option>
                          <option value="admin">Admin</option>
                        </select>
                        {u.id === user?.id && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginLeft: '0.5rem' }}>
                            (nao pode alterar propria role)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            color: '#6b7280'
          }}>
            <strong style={{ color: '#111827' }}>Informações sobre Roles:</strong>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
              <li><strong>Analista:</strong> Pode visualizar dashboards e relatórios.</li>
              <li><strong>Admin:</strong> Tem acesso total, incluindo gerenciamento de usuários.</li>
            </ul>
          </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

