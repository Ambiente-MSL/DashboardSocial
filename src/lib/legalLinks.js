const normalizeBase = (value) => (value || '').replace(/\/$/, '');

export function resolveLegalBaseUrl() {
  const explicit = normalizeBase(process.env.REACT_APP_LEGAL_BASE_URL);
  if (explicit) return explicit;

  const backend = normalizeBase(process.env.REACT_APP_BACKEND_URL);
  if (backend) return backend;

  const apiBase = normalizeBase(process.env.REACT_APP_API_URL);
  if (apiBase) {
    const withoutApi = apiBase.replace(/\/api$/i, '');
    return withoutApi || apiBase;
  }

  if (typeof window !== 'undefined') {
    // Heurística: em dev, se o front roda em 3010, assuma backend em 5000.
    if (window.location.port === '3010') {
      return `${window.location.protocol}//${window.location.hostname}:5000`;
    }
    return window.location.origin;
  }

  return '';
}

export function buildLegalUrl(path = '/') {
  const base = resolveLegalBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
