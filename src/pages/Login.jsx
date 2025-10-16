import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const translateError = (rawMessage) => {
  if (!rawMessage) {
    return 'Não foi possível acessar sua conta. Verifique as credenciais.';
  }
  const normalized = String(rawMessage).toLowerCase();
  if (normalized.includes('invalid login')) {
    return 'Credenciais inválidas. Verifique os dados informados.';
  }
  if (normalized.includes('network')) {
    return 'Falha de rede ao conectar. Tente novamente em instantes.';
  }
  return rawMessage;
};

export default function Login() {
  const { user, loading, signInWithPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectPath = useMemo(() => {
    const fromPath = location.state?.from?.pathname;
    if (!fromPath || fromPath === '/login') return '/';
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
    setSubmitting(true);
    try {
      await signInWithPassword(email, password);
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setFormError(translateError(err?.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">Monitor MSL</div>
        <h1 className="auth-heading">Login</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-label" htmlFor="email">E-mail</label>
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
            <label className="auth-label" htmlFor="password">Senha</label>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Digite sua senha"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={submitting}
          />
          {formError && <p className="auth-error">{formError}</p>}
          <a className="auth-link" href="https://app.supabase.com/" target="_blank" rel="noreferrer">Esqueceu a senha?</a>
          <button type="submit" className="auth-submit" disabled={submitting}>
            <LogIn size={16} />
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <p className="auth-footnote">
        </p>
      </div>
    </div>
  );
}
