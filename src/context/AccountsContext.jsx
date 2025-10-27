import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createDefaultAccounts } from "../data/accounts";


const STORAGE_KEY = "dashboard.accounts";
const API_BASE_URL = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
const DISCOVER_ACCOUNTS_ENDPOINT = `${API_BASE_URL || ""}/api/accounts/discover`;

const AccountsContext = createContext(null);

function normalizeAccount(raw, existing = []) {
  if (!raw) return null;
  const {
    id,
    label,
    facebookPageId,
    instagramUserId,
    adAccountId,
    instagramUsername,
    adAccounts,
    source,
  } = raw;
  if (!label) return null;
  const normalized = {
    id: String(id || generateAccountId(label, existing)).trim(),
    label: String(label).trim(),
    facebookPageId: String(facebookPageId || "").trim(),
    instagramUserId: String(instagramUserId || "").trim(),
    adAccountId: String(adAccountId || "").trim(),
  };
  if (instagramUsername) {
    normalized.instagramUsername = String(instagramUsername).trim();
  }
  if (Array.isArray(adAccounts)) {
    const normalizedAds = adAccounts
      .map((ad) => {
        if (!ad) return null;
        const adId = ad.id != null ? String(ad.id).trim() : "";
        if (!adId) return null;
        return {
          id: adId,
          name: ad.name != null ? String(ad.name).trim() : "",
          accountStatus: ad.accountStatus ?? null,
          currency: ad.currency != null ? String(ad.currency).trim() : "",
          timezoneName: ad.timezoneName != null ? String(ad.timezoneName).trim() : "",
        };
      })
      .filter(Boolean);
    if (normalizedAds.length) {
      normalized.adAccounts = normalizedAds;
    }
  }
  if (source) {
    normalized.source = String(source).trim();
  }
  return normalized;
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
    const normalized = [];
    for (const item of parsed) {
      const account = normalizeAccount(item, normalized);
      if (account) {
        normalized.push(account);
      }
    }
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

  useEffect(() => {
    if (typeof window === "undefined" || typeof fetch !== "function") {
      return undefined;
    }

    let cancelled = false;
    const controller = new AbortController();

    const discoverAccounts = async () => {
      try {
        const response = await fetch(DISCOVER_ACCOUNTS_ENDPOINT, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const body = await response.json();
        const rawList = Array.isArray(body?.accounts) ? body.accounts : [];
        if (!rawList.length || cancelled) {
          return;
        }

        const discovered = [];
        for (const item of rawList) {
          const account = normalizeAccount({ ...item, source: "meta" }, discovered);
          if (account) {
            discovered.push(account);
          }
        }

        if (!discovered.length || cancelled) {
          return;
        }

        setAccounts((prev) => {
          if (!Array.isArray(prev) || prev.length === 0) {
            const merged = discovered.map((account) => ({
              ...account,
              id: account.id || generateAccountId(account.label, discovered),
            }));
            return merged.length ? merged : prev;
          }

          const next = [...prev];
          let changed = false;
          const indexByPageId = new Map();
          next.forEach((account, index) => {
            if (account?.facebookPageId) {
              indexByPageId.set(account.facebookPageId, index);
            }
          });

          discovered.forEach((metaAccount) => {
            const pageId = metaAccount.facebookPageId;
            if (!pageId) return;

            const existingIndex = indexByPageId.get(pageId);
            if (existingIndex != null) {
              const current = next[existingIndex];
              const merged = {
                ...current,
                label: metaAccount.label || current.label,
                facebookPageId: metaAccount.facebookPageId || current.facebookPageId,
                instagramUserId: metaAccount.instagramUserId || current.instagramUserId,
                adAccountId: metaAccount.adAccountId || current.adAccountId,
                id: current.id || metaAccount.id,
              };
              if (metaAccount.instagramUsername) {
                merged.instagramUsername = metaAccount.instagramUsername;
              }
              if (metaAccount.adAccounts) {
                merged.adAccounts = metaAccount.adAccounts;
              }
              merged.source = current.source || metaAccount.source;

              const previousSnapshot = JSON.stringify(current);
              const nextSnapshot = JSON.stringify(merged);
              if (previousSnapshot !== nextSnapshot) {
                next[existingIndex] = merged;
                changed = true;
              }
            } else {
              const candidateId = metaAccount.id || generateAccountId(metaAccount.label, next);
              const newAccount = {
                ...metaAccount,
                id: candidateId,
              };
              next.push(newAccount);
              indexByPageId.set(pageId, next.length - 1);
              changed = true;
            }
          });

          return changed ? next : prev;
        });
      } catch (error) {
        if (cancelled || error.name === "AbortError") {
          return;
        }
        console.warn("Falha ao descobrir contas automaticamente.", error);
      }
    };

    discoverAccounts();

    return () => {
      cancelled = true;
      controller.abort();
    };
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
