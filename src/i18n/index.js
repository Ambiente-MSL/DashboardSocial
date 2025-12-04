import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const STORAGE_KEY = 'dashboardsocial.lang';

const resources = {
  pt: {
    translation: {
      login: {
        title: 'Olá! Faça seu login 👇',
        email: 'E-mail',
        password: 'Senha',
        submit: 'Entrar',
        submit_loading: 'Entrando...',
        forgot: 'Esqueceu a senha? Entre em contato com um administrador.',
        no_account: 'Ainda não tem conta?',
        create_account: 'Criar conta',
        or: 'ou',
        fb: 'Continuar com Facebook',
        fb_loading: 'Conectando...',
        fb_loading_sdk: 'Carregando Facebook...',
        error_generic: 'Não foi possível acessar sua conta. Verifique as credenciais.',
        error_invalid: 'Credenciais inválidas. Verifique os dados informados.',
        error_required: 'Informe e-mail e senha para continuar.',
        error_network: 'Falha de rede ao conectar. Tente novamente em instantes.',
        legal_terms: 'Termos de Serviço',
        legal_privacy: 'Políticas de Privacidade',
        legal_privacy_en: 'Privacy Policy(EN)',
      },
      lang: {
        label: 'Idioma',
        pt: 'Português',
        en: 'English',
      },
    },
  },
  en: {
    translation: {
      login: {
        title: 'Login',
        email: 'Email',
        password: 'Password',
        submit: 'Sign in',
        submit_loading: 'Signing in...',
        forgot: 'Forgot your password? Contact an administrator.',
        no_account: "Don't have an account?",
        create_account: 'Create account',
        or: 'or',
        fb: 'Continue with Facebook',
        fb_loading: 'Connecting...',
        fb_loading_sdk: 'Loading Facebook...',
        error_generic: 'Could not sign you in. Please check your credentials.',
        error_invalid: 'Invalid credentials. Please check your data.',
        error_required: 'Email and password are required.',
        error_network: 'Network error. Try again in a moment.',
        legal_terms: 'Terms of Service',
        legal_privacy: 'Privacy Policy',
        legal_privacy_en: 'Privacy Policy (EN)',
      },
      lang: {
        label: 'Language',
        pt: 'Portuguese',
        en: 'English',
      },
    },
  },
};

function detectInitialLang() {
  if (typeof window === 'undefined') return 'pt';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && resources[saved]) return saved;
  } catch (err) {
    // ignore
  }
  const browser = navigator.language || navigator.languages?.[0] || 'pt';
  return browser.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

const initialLang = detectInitialLang();

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLang,
    fallbackLng: 'pt',
    interpolation: { escapeValue: false },
  });

export function changeLanguage(lang) {
  const next = resources[lang] ? lang : 'pt';
  i18n.changeLanguage(next);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch (err) {
      // ignore
    }
  }
}

export default i18n;
