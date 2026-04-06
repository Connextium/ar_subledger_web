"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageTitle } from "@/components/ui/page-title";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/context/workspace-context";
import { useRoleGate } from "@/hooks/use-role-gate";
import { supabase } from "@/lib/supabase/client";
import { env } from "@/lib/config/env";
import type { WalletUsage, WorkspaceWallet } from "@/lib/types/wallet";
import { clampText } from "@/lib/utils/format";

const usageOptions: WalletUsage[] = [
  "main_operational",
  "registration_seed",
  "transaction_signer",
  "workspace_bootstrap",
  "ledger_initialize",
  "customer_initialize",
  "invoice_issue",
  "settlement_record",
  "emergency_fallback",
];

function formatSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(6);
}

async function getAuthToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export default function ConfigurationPage() {
  const { selectedWorkspaceId } = useWorkspace();
  const { canWriteTransactions } = useRoleGate();
  const [wallets, setWallets] = useState<WorkspaceWallet[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoRefreshedWorkspaceRef = useRef<string | null>(null);

  const [createUsage, setCreateUsage] = useState<WalletUsage>("transaction_signer");
  const [setAsMain, setSetAsMain] = useState(false);
  const [exportedPrivateKey, setExportedPrivateKey] = useState<string | null>(null);

  const mainWallet = useMemo(
    () => wallets.find((wallet) => wallet.isMain && wallet.status === "active") ?? null,
    [wallets],
  );

  const loadWallets = useCallback(async () => {
    if (!selectedWorkspaceId || !env.supabaseUrl || !env.supabaseAnonKey) {
      setWallets([]);
      return;
    }

    const token = await getAuthToken();
    if (!token) {
      setError("Authentication token is missing.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/wallets?workspaceId=${encodeURIComponent(selectedWorkspaceId)}`,
        {
          headers: {
            authorization: `Bearer ${token}`,
          },
        },
      );
      const data = (await response.json()) as { wallets?: WorkspaceWallet[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load wallets.");
      }
      setWallets(data.wallets ?? []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load wallets.");
    } finally {
      setLoading(false);
    }
  }, [selectedWorkspaceId]);

  useEffect(() => {
    void loadWallets();
  }, [loadWallets]);

  const requestBalanceRefresh = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!selectedWorkspaceId) return false;
      const token = await getAuthToken();
      if (!token) {
        if (!options?.silent) {
          setError("Authentication token is missing.");
        }
        return false;
      }

      if (!options?.silent) {
        setError(null);
      }

      const response = await fetch("/api/wallets/balances/refresh", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ workspaceId: selectedWorkspaceId }),
      });

      const data = (await response.json()) as { snapshots?: unknown[]; error?: string };
      if (!response.ok) {
        if (!options?.silent) {
          setError(data.error ?? "Failed to refresh balances.");
        }
        return false;
      }

      if (!options?.silent) {
        setMessage(`Balance refresh completed for ${data.snapshots?.length ?? 0} wallet(s).`);
      }

      await loadWallets();
      return true;
    },
    [loadWallets, selectedWorkspaceId],
  );

  useEffect(() => {
    if (!selectedWorkspaceId || !canWriteTransactions) return;
    if (autoRefreshedWorkspaceRef.current === selectedWorkspaceId) return;

    autoRefreshedWorkspaceRef.current = selectedWorkspaceId;
    void requestBalanceRefresh({ silent: true });
  }, [canWriteTransactions, requestBalanceRefresh, selectedWorkspaceId]);

  const createWallet = async () => {
    if (!selectedWorkspaceId) return;
    const token = await getAuthToken();
    if (!token) {
      setError("Authentication token is missing.");
      return;
    }

    setError(null);
    setMessage(null);
    setExportedPrivateKey(null);

    const response = await fetch("/api/wallets", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        workspaceId: selectedWorkspaceId,
        usage: createUsage,
        source: "rotate",
        setAsMain,
      }),
    });

    const data = (await response.json()) as { wallet?: WorkspaceWallet; error?: string };
    if (!response.ok) {
      setError(data.error ?? "Failed to create wallet.");
      return;
    }

    setMessage(`Created wallet ${clampText(data.wallet?.publicKey ?? "", 20)}.`);
    setSetAsMain(false);
    await loadWallets();
  };

  const setMainWallet = async (walletId: string) => {
    if (!selectedWorkspaceId) return;
    const token = await getAuthToken();
    if (!token) {
      setError("Authentication token is missing.");
      return;
    }

    setError(null);
    const response = await fetch("/api/wallets/main", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ workspaceId: selectedWorkspaceId, walletId }),
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Failed to set main wallet.");
      return;
    }

    setMessage("Main wallet updated.");
    await loadWallets();
  };

  const refreshBalances = async () => {
    await requestBalanceRefresh({ silent: false });
  };

  const exportWallet = async (walletId: string) => {
    if (!selectedWorkspaceId) return;
    const token = await getAuthToken();
    if (!token) {
      setError("Authentication token is missing.");
      return;
    }

    setError(null);
    const response = await fetch("/api/wallets/export", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ workspaceId: selectedWorkspaceId, walletId }),
    });
    const data = (await response.json()) as { privateKey?: string; error?: string };
    if (!response.ok) {
      setError(data.error ?? "Failed to export private key.");
      return;
    }

    setExportedPrivateKey(data.privateKey ?? null);
    setMessage("Private key exported (raw) for current stage workflow.");
  };

  return (
    <div className="space-y-4">
      <PageTitle
        title="Configuration"
        subtitle="Workspace wallet management and operational signer settings."
        actions={
          <Button variant="secondary" onClick={refreshBalances} disabled={!selectedWorkspaceId || !canWriteTransactions}>
            Refresh Balances
          </Button>
        }
      />

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
          {message}
        </p>
      ) : null}

      {!selectedWorkspaceId ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          Select a workspace from topbar to manage wallets.
        </p>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-900">Main Wallet</h2>
        {mainWallet ? (
          <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px]">
            <p className="font-semibold text-slate-900">{mainWallet.publicKey}</p>
            <p className="mt-1 text-slate-600">
              Usage: {mainWallet.usage} | Chain: {mainWallet.chain} | Status: {mainWallet.status}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-slate-500">No main wallet is set for this workspace.</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-900">Wallet Inventory</h2>
          <Button variant="ghost" onClick={() => void loadWallets()} disabled={loading}>
            {loading ? "Loading..." : "Reload"}
          </Button>
        </div>

        {wallets.length === 0 ? (
          <p className="text-[11px] text-slate-500">No wallets available for this workspace.</p>
        ) : (
          <div className="space-y-2">
            {wallets.map((wallet) => (
              <div key={wallet.id} className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px]">
                <p className="font-mono text-[10px] text-slate-800">{wallet.publicKey}</p>
                <p className="mt-1 text-slate-600">
                  {wallet.usage} | {wallet.source} | {wallet.status} {wallet.isMain ? "| MAIN" : ""}
                </p>
                <p className="mt-1 text-slate-600">
                  Balance: {typeof wallet.latestBalanceLamports === "number"
                    ? `${formatSol(wallet.latestBalanceLamports)} SOL (${wallet.latestBalanceLamports} lamports)`
                    : "Not refreshed yet"}
                  {wallet.latestBalanceObservedAt ? ` | Observed: ${new Date(wallet.latestBalanceObservedAt).toLocaleString()}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    disabled={!canWriteTransactions || wallet.isMain || wallet.status !== "active"}
                    onClick={() => void setMainWallet(wallet.id)}
                  >
                    Set Main
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={!canWriteTransactions || wallet.status !== "active"}
                    onClick={() => void exportWallet(wallet.id)}
                  >
                    Export Raw Private Key
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="create-wallet" className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-900">Create New Wallet</h2>
        <div className="mt-2 grid gap-2 md:grid-cols-1">
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
            <span>Usage</span>
            <select
              className="rounded-md border border-slate-300 bg-white px-2 py-2 text-xs text-slate-800"
              value={createUsage}
              onChange={(event) => setCreateUsage(event.target.value as WalletUsage)}
            >
              {usageOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-700">
          <input
            type="checkbox"
            checked={setAsMain}
            onChange={(event) => setSetAsMain(event.target.checked)}
          />
          Set as main wallet after create
        </label>

        <div className="mt-3">
          <Button disabled={!selectedWorkspaceId || !canWriteTransactions} onClick={createWallet}>
            Create Wallet
          </Button>
        </div>
      </section>

      {exportedPrivateKey ? (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-3 shadow-sm">
          <h2 className="text-xs font-semibold text-amber-900">Exported Private Key (Raw)</h2>
          <p className="mt-1 text-[11px] text-amber-800">
            Copy and store securely. This is shown for current-stage Option 3 workflow.
          </p>
          <p className="mt-2 break-all rounded border border-amber-300 bg-white p-2 font-mono text-[10px] text-slate-800">
            {exportedPrivateKey}
          </p>
        </section>
      ) : null}
    </div>
  );
}
