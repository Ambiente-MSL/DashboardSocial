import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_ACCOUNTS, createDefaultAccounts } from "../data/accounts";

const STORAGE_KEY = "dashboard.accounts";

const AccountsContext = createContext(null);

function normalizeAccount(raw) {
  if (!raw) return null;
  const {
    id,
    label,
    facebookPageId,
    instagramUserId,
    adAccountId,
  } = raw;
  if (!label) return null;
  return {
    id: String(id || generateAccountId(label)).trim(),
    label: String(label).trim(),
    facebookPageId: String(facebookPageId || "").trim(),
    instagramUserId: String(instagramUserId || "").trim(),
    adAccountId: String(adAccountId || "").trim(),
  };
}

function loadAccountsFromStorage() {
  if (typeof window === "undefined") {
    return createDefaultAccounts();
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return createDefaultAccounts();
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return createDefaultAccounts();
    const normalized = parsed
      .map(normalizeAccount)
      .filter(Boolean);
    return normalized.length ? normalized : createDefaultAccounts();
  } catch (err) {
    console.warn("Falha ao carregar contas do storage, usando padrão.", err);
    return createDefaultAccounts();
  }
}

function saveAccountsToStorage(list) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn("Falha ao salvar contas no storage.", err);
  }
}

function generateAccountId(label, existing = []) {
  const base = String(label)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const fallback = base || "account";
  let candidate = fallback;
  let counter = 1;
  const ids = new Set(existing.map((acc) => acc.id));
  while (ids.has(candidate)) {
    candidate = `${fallback}-${counter++}`;
  }
  return candidate;
}

export function AccountsProvider({ children }) {
  const [accounts, setAccounts] = useState(() => loadAccountsFromStorage());

  useEffect(() => {
    saveAccountsToStorage(accounts);
  }, [accounts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const listener = (event) => {
      if (event.key === STORAGE_KEY) {
        setAccounts(loadAccountsFromStorage());
      }
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);

  const addAccount = (payload) => {
    setAccounts((prev) => {
      const nextId = generateAccountId(payload.label, prev);
      const next = [
        ...prev,
        {
          id: nextId,
          label: payload.label.trim(),
          facebookPageId: payload.facebookPageId.trim(),
          instagramUserId: payload.instagramUserId.trim(),
          adAccountId: payload.adAccountId.trim(),
        },
      ];
      return next;
    });
  };

  const updateAccount = (id, payload) => {
    setAccounts((prev) =>
      prev.map((account) =>
        account.id === id
          ? {
              ...account,
              label: payload.label.trim(),
              facebookPageId: payload.facebookPageId.trim(),
              instagramUserId: payload.instagramUserId.trim(),
              adAccountId: payload.adAccountId.trim(),
            }
          : account,
      ),
    );
  };

  const removeAccount = (id) => {
    setAccounts((prev) => {
      const next = prev.filter((account) => account.id !== id);
      return next.length ? next : createDefaultAccounts();
    });
  };

  const value = useMemo(
    () => ({
      accounts,
      addAccount,
      updateAccount,
      removeAccount,
    }),
    [accounts],
  );

  return <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>;
}

export function useAccounts() {
  const context = useContext(AccountsContext);
  if (!context) {
    throw new Error("useAccounts deve ser utilizado dentro de AccountsProvider");
  }
  return context;
}
