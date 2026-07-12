"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageTitle } from "@/components/ui/page-title";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/context/workspace-context";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import { useRoleGate } from "@/hooks/use-role-gate";
import { supabase } from "@/lib/api-client/v1/session-client";
import { resolveApiBasePath } from "@/lib/api-client/v1/config";
import { authApi } from "@/lib/api-client/v1/auth";
import { dispatchReloginRequired, RELOGIN_WARNING_MESSAGE } from "@/lib/auth/relogin-warning";
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

type ApiKeyRecord = {
  id: string;
  clientId: string;
  clientName: string | null;
  workspaceId: string;
  keyPrefix: string;
  status: string;
  createdAt: string;
  revokedAt: string | null;
};

type CreatedApiKeyState = {
  apiKey: string;
  keyPrefix: string;
  clientName: string | null;
} | null;

function formatSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(6);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeApiKeyRecord(record: unknown): ApiKeyRecord | null {
  if (!isRecord(record)) {
    return null;
  }

  const id = readString(record.id);
  const clientId = readString(record.clientId);
  const workspaceId = readString(record.workspaceId);
  const keyPrefix = readString(record.keyPrefix);

  if (!id || !clientId || !workspaceId || !keyPrefix) {
    return null;
  }

  return {
    id,
    clientId,
    clientName: readNullableString(record.clientName),
    workspaceId,
    keyPrefix,
    status: readString(record.status) || "unknown",
    createdAt: readString(record.createdAt),
    revokedAt: readNullableString(record.revokedAt),
  };
}

function parseApiKeyScopes(value: string): string[] {
  const scopes = value
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

  return scopes.length > 0 ? scopes : ["workspace:*"];
}

function normalizeCreatedApiKey(payload: { apiKey?: string; record?: unknown }): CreatedApiKeyState {
  if (!payload.apiKey || !isRecord(payload.record)) {
    return null;
  }

  return {
    apiKey: payload.apiKey,
    keyPrefix: readString(payload.record.keyPrefix),
    clientName: readNullableString(payload.record.clientName),
  };
}

async function getAuthToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function buildMutationHeaders(token: string): HeadersInit {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
    "x-request-id": `req_${crypto.randomUUID()}`,
    "idempotency-key": `idem_${crypto.randomUUID()}`,
  };
}

export default function ConfigurationPage() {
  const { selectedWorkspaceId, workspaces } = useWorkspace();
  const { regenerateWallet } = useEmbeddedWallet();
  const { canWriteTransactions } = useRoleGate();
  const [wallets, setWallets] = useState<WorkspaceWallet[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoRefreshedWorkspaceRef = useRef<string | null>(null);

  const [createUsage, setCreateUsage] = useState<WalletUsage>("transaction_signer");
  const [setAsMain, setSetAsMain] = useState(false);
  const [exportedPrivateKey, setExportedPrivateKey] = useState<string | null>(null);
  const [importPublicKey, setImportPublicKey] = useState("");
  const [importPrivateKey, setImportPrivateKey] = useState("");
  const [importSetAsMain, setImportSetAsMain] = useState(true);
  const [importingWallet, setImportingWallet] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [apiKeyName, setApiKeyName] = useState("Default API Client");
  const [apiKeyScopes, setApiKeyScopes] = useState("workspace:*");
  const [creatingApiKey, setCreatingApiKey] = useState(false);
  const [revokingApiKeyId, setRevokingApiKeyId] = useState<string | null>(null);
  const [createdApiKey, setCreatedApiKey] = useState<CreatedApiKeyState>(null);

  const activeWorkspaceId = selectedWorkspaceId ?? workspaces[0]?.id ?? null;
  const hasWorkspace = Boolean(activeWorkspaceId);

  const mainWallet = useMemo(
    () => wallets.find((wallet) => wallet.isMain && wallet.status === "active") ?? null,
    [wallets],
  );

  const canCreateWallet = hasWorkspace && (canWriteTransactions || wallets.length === 0);

  const loadWallets = useCallback(async () => {
    if (!activeWorkspaceId) {
      setWallets([]);
      return;
    }

    const token = await getAuthToken();
    if (!token) {
      setError(RELOGIN_WARNING_MESSAGE);
      dispatchReloginRequired();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        resolveApiBasePath(`/api/v1/platform/workspaces/${encodeURIComponent(activeWorkspaceId)}/wallets`),
        {
          headers: {
            authorization: `Bearer ${token}`,
          },
        },
      );
      const data = (await response.json()) as {
        data?: { wallets?: WorkspaceWallet[] };
        wallets?: WorkspaceWallet[];
        error?: { message?: string } | string;
      };
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Failed to load wallets.",
        );
      }
      setWallets(data.data?.wallets ?? data.wallets ?? []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load wallets.");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId]);

  const loadApiKeys = useCallback(async () => {
    if (!activeWorkspaceId) {
      setApiKeys([]);
      setCreatedApiKey(null);
      return;
    }

    const token = await getAuthToken();
    if (!token) {
      setError(RELOGIN_WARNING_MESSAGE);
      dispatchReloginRequired();
      return;
    }

    setApiKeysLoading(true);
    setError(null);
    try {
      const payload = await authApi.listApiKeys(activeWorkspaceId, token);
      setApiKeys(payload.apiKeys.map(normalizeApiKeyRecord).filter((record): record is ApiKeyRecord => record !== null));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load API keys.");
    } finally {
      setApiKeysLoading(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadWallets();
  }, [loadWallets]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadApiKeys();
  }, [loadApiKeys]);

  const requestBalanceRefresh = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!activeWorkspaceId) return false;
      const token = await getAuthToken();
      if (!token) {
        if (!options?.silent) {
          setError(RELOGIN_WARNING_MESSAGE);
        }
        dispatchReloginRequired();
        return false;
      }

      if (!options?.silent) {
        setError(null);
      }

      let response: Response;
      try {
        response = await fetch(resolveApiBasePath(`/api/v1/platform/workspaces/${encodeURIComponent(activeWorkspaceId)}/wallet-balances/refresh`), {
          method: "POST",
          headers: buildMutationHeaders(token),
          body: JSON.stringify({}),
        });
      } catch (error) {
        if (!options?.silent) {
          setError(error instanceof Error ? error.message : "Failed to refresh balances.");
        }
        return false;
      }

      const data = (await response.json()) as {
        data?: { snapshots?: unknown[] };
        snapshots?: unknown[];
        error?: { message?: string } | string;
      };
      if (!response.ok) {
        if (!options?.silent) {
          setError(
            typeof data.error === "string"
              ? data.error
              : data.error?.message ?? "Failed to refresh balances.",
          );
        }
        return false;
      }

      if (!options?.silent) {
        const snapshots = data.data?.snapshots ?? data.snapshots ?? [];
        setMessage(`Balance refresh completed for ${snapshots.length} wallet(s).`);
      }

      await loadWallets();
      return true;
    },
    [activeWorkspaceId, loadWallets],
  );

  useEffect(() => {
    if (!activeWorkspaceId || !canWriteTransactions) return;
    if (autoRefreshedWorkspaceRef.current === activeWorkspaceId) return;

    autoRefreshedWorkspaceRef.current = activeWorkspaceId;
    void requestBalanceRefresh({ silent: true });
  }, [activeWorkspaceId, canWriteTransactions, requestBalanceRefresh]);

  useEffect(() => {
    if (!activeWorkspaceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSetAsMain(false);
      return;
    }

    if (wallets.length === 0) {
      setSetAsMain(true);
      setImportSetAsMain(true);
    }
  }, [activeWorkspaceId, wallets.length]);

  const createWallet = async () => {
    if (!activeWorkspaceId) return;
    const token = await getAuthToken();
    if (!token) {
      setError(RELOGIN_WARNING_MESSAGE);
      dispatchReloginRequired();
      return;
    }

    setError(null);
    setMessage(null);
    setExportedPrivateKey(null);

    const response = await fetch(resolveApiBasePath(`/api/v1/platform/workspaces/${encodeURIComponent(activeWorkspaceId)}/wallets`), {
      method: "POST",
      headers: buildMutationHeaders(token),
      body: JSON.stringify({
        usage: createUsage,
        source: "rotate",
        setAsMain,
      }),
    });

    const data = (await response.json()) as {
      data?: { wallet?: WorkspaceWallet };
      wallet?: WorkspaceWallet;
      error?: { message?: string } | string;
    };
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : data.error?.message ?? "Failed to create wallet.");
      return;
    }

    const wallet = data.data?.wallet ?? data.wallet;
    setMessage(`Created wallet ${clampText(wallet?.publicKey ?? "", 20)}.`);
    setSetAsMain(false);
    await loadWallets();
    regenerateWallet();
  };

  const importWallet = async () => {
    if (!activeWorkspaceId || importingWallet) return;

    const publicKey = importPublicKey.trim();
    const privateKey = importPrivateKey.trim();
    if (!publicKey || !privateKey) {
      setError("Public key and private key are required.");
      return;
    }

    const token = await getAuthToken();
    if (!token) {
      setError(RELOGIN_WARNING_MESSAGE);
      dispatchReloginRequired();
      return;
    }

    setImportingWallet(true);
    setError(null);
    setMessage(null);
    setExportedPrivateKey(null);

    try {
      const response = await fetch(resolveApiBasePath(`/api/v1/platform/workspaces/${encodeURIComponent(activeWorkspaceId)}/wallets/import`), {
        method: "POST",
        headers: buildMutationHeaders(token),
        body: JSON.stringify({
          publicKey,
          privateKey,
          setAsMain: importSetAsMain,
        }),
      });

      const data = (await response.json()) as {
        data?: { wallet?: WorkspaceWallet };
        wallet?: WorkspaceWallet;
        error?: { message?: string } | string;
      };
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Failed to import wallet.",
        );
      }

      const wallet = data.data?.wallet ?? data.wallet;
      setMessage(`Imported wallet ${clampText(wallet?.publicKey ?? publicKey, 20)}.`);
      setImportPublicKey("");
      setImportPrivateKey("");
      setImportSetAsMain(false);
      await loadWallets();
      regenerateWallet();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to import wallet.");
    } finally {
      setImportingWallet(false);
    }
  };

  const setMainWallet = async (walletId: string) => {
    if (!activeWorkspaceId) return;
    const token = await getAuthToken();
    if (!token) {
      setError(RELOGIN_WARNING_MESSAGE);
      dispatchReloginRequired();
      return;
    }

    setError(null);
    const response = await fetch(resolveApiBasePath(`/api/v1/platform/workspaces/${encodeURIComponent(activeWorkspaceId)}/wallets/${encodeURIComponent(walletId)}/main`), {
      method: "POST",
      headers: buildMutationHeaders(token),
      body: JSON.stringify({}),
    });

    const data = (await response.json()) as { error?: { message?: string } | string };
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : data.error?.message ?? "Failed to set main wallet.");
      return;
    }

    setMessage("Main wallet updated.");
    await loadWallets();
    regenerateWallet();
  };

  const refreshBalances = async () => {
    await requestBalanceRefresh({ silent: false });
  };

  const createApiKey = async () => {
    if (!activeWorkspaceId || creatingApiKey) return;

    const token = await getAuthToken();
    if (!token) {
      setError(RELOGIN_WARNING_MESSAGE);
      dispatchReloginRequired();
      return;
    }

    setCreatingApiKey(true);
    setCreatedApiKey(null);
    setError(null);
    setMessage(null);

    try {
      const payload = await authApi.createApiKey(
        {
          workspaceId: activeWorkspaceId,
          name: apiKeyName.trim() || "Default API Client",
          scopes: parseApiKeyScopes(apiKeyScopes),
        },
        token,
      );

      const nextCreatedApiKey = normalizeCreatedApiKey(payload);
      if (!nextCreatedApiKey) {
        throw new Error("API key was created, but the response did not include a raw key.");
      }

      setCreatedApiKey(nextCreatedApiKey);
      setMessage("API key created. Copy now; the raw key is shown once and will not be stored by the web app.");
      await loadApiKeys();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to create API key.");
    } finally {
      setCreatingApiKey(false);
    }
  };

  const copyCreatedApiKey = async () => {
    if (!createdApiKey) return;

    try {
      await navigator.clipboard.writeText(createdApiKey.apiKey);
      setMessage("API key copied to clipboard.");
      setError(null);
    } catch {
      setError("Clipboard copy failed. Manually copy the visible API key before dismissing it.");
    }
  };

  const dismissCreatedApiKey = () => {
    setCreatedApiKey(null);
  };

  const revokeApiKey = async (keyId: string) => {
    if (!activeWorkspaceId || revokingApiKeyId) return;

    if (!window.confirm("Revoke this API key? Existing integrations using it will stop authenticating.")) {
      return;
    }

    const token = await getAuthToken();
    if (!token) {
      setError(RELOGIN_WARNING_MESSAGE);
      dispatchReloginRequired();
      return;
    }

    setRevokingApiKeyId(keyId);
    setError(null);
    setMessage(null);

    try {
      await authApi.revokeApiKey(keyId, token);
      setMessage("API key revoked.");
      await loadApiKeys();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to revoke API key.");
    } finally {
      setRevokingApiKeyId(null);
    }
  };

  const exportWallet = async (walletId: string) => {
    if (!activeWorkspaceId) return;
    const token = await getAuthToken();
    if (!token) {
      setError(RELOGIN_WARNING_MESSAGE);
      dispatchReloginRequired();
      return;
    }

    setError(null);
    const response = await fetch(resolveApiBasePath(`/api/v1/platform/workspaces/${encodeURIComponent(activeWorkspaceId)}/wallets/${encodeURIComponent(walletId)}/export`), {
      method: "POST",
      headers: buildMutationHeaders(token),
      body: JSON.stringify({}),
    });
    const data = (await response.json()) as {
      data?: { privateKey?: string };
      privateKey?: string;
      error?: { message?: string } | string;
    };
    if (!response.ok) {
      setError(
        typeof data.error === "string"
          ? data.error
          : data.error?.message ?? "Failed to export private key.",
      );
      return;
    }

    setExportedPrivateKey(data.data?.privateKey ?? data.privateKey ?? null);
    setMessage("Private key exported (raw) for current stage workflow.");
  };

  return (
    <div className="space-y-4">
      <PageTitle
        title="Configuration"
        subtitle="Step 1: create/select workspace. Step 2: create wallet."
        actions={
          <Button variant="secondary" onClick={refreshBalances} disabled={!activeWorkspaceId || !canWriteTransactions}>
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

      {!activeWorkspaceId ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          Create a workspace first (topbar), then create a wallet.
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

      <section id="api-keys" className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-semibold text-slate-900">API Keys</h2>
            <p className="mt-1 text-[11px] text-slate-600">
              Workspace-scoped service keys for integrations. Raw keys are shown once after creation.
            </p>
          </div>
          <Button variant="ghost" onClick={() => void loadApiKeys()} disabled={!hasWorkspace || apiKeysLoading}>
            {apiKeysLoading ? "Loading..." : "Reload"}
          </Button>
        </div>

        {!hasWorkspace ? (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-700">
            Workspace is required before API key management.
          </p>
        ) : null}

        <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
            <span>Client Name</span>
            <input
              className="rounded-md border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
              value={apiKeyName}
              onChange={(event) => setApiKeyName(event.target.value)}
              placeholder="ERP integration"
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
            <span>Scopes</span>
            <input
              className="rounded-md border border-slate-300 bg-slate-50 px-2.5 py-2 font-mono text-xs text-slate-900 outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
              value={apiKeyScopes}
              onChange={(event) => setApiKeyScopes(event.target.value)}
              placeholder="workspace:*"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <Button
            disabled={!hasWorkspace || !canWriteTransactions || creatingApiKey}
            onClick={createApiKey}
          >
            {creatingApiKey ? "Creating..." : "Create API Key"}
          </Button>
        </div>

        {createdApiKey ? (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <h3 className="text-xs font-semibold text-amber-900">Copy now. This raw key will not be shown again.</h3>
            <p className="mt-1 text-[11px] text-amber-800">
              Client: {createdApiKey.clientName ?? "Unnamed client"} | Prefix: {createdApiKey.keyPrefix || "-"}
            </p>
            <p className="mt-2 break-all rounded border border-amber-300 bg-white p-2 font-mono text-[10px] text-slate-800">
              {createdApiKey.apiKey}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void copyCreatedApiKey()}>
                Copy Key
              </Button>
              <Button variant="ghost" onClick={dismissCreatedApiKey}>
                Dismiss
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-3 space-y-2">
          {apiKeys.length === 0 ? (
            <p className="text-[11px] text-slate-500">
              {apiKeysLoading ? "Loading API keys..." : "No API keys have been created for this workspace."}
            </p>
          ) : (
            apiKeys.map((apiKey) => (
              <div key={apiKey.id} className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-[10px] font-semibold text-slate-900">{apiKey.keyPrefix}</p>
                    <p className="mt-1 text-slate-600">
                      {apiKey.clientName ?? "Unnamed client"} | Status: {apiKey.status}
                    </p>
                    <p className="mt-1 text-slate-600">
                      Created: {apiKey.createdAt ? new Date(apiKey.createdAt).toLocaleString() : "-"}
                      {apiKey.revokedAt ? ` | Revoked: ${new Date(apiKey.revokedAt).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    disabled={!canWriteTransactions || apiKey.status !== "active" || revokingApiKeyId === apiKey.id}
                    onClick={() => void revokeApiKey(apiKey.id)}
                  >
                    {revokingApiKeyId === apiKey.id ? "Revoking..." : "Revoke"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
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

      <section id="import-wallet" className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-900">Import Wallet</h2>
        {!hasWorkspace ? (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-700">
            Workspace is required before wallet import.
          </p>
        ) : null}
        <div className="mt-2 grid gap-2">
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
            <span>Public Key</span>
            <input
              className="rounded-md border border-slate-300 bg-slate-50 px-2.5 py-2 font-mono text-xs text-slate-900 outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
              value={importPublicKey}
              onChange={(event) => setImportPublicKey(event.target.value)}
              placeholder="Wallet public key"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
            <span>Private Key</span>
            <textarea
              className="min-h-24 resize-y rounded-md border border-slate-300 bg-slate-50 px-2.5 py-2 font-mono text-xs text-slate-900 outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
              value={importPrivateKey}
              onChange={(event) => setImportPrivateKey(event.target.value)}
              placeholder="Base58 encoded private key"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        </div>

        <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-700">
          <input
            type="checkbox"
            checked={importSetAsMain}
            onChange={(event) => setImportSetAsMain(event.target.checked)}
          />
          Set as main wallet after import
        </label>

        <div className="mt-3">
          <Button
            disabled={!hasWorkspace || !canWriteTransactions || importingWallet}
            onClick={importWallet}
          >
            {importingWallet ? "Importing..." : "Import Wallet"}
          </Button>
        </div>
      </section>

      <section id="create-wallet" className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-900">Create New Wallet</h2>
        {!hasWorkspace ? (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-700">
            Workspace is required before wallet creation.
          </p>
        ) : null}
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
          <Button disabled={!canCreateWallet} onClick={createWallet}>
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
