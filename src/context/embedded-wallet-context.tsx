"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { EmbeddedWallet } from "@/lib/solana/embedded-wallet";
import { useAuth } from "@/context/auth-context";
import { useWorkspace } from "@/context/workspace-context";
import { env } from "@/lib/config/env";
import { supabase } from "@/lib/supabase/client";
import type { WorkspaceWallet } from "@/lib/types/wallet";

const STORAGE_PREFIX = "ar:embedded-wallet";
const LEGACY_IMPORT_PREFIX = "ar:wallet-legacy-imported";

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
  const [fallbackWallet, setFallbackWallet] = useState<EmbeddedWallet | null>(null);

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
      const restored = EmbeddedWallet.fromSecret(existing);
      setFallbackWallet(restored);
      setWallet(restored);
      setLoading(false);
      return;
    }

    const nextWallet = EmbeddedWallet.create();
    window.localStorage.setItem(key, nextWallet.exportSecretKey());
    setFallbackWallet(nextWallet);
    setWallet(nextWallet);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!env.supabaseUrl || !env.supabaseAnonKey) return;
    if (!user || !selectedWorkspaceId) return;

    let cancelled = false;

    void (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        if (!accessToken || cancelled) return;

        if (fallbackWallet) {
          const importKey = `${LEGACY_IMPORT_PREFIX}:${user.id}:${selectedWorkspaceId}`;
          const imported = window.localStorage.getItem(importKey);
          if (!imported) {
            const importResponse = await fetch("/api/wallets/import-legacy", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                workspaceId: selectedWorkspaceId,
                privateKey: fallbackWallet.exportSecretKey(),
                setAsMain: true,
              }),
            });

            if (importResponse.ok) {
              window.localStorage.setItem(importKey, "1");
            }
          }
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
          if (!cancelled && fallbackWallet) setWallet(fallbackWallet);
          return;
        }

        const listData = (await listResponse.json()) as { wallets?: WorkspaceWallet[] };
        const candidate =
          listData.wallets?.find((row) => row.isMain && row.status === "active") ?? null;

        if (!candidate) {
          if (!cancelled && fallbackWallet) setWallet(fallbackWallet);
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
          if (!cancelled && fallbackWallet) setWallet(fallbackWallet);
          return;
        }

        const exportData = (await exportResponse.json()) as { privateKey?: string };
        if (!exportData.privateKey) {
          if (!cancelled && fallbackWallet) setWallet(fallbackWallet);
          return;
        }

        const workspaceWallet = EmbeddedWallet.fromSecret(exportData.privateKey);
        if (!cancelled) {
          setWallet(workspaceWallet);
        }
      } catch {
        if (!cancelled && fallbackWallet) {
          setWallet(fallbackWallet);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fallbackWallet, selectedWorkspaceId, user]);

  const value = useMemo<EmbeddedWalletContextValue>(
    () => ({
      wallet,
      loading,
      regenerateWallet() {
        if (!user) return;
        const key = `${STORAGE_PREFIX}:${user.id}`;
        const nextWallet = EmbeddedWallet.create();
        window.localStorage.setItem(key, nextWallet.exportSecretKey());
        setFallbackWallet(nextWallet);
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
