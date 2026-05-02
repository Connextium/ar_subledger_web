"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SearchBar } from "@/components/records/search-bar";
import { PageTitle } from "@/components/ui/page-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useArSubledger } from "@/hooks/use-ar-subledger";
import { useWorkspace } from "@/context/workspace-context";
import { useWorkingContext } from "@/context/working-context";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import { useRoleGate } from "@/hooks/use-role-gate";
import { controlPlaneService } from "@/services/control-plane-service";
import { accountingEngineService } from "@/services/accounting-engine-service";
import { initializeLedgerSchema } from "@/lib/validation/schemas";
import type { LedgerRecord, WorkspaceLedgerLink } from "@/lib/types/domain";
import { clampText } from "@/lib/utils/format";

const DEFAULT_INIT_LEDGER_CODE = "";

export default function LedgersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const service = useArSubledger();
  const { wallet } = useEmbeddedWallet();
  const { canManageWorkspace } = useRoleGate();
  const { selectedWorkspaceId, refresh: refreshWorkspace, ledgerLinks } = useWorkspace();
  const { workspaceId, ledgerPda, customerId, setLedgerPda, setCustomerId } = useWorkingContext();

  const workspaceFromQuery = searchParams.get("workspace");
  const activeWorkspaceId = selectedWorkspaceId ?? workspaceId ?? workspaceFromQuery;

  const [rows, setRows] = useState<LedgerRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [localSelectedLedgerPda, setLocalSelectedLedgerPda] = useState<string | null>(null);
  const [initLedgerCode, setInitLedgerCode] = useState(DEFAULT_INIT_LEDGER_CODE);
  const [initAccountingLedgerPubkey, setInitAccountingLedgerPubkey] = useState("");
  const [initArControlAccountCode, setInitArControlAccountCode] = useState("1100");
  const [initRevenueAccountCode, setInitRevenueAccountCode] = useState("4000");
  const [initCashAccountCode, setInitCashAccountCode] = useState("1000");
  const [initWriteoffExpenseAccountCode, setInitWriteoffExpenseAccountCode] = useState("6500");
  const [isInitializingNewLedgerMode, setIsInitializingNewLedgerMode] = useState(false);
  const [initializingLedger, setInitializingLedger] = useState(false);
  const [accountingGlOptions, setAccountingGlOptions] = useState<Array<{ value: string; label: string; code: string }>>([]);
  const [formCode, setFormCode] = useState("");
  const [customersByLedger, setCustomersByLedger] = useState<
    Array<{
      id: string;
      customerRef: string;
      legalName: string;
      onchainCustomerPubkey: string;
      customerCode: string;
      status: "active" | "inactive";
    }>
  >([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [allAccessibleLedgerLinks, setAllAccessibleLedgerLinks] = useState<WorkspaceLedgerLink[]>([]);

  const refreshAccessibleLedgerLinks = useCallback(async () => {
    const links = await controlPlaneService.listAccessibleLedgerLinks();
    setAllAccessibleLedgerLinks(links);
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!service) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [nextRows] = await Promise.all([
          service.listLedgers(),
          refreshAccessibleLedgerLinks(),
        ]);
        setRows(nextRows);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [service, refreshAccessibleLedgerLinks]);

  useEffect(() => {
    const run = async () => {
      if (!wallet) {
        setAccountingGlOptions([]);
        return;
      }

      const accountingGls = await accountingEngineService.listLedgersByAuthority(wallet.publicKey);
      const nextOptions = accountingGls.map((ledger) => {
        const pubkey = ledger.publicKey.toBase58();
        const code = ledger.account.ledgerCode || "";
        return {
          value: pubkey,
          label: `${code || "(no code)"} (${pubkey})`,
          code,
        };
      });

      setAccountingGlOptions(nextOptions);
      if (!initAccountingLedgerPubkey && nextOptions.length > 0) {
        setInitAccountingLedgerPubkey(nextOptions[0].value);
      }
    };

    void run();
  }, [initAccountingLedgerPubkey, wallet]);

  useEffect(() => {
    void refreshAccessibleLedgerLinks();
  }, [activeWorkspaceId, refreshAccessibleLedgerLinks]);

  const linkedSet = useMemo(
    () =>
      new Set(
        ledgerLinks
          .filter(
            (row) =>
              (activeWorkspaceId ? row.workspaceId === activeWorkspaceId : true) &&
              row.status === "active",
          )
          .map((row) => row.ledgerPda),
      ),
    [activeWorkspaceId, ledgerLinks],
  );

  const inactiveLinkedSet = useMemo(
    () =>
      new Set(
        ledgerLinks
          .filter(
            (row) =>
              (activeWorkspaceId ? row.workspaceId === activeWorkspaceId : true) &&
              row.status === "inactive",
          )
          .map((row) => row.ledgerPda),
      ),
    [activeWorkspaceId, ledgerLinks],
  );

  const ledgerLinkByPda = useMemo(
    () =>
      new Map(
        ledgerLinks
          .filter((row) => (activeWorkspaceId ? row.workspaceId === activeWorkspaceId : true))
          .map((row) => [row.ledgerPda, row]),
      ),
    [activeWorkspaceId, ledgerLinks],
  );

  const getDisplayLedgerCode = useCallback(
    (_ledgerPdaValue: string, onchainLedgerCode: string) => onchainLedgerCode,
    [],
  );

  const duplicateCodeSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = getDisplayLedgerCode(row.pubkey, row.ledgerCode).trim().toUpperCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([code]) => code),
    );
  }, [getDisplayLedgerCode, rows]);

  const workspaceScopedRows = useMemo(() => {
    if (!activeWorkspaceId) return [];

    const workspaceLinks = ledgerLinks.filter((row) => row.workspaceId === activeWorkspaceId);
    const rowByPda = new Map(rows.map((row) => [row.pubkey, row]));

    return workspaceLinks.map((link) => {
      const onchain = rowByPda.get(link.ledgerPda);
      if (onchain) return onchain;
      return {
        pubkey: link.ledgerPda,
        authority: link.authorityPubkey,
        ledgerCode: link.ledgerCode,
        accountingLedger: "",
        arControlAccountCode: 0,
        revenueAccountCode: 0,
        cashAccountCode: 0,
        writeoffExpenseAccountCode: 0,
        nextJournalEntryId: 0,
        customerCount: 0,
        invoiceCount: 0,
      };
    });
  }, [activeWorkspaceId, ledgerLinks, rows]);

  const filtered = workspaceScopedRows.filter((row) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const displayLedgerCode = getDisplayLedgerCode(row.pubkey, row.ledgerCode).toLowerCase();
    return displayLedgerCode.includes(q) || row.pubkey.toLowerCase().includes(q);
  });

  const selectedLedgerPubkey = localSelectedLedgerPda ?? ledgerPda;

  const selectedLedger = useMemo(
    () => workspaceScopedRows.find((row) => row.pubkey === selectedLedgerPubkey) ?? null,
    [selectedLedgerPubkey, workspaceScopedRows],
  );

  const selectedLink = useMemo(
    () => (selectedLedger ? ledgerLinkByPda.get(selectedLedger.pubkey) ?? null : null),
    [ledgerLinkByPda, selectedLedger],
  );

  const selectedDisplayLedgerCode = useMemo(
    () =>
      selectedLedger
        ? getDisplayLedgerCode(selectedLedger.pubkey, selectedLedger.ledgerCode)
        : null,
    [getDisplayLedgerCode, selectedLedger],
  );

  const selectedLedgerHasDuplicateCode = useMemo(
    () =>
      selectedDisplayLedgerCode
        ? duplicateCodeSet.has(selectedDisplayLedgerCode.trim().toUpperCase())
        : false,
    [duplicateCodeSet, selectedDisplayLedgerCode],
  );

  const activeOwnerWorkspaceIdsByLedgerPda = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const row of allAccessibleLedgerLinks) {
      if (row.status !== "active") continue;
      const existing = map.get(row.ledgerPda) ?? new Set<string>();
      existing.add(row.workspaceId);
      map.set(row.ledgerPda, existing);
    }
    return map;
  }, [allAccessibleLedgerLinks]);

  const selectedLedgerOwnedByAnotherWorkspace = useMemo(() => {
    if (!selectedLedger) return false;
    const ownerWorkspaceIds = activeOwnerWorkspaceIdsByLedgerPda.get(selectedLedger.pubkey);
    if (!ownerWorkspaceIds || ownerWorkspaceIds.size === 0) return false;
    if (!activeWorkspaceId) return false;
    return Array.from(ownerWorkspaceIds).some((workspace) => workspace !== activeWorkspaceId);
  }, [activeOwnerWorkspaceIdsByLedgerPda, activeWorkspaceId, selectedLedger]);

  const canActivateSelectedLedgerInWorkspace = useMemo(() => {
    if (!selectedLedger) return false;
    if (!selectedLedgerOwnedByAnotherWorkspace) return true;
    return linkedSet.has(selectedLedger.pubkey);
  }, [linkedSet, selectedLedger, selectedLedgerOwnedByAnotherWorkspace]);

  const defaultLedgerPubkey = useMemo(() => {
    if (activeWorkspaceId) {
      const firstLinked = filtered.find((row) => linkedSet.has(row.pubkey));
      return firstLinked?.pubkey ?? null;
    }
    return filtered[0]?.pubkey ?? null;
  }, [activeWorkspaceId, filtered, linkedSet]);

  useEffect(() => {
    if (isInitializingNewLedgerMode) return;
    if (!selectedLedgerPubkey && defaultLedgerPubkey) {
      setLocalSelectedLedgerPda(defaultLedgerPubkey);
      setLedgerPda(defaultLedgerPubkey);
    }
  }, [defaultLedgerPubkey, isInitializingNewLedgerMode, selectedLedgerPubkey, setLedgerPda]);

  useEffect(() => {
    if (!localSelectedLedgerPda) return;
    if (!workspaceScopedRows.some((row) => row.pubkey === localSelectedLedgerPda)) {
      if (ledgerPda === localSelectedLedgerPda) {
        setLedgerPda(null);
      }
      setLocalSelectedLedgerPda(null);
    }
  }, [ledgerPda, localSelectedLedgerPda, setLedgerPda, workspaceScopedRows]);

  useEffect(() => {
    if (!selectedLedger) {
      setFormCode("");
      return;
    }
    setFormCode(selectedLedger.ledgerCode);
  }, [selectedLedger]);

  useEffect(() => {
    const scopeLedgerPda = selectedLedger?.pubkey ?? null;
    if (!activeWorkspaceId || !scopeLedgerPda) {
      setCustomersByLedger([]);
      setLoadingCustomers(false);
      return;
    }

    let cancelled = false;
    setLoadingCustomers(true);

    void (async () => {
      try {
        const [customers, links] = await Promise.all([
          controlPlaneService.listWorkspaceCustomers(activeWorkspaceId),
          controlPlaneService.listWorkspaceCustomerLedgerLinks({
            workspaceId: activeWorkspaceId,
          }),
        ]);

        if (cancelled) return;

        const customerMap = new Map(customers.map((row) => [row.id, row]));
        const scoped = links
          .filter((row) => row.ledgerPda === scopeLedgerPda)
          .map((link) => {
            const customer = customerMap.get(link.workspaceCustomerId);
            return {
              id: customer?.id ?? link.workspaceCustomerId,
              customerRef: customer?.customerRef ?? link.customerCode,
              legalName: customer?.legalName ?? "(customer master missing)",
              onchainCustomerPubkey: link.onchainCustomerPubkey,
              customerCode: link.customerCode,
              status: link.status,
            };
          })
          .filter((row): row is NonNullable<typeof row> => Boolean(row));

        setCustomersByLedger(scoped);
      } finally {
        if (!cancelled) {
          setLoadingCustomers(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, selectedLedger?.pubkey]);

  return (
    <div className="space-y-3">
      <PageTitle
        title="Ledgers"
        subtitle="3-pane contextual ledger workspace: choose ledger, review linked customers, then add/edit workspace ledger link."
        actions={
          <Button
            onClick={() => {
              setIsInitializingNewLedgerMode(true);
              setLocalSelectedLedgerPda(null);
              setLedgerPda(null);
              setCustomerId(null);
              setFormCode("");
              setInitLedgerCode(DEFAULT_INIT_LEDGER_CODE);
              setMessage(null);
              document.getElementById("initialize-ledger-form")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
          >
            Initialize New Ledger
          </Button>
        }
      />

      {message ? (
        <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
          {message}
        </p>
      ) : null}

      <div className="mb-3 flex items-center justify-between gap-3">
        <SearchBar
          label="Search ledger"
          value={search}
          onChange={setSearch}
          placeholder="Code or PDA..."
        />
        <p className="text-[11px] text-slate-500">
          {loading ? "Loading..." : `${filtered.length} ledger(s)`}
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-12">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:col-span-4">
          <header className="border-b border-slate-200 bg-slate-50 px-3 py-2">
            <h2 className="text-xs font-semibold text-slate-800">Ledgers</h2>
          </header>
          <div className="max-h-[620px] overflow-auto p-2">
            {filtered.length === 0 ? (
              <p className="px-2 py-4 text-xs text-slate-500">
                {activeWorkspaceId ? "No ledgers found in this workspace." : "Select a workspace to view ledgers."}
              </p>
            ) : (
              <div className="space-y-2">
                {filtered.map((row) => {
                  const selected = row.pubkey === selectedLedger?.pubkey;
                  const linked = linkedSet.has(row.pubkey);
                  const inactiveLinked = inactiveLinkedSet.has(row.pubkey);
                  const ownerWorkspaceIds = activeOwnerWorkspaceIdsByLedgerPda.get(row.pubkey);
                  const ownedByAnotherWorkspace =
                    Boolean(ownerWorkspaceIds) &&
                    Boolean(activeWorkspaceId) &&
                    Array.from(ownerWorkspaceIds ?? []).some((workspace) => workspace !== activeWorkspaceId);
                  const disabled = inactiveLinked || (ownedByAnotherWorkspace && !linked);
                  return (
                    <button
                      key={row.pubkey}
                      type="button"
                      className={[
                        "w-full rounded-md border px-3 py-2 text-left transition",
                        disabled
                          ? "border-slate-300 bg-slate-100 text-slate-500"
                          : selected
                            ? "border-[var(--badge-border)] bg-[var(--badge-bg)] text-[var(--badge-fg)]"
                            : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50",
                      ].join(" ")}
                      onClick={() => {
                        setIsInitializingNewLedgerMode(false);
                        setLocalSelectedLedgerPda(row.pubkey);
                        setLedgerPda(row.pubkey);
                      }}
                    >
                      <p className="text-xs font-semibold">{getDisplayLedgerCode(row.pubkey, row.ledgerCode)}</p>
                      <p className="mt-1 font-mono text-[10px] opacity-80">{clampText(row.pubkey, 30)}</p>
                      <p className="mt-1 text-[10px] opacity-80">
                        {row.customerCount} customers / {row.invoiceCount} invoices {linked
                          ? "- linked (active)"
                          : inactiveLinked
                            ? "- linked (disabled)"
                            : ownedByAnotherWorkspace
                              ? "- owned by another workspace"
                              : "- not linked"}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:col-span-4">
          <header className="border-b border-slate-200 bg-slate-50 px-3 py-2">
            <h2 className="text-xs font-semibold text-slate-800">Customers in Selected Ledger</h2>
          </header>
          <div className="max-h-[620px] overflow-auto p-2">
            {!selectedLedger ? (
              <p className="px-2 py-4 text-xs text-slate-500">Select a ledger to load scoped customers.</p>
            ) : loadingCustomers ? (
              <p className="px-2 py-4 text-xs text-slate-500">Loading customers...</p>
            ) : customersByLedger.length === 0 ? (
              <p className="px-2 py-4 text-xs text-slate-500">No customers are associated to this ledger yet.</p>
            ) : (
              <div className="space-y-2">
                {customersByLedger.map((row) => (
                  <div
                    key={row.id}
                    className={[
                      "rounded-md border px-3 py-2 text-[11px]",
                      row.id === customerId
                        ? "border-slate-700 bg-slate-100"
                        : "border-slate-200 bg-slate-50",
                    ].join(" ")}
                  >
                    <p className="font-semibold text-slate-900">{row.customerRef} - {row.legalName}</p>
                    <p className="mt-1 font-mono text-[10px] text-slate-600">Code: {row.customerCode}</p>
                    <p className="mt-1 text-[10px] text-slate-600">Link status: {row.status}</p>
                    <p className="mt-1 font-mono text-[10px] text-slate-600">
                      On-chain: {clampText(row.onchainCustomerPubkey, 28)}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Link
                        href={`/app/customers?customer=${row.id}&ledger=${selectedLedger.pubkey}`}
                        className="underline decoration-slate-300"
                      >
                        Edit Customer
                      </Link>
                      <button
                        type="button"
                        className="underline decoration-slate-300"
                        onClick={() => {
                          setLocalSelectedLedgerPda(selectedLedger.pubkey);
                          setLedgerPda(selectedLedger.pubkey);
                          setCustomerId(row.id);
                          router.push(
                            `/app/workflow?workspace=${activeWorkspaceId ?? ""}&ledger=${selectedLedger.pubkey}&customer=${row.id}`,
                          );
                        }}
                      >
                        Go to Workflow
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:col-span-4">
          <header className="border-b border-slate-200 bg-slate-50 px-3 py-2">
            <h2 className="text-xs font-semibold text-slate-800">Add / Edit Ledger Link</h2>
          </header>
          <div className="space-y-3 p-3">
            {isInitializingNewLedgerMode ? (
            <div id="initialize-ledger-form" className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px]">
              <p className="mb-2 font-semibold text-slate-900">Initialize On-chain Ledger</p>
              <Input
                label="Ledger code"
                value={initLedgerCode}
                placeholder="AR-{REGION}-{YYYY}"
                onChange={(event) => setInitLedgerCode(event.target.value.toUpperCase())}
              />
              <Select
                label="Base GL"
                value={initAccountingLedgerPubkey}
                onChange={(event) => {
                  setInitAccountingLedgerPubkey(event.target.value);
                }}
                options={
                  accountingGlOptions.length > 0
                    ? accountingGlOptions
                    : [{ value: "", label: wallet ? "No Base GL available" : "Wallet not available" }]
                }
                disabled={accountingGlOptions.length === 0}
              />
              {accountingGlOptions.length === 0 ? (
                <p className="text-[10px] text-slate-500">
                  Create Base GL first in Base GL ( COA ), then return to select it as Base GL.
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="AR control GL"
                  value={initArControlAccountCode}
                  onChange={(event) => setInitArControlAccountCode(event.target.value)}
                />
                <Input
                  label="Revenue GL"
                  value={initRevenueAccountCode}
                  onChange={(event) => setInitRevenueAccountCode(event.target.value)}
                />
                <Input
                  label="Cash GL"
                  value={initCashAccountCode}
                  onChange={(event) => setInitCashAccountCode(event.target.value)}
                />
                <Input
                  label="Write-off GL"
                  value={initWriteoffExpenseAccountCode}
                  onChange={(event) => setInitWriteoffExpenseAccountCode(event.target.value)}
                />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Button
                  disabled={!service || !canManageWorkspace || initializingLedger || !initAccountingLedgerPubkey}
                  onClick={async () => {
                    if (!service) return;
                    const parsed = initializeLedgerSchema.safeParse({
                      ledgerCode: initLedgerCode,
                      accountingLedgerPubkey: initAccountingLedgerPubkey,
                      arControlAccountCode: initArControlAccountCode,
                      revenueAccountCode: initRevenueAccountCode,
                      cashAccountCode: initCashAccountCode,
                      writeoffExpenseAccountCode: initWriteoffExpenseAccountCode,
                    });
                    if (!parsed.success) {
                      setMessage(parsed.error.issues[0]?.message ?? "Invalid ledger code format.");
                      return;
                    }

                    const normalizedLedgerCode = parsed.data.ledgerCode.trim().toUpperCase();
                    if (activeWorkspaceId) {
                      const codeExists = ledgerLinks.some(
                        (row) =>
                          row.workspaceId === activeWorkspaceId &&
                          row.ledgerCode.trim().toUpperCase() === normalizedLedgerCode,
                      );
                      if (codeExists) {
                        setMessage(`Ledger code '${normalizedLedgerCode}' already exists in this workspace.`);
                        return;
                      }
                    }

                    setInitializingLedger(true);
                    try {
                      const nextLedgerPubkey = await service.initializeLedger({
                        ledgerCode: normalizedLedgerCode,
                        accountingLedgerPubkey: parsed.data.accountingLedgerPubkey,
                        arControlAccountCode: parsed.data.arControlAccountCode,
                        revenueAccountCode: parsed.data.revenueAccountCode,
                        cashAccountCode: parsed.data.cashAccountCode,
                        writeoffExpenseAccountCode: parsed.data.writeoffExpenseAccountCode,
                      });
                      const ledger = await service.getLedger(nextLedgerPubkey);

                      if (activeWorkspaceId && ledger) {
                        await controlPlaneService.linkLedgerToWorkspace({
                          workspaceId: activeWorkspaceId,
                          ledgerPda: nextLedgerPubkey,
                          ledgerCode: ledger.ledgerCode,
                          authorityPubkey: ledger.authority,
                          onchainLedgerKey: parsed.data.accountingLedgerPubkey,
                        });
                        await refreshWorkspace();
                      await refreshAccessibleLedgerLinks();
                      }

                      setRows(await service.listLedgers());
                      setIsInitializingNewLedgerMode(false);
                      setLocalSelectedLedgerPda(nextLedgerPubkey);
                      setLedgerPda(nextLedgerPubkey);
                      setMessage(`Ledger initialized: ${nextLedgerPubkey}`);
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : "Failed to initialize ledger.");
                    } finally {
                      setInitializingLedger(false);
                    }
                  }}
                >
                  {initializingLedger ? "Initializing..." : "Initialize"}
                </Button>
              </div>
            </div>
            ) : null}

            {!isInitializingNewLedgerMode && !selectedLedger ? (
              <p className="text-xs text-slate-500">Select a ledger from the left pane to edit workspace link settings.</p>
            ) : !isInitializingNewLedgerMode && selectedLedger ? (
              <>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px]">
                  <p>
                    <span className="font-semibold">Ledger:</span> {selectedDisplayLedgerCode ?? selectedLedger.ledgerCode}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-700">
                    <span className="font-semibold">Link status:</span>{" "}
                    {selectedLink?.status === "inactive" ? "Disabled" : selectedLink ? "Active" : "Not linked"}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-slate-600">
                    PDA: {clampText(selectedLedger.pubkey, 34)}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-slate-600">
                    Authority: {clampText(selectedLedger.authority, 24)}
                  </p>
                </div>

                <Input
                  label="Ledger code (on-chain, read-only)"
                  value={formCode}
                  readOnly
                />

                <div className="flex flex-wrap items-center gap-2">
                  {!linkedSet.has(selectedLedger.pubkey) && !inactiveLinkedSet.has(selectedLedger.pubkey) ? (
                    <Button
                      disabled={!activeWorkspaceId || !canManageWorkspace || !canActivateSelectedLedgerInWorkspace}
                      onClick={async () => {
                        if (!activeWorkspaceId || !selectedLedger) return;
                        await controlPlaneService.linkLedgerToWorkspace({
                          workspaceId: activeWorkspaceId,
                          ledgerPda: selectedLedger.pubkey,
                          ledgerCode: selectedLedger.ledgerCode,
                          authorityPubkey: selectedLedger.authority,
                          status: "active",
                        });
                        await refreshWorkspace();
                        await refreshAccessibleLedgerLinks();
                        setMessage(`Added link for ${selectedDisplayLedgerCode ?? selectedLedger.ledgerCode}.`);
                      }}
                    >
                      Add Link
                    </Button>
                  ) : linkedSet.has(selectedLedger.pubkey) ? (
                    <Button variant="ghost" disabled>
                      Linked
                    </Button>
                  ) : null}

                  <Button
                    variant="ghost"
                    disabled={
                      !activeWorkspaceId ||
                      !canManageWorkspace ||
                      !linkedSet.has(selectedLedger.pubkey) ||
                      !selectedLedgerHasDuplicateCode
                    }
                    onClick={async () => {
                      if (!activeWorkspaceId || !selectedLedger) return;
                      await controlPlaneService.setLedgerLinkStatus({
                        workspaceId: activeWorkspaceId,
                        ledgerPda: selectedLedger.pubkey,
                        status: "inactive",
                      });
                      await refreshWorkspace();
                      await refreshAccessibleLedgerLinks();
                      setMessage(`Disabled ${selectedDisplayLedgerCode ?? selectedLedger.ledgerCode} link in workspace.`);
                    }}
                  >
                    Disable
                  </Button>

                  <Button
                    variant="ghost"
                    disabled={!activeWorkspaceId || !canManageWorkspace || !inactiveLinkedSet.has(selectedLedger.pubkey) || !canActivateSelectedLedgerInWorkspace}
                    onClick={async () => {
                      if (!activeWorkspaceId || !selectedLedger) return;
                      await controlPlaneService.setLedgerLinkStatus({
                        workspaceId: activeWorkspaceId,
                        ledgerPda: selectedLedger.pubkey,
                        status: "active",
                      });
                      await refreshWorkspace();
                      await refreshAccessibleLedgerLinks();
                      setMessage(`Enabled ${selectedDisplayLedgerCode ?? selectedLedger.ledgerCode} link in workspace.`);
                    }}
                  >
                    Enable
                  </Button>

                  <Button
                    variant="secondary"
                    disabled={
                      !activeWorkspaceId ||
                      !selectedLedger ||
                      !linkedSet.has(selectedLedger.pubkey)
                    }
                    onClick={() => {
                      router.push(
                        `/app/workflow?workspace=${activeWorkspaceId ?? ""}&ledger=${selectedLedger.pubkey}`,
                      );
                    }}
                  >
                    Go to Workflow
                  </Button>
                </div>

                {!activeWorkspaceId ? (
                  <p className="text-[11px] text-amber-700">Select a workspace in the top bar to save link changes.</p>
                ) : null}

                {selectedLedgerOwnedByAnotherWorkspace && !linkedSet.has(selectedLedger?.pubkey ?? "") ? (
                  <p className="text-[11px] text-amber-700">
                    This ledger is already active in another workspace. Unlink or disable it there before activating it here.
                  </p>
                ) : null}

                {selectedLedger && !selectedLedgerHasDuplicateCode ? (
                  <p className="text-[11px] text-slate-500">
                    Disable is available when two or more ledgers share the same ledger code.
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
