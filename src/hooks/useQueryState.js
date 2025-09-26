import { useSearchParams } from 'react-router-dom';

export default function useQueryState(defaults) {
  const [params, setParams] = useSearchParams();
  const get = (k) => params.get(k) ?? (defaults?.[k] ?? '');
  const set = (obj) => {
    const p = new URLSearchParams(params);
    Object.entries(obj).forEach(([k,v]) => v==null ? p.delete(k) : p.set(k, String(v)));
    setParams(p, { replace: true });
  };
  return [get, set];
}