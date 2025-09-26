import { ChevronDown } from "lucide-react";
import useQueryState from "../hooks/useQueryState";
import { accounts } from "../data/accounts";

const DEFAULT_ACCOUNT_ID = accounts[0]?.id || "";

export default function AccountSelect() {
  const [get, set] = useQueryState({ account: DEFAULT_ACCOUNT_ID });
  const value = get("account") || DEFAULT_ACCOUNT_ID;

  const handleChange = (event) => {
    set({ account: event.target.value || undefined });
  };

  return (
    <div className="filter-select">
      <label className="filter-select__label" htmlFor="account-select">Conta</label>
      <select
        id="account-select"
        value={value}
        onChange={handleChange}
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
