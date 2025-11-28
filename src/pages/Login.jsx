import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Facebook, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { buildLegalUrl } from '../lib/legalLinks';

const translateError = (rawMessage) => {
  if (!rawMessage) {
    return 'Não foi possível acessar sua conta. Verifique as credenciais.';
  }
  const normalized = String(rawMessage).toLowerCase();
  if (normalized.includes('invalid credentials')) {
    return 'Credenciais inválidas. Verifique os dados informados.';
  }
  if (normalized.includes('email') && normalized.includes('required')) {
    return 'Informe e-mail e senha para continuar.';
  }
  if (normalized.includes('network')) {
    return 'Falha de rede ao conectar. Tente novamente em instantes.';
  }
  return rawMessage;
};

const facebookAppId = process.env.REACT_APP_FACEBOOK_APP_ID;

const ensureFacebookSdk = () =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Ambiente de navegador não disponível.'));
      return;
    }
    if (window.FB) {
      resolve(window.FB);
      return;
    }

    window.fbAsyncInit = () => {
      try {
        window.FB.init({
          appId: facebookAppId,
          cookie: true,
          xfbml: false,
          version: 'v23.0',
        });
        resolve(window.FB);
      } catch (err) {
        reject(err);
      }
    };

    const existingScript = document.getElementById('facebook-jssdk');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.FB));
      existingScript.addEventListener('error', () => reject(new Error('Não foi possível carregar o SDK do Facebook.')));
      return;
    }

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.FB) {
        resolve(window.FB);
      }
    };
    script.onerror = () => reject(new Error('Não foi possível carregar o SDK do Facebook.'));
    document.body.appendChild(script);
  });

export default function Login() {
  const { user, loading, signInWithPassword, signInWithFacebook } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [facebookLoading, setFacebookLoading] = useState(false);
  const [facebookReady, setFacebookReady] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    if (!facebookAppId) return undefined;

    ensureFacebookSdk()
      .then(() => {
        if (!cancelled) {
          setFacebookReady(true);
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar SDK do Facebook', err);
        if (!cancelled) {
          setFacebookReady(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  const handleFacebookLogin = async () => {
    setFormError('');
    if (!facebookAppId) {
      setFormError('Configuração do Facebook ausente. Defina REACT_APP_FACEBOOK_APP_ID.');
      return;
    }
    setFacebookLoading(true);
    try {
      const FB = await ensureFacebookSdk();
      const accessToken = await new Promise((resolve, reject) => {
        FB.login(
          (response) => {
            if (response?.authResponse?.accessToken) {
              resolve(response.authResponse.accessToken);
            } else if (response?.status === 'not_authorized') {
              reject(new Error('Permissão do Facebook não autorizada.'));
            } else {
              reject(new Error('Login com Facebook cancelado.'));
            }
          },
          { scope: 'email,public_profile', return_scopes: true },
        );
      });

      await signInWithFacebook(accessToken);
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setFormError(translateError(err?.message));
    } finally {
      setFacebookLoading(false);
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
          <p className="auth-footnote" style={{ marginTop: '0.5rem'}}>
            Esqueceu a senha? Entre em contato com um administrador.
          </p>
          <button type="submit" className="auth-submit" disabled={submitting}>
            <LogIn size={16} />
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1.25rem 0 0.75rem' }}>
          <div style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
          <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>ou</span>
          <div style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
        </div>

        <button
          type="button"
          className="auth-submit"
          style={{
            backgroundColor: '#0866ff',
            borderColor: '#0653d9',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            justifyContent: 'center',
          }}
          onClick={handleFacebookLogin}
          disabled={submitting || facebookLoading || (facebookAppId && !facebookReady)}
        >
          <Facebook size={16} />
          {facebookLoading
            ? 'Conectando...'
            : !facebookReady && facebookAppId
              ? 'Carregando Facebook...'
              : 'Continuar com Facebook'}
        </button>

        <p className="auth-footnote">
          Nao tem conta?{' '}
          <Link className="auth-link" to="/register">
            Criar conta
          </Link>
        </p>

        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
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
      </div>
    </div>
  );
}
