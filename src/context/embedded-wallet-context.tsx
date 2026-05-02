"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { EmbeddedWallet } from "@/lib/solana/embedded-wallet";
import { useAuth } from "@/context/auth-context";
import { useWorkspace } from "@/context/workspace-context";
import { env } from "@/lib/config/env";
import { supabase } from "@/lib/supabase/client";
import type { WorkspaceWallet } from "@/lib/types/wallet";

type EmbeddedWalletContextValue = {
  wallet: EmbeddedWallet | null;
  loading: boolean;
  regenerateWallet: () => void;
};

const EmbeddedWalletContext = createContext<EmbeddedWalletContextValue | null>(null);

export function EmbeddedWalletProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { selectedWorkspaceId } = useWorkspace();
  const [wallet, setWallet] = useState<EmbeddedWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!user) {
      setWallet(null);
      setLoading(false);
      return;
    }

    // Wallet must be explicitly created in Configuration; do not auto-generate on login.
    setWallet(null);
  }, [user]);

  useEffect(() => {
    if (!env.supabaseUrl || !env.supabaseAnonKey) return;
    if (!user || !selectedWorkspaceId) {
      setWallet(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        if (!accessToken || cancelled) {
          if (!cancelled) setWallet(null);
          return;
        }

        const listResponse = await fetch(
          `/api/wallets?workspaceId=${encodeURIComponent(selectedWorkspaceId)}`,
          {
            headers: {
              authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!listResponse.ok) {
          if (!cancelled) setWallet(null);
          return;
        }

        const listData = (await listResponse.json()) as { wallets?: WorkspaceWallet[] };
        const candidate =
          listData.wallets?.find((row) => row.isMain && row.status === "active") ?? null;

        if (!candidate) {
          if (!cancelled) setWallet(null);
          return;
        }

        const exportResponse = await fetch("/api/wallets/export", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ workspaceId: selectedWorkspaceId, walletId: candidate.id }),
        });

        if (!exportResponse.ok) {
          if (!cancelled) setWallet(null);
          return;
        }

        const exportData = (await exportResponse.json()) as { privateKey?: string };
        if (!exportData.privateKey) {
          if (!cancelled) setWallet(null);
          return;
        }

        const workspaceWallet = EmbeddedWallet.fromSecret(exportData.privateKey);
        if (!cancelled) {
          setWallet(workspaceWallet);
        }
      } catch {
        if (!cancelled) setWallet(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadToken, selectedWorkspaceId, user]);

  const value = useMemo<EmbeddedWalletContextValue>(
    () => ({
      wallet,
      loading,
      regenerateWallet() {
        setReloadToken((prev) => prev + 1);
      },
    }),
    [loading, wallet],
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
