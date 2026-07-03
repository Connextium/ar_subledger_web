"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useWorkspace } from "@/context/workspace-context";
import { supabase } from "@/lib/api-client/v1/session-client";
import { resolveApiBasePath } from "@/lib/api-client/v1/config";
import type { WorkspaceWallet } from "@/lib/types/wallet";

type EmbeddedWalletRef = {
  id: string;
  publicKey: string;
};

type EmbeddedWalletContextValue = {
  wallet: EmbeddedWalletRef | null;
  loading: boolean;
  regenerateWallet: () => void;
};

const EmbeddedWalletContext = createContext<EmbeddedWalletContextValue | null>(null);

export function EmbeddedWalletProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { selectedWorkspaceId } = useWorkspace();
  const [wallet, setWallet] = useState<EmbeddedWalletRef | null>(null);
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
          resolveApiBasePath(`/api/v1/platform/workspaces/${encodeURIComponent(selectedWorkspaceId)}/wallets`),
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

        const listData = (await listResponse.json()) as {
          data?: { wallets?: WorkspaceWallet[] };
          wallets?: WorkspaceWallet[];
        };
        const wallets = listData.data?.wallets ?? listData.wallets ?? [];
        const candidate =
          wallets.find((row) => row.isMain && row.status === "active") ?? null;

        if (!candidate) {
          if (!cancelled) setWallet(null);
          return;
        }

        if (!cancelled) {
          setWallet({
            id: candidate.id,
            publicKey: candidate.publicKey,
          });
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
