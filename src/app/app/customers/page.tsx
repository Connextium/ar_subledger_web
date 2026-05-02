"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SearchBar } from "@/components/records/search-bar";
import { PageTitle } from "@/components/ui/page-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useArSubledger } from "@/hooks/use-ar-subledger";
import { useWorkspace } from "@/context/workspace-context";
import { useWorkingContext } from "@/context/working-context";
import { useRoleGate } from "@/hooks/use-role-gate";
import { controlPlaneService } from "@/services/control-plane-service";
import { PublicKey } from "@solana/web3.js";
import { deriveCustomerPda } from "@/lib/solana/pdas";
import {
  createWorkspaceCustomerSchema,
  reserveWorkspaceCustomerCodeSchema,
  updateWorkspaceCustomerSchema,
  workspaceCustomerCodeSchema,
} from "@/lib/validation/schemas";
import type {
  WorkspaceCustomer,
  WorkspaceCustomerCodeRegistryEntry,
  WorkspaceCustomerLedgerLink,
  WorkspaceLedgerLink,
} from "@/lib/types/domain";

export default function CustomersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const arService = useArSubledger();
  const { canWriteTransactions } = useRoleGate();
  const { selectedWorkspaceId, ledgerLinks } = useWorkspace();
  const { customerId, refreshCustomerOptions, setCustomerId, setLedgerPda, workspaceId } = useWorkingContext();

  const workspaceFromQuery = searchParams.get("workspace");
  const activeWorkspaceId = workspaceId ?? selectedWorkspaceId ?? workspaceFromQuery;

  const [customers, setCustomers] = useState<WorkspaceCustomer[]>([]);
  const [codeRegistry, setCodeRegistry] = useState<WorkspaceCustomerCodeRegistryEntry[]>([]);
  const [customerLedgerLinks, setCustomerLedgerLinks] = useState<WorkspaceCustomerLedgerLink[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [initializingOnchain, setInitializingOnchain] = useState(false);

  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formCustomerRef, setFormCustomerRef] = useState("");
  const [formLegalName, setFormLegalName] = useState("");
  const [formTaxId, setFormTaxId] = useState("");
  const [formStatus, setFormStatus] = useState<"active" | "inactive" | "archived">("active");
  const [formCode, setFormCode] = useState("");
  const [formLedgerPda, setFormLedgerPda] = useState("");
  const [formOnchainCustomerPubkey, setFormOnchainCustomerPubkey] = useState("");
  const [isCreateModePinned, setIsCreateModePinned] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isOnchainInitialized, setIsOnchainInitialized] = useState<boolean | null>(null);

  const load = async () => {
    if (!activeWorkspaceId) {
      setCustomers([]);
      setCodeRegistry([]);
      setCustomerLedgerLinks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [nextCustomers, nextRegistry, nextLinks] = await Promise.all([
      controlPlaneService.listWorkspaceCustomers(activeWorkspaceId),
      controlPlaneService.listWorkspaceCustomerCodeRegistry(activeWorkspaceId),
      controlPlaneService.listWorkspaceCustomerLedgerLinks({ workspaceId: activeWorkspaceId }),
    ]);
    setCustomers(nextCustomers);
    setCodeRegistry(nextRegistry);
    setCustomerLedgerLinks(nextLinks);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((row) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        q.length === 0 ||
        row.customerRef.toLowerCase().includes(q) ||
        row.legalName.toLowerCase().includes(q) ||
        row.id.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || row.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [customers, search, statusFilter]);

  const selectedCustomer = useMemo(
    () => filteredCustomers.find((row) => row.id === customerId) ?? customers.find((row) => row.id === customerId) ?? null,
    [customerId, customers, filteredCustomers],
  );

  const linkedLedgers = useMemo(() => {
    if (!selectedCustomer) return [];
    const links = customerLedgerLinks.filter((row) => row.workspaceCustomerId === selectedCustomer.id);
    const ledgerByPda = new Map<string, WorkspaceLedgerLink>(ledgerLinks.map((row) => [row.ledgerPda, row]));
    return links.map((link) => ({
      link,
      ledger: ledgerByPda.get(link.ledgerPda) ?? null,
    }));
  }, [customerLedgerLinks, ledgerLinks, selectedCustomer]);

  useEffect(() => {
    if (!customerId && filteredCustomers.length > 0 && !isCreateModePinned) {
      setCustomerId(filteredCustomers[0].id);
    }
  }, [customerId, filteredCustomers, isCreateModePinned, setCustomerId]);

  useEffect(() => {
    if (!selectedCustomer) {
      setFormMode("create");
      setFormCustomerRef("");
      setFormLegalName("");
      setFormTaxId("");
      setFormStatus("active");
      setFormCode("");
      setFormLedgerPda("");
      setFormOnchainCustomerPubkey("");
      return;
    }

    setFormMode("edit");
    setFormCustomerRef(selectedCustomer.customerRef);
    setFormLegalName(selectedCustomer.legalName);
    setFormTaxId(selectedCustomer.taxId ?? "");
    setFormStatus(selectedCustomer.status);
    const reservedCode = codeRegistry.find(
      (row) => row.workspaceCustomerId === selectedCustomer.id && row.status === "reserved",
    );
    setFormCode(reservedCode?.customerCode ?? "");

    const preferredLink = customerLedgerLinks
      .filter((row) => row.workspaceCustomerId === selectedCustomer.id)
      .sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === "active" ? -1 : 1;
        }
        return b.updatedAt.localeCompare(a.updatedAt);
      })[0];

    setFormLedgerPda(preferredLink?.ledgerPda ?? "");
    setFormOnchainCustomerPubkey(preferredLink?.onchainCustomerPubkey ?? "");
  }, [selectedCustomer, codeRegistry, customerLedgerLinks]);

  const ledgerOptions = useMemo(
    () =>
      ledgerLinks
        .filter((row) => row.status === "active")
        .map((row) => ({ value: row.ledgerPda, label: `${row.ledgerCode} (${row.ledgerPda.slice(0, 8)}...)` })),
    [ledgerLinks],
  );

  const selectedLinkForForm = useMemo(() => {
    if (!selectedCustomer || !formLedgerPda.trim()) return null;
    return (
      customerLedgerLinks.find(
        (row) =>
          row.workspaceCustomerId === selectedCustomer.id &&
          row.ledgerPda === formLedgerPda.trim(),
      ) ?? null
    );
  }, [customerLedgerLinks, formLedgerPda, selectedCustomer]);

  useEffect(() => {
    if (!selectedCustomer || !formLedgerPda.trim() || !formCode.trim()) {
      setIsOnchainInitialized(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        let candidatePubkey =
          formOnchainCustomerPubkey.trim() || selectedLinkForForm?.onchainCustomerPubkey || "";

        if (!candidatePubkey) {
          const [derived] = deriveCustomerPda(
            new PublicKey(formLedgerPda.trim()),
            formCode.trim().toUpperCase(),
          );
          candidatePubkey = derived.toBase58();
        }

        if (!arService || !candidatePubkey) {
          if (!cancelled) setIsOnchainInitialized(null);
          return;
        }

        const onchainCustomer = await arService.getCustomer(candidatePubkey);
        if (!cancelled) {
          setIsOnchainInitialized(Boolean(onchainCustomer));
        }
      } catch {
        if (!cancelled) setIsOnchainInitialized(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [arService, formCode, formLedgerPda, formOnchainCustomerPubkey, selectedCustomer, selectedLinkForForm]);

  const initializeOnchainCustomer = async () => {
    if (!activeWorkspaceId || !selectedCustomer || !arService || !canWriteTransactions) return;

    const ledgerPda = formLedgerPda.trim();
    const customerCode = formCode.trim().toUpperCase();

    const nextErrors: Record<string, string> = {};
    if (!ledgerPda) nextErrors.ledgerPda = "Select a ledger before initializing on-chain customer.";
    if (!customerCode) nextErrors.customerCode = "Customer code is required to initialize on-chain customer.";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setInitializingOnchain(true);
    setErrors({});
    setMessage(null);

    try {
      const [derivedCustomerPda] = deriveCustomerPda(new PublicKey(ledgerPda), customerCode);
      const derivedPubkey = derivedCustomerPda.toBase58();

      let onchainPubkey = derivedPubkey;
      const existingOnchain = await arService.getCustomer(derivedPubkey);
      if (!existingOnchain) {
        onchainPubkey = await arService.createCustomer({
          ledgerPubkey: ledgerPda,
          customerCode,
          customerName: selectedCustomer.legalName,
          creditLimitMinor: 0,
        });
      }

      await controlPlaneService.linkWorkspaceCustomerToLedger({
        workspaceId: activeWorkspaceId,
        workspaceCustomerId: selectedCustomer.id,
        ledgerPda,
        onchainCustomerPubkey: onchainPubkey,
        customerCode,
        status: "active",
      });

      setFormOnchainCustomerPubkey(onchainPubkey);
      await load();
  await refreshCustomerOptions();
      setCustomerId(selectedCustomer.id);
      setMessage(`On-chain customer confirmed and linked: ${onchainPubkey}`);
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "On-chain customer initialization failed." });
    } finally {
      setInitializingOnchain(false);
    }
  };

  const startCreateMode = () => {
    setIsCreateModePinned(true);
    setFormMode("create");
    setCustomerId(null);
    setFormCustomerRef("");
    setFormLegalName("");
    setFormTaxId("");
    setFormStatus("active");
    setFormCode("");
    setFormLedgerPda("");
    setFormOnchainCustomerPubkey("");
    setErrors({});
    setMessage(null);
    setIsOnchainInitialized(null);
  };

  return (
    <div className="space-y-3">
      <PageTitle
        title="Customers"
        subtitle="Customer master workflow: select customer, review linked ledgers, then add/edit master and reservation details."
        actions={
          <Button
            variant="secondary"
            onClick={startCreateMode}
          >
            New customer
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <SearchBar
          label="Search customer master"
          value={search}
          onChange={setSearch}
          placeholder="Ref, legal name, or customer id..."
        />
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
          <span>Status</span>
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <p className="ml-auto text-[11px] text-slate-500">
          {loading ? "Loading..." : `${filteredCustomers.length} customer(s)`}
        </p>
      </div>

      {message ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
          {message}
        </p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-12">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:col-span-4">
          <header className="border-b border-slate-200 bg-slate-50 px-3 py-2">
            <h2 className="text-xs font-semibold text-slate-800">Customer Master</h2>
          </header>
          <div className="max-h-[620px] overflow-auto p-2">
            {filteredCustomers.length === 0 ? (
              <p className="px-2 py-4 text-xs text-slate-500">No customers found.</p>
            ) : (
              <div className="space-y-2">
                {filteredCustomers.map((row) => {
                  const selected = row.id === selectedCustomer?.id;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      className={[
                        "w-full rounded-md border px-3 py-2 text-left transition",
                        selected
                          ? "border-[var(--badge-border)] bg-[var(--badge-bg)] text-[var(--badge-fg)]"
                          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50",
                      ].join(" ")}
                      onClick={() => {
                        setIsCreateModePinned(false);
                        setCustomerId(row.id);
                      }}
                    >
                      <p className="text-xs font-semibold">{row.customerRef}</p>
                      <p className="mt-1 text-[11px] opacity-90">{row.legalName}</p>
                      <p className="mt-1 text-[10px] uppercase opacity-80">{row.status}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:col-span-4">
          <header className="border-b border-slate-200 bg-slate-50 px-3 py-2">
            <h2 className="text-xs font-semibold text-slate-800">Ledgers Linked to Selected Customer</h2>
          </header>
          <div className="max-h-[620px] overflow-auto p-2">
            {!selectedCustomer ? (
              <p className="px-2 py-4 text-xs text-slate-500">Select a customer to view linked ledgers.</p>
            ) : linkedLedgers.length === 0 ? (
              <p className="px-2 py-4 text-xs text-slate-500">No active ledger links yet.</p>
            ) : (
              <div className="space-y-2">
                {linkedLedgers.map(({ link, ledger }) => (
                  <div key={link.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]">
                    <p className="font-semibold text-slate-900">{ledger?.ledgerCode ?? "Unknown Ledger"}</p>
                    <p className="mt-1 font-mono text-[10px] text-slate-600">Ledger PDA: {link.ledgerPda}</p>
                    <p className="mt-1 font-mono text-[10px] text-slate-600">Code: {link.customerCode}</p>
                    <p className="mt-1 text-[10px] text-slate-600">Link status: {link.status}</p>
                    <p className="mt-1 font-mono text-[10px] text-slate-600">
                      On-chain: {link.onchainCustomerPubkey}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        className="underline decoration-slate-300"
                        onClick={() => {
                          setLedgerPda(link.ledgerPda);
                          setCustomerId(selectedCustomer.id);
                          router.push(
                            `/app/workflow?workspace=${activeWorkspaceId ?? ""}&ledger=${link.ledgerPda}&customer=${selectedCustomer.id}`,
                          );
                        }}
                      >
                        Go to Workflow
                      </button>
                      <Link href={`/app/ledgers?ledger=${link.ledgerPda}`} className="underline decoration-slate-300">
                        Edit Ledger
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:col-span-4">
          <header className="border-b border-slate-200 bg-slate-50 px-3 py-2">
            <h2 className="text-xs font-semibold text-slate-800">Add / Edit Customer</h2>
          </header>
          <form
            className="space-y-3 p-3"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!activeWorkspaceId || !canWriteTransactions) return;

              setSaving(true);
              setErrors({});
              setMessage(null);

              try {
                let targetCustomer = selectedCustomer;

                if (formMode === "create") {
                  const parsedCreate = createWorkspaceCustomerSchema.safeParse({
                    workspaceId: activeWorkspaceId,
                    customerRef: formCustomerRef,
                    legalName: formLegalName,
                    taxId: formTaxId || undefined,
                    status: formStatus,
                  });

                  if (!parsedCreate.success) {
                    const nextErrors: Record<string, string> = {};
                    for (const issue of parsedCreate.error.issues) {
                      nextErrors[String(issue.path[0] ?? "form")] = issue.message;
                    }
                    setErrors(nextErrors);
                    return;
                  }

                  targetCustomer = await controlPlaneService.createWorkspaceCustomer({
                    workspaceId: activeWorkspaceId,
                    customerRef: formCustomerRef.trim(),
                    legalName: formLegalName.trim(),
                    taxId: formTaxId.trim() || null,
                    status: formStatus,
                  });

                  if (targetCustomer) {
                    setIsCreateModePinned(false);
                    setCustomerId(targetCustomer.id);
                  }
                } else if (selectedCustomer) {
                  const parsedUpdate = updateWorkspaceCustomerSchema.safeParse({
                    id: selectedCustomer.id,
                    workspaceId: activeWorkspaceId,
                    customerRef: formCustomerRef,
                    legalName: formLegalName,
                    taxId: formTaxId || null,
                    status: formStatus,
                  });

                  if (!parsedUpdate.success) {
                    const nextErrors: Record<string, string> = {};
                    for (const issue of parsedUpdate.error.issues) {
                      nextErrors[String(issue.path[0] ?? "form")] = issue.message;
                    }
                    setErrors(nextErrors);
                    return;
                  }

                  targetCustomer = await controlPlaneService.updateWorkspaceCustomer({
                    id: selectedCustomer.id,
                    workspaceId: activeWorkspaceId,
                    customerRef: formCustomerRef.trim(),
                    legalName: formLegalName.trim(),
                    taxId: formTaxId.trim() || null,
                    status: formStatus,
                  });
                }

                if (!targetCustomer) {
                  setErrors({ form: "Customer save failed." });
                  return;
                }

                const wantsLink =
                  formLedgerPda.trim().length > 0 ||
                  formOnchainCustomerPubkey.trim().length > 0;

                const targetLedgerPda = formLedgerPda.trim();
                const existingLinkForLedger = targetLedgerPda
                  ? customerLedgerLinks.find(
                      (row) =>
                        row.workspaceCustomerId === targetCustomer.id &&
                        row.ledgerPda === targetLedgerPda,
                    )
                  : null;
                let derivedOnchainCustomerPubkey = "";
                if (!formOnchainCustomerPubkey.trim() && targetLedgerPda && formCode.trim()) {
                  try {
                    const [derivedCustomerPda] = deriveCustomerPda(
                      new PublicKey(targetLedgerPda),
                      formCode.trim().toUpperCase(),
                    );
                    derivedOnchainCustomerPubkey = derivedCustomerPda.toBase58();
                  } catch {
                    derivedOnchainCustomerPubkey = "";
                  }
                }
                const resolvedOnchainCustomerPubkey =
                  formOnchainCustomerPubkey.trim() ||
                  existingLinkForLedger?.onchainCustomerPubkey ||
                  derivedOnchainCustomerPubkey ||
                  "";

                if (wantsLink) {
                  const nextErrors: Record<string, string> = {};
                  if (!formCode.trim()) {
                    nextErrors.customerCode = "Customer code is required when linking a ledger.";
                  }
                  if (!targetLedgerPda) {
                    nextErrors.ledgerPda = "Select a ledger to create a link.";
                  }
                  if (!resolvedOnchainCustomerPubkey) {
                    nextErrors.onchainCustomerPubkey =
                      "On-chain customer pubkey is required when linking a ledger.";
                  }

                  if (Object.keys(nextErrors).length > 0) {
                    setErrors(nextErrors);
                    return;
                  }
                }

                if (formCode.trim()) {
                  const parsedCode = reserveWorkspaceCustomerCodeSchema.safeParse({
                    workspaceId: activeWorkspaceId,
                    customerCode: formCode,
                    workspaceCustomerId: targetCustomer.id,
                    status: "reserved",
                  });
                  if (!parsedCode.success) {
                    const first = parsedCode.error.issues[0];
                    setErrors({ customerCode: first?.message ?? "Invalid customer code" });
                    return;
                  }

                  await controlPlaneService.reserveWorkspaceCustomerCode({
                    workspaceId: activeWorkspaceId,
                    customerCode: formCode.trim().toUpperCase(),
                    workspaceCustomerId: targetCustomer.id,
                    status: "reserved",
                  });
                }

                if (targetLedgerPda && resolvedOnchainCustomerPubkey && formCode.trim()) {
                  const parsedLink = workspaceCustomerCodeSchema.safeParse(formCode);
                  if (!parsedLink.success) {
                    setErrors({ customerCode: parsedLink.error.issues[0]?.message ?? "Invalid customer code" });
                    return;
                  }

                  await controlPlaneService.linkWorkspaceCustomerToLedger({
                    workspaceId: activeWorkspaceId,
                    workspaceCustomerId: targetCustomer.id,
                    ledgerPda: targetLedgerPda,
                    onchainCustomerPubkey: resolvedOnchainCustomerPubkey,
                    customerCode: formCode.trim().toUpperCase(),
                    status: "active",
                  });
                }

                await load();
        await refreshCustomerOptions();
                setIsCreateModePinned(false);
        setCustomerId(targetCustomer.id);
                setMessage(formMode === "create" ? "Customer created." : "Customer updated.");
              } catch (error) {
                setErrors({ form: error instanceof Error ? error.message : "Save failed." });
              } finally {
                setSaving(false);
              }
            }}
          >
            <Input
              label="Customer Ref"
              value={formCustomerRef}
              onChange={(event) => setFormCustomerRef(event.target.value)}
              error={errors.customerRef}
              disabled={!canWriteTransactions || !activeWorkspaceId}
            />
            <Input
              label="Legal Name"
              value={formLegalName}
              onChange={(event) => setFormLegalName(event.target.value)}
              error={errors.legalName}
              disabled={!canWriteTransactions || !activeWorkspaceId}
            />
            <Input
              label="Tax ID (optional)"
              value={formTaxId}
              onChange={(event) => setFormTaxId(event.target.value)}
              error={errors.taxId}
              disabled={!canWriteTransactions || !activeWorkspaceId}
            />

            <Select
              label="Status"
              value={formStatus}
              onChange={(event) => setFormStatus(event.target.value as "active" | "inactive" | "archived")}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
                { value: "archived", label: "Archived" },
              ]}
              disabled={!canWriteTransactions || !activeWorkspaceId}
            />

            <Input
              label="Reserved Customer Code"
              value={formCode}
              onChange={(event) => setFormCode(event.target.value.toUpperCase())}
              error={errors.customerCode}
              disabled={!canWriteTransactions || !activeWorkspaceId}
            />

            <Select
              label="Link Ledger (optional)"
              value={formLedgerPda}
              onChange={(event) => setFormLedgerPda(event.target.value)}
              options={[{ value: "", label: "Select ledger" }, ...ledgerOptions]}
              disabled={!canWriteTransactions || !activeWorkspaceId}
              error={errors.ledgerPda}
            />
            <Input
              label="On-chain Customer Pubkey (optional)"
              value={formOnchainCustomerPubkey}
              onChange={(event) => setFormOnchainCustomerPubkey(event.target.value)}
              disabled={!canWriteTransactions || !activeWorkspaceId}
              error={errors.onchainCustomerPubkey}
            />

            {errors.form ? <p className="text-[11px] text-rose-600">{errors.form}</p> : null}
            {!activeWorkspaceId ? (
              <p className="text-[11px] text-amber-700">Select a workspace in the top bar before editing customers.</p>
            ) : null}

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={!canWriteTransactions || !activeWorkspaceId || saving}>
                {saving ? "Saving..." : formMode === "create" ? "Create Customer" : "Save Customer"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={
                  isOnchainInitialized === true
                    ? "border border-slate-300 bg-slate-100 text-slate-500"
                    : isOnchainInitialized === false
                    ? "border border-emerald-300 bg-emerald-100 text-emerald-900 hover:bg-emerald-200"
                    : ""
                }
                disabled={
                  !canWriteTransactions ||
                  !activeWorkspaceId ||
                  !selectedCustomer ||
                  !formLedgerPda.trim() ||
                  !formCode.trim() ||
                  !arService ||
                  isOnchainInitialized === true ||
                  initializingOnchain ||
                  saving
                }
                onClick={() => {
                  void initializeOnchainCustomer();
                }}
              >
                {initializingOnchain ? "Initializing on-chain..." : "Initialize On-chain Customer"}
              </Button>
              {selectedCustomer ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={startCreateMode}
                >
                  New
                </Button>
              ) : null}
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
