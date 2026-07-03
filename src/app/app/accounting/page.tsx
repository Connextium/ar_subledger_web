"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import { useWorkspace } from "@/context/workspace-context";
import { useArSubledger } from "@/hooks/use-ar-subledger";
import type {
  BuyerLedgerRecord,
  LedgerRecord,
  WorkspaceBuyerLedgerLink,
  WorkspaceLedgerLink,
} from "@/lib/types/domain";
import {
  AccountingLedger,
  AccountingLedgerDiscoveryDebug,
  accountingEngineService,
  GlAccount,
  JournalEntry,
} from "@/lib/api-client/v1/accounting";
import { createApSubledgerService } from "@/lib/api-client/v1/buyer";
import { controlPlaneService } from "@/lib/api-client/v1/platform";

type LinkedSubLedger = {
  id: string;
  code: string;
  pubkey: string;
};

type BaseGlWithLinks = {
  pubkey: string;
  code: string;
  ledger: AccountingLedger;
  linkedSupplierLedgers: LinkedSubLedger[];
  linkedBuyerLedgers: LinkedSubLedger[];
  glAccounts: GlAccount[];
  recentEntries: JournalEntry[];
  totalAssets: bigint;
  totalLiabilities: bigint;
};

const STANDALONE_GL_PREFIX = "GL-";

function normalizeStandaloneGlCode(raw: string): string {
  const upper = raw.trim().toUpperCase();
  if (!upper) return "";
  if (upper.startsWith(STANDALONE_GL_PREFIX)) return upper;
  return `${STANDALONE_GL_PREFIX}${upper.replace(/^GL-?/, "")}`;
}

function formatAmount(amount: bigint) {
  return (Number(amount) / 100).toFixed(2);
}

function formatDate(timestamp: bigint) {
  return new Date(Number(timestamp) * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getCanonicalGlAccountName(code: number, currentName: string): string {
  if (code === 5000) return "Purchase Expense";
  if (code === 6500) return "Write-off Expense";
  return currentName;
}

function mapSupplierLinks(
  dbLedgers: WorkspaceLedgerLink[],
  arLedgerRows: LedgerRecord[],
): LinkedSubLedger[] {
  const dbByPda = new Map(dbLedgers.map((row) => [row.ledgerPda, row]));

  return arLedgerRows.map((row) => {
    const dbRow = dbByPda.get(row.pubkey);
    return {
      id: dbRow?.id ?? `supplier:${row.pubkey}`,
      code: dbRow?.ledgerCode ?? row.ledgerCode,
      pubkey: row.pubkey,
    };
  });
}

function mapBuyerLinks(buyerLedgerRows: BuyerLedgerRecord[]): LinkedSubLedger[] {
  return buyerLedgerRows.map((row) => ({
    id: `buyer:${row.pubkey}`,
    code: row.ledgerCode,
    pubkey: row.pubkey,
  }));
}

export default function AccountingHubPage() {
  const { selectedWorkspaceId, workspaces } = useWorkspace();
  const { wallet } = useEmbeddedWallet();
  const arSubledgerService = useArSubledger();
  const apSubledgerService = useMemo(() => (wallet ? createApSubledgerService(wallet) : null), [wallet]);

  const [baseGls, setBaseGls] = useState<BaseGlWithLinks[]>([]);
  const [selectedBaseGlPubkey, setSelectedBaseGlPubkey] = useState("");
  const [standaloneLedgerCode, setStandaloneLedgerCode] = useState("");
  const [standaloneCreatedPubkey, setStandaloneCreatedPubkey] = useState<string | null>(null);
  const [workspaceAccountingGls, setWorkspaceAccountingGls] = useState<AccountingLedger[]>([]);
  const [ledgerDiscoveryDebug, setLedgerDiscoveryDebug] = useState<AccountingLedgerDiscoveryDebug | null>(null);
  const [isCreatingStandaloneAccountingGl, setIsCreatingStandaloneAccountingGl] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeWorkspaceId = selectedWorkspaceId ?? workspaces[0]?.id ?? null;
  const selectedBaseGl = useMemo(
    () => baseGls.find((row) => row.pubkey === selectedBaseGlPubkey) ?? null,
    [baseGls, selectedBaseGlPubkey],
  );

  const loadBaseGlDetails = useCallback(async (rows: BaseGlWithLinks[], glPubkey: string) => {
    if (!glPubkey) {
      setBaseGls(rows);
      return;
    }

    try {
      const [glAccounts, journalEntries] = await Promise.all([
        accountingEngineService.listGlAccounts(glPubkey),
        accountingEngineService.listJournalEntries(glPubkey),
      ]);

      let totalAssets = BigInt(0);
      let totalLiabilities = BigInt(0);

      glAccounts.forEach((account: any) => {
        if (account.account.category === "Asset") {
          totalAssets += account.account.balance;
        } else if (account.account.category === "Liability") {
          totalLiabilities += account.account.balance;
        }
      });

      setBaseGls(
        rows.map((row) =>
          row.pubkey === glPubkey
            ? {
                ...row,
                glAccounts,
                recentEntries: journalEntries.slice(0, 5),
                totalAssets,
                totalLiabilities,
              }
            : row,
        ),
      );
    } catch (err) {
      console.error(`Error loading Base GL ${glPubkey}:`, err);
      setBaseGls(rows);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!activeWorkspaceId) {
      setError("No workspace selected");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const safe = async <T,>(operation: Promise<T>, fallback: T): Promise<T> => {
        try {
          return await operation;
        } catch {
          return fallback;
        }
      };

      const [baseAccountingGls, workspaceLedgerLinks, workspaceBuyerLinks, arLedgerRows, buyerLedgerRows] =
        (await Promise.all([
          safe(
            (async () => {
              const signerScoped =
                wallet
                  ? await accountingEngineService.listLedgersByAuthority({
                      workspaceId: activeWorkspaceId,
                      authority: wallet.publicKey,
                    })
                  : [];

              if (signerScoped.length > 0) {
                return signerScoped;
              }

              // Fallback to workspace-scope so buyers can still see Base GL created by workspace main wallet.
              return accountingEngineService.listLedgersByAuthority({ workspaceId: activeWorkspaceId });
            })(),
            [],
          ),
          safe(controlPlaneService.listLedgerLinks(activeWorkspaceId), []),
          safe(controlPlaneService.listBuyerLedgerLinks(activeWorkspaceId), []),
          arSubledgerService ? safe(arSubledgerService.listLedgers(activeWorkspaceId), []) : Promise.resolve([]),
          apSubledgerService ? safe(apSubledgerService.listBuyerLedgers(activeWorkspaceId), []) : Promise.resolve([]),
        ])) as [
          AccountingLedger[],
          WorkspaceLedgerLink[],
          WorkspaceBuyerLedgerLink[],
          LedgerRecord[],
          BuyerLedgerRecord[],
        ];

      if (wallet && baseAccountingGls.length === 0) {
        setLedgerDiscoveryDebug(await accountingEngineService.getLedgerDiscoveryDebug(wallet.publicKey));
      } else {
        setLedgerDiscoveryDebug(null);
      }

      const activeWorkspaceLedgerLinks = workspaceLedgerLinks.filter((link) => link.status === "active");
      const activeSupplierLedgerPdas = new Set(activeWorkspaceLedgerLinks.map((link) => link.ledgerPda));
      const activeBuyerLedgerPdas = new Set(
        workspaceBuyerLinks.filter((link) => link.status === "active").map((link) => link.ledgerPda),
      );
      const workspaceGlKeys = new Set<string>();

      activeWorkspaceLedgerLinks.forEach((link) => {
        if (link.onchainLedgerKey) workspaceGlKeys.add(link.onchainLedgerKey);
      });
      workspaceBuyerLinks.forEach((link) => {
        if (link.status === "active" && link.accountingLedgerKey) {
          workspaceGlKeys.add(link.accountingLedgerKey);
        }
      });

      const scopedArLedgerRows = arLedgerRows.filter((row) => activeSupplierLedgerPdas.has(row.pubkey));
      scopedArLedgerRows.forEach((row) => {
        if (row.accountingLedger) workspaceGlKeys.add(row.accountingLedger);
      });

      const scopedBuyerLedgerRows =
        activeBuyerLedgerPdas.size > 0
          ? buyerLedgerRows.filter((row) => activeBuyerLedgerPdas.has(row.pubkey))
          : buyerLedgerRows;
      scopedBuyerLedgerRows.forEach((row) => {
        if (row.accountingLedger) workspaceGlKeys.add(row.accountingLedger);
      });

      // Fallback: when link metadata is missing/stale, still show Base GLs owned by current workspace wallet.
      if (workspaceGlKeys.size === 0 && baseAccountingGls.length > 0) {
        baseAccountingGls.forEach((ledger) => {
          if (ledger.pubkey) {
            workspaceGlKeys.add(ledger.pubkey);
          }
        });
      }

      const availableGlByPubkey = new Map<string, AccountingLedger>(
        baseAccountingGls
          .map((ledger) => {
            const key = ledger.pubkey;
            return key ? ([key, ledger] as const) : null;
          })
          .filter((entry): entry is readonly [string, AccountingLedger] => Boolean(entry)),
      );
      const glByPubkey = new Map<string, AccountingLedger>();

      for (const key of workspaceGlKeys) {
        const ledger = availableGlByPubkey.get(key) ?? await accountingEngineService.getLedger(key);
        if (ledger) {
          glByPubkey.set(key, ledger);
        }
      }

      const supplierLinksByGl = new Map<string, LinkedSubLedger[]>();
      for (const row of scopedArLedgerRows) {
        if (!row.accountingLedger) continue;
        const links = supplierLinksByGl.get(row.accountingLedger) ?? [];
        links.push(mapSupplierLinks(activeWorkspaceLedgerLinks, [row])[0]);
        supplierLinksByGl.set(row.accountingLedger, links);
      }

      const buyerLinksByGl = new Map<string, LinkedSubLedger[]>();
      for (const row of scopedBuyerLedgerRows) {
        if (!row.accountingLedger) continue;
        const links = buyerLinksByGl.get(row.accountingLedger) ?? [];
        links.push(mapBuyerLinks([row])[0]);
        buyerLinksByGl.set(row.accountingLedger, links);
      }

      const nextBaseGls: BaseGlWithLinks[] = Array.from(glByPubkey.values())
        .sort((a, b) => (a.account?.ledgerCode || a.ledgerCode || "").localeCompare(b.account?.ledgerCode || b.ledgerCode || ""))
        .map((ledger) => {
          const pubkey = ledger.pubkey ?? "";
          return {
            pubkey,
            code: ledger.account?.ledgerCode || ledger.ledgerCode || pubkey,
            ledger,
            linkedSupplierLedgers: supplierLinksByGl.get(pubkey) ?? [],
            linkedBuyerLedgers: buyerLinksByGl.get(pubkey) ?? [],
            glAccounts: [],
            recentEntries: [],
            totalAssets: BigInt(0),
            totalLiabilities: BigInt(0),
          };
        });

      setWorkspaceAccountingGls(nextBaseGls.map((row) => row.ledger));

      const nextSelectedPubkey =
        selectedBaseGlPubkey && nextBaseGls.some((row) => row.pubkey === selectedBaseGlPubkey)
          ? selectedBaseGlPubkey
          : nextBaseGls[0]?.pubkey ?? "";

      setSelectedBaseGlPubkey(nextSelectedPubkey);
      await loadBaseGlDetails(nextBaseGls, nextSelectedPubkey);
    } catch (err) {
      console.error("Error loading accounting data:", err);
      setError(err instanceof Error ? err.message : "Failed to load accounting data");
    } finally {
      setIsLoading(false);
    }
  }, [
    activeWorkspaceId,
    apSubledgerService,
    arSubledgerService,
    loadBaseGlDetails,
    selectedBaseGlPubkey,
    wallet,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateStandaloneAccountingGl = useCallback(async () => {
    if (!wallet) {
      setError("Workspace wallet is not available. Configure wallet first.");
      return;
    }
    if (!activeWorkspaceId) {
      setError("Select a workspace before creating a Base GL.");
      return;
    }

    const normalizedCode = normalizeStandaloneGlCode(standaloneLedgerCode);
    if (!normalizedCode || normalizedCode === STANDALONE_GL_PREFIX) {
      setError("Ledger code is required after GL- prefix (example: GL-SG-2026).");
      return;
    }

    try {
      setError(null);
      setStandaloneCreatedPubkey(null);
      setIsCreatingStandaloneAccountingGl(true);
      const accountingLedgerPubkey = await accountingEngineService.initializeLedger(normalizedCode, wallet);
      await controlPlaneService.linkLedgerToWorkspace({
        workspaceId: activeWorkspaceId,
        ledgerPda: accountingLedgerPubkey,
        ledgerCode: normalizedCode,
        authorityPubkey: wallet.publicKey,
        onchainLedgerKey: accountingLedgerPubkey,
      });
      setStandaloneCreatedPubkey(accountingLedgerPubkey);
      setSelectedBaseGlPubkey(accountingLedgerPubkey);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create standalone Base GL.");
    } finally {
      setIsCreatingStandaloneAccountingGl(false);
    }
  }, [activeWorkspaceId, loadData, standaloneLedgerCode, wallet]);

  return (
    <div className="space-y-6">
      <PageTitle title="Base GL ( COA )" />

      {selectedBaseGl ? (
        <p className="mt-2 text-base font-semibold text-gray-800">
          Base GL ( COA ): <span className="font-mono">{selectedBaseGl.code}</span>
        </p>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-lg border bg-white p-4">
        <p className="text-sm font-semibold text-gray-900">Create Base GL ( COA )</p>
        <p className="mt-1 text-sm text-gray-600">
          Create the Base GL first, then link Buyer AP and Supplier AR ledgers to it.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <Input
            label="Ledger code"
            value={standaloneLedgerCode}
            placeholder="GL-{REGION}-{YYYY}"
            onChange={(event) => setStandaloneLedgerCode(normalizeStandaloneGlCode(event.target.value))}
          />
          <Button
            onClick={() => {
              void handleCreateStandaloneAccountingGl();
            }}
            disabled={!wallet || isCreatingStandaloneAccountingGl}
          >
            {isCreatingStandaloneAccountingGl ? "Creating Base GL..." : "Create Base GL"}
          </Button>
        </div>
        {standaloneCreatedPubkey ? (
          <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-xs font-semibold text-emerald-800">Base GL pubkey created</p>
            <p className="mt-1 font-mono text-xs text-emerald-700">{standaloneCreatedPubkey}</p>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : workspaceAccountingGls.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No Base GL found for current workspace wallet yet.</AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="rounded-lg border bg-gray-50 p-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">Select Base GL</label>
            <select
              value={selectedBaseGlPubkey}
              onChange={(event) => {
                const nextPubkey = event.target.value;
                setSelectedBaseGlPubkey(nextPubkey);
                void loadBaseGlDetails(baseGls, nextPubkey);
              }}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {baseGls.map((row) => (
                <option key={row.pubkey} value={row.pubkey}>
                  {row.code} ({row.pubkey})
                </option>
              ))}
            </select>
          </div>

          {selectedBaseGl ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <section className="rounded-lg border bg-white p-4">
                  <h3 className="text-sm font-semibold text-gray-900">Linked Supplier Ledgers</h3>
                  <div className="mt-3 space-y-2">
                    {selectedBaseGl.linkedSupplierLedgers.map((ledger) => (
                      <div key={ledger.id} className="rounded border border-slate-200 px-3 py-2">
                        <p className="text-sm font-medium text-slate-900">{ledger.code}</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">{ledger.pubkey}</p>
                      </div>
                    ))}
                    {selectedBaseGl.linkedSupplierLedgers.length === 0 ? (
                      <p className="text-sm text-slate-500">No Supplier AR ledgers linked.</p>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-lg border bg-white p-4">
                  <h3 className="text-sm font-semibold text-gray-900">Linked Buyer Ledgers</h3>
                  <div className="mt-3 space-y-2">
                    {selectedBaseGl.linkedBuyerLedgers.map((ledger) => (
                      <div key={ledger.id} className="rounded border border-slate-200 px-3 py-2">
                        <p className="text-sm font-medium text-slate-900">{ledger.code}</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">{ledger.pubkey}</p>
                      </div>
                    ))}
                    {selectedBaseGl.linkedBuyerLedgers.length === 0 ? (
                      <p className="text-sm text-slate-500">No Buyer AP ledgers linked.</p>
                    ) : null}
                  </div>
                </section>
              </div>

              {selectedBaseGl.glAccounts.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-lg border bg-white p-6">
                    <p className="text-sm font-medium text-gray-600">GL Accounts</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">{selectedBaseGl.glAccounts.length}</p>
                  </div>
                  <div className="rounded-lg border bg-white p-6">
                    <p className="text-sm font-medium text-gray-600">Total Assets</p>
                    <p className="mt-2 text-3xl font-bold text-green-600">{formatAmount(selectedBaseGl.totalAssets)}</p>
                  </div>
                  <div className="rounded-lg border bg-white p-6">
                    <p className="text-sm font-medium text-gray-600">Journal Entries</p>
                    <p className="mt-2 text-3xl font-bold text-blue-600">{selectedBaseGl.recentEntries.length}</p>
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    GL accounts not initialized. Go to Manage GL Accounting to initialize linked sub-ledger accounts.
                  </AlertDescription>
                </Alert>
              )}

              {selectedBaseGl.glAccounts.length > 0 ? (
                <div className="rounded-lg border">
                  <div className="border-b p-4">
                    <h3 className="font-semibold text-gray-900">GL Accounts</h3>
                  </div>
                  <table className="w-full">
                    <thead className="border-b bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Code</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Category</th>
                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedBaseGl.glAccounts.map((account) => (
                        <tr key={account.account.code} className="hover:bg-gray-50">
                          <td className="px-6 py-3 font-mono text-sm text-gray-900">{account.account.code}</td>
                          <td className="px-6 py-3 text-sm text-gray-900">
                            {getCanonicalGlAccountName(account.account.code, account.account.name)}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-600">{account.account.category}</td>
                          <td className="px-6 py-3 text-right font-mono text-sm text-gray-900">
                            {formatAmount(account.account.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {selectedBaseGl.recentEntries.length > 0 ? (
                <div className="rounded-lg border">
                  <div className="border-b p-4">
                    <h3 className="font-semibold text-gray-900">Recent Journal Entries</h3>
                  </div>
                  <table className="w-full">
                    <thead className="border-b bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">ID</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Reference</th>
                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedBaseGl.recentEntries.map((entry) => (
                        <tr key={Number(entry.account.entryId)} className="hover:bg-gray-50">
                          <td className="px-6 py-3 font-mono text-sm text-gray-900">{Number(entry.account.entryId)}</td>
                          <td className="px-6 py-3 text-sm text-gray-600">{formatDate(entry.account.postedAt)}</td>
                          <td className="px-6 py-3 text-sm text-gray-900">{entry.account.externalRef}</td>
                          <td className="px-6 py-3 text-right font-mono text-sm text-gray-900">
                            {formatAmount(entry.account.totalDebit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div className="flex gap-2">
                <Link
                  href={`/app/accounting/base-gl/${selectedBaseGl.pubkey}/manage`}
                  className="inline-block rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Manage GL Accounting
                </Link>
              </div>
            </>
          ) : null}
        </>
      )}

      {ledgerDiscoveryDebug ? (
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-slate-700">Discovery debug</p>
          <p className="mt-1 text-[11px] text-slate-600">Program: {ledgerDiscoveryDebug.programId}</p>
          <p className="text-[11px] text-slate-600">Memcmp hits: {ledgerDiscoveryDebug.memcmpHits}</p>
          <p className="text-[11px] text-slate-600">Scanned accounts: {ledgerDiscoveryDebug.scannedAccounts}</p>
          <p className="text-[11px] text-slate-600">Decoded ledger configs: {ledgerDiscoveryDebug.decodedLedgerConfigs}</p>
          <p className="text-[11px] text-slate-600">Authority matches: {ledgerDiscoveryDebug.authorityMatches}</p>
        </div>
      ) : null}
    </div>
  );
}
