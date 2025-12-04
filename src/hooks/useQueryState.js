import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';

const ACCOUNT_STORAGE_KEY = 'dashboardsocial.selectedAccount';

function readStoredAccount() {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(ACCOUNT_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function persistAccount(value) {
  if (typeof window === 'undefined') return;
  try {
    if (!value) {
      window.localStorage.removeItem(ACCOUNT_STORAGE_KEY);
    } else {
      window.localStorage.setItem(ACCOUNT_STORAGE_KEY, value);
    }
  } catch {
    // ignore storage failures
  }
}

export default function useQueryState(defaults) {
  const [params, setParams] = useSearchParams();

  const get = useCallback((k) => {
    const fromParams = params.get(k);
    if (fromParams !== null) return fromParams;
    if (k === 'account') {
      const stored = readStoredAccount();
      if (stored) return stored;
    }
    return defaults?.[k] ?? '';
  }, [params, defaults]);

  const set = useCallback((obj) => {
    const p = new URLSearchParams(params);
    Object.entries(obj).forEach(([k, v]) => {
      if (k === 'account') {
        persistAccount(v);
      }
      if (v == null) {
        p.delete(k);
      } else {
        p.set(k, String(v));
      }
    });
    setParams(p, { replace: true });
  }, [params, setParams]);

  return useMemo(() => [get, set], [get, set]);
}
