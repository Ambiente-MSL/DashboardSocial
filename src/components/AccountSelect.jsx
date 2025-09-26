import { ChevronDown } from 'lucide-react';
import useQueryState from '../hooks/useQueryState';

const accounts = [
  { id: 'acc_1', label: 'Conta principal' },
  { id: 'acc_2', label: 'Conta secundária' },
];

export default function AccountSelect() {
  const [get, set] = useQueryState({ account: accounts[0].id });
  const value = get('account') || accounts[0].id;

  return (
    <div className="filter-select">
      <label className="filter-select__label" htmlFor="account-select">Conta</label>
      <select
        id="account-select"
        value={value}
        onChange={(event) => set({ account: event.target.value })}
        className="filter-select__input"
      >
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.label}
          </option>
        ))}
      </select>
      <ChevronDown size={16} className="filter-select__icon" aria-hidden="true" />
    </div>
  );
}
