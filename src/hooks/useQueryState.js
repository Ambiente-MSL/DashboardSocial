import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';

export default function useQueryState(defaults) {
  const [params, setParams] = useSearchParams();

  const get = useCallback((k) => params.get(k) ?? (defaults?.[k] ?? ''), [params, defaults]);

  const set = useCallback((obj) => {
    const p = new URLSearchParams(params);
    Object.entries(obj).forEach(([k,v]) => v==null ? p.delete(k) : p.set(k, String(v)));
    setParams(p, { replace: true });
  }, [params, setParams]);

  return useMemo(() => [get, set], [get, set]);
}