import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const translateError = (rawMessage) => {
  if (!rawMessage) {
    return 'Nao foi possivel criar sua conta. Tente novamente em instantes.';
  }
  const normalized = String(rawMessage).toLowerCase();
  if (normalized.includes('password')) {
    return 'Senha invalida. Use ao menos 6 caracteres.';
  }
  if (normalized.includes('already registered') || normalized.includes('user already registered')) {
    return 'E-mail ja cadastrado. Tente fazer login ou use outro e-mail.';
  }
  if (normalized.includes('email') && normalized.includes('invalid')) {
    return 'E-mail invalido. Verifique o formato.';
  }
  if (normalized.includes('insert') || normalized.includes('user_profiles')) {
    return 'Erro ao criar perfil. Verifique se a tabela user_profiles existe no Supabase.';
  }
  if (normalized.includes('policy') || normalized.includes('permission')) {
    return 'Erro de permissao. Verifique as policies RLS no Supabase.';
  }
  return rawMessage;
};

export default function Register() {
  const { user, loading, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectPath = useMemo(() => {
    const fromPath = location.state?.from?.pathname;
    if (!fromPath || fromPath === '/login' || fromPath === '/register') {
      return '/';
    }
    return fromPath;
  }, [location.state]);

  useEffect(() => {
    if (!loading && user) {
      navigate(redirectPath, { replace: true });
    }
  }, [loading, user, navigate, redirectPath]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    if (!nome.trim()) {
      setFormError('Por favor, informe seu nome.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('As senhas informadas nao conferem.');
      return;
    }

    if (password.length < 6) {
      setFormError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      await signUp(email, password, nome.trim());
      navigate(redirectPath, { replace: true });
    } catch (err) {
      console.error('Erro no sign up:', err);
      setFormError(translateError(err?.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">Monitor MSL</div>
        <h1 className="auth-heading">Criar conta</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-label" htmlFor="nome">
            Nome Completo
          </label>
          <input
            id="nome"
            type="text"
            autoComplete="name"
            placeholder="Digite seu nome completo"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            required
            disabled={submitting}
          />
          <label className="auth-label" htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="Digite seu e-mail"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={submitting}
          />
          <div className="auth-label-row">
            <label className="auth-label" htmlFor="password">
              Senha
            </label>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="Defina uma senha"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={submitting}
          />
          <div className="auth-label-row">
            <label className="auth-label" htmlFor="confirmPassword">
              Confirmar senha
            </label>
          </div>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Repita a senha"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            disabled={submitting}
          />
          {formError && <p className="auth-error">{formError}</p>}
          <button type="submit" className="auth-submit" disabled={submitting}>
            <UserPlus size={16} />
            {submitting ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>
        <p className="auth-footnote">
          Ja tem conta?{' '}
          <Link className="auth-link" to="/login">
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
}
