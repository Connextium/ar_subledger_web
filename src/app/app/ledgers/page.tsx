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

  const linkedSet = useMemo(() => new Set(ledgerLinks.map((row) => row.ledgerPda)), [ledgerLinks]);

  const filtered = rows.filter((row) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return row.ledgerCode.toLowerCase().includes(q) || row.pubkey.toLowerCase().includes(q);
  });

  const selectedLedger = useMemo(
    () => rows.find((row) => row.pubkey === ledgerPda) ?? null,
    [ledgerPda, rows],
  );

  useEffect(() => {
    if (!ledgerPda && filtered.length > 0) {
      setLedgerPda(filtered[0].pubkey);
    }
  }, [filtered, ledgerPda, setLedgerPda]);

  useEffect(() => {
    if (!selectedLedger) {
      setFormCode("");
      return;
    }
    const linked = ledgerLinks.find((row) => row.ledgerPda === selectedLedger.pubkey);
    setFormCode(linked?.ledgerCode ?? selectedLedger.ledgerCode);
  }, [selectedLedger, ledgerLinks]);

  useEffect(() => {
    if (!activeWorkspaceId || !ledgerPda) {
      setCustomersByLedger([]);
      return;
    }

    let cancelled = false;
    setLoadingCustomers(true);

    void (async () => {
      const [customers, links] = await Promise.all([
        controlPlaneService.listWorkspaceCustomers(activeWorkspaceId),
        controlPlaneService.listWorkspaceCustomerLedgerLinks({
          workspaceId: activeWorkspaceId,
        }),
      ]);

      if (cancelled) return;

      const customerMap = new Map(customers.map((row) => [row.id, row]));
      const scoped = links
        .filter((row) => row.ledgerPda === ledgerPda)
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
      setLoadingCustomers(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, ledgerPda]);

  return (
    <div className="space-y-3">
      <PageTitle
        title="Ledgers"
        subtitle="3-pane contextual ledger workspace: choose ledger, review linked customers, then add/edit workspace ledger link."
        actions={
          <Link href="/app/workflow#initialize-ledger">
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
                        setLedgerPda(row.pubkey);
                      }}
                    >
                      <p className="text-xs font-semibold">{row.ledgerCode}</p>
                      <p className="mt-1 font-mono text-[10px] opacity-80">{clampText(row.pubkey, 30)}</p>
                      <p className="mt-1 text-[10px] opacity-80">
                        {row.customerCount} customers / {row.invoiceCount} invoices {linked ? "- linked" : "- not linked"}
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
            {!selectedLedger ? (
              <p className="text-xs text-slate-500">Select a ledger from the left pane to edit workspace link settings.</p>
            ) : (
              <>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px]">
                  <p>
                    <span className="font-semibold">Ledger:</span> {selectedLedger.ledgerCode}
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
                      });
                      await refreshWorkspace();
                      setMessage(`Saved ledger link for ${selectedLedger.ledgerCode}.`);
                    }}
                  >
                    {linkedSet.has(selectedLedger.pubkey) ? "Update Link" : "Add Link"}
                  </Button>

                  <Button
                    variant="ghost"
                    disabled={!activeWorkspaceId || !canManageWorkspace || !linkedSet.has(selectedLedger.pubkey)}
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
                    disabled={!activeWorkspaceId || !selectedLedger}
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
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
