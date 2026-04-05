"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SearchBar } from "@/components/records/search-bar";
import { PageTitle } from "@/components/ui/page-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useArSubledger } from "@/hooks/use-ar-subledger";
import { useWorkspace } from "@/context/workspace-context";
import { useWorkingContext } from "@/context/working-context";
import { useRoleGate } from "@/hooks/use-role-gate";
import { controlPlaneService } from "@/services/control-plane-service";
import { initializeLedgerSchema } from "@/lib/validation/schemas";
import type { LedgerRecord } from "@/lib/types/domain";
import { clampText } from "@/lib/utils/format";

export default function LedgersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const service = useArSubledger();
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
  const [initLedgerCode, setInitLedgerCode] = useState("AR-US-2026");
  const [initializingLedger, setInitializingLedger] = useState(false);
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

  useEffect(() => {
    const run = async () => {
      if (!service) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        setRows(await service.listLedgers());
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [service]);

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

  const duplicateCodeSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = row.ledgerCode.trim().toUpperCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([code]) => code),
    );
  }, [rows]);

  const filtered = rows.filter((row) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return row.ledgerCode.toLowerCase().includes(q) || row.pubkey.toLowerCase().includes(q);
  });

  const selectedLedgerPubkey = localSelectedLedgerPda ?? ledgerPda;

  const selectedLedger = useMemo(
    () => rows.find((row) => row.pubkey === selectedLedgerPubkey) ?? null,
    [rows, selectedLedgerPubkey],
  );

  const selectedLink = useMemo(
    () => (selectedLedger ? ledgerLinkByPda.get(selectedLedger.pubkey) ?? null : null),
    [ledgerLinkByPda, selectedLedger],
  );

  const selectedLedgerHasDuplicateCode = useMemo(
    () => (selectedLedger ? duplicateCodeSet.has(selectedLedger.ledgerCode.trim().toUpperCase()) : false),
    [duplicateCodeSet, selectedLedger],
  );

  const defaultLedgerPubkey = useMemo(() => {
    if (activeWorkspaceId) {
      const firstLinked = filtered.find((row) => linkedSet.has(row.pubkey));
      return firstLinked?.pubkey ?? null;
    }
    return filtered[0]?.pubkey ?? null;
  }, [activeWorkspaceId, filtered, linkedSet]);

  useEffect(() => {
    if (!selectedLedgerPubkey && defaultLedgerPubkey) {
      setLocalSelectedLedgerPda(defaultLedgerPubkey);
      setLedgerPda(defaultLedgerPubkey);
    }
  }, [defaultLedgerPubkey, selectedLedgerPubkey, setLedgerPda]);

  useEffect(() => {
    if (!localSelectedLedgerPda) return;
    if (!rows.some((row) => row.pubkey === localSelectedLedgerPda)) {
      setLocalSelectedLedgerPda(null);
    }
  }, [localSelectedLedgerPda, rows]);

  useEffect(() => {
    if (!selectedLedger) {
      setFormCode("");
      return;
    }
    const linked = ledgerLinkByPda.get(selectedLedger.pubkey);
    setFormCode(linked?.ledgerCode ?? selectedLedger.ledgerCode);
  }, [selectedLedger, ledgerLinkByPda]);

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
          <Link href="#initialize-ledger-form">
            <Button>Initialize new ledger</Button>
          </Link>
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
              <p className="px-2 py-4 text-xs text-slate-500">No ledgers found.</p>
            ) : (
              <div className="space-y-2">
                {filtered.map((row) => {
                  const selected = row.pubkey === selectedLedger?.pubkey;
                  const linked = linkedSet.has(row.pubkey);
                  const inactiveLinked = inactiveLinkedSet.has(row.pubkey);
                  return (
                    <button
                      key={row.pubkey}
                      type="button"
                      className={[
                        "w-full rounded-md border px-3 py-2 text-left transition",
                        selected
                          ? "border-slate-700 bg-slate-800 text-white"
                          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50",
                      ].join(" ")}
                      onClick={() => {
                        setLocalSelectedLedgerPda(row.pubkey);
                        setLedgerPda(row.pubkey);
                      }}
                    >
                      <p className="text-xs font-semibold">{row.ledgerCode}</p>
                      <p className="mt-1 font-mono text-[10px] opacity-80">{clampText(row.pubkey, 30)}</p>
                      <p className="mt-1 text-[10px] opacity-80">
                        {row.customerCount} customers / {row.invoiceCount} invoices {linked ? "- linked (active)" : inactiveLinked ? "- linked (disabled)" : "- not linked"}
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
            <div id="initialize-ledger-form" className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px]">
              <p className="mb-2 font-semibold text-slate-900">Initialize On-chain Ledger</p>
              <Input
                label="Ledger code"
                value={initLedgerCode}
                onChange={(event) => setInitLedgerCode(event.target.value.toUpperCase())}
              />
              <div className="mt-2 flex items-center gap-2">
                <Button
                  disabled={!service || !canManageWorkspace || initializingLedger}
                  onClick={async () => {
                    if (!service) return;
                    const parsed = initializeLedgerSchema.safeParse({ ledgerCode: initLedgerCode });
                    if (!parsed.success) {
                      setMessage(parsed.error.issues[0]?.message ?? "Invalid ledger code format.");
                      return;
                    }

                    setInitializingLedger(true);
                    try {
                      const nextLedgerPubkey = await service.initializeLedger({ ledgerCode: initLedgerCode });
                      const ledger = await service.getLedger(nextLedgerPubkey);

                      if (activeWorkspaceId && ledger) {
                        await controlPlaneService.linkLedgerToWorkspace({
                          workspaceId: activeWorkspaceId,
                          ledgerPda: nextLedgerPubkey,
                          ledgerCode: ledger.ledgerCode,
                          authorityPubkey: ledger.authority,
                        });
                        await refreshWorkspace();
                      }

                      setRows(await service.listLedgers());
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
                  {initializingLedger ? "Initializing..." : "Initialize Ledger"}
                </Button>
              </div>
            </div>

            {!selectedLedger ? (
              <p className="text-xs text-slate-500">Select a ledger from the left pane to edit workspace link settings.</p>
            ) : (
              <>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px]">
                  <p>
                    <span className="font-semibold">Ledger:</span> {selectedLedger.ledgerCode}
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
                  label="Ledger code (workspace link)"
                  value={formCode}
                  onChange={(event) => setFormCode(event.target.value.toUpperCase())}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    disabled={!activeWorkspaceId || !canManageWorkspace || !formCode.trim()}
                    onClick={async () => {
                      if (!activeWorkspaceId || !selectedLedger) return;
                      await controlPlaneService.linkLedgerToWorkspace({
                        workspaceId: activeWorkspaceId,
                        ledgerPda: selectedLedger.pubkey,
                        ledgerCode: formCode.trim(),
                        authorityPubkey: selectedLedger.authority,
                        status: "active",
                      });
                      await refreshWorkspace();
                      setMessage(`Saved ledger link for ${selectedLedger.ledgerCode}.`);
                    }}
                  >
                    {linkedSet.has(selectedLedger.pubkey)
                      ? "Update Link"
                      : inactiveLinkedSet.has(selectedLedger.pubkey)
                        ? "Enable Link"
                        : "Add Link"}
                  </Button>

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
                      setMessage(`Disabled ${selectedLedger.ledgerCode} link in workspace.`);
                    }}
                  >
                    Disable
                  </Button>

                  <Button
                    variant="ghost"
                    disabled={!activeWorkspaceId || !canManageWorkspace || !inactiveLinkedSet.has(selectedLedger.pubkey)}
                    onClick={async () => {
                      if (!activeWorkspaceId || !selectedLedger) return;
                      await controlPlaneService.setLedgerLinkStatus({
                        workspaceId: activeWorkspaceId,
                        ledgerPda: selectedLedger.pubkey,
                        status: "active",
                      });
                      await refreshWorkspace();
                      setMessage(`Enabled ${selectedLedger.ledgerCode} link in workspace.`);
                    }}
                  >
                    Enable
                  </Button>

                  <Button
                    variant="ghost"
                    disabled={
                      !activeWorkspaceId ||
                      !canManageWorkspace ||
                      (!linkedSet.has(selectedLedger.pubkey) &&
                        !inactiveLinkedSet.has(selectedLedger.pubkey))
                    }
                    onClick={async () => {
                      if (!activeWorkspaceId || !selectedLedger) return;
                      await controlPlaneService.unlinkLedgerFromWorkspace(
                        activeWorkspaceId,
                        selectedLedger.pubkey,
                      );
                      await refreshWorkspace();
                      setMessage(`Unlinked ${selectedLedger.ledgerCode} from workspace.`);
                    }}
                  >
                    Unlink
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

                {selectedLedger && !selectedLedgerHasDuplicateCode ? (
                  <p className="text-[11px] text-slate-500">
                    Disable is available when two or more ledgers share the same ledger code.
                  </p>
                ) : null}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
