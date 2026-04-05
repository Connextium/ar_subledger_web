"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { EmbeddedWallet } from "@/lib/solana/embedded-wallet";
import { useAuth } from "@/context/auth-context";

const STORAGE_PREFIX = "ar:embedded-wallet";

type EmbeddedWalletContextValue = {
  wallet: EmbeddedWallet | null;
  loading: boolean;
  regenerateWallet: () => void;
};

const EmbeddedWalletContext = createContext<EmbeddedWalletContextValue | null>(null);

export function EmbeddedWalletProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<EmbeddedWallet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWallet(null);
      setLoading(false);
      return;
    }

    const key = `${STORAGE_PREFIX}:${user.id}`;
    const existing = window.localStorage.getItem(key);

    if (existing) {
      setWallet(EmbeddedWallet.fromSecret(existing));
      setLoading(false);
      return;
    }

    const nextWallet = EmbeddedWallet.create();
    window.localStorage.setItem(key, nextWallet.exportSecretKey());
    setWallet(nextWallet);
    setLoading(false);
  }, [user]);

  const value = useMemo<EmbeddedWalletContextValue>(
    () => ({
      wallet,
      loading,
      regenerateWallet() {
        if (!user) return;
        const key = `${STORAGE_PREFIX}:${user.id}`;
        const nextWallet = EmbeddedWallet.create();
        window.localStorage.setItem(key, nextWallet.exportSecretKey());
        setWallet(nextWallet);
      },
    }),
    [loading, user, wallet],
  );

  return <EmbeddedWalletContext.Provider value={value}>{children}</EmbeddedWalletContext.Provider>;
}

export function useEmbeddedWallet() {
  const context = useContext(EmbeddedWalletContext);
  if (!context) {
    throw new Error("useEmbeddedWallet must be used within EmbeddedWalletProvider");
  }
  return context;
}
