import { useEffect, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import useQueryState from "../hooks/useQueryState";
import { useAccounts } from "../context/AccountsContext";
import { DEFAULT_ACCOUNTS } from "../data/accounts";

const FALLBACK_ACCOUNT_ID = DEFAULT_ACCOUNTS[0]?.id || "";

export default function AccountSelect() {
  const { accounts } = useAccounts();
  const availableAccounts = accounts.length ? accounts : DEFAULT_ACCOUNTS;
  const [get, set] = useQueryState({ account: FALLBACK_ACCOUNT_ID });
  const queryAccount = get("account");

  const currentValue = useMemo(() => {
    if (!availableAccounts.length) return "";
    if (queryAccount && availableAccounts.some((account) => account.id === queryAccount)) {
      return queryAccount;
    }
    return availableAccounts[0].id;
  }, [availableAccounts, queryAccount]);

  useEffect(() => {
    if (!availableAccounts.length) return;
    if (!queryAccount || !availableAccounts.some((account) => account.id === queryAccount)) {
      set({ account: availableAccounts[0].id });
    }
  }, [availableAccounts, queryAccount, set]);

  const handleChange = (event) => {
    const nextValue = event.target.value || undefined;
    set({ account: nextValue });
  };

  const isDisabled = availableAccounts.length === 0;

  return (
    <div className="filter-select">
      <label className="filter-select__label" htmlFor="account-select">Conta</label>
      {isDisabled ? (
        <div className="filter-select__empty" role="note">
          Cadastre uma conta nas configuracoes.
        </div>
      ) : (
        <>
          <select
            id="account-select"
            value={currentValue}
            onChange={handleChange}
            className="filter-select__input"
          >
            {availableAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="filter-select__icon" aria-hidden="true" />
        </>
      )}
    </div>
  );
}
