import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Shield, UserCog, AlertCircle, CheckCircle } from 'lucide-react';
import Section from '../components/Section';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function Admin() {
  const outletContext = useOutletContext() || {};
  const { setTopbarConfig, resetTopbarConfig } = outletContext;
  const { user, role } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    if (!setTopbarConfig) return undefined;
    setTopbarConfig({ title: 'Admin', showFilters: false });
    return () => resetTopbarConfig?.();
  }, [setTopbarConfig, resetTopbarConfig]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');

      // Buscar da view que combina user_profiles + auth.users
      const { data, error: fetchError } = await supabase
        .from('user_profiles_with_email')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setUsers(data || []);
    } catch (err) {
      console.error('Erro ao buscar usuarios:', err);
      setError('Erro ao carregar lista de usuarios: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      setUpdating(userId);
      setError('');
      setSuccess('');

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (updateError) throw updateError;

      setSuccess(`Role atualizada para ${newRole} com sucesso!`);
      await fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Erro ao atualizar role:', err);
      setError('Erro ao atualizar role: ' + err.message);
    } finally {
      setUpdating(null);
    }
  };

  if (role !== 'admin') {
    return (
      <>
        <div className="page-content">
          <Section title="Acesso Negado">
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
              <Shield size={48} style={{ marginBottom: '1rem' }} />
              <p>Voce nao tem permissao para acessar esta pagina.</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                Apenas usuarios com role <strong>admin</strong> podem gerenciar usuarios.
              </p>
            </div>
          </Section>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-content">
        <Section
          title="Gerenciamento de Usuarios"
          description="Gerencie roles e permissoes dos usuarios do sistema."
        >
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
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            color: 'var(--muted)'
          }}>
            <strong>Informacoes sobre Roles:</strong>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
              <li><strong>Analista:</strong> Pode visualizar dashboards e relatorios.</li>
              <li><strong>Admin:</strong> Tem acesso total, incluindo gerenciamento de usuarios.</li>
            </ul>
          </div>
        </Section>
      </div>
    </>
  );
}

