"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { PageTitle } from "@/components/ui/page-title";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle } from "lucide-react";
import {
  accountingEngineService,
  JournalEntry,
  GlAccount,
  AccountingLedger,
  AccountingLedgerDiscoveryDebug,
} from "@/services/accounting-engine-service";
import { useArSubledger } from "@/hooks/use-ar-subledger";
import { useWorkspace } from "@/context/workspace-context";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";

interface LedgerWithAccounting {
  id: string;
  code: string;
  ledgerPda: string;
  onchain_ledger_key: string | null;
  glAccounts: GlAccount[];
  recentEntries: JournalEntry[];
  totalAssets: bigint;
  totalLiabilities: bigint;
}

type WorkspaceLedgerRow = {
  id: string;
  ledger_code: string;
  ledger_pda: string;
  onchain_ledger_key: string | null;
};

const STANDALONE_GL_PREFIX = "GL-";

function normalizeStandaloneGlCode(raw: string): string {
  const upper = raw.trim().toUpperCase();
  if (!upper) return "";
  if (upper.startsWith(STANDALONE_GL_PREFIX)) return upper;
  return `${STANDALONE_GL_PREFIX}${upper.replace(/^GL-?/, "")}`;
}

export default function AccountingHubPage() {
  const { selectedWorkspaceId, workspaces } = useWorkspace();
  const { wallet } = useEmbeddedWallet();
  const arSubledgerService = useArSubledger();
  const [ledgers, setLedgers] = useState<LedgerWithAccounting[]>([]);
  const [selectedLedgerId, setSelectedLedgerId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [standaloneLedgerCode, setStandaloneLedgerCode] = useState("");
  const [standaloneCreatedPubkey, setStandaloneCreatedPubkey] = useState<string | null>(null);
  const [isCreatingStandaloneAccountingGl, setIsCreatingStandaloneAccountingGl] = useState(false);
  const [workspaceAccountingGls, setWorkspaceAccountingGls] = useState<AccountingLedger[]>([]);
  const [ledgerDiscoveryDebug, setLedgerDiscoveryDebug] = useState<AccountingLedgerDiscoveryDebug | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeWorkspaceId = selectedWorkspaceId ?? workspaces[0]?.id ?? null;

  // Load ledgers and accounting data
  const loadData = useCallback(async () => {
    if (!activeWorkspaceId) {
      setError("No workspace selected");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Load wallet-scoped Base GL first (independent of workspace ledger rows)
      const baseAccountingGls = wallet
        ? await accountingEngineService.listLedgersByAuthority(wallet.publicKey)
        : [];
      setWorkspaceAccountingGls(baseAccountingGls);
      if (wallet) {
        const debug = await accountingEngineService.getLedgerDiscoveryDebug(wallet.publicKey);
        setLedgerDiscoveryDebug(debug);
      } else {
        setLedgerDiscoveryDebug(null);
      }

      // Fetch all ledgers for workspace
      const { data: dbLedgers, error: ledgerError } = await supabase
        .from("ledgers")
        .select("id,ledger_code,ledger_pda,onchain_ledger_key")
        .eq("workspace_id", activeWorkspaceId);

      if (ledgerError) throw ledgerError;
      if (!dbLedgers || dbLedgers.length === 0) {
        setLedgers([]);
        setSelectedLedgerId("");
        return;
      }

      const typedLedgerRows = (dbLedgers ?? []) as WorkspaceLedgerRow[];

      const arLedgerAccountingByPda = new Map<string, string>();
      if (arSubledgerService) {
        const arLedgers = await arSubledgerService.listLedgers();
        for (const row of arLedgers) {
          if (row.accountingLedger) {
            arLedgerAccountingByPda.set(row.pubkey, row.accountingLedger);
          }
        }
      }

      const resolvedLedgerRows = typedLedgerRows.map((row) => ({
        ...row,
        onchain_ledger_key: row.onchain_ledger_key ?? arLedgerAccountingByPda.get(row.ledger_pda) ?? null,
      }));

      const mergeAccountingLedgers = async (rows: Array<{ onchain_ledger_key: string | null }>) => {
        const byPubkey = new Map<string, AccountingLedger>(
          baseAccountingGls.map((ledger) => [ledger.publicKey.toBase58(), ledger]),
        );

        const linkedKeys = Array.from(
          new Set(rows.map((row) => row.onchain_ledger_key).filter(Boolean) as string[]),
        );

        for (const key of linkedKeys) {
          if (byPubkey.has(key)) continue;
          const ledger = await accountingEngineService.getLedger(new PublicKey(key));
          if (ledger) {
            byPubkey.set(key, ledger);
          }
        }

        setWorkspaceAccountingGls(
          Array.from(byPubkey.values()).sort((a, b) =>
            (a.account.ledgerCode || "").localeCompare(b.account.ledgerCode || ""),
          ),
        );
      };

      // Load accounting data for each ledger
      const ledgersWithData: LedgerWithAccounting[] = [];

      for (const dbLedger of resolvedLedgerRows) {
        const baseRow: LedgerWithAccounting = {
          id: dbLedger.id,
          code: dbLedger.ledger_code,
          ledgerPda: dbLedger.ledger_pda,
          onchain_ledger_key: dbLedger.onchain_ledger_key,
          glAccounts: [],
          recentEntries: [],
          totalAssets: BigInt(0),
          totalLiabilities: BigInt(0),
        };

        if (!dbLedger.onchain_ledger_key) {
          ledgersWithData.push(baseRow);
          continue;
        }

        try {
          const ledgerKey = new PublicKey(dbLedger.onchain_ledger_key);

          const [glAccounts, journalEntries] = await Promise.all([
            accountingEngineService.listGlAccounts(ledgerKey),
            accountingEngineService.listJournalEntries(ledgerKey),
          ]);

          // Calculate totals
          let totalAssets = BigInt(0);
          let totalLiabilities = BigInt(0);

          glAccounts.forEach((acc) => {
            if (acc.account.category === "Asset") {
              totalAssets += acc.account.balance;
            } else if (acc.account.category === "Liability") {
              totalLiabilities += acc.account.balance;
            }
          });

          ledgersWithData.push({
            ...baseRow,
            glAccounts,
            recentEntries: journalEntries.slice(0, 5),
            totalAssets,
            totalLiabilities,
          });
        } catch (err) {
          console.error(`Error loading data for ledger ${dbLedger.ledger_code}:`, err);
          ledgersWithData.push(baseRow);
        }
      }

      setLedgers(ledgersWithData);
      if (ledgersWithData.length > 0 && !selectedLedgerId) {
        setSelectedLedgerId(ledgersWithData[0].id);
      }
      await mergeAccountingLedgers(resolvedLedgerRows as Array<{ onchain_ledger_key: string | null }>);
    } catch (err) {
      console.error("Error loading accounting data:", err);
      setError(err instanceof Error ? err.message : "Failed to load accounting data");
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, arSubledgerService, selectedLedgerId, wallet]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedLedger = useMemo(() => ledgers.find((l) => l.id === selectedLedgerId), [ledgers, selectedLedgerId]);

  const handleCreateStandaloneAccountingGl = useCallback(async () => {
    if (!wallet) {
      setError("Workspace wallet is not available. Configure wallet first.");
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
      const accountingLedgerPubkey = await accountingEngineService.initializeLedger(
        normalizedCode,
        wallet,
      );
      setStandaloneCreatedPubkey(accountingLedgerPubkey);
      setWorkspaceAccountingGls((current) => {
        if (current.some((row) => row.publicKey.toBase58() === accountingLedgerPubkey)) {
          return current;
        }
        return [
          ...current,
          {
            publicKey: new PublicKey(accountingLedgerPubkey),
            account: {
              authority: wallet.publicKey,
              ledgerCode: normalizedCode,
              journalEntryCount: BigInt(0),
              bump: 0,
            },
          },
        ].sort((a, b) => a.account.ledgerCode.localeCompare(b.account.ledgerCode));
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create standalone Base GL.");
    } finally {
      setIsCreatingStandaloneAccountingGl(false);
    }
  }, [loadData, standaloneLedgerCode, wallet]);

  const formatAmount = (amount: bigint) => {
    return (Number(amount) / 100).toFixed(2);
  };

  const formatDate = (timestamp: bigint) => {
    return new Date(Number(timestamp) * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">

      <PageTitle title="Base GL ( COA )" />
      {selectedLedger && (
        <p className="text-base font-semibold text-gray-800 mt-2">
          Base GL ( COA ) / Ledger: <span className="font-mono">{selectedLedger.code}</span>
        </p>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border p-4 bg-white">
        <p className="text-sm font-semibold text-gray-900">Create Base GL (No AR Ledger Required)</p>
        <p className="mt-1 text-sm text-gray-600">
          Use this to create Base GL first, then paste the generated pubkey when creating AR ledger in Subledger Protocol.
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

        <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-800">Base GL in Current Workspace Wallet</p>
          <p className="mt-1 text-[11px] text-slate-600">
            Current wallet:
            {wallet ? (
              <span className="ml-1 font-mono text-slate-700">{wallet.publicKey.toBase58()}</span>
            ) : (
              <span className="ml-1 text-amber-700">not available</span>
            )}
          </p>
          {workspaceAccountingGls.length === 0 ? (
            <div className="mt-1 space-y-2">
              <p className="text-xs text-slate-600">No Base GL found for current workspace wallet yet.</p>
              {ledgerDiscoveryDebug ? (
                <div className="rounded border border-slate-200 bg-white px-2 py-1.5">
                  <p className="text-[11px] font-semibold text-slate-700">Discovery debug</p>
                  <p className="mt-1 text-[11px] text-slate-600">Program: {ledgerDiscoveryDebug.programId}</p>
                  <p className="text-[11px] text-slate-600">Memcmp hits: {ledgerDiscoveryDebug.memcmpHits}</p>
                  <p className="text-[11px] text-slate-600">Scanned accounts: {ledgerDiscoveryDebug.scannedAccounts}</p>
                  <p className="text-[11px] text-slate-600">Decoded ledger configs: {ledgerDiscoveryDebug.decodedLedgerConfigs}</p>
                  <p className="text-[11px] text-slate-600">Authority matches: {ledgerDiscoveryDebug.authorityMatches}</p>
                  {ledgerDiscoveryDebug.scannedAccounts > 0 && ledgerDiscoveryDebug.decodedLedgerConfigs === 0 ? (
                    <p className="mt-1 text-[11px] text-amber-700">
                      Program-owned accounts exist but none decode as current GlConfig.
                      Verify the program ID and account layout match the current accounting_engine build.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <ul className="mt-2 space-y-2">
              {workspaceAccountingGls.map((ledger) => (
                <li key={ledger.publicKey.toBase58()} className="rounded border border-slate-200 bg-white px-2 py-1.5">
                  <p className="text-xs font-semibold text-slate-900">{ledger.account.ledgerCode}</p>
                  <p className="mt-1 font-mono text-[11px] text-slate-600">{ledger.publicKey.toBase58()}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : ledgers.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No ledgers found. Create a ledger first to get started with accounting.</AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Ledger Selector */}
          <div className="rounded-lg border p-4 bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Ledger</label>
            <select
              value={selectedLedgerId}
              onChange={(e) => setSelectedLedgerId(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ledgers.map((ledger) => (
                <option key={ledger.id} value={ledger.id}>
                  {ledger.code}
                </option>
              ))}
            </select>
          </div>

          {selectedLedger && (
            <>
              {/* GL Accounts Overview */}
              {selectedLedger.onchain_ledger_key && selectedLedger.glAccounts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border p-6 bg-white">
                    <p className="text-sm font-medium text-gray-600">GL Accounts</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">{selectedLedger.glAccounts.length}</p>
                  </div>
                  <div className="rounded-lg border p-6 bg-white">
                    <p className="text-sm font-medium text-gray-600">Total Assets</p>
                    <p className="mt-2 text-3xl font-bold text-green-600">
                      {formatAmount(selectedLedger.totalAssets)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-6 bg-white">
                    <p className="text-sm font-medium text-gray-600">Journal Entries</p>
                    <p className="mt-2 text-3xl font-bold text-blue-600">{selectedLedger.recentEntries.length}</p>
                  </div>
                </div>
              ) : selectedLedger.onchain_ledger_key ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>GL accounts not initialized. Go to the ledger&apos;s Accounting tab to initialize.</AlertDescription>
                </Alert>
              ) : null}

              {/* GL Accounts Table */}
              {selectedLedger.onchain_ledger_key && selectedLedger.glAccounts.length > 0 && (
                <div className="rounded-lg border">
                  <div className="border-b p-4">
                    <h3 className="font-semibold text-gray-900">GL Accounts</h3>
                  </div>
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Code</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Category</th>
                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedLedger.glAccounts.map((account) => (
                        <tr key={account.account.code} className="hover:bg-gray-50">
                          <td className="px-6 py-3 text-sm font-mono text-gray-900">{account.account.code}</td>
                          <td className="px-6 py-3 text-sm text-gray-900">{account.account.name}</td>
                          <td className="px-6 py-3 text-sm text-gray-600">{account.account.category}</td>
                          <td className="px-6 py-3 text-right text-sm font-mono text-gray-900">
                            {formatAmount(account.account.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Recent Journal Entries */}
              {selectedLedger.onchain_ledger_key && selectedLedger.recentEntries.length > 0 && (
                <div className="rounded-lg border">
                  <div className="border-b p-4">
                    <h3 className="font-semibold text-gray-900">Recent Journal Entries</h3>
                  </div>
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">ID</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Reference</th>
                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedLedger.recentEntries.map((entry) => (
                        <tr key={Number(entry.account.entryId)} className="hover:bg-gray-50">
                          <td className="px-6 py-3 text-sm font-mono text-gray-900">
                            <Link
                              href={`/app/accounting/entries/${selectedLedger.id}/${Number(entry.account.entryId)}`}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              {Number(entry.account.entryId)}
                            </Link>
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-600">
                            {formatDate(entry.account.postedAt)}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-900">{entry.account.externalRef}</td>
                          <td className="px-6 py-3 text-right text-sm font-mono text-gray-900">
                            {formatAmount(entry.account.totalDebit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Action Links */}
              {selectedLedger.onchain_ledger_key ? (
                <div className="flex gap-2">
                  <Link
                    href={`/app/ledgers/${selectedLedger.id}/accounting`}
                    className="inline-block rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Manage Base GL Accounting
                  </Link>
                  <Link
                    href={`/app/accounting/entries/${selectedLedger.id}`}
                    className="inline-block rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    View All Entries
                  </Link>
                </div>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}
