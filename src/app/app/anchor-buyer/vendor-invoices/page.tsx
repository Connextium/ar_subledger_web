"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageTitle } from "@/components/ui/page-title";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import { useWorkspace } from "@/context/workspace-context";
import type { BuyerLedgerRecord, VendorRecord, VendorInvoiceRecord } from "@/lib/types/domain";
import { formatLamportsAmount, parseAmountToMinor } from "@/lib/utils/format";
import { createApSubledgerService } from "@/lib/api-client/v1/buyer";
import { filterBuyerLedgersByWorkspaceLinks } from "@/lib/api-client/v1/buyer-ledger-workspace";
import { controlPlaneService } from "@/lib/api-client/v1/platform";

function toUnix(date: string) {
  return Math.floor(new Date(date).getTime() / 1000);
}

type InvoiceStatusFilter = "all" | "open" | "partially_paid" | "paid";

function getInvoiceStatus(invoice: VendorInvoiceRecord): Exclude<InvoiceStatusFilter, "all"> {
  if (invoice.openAmount === 0) return "paid";
  if (invoice.paidAmount > 0) return "partially_paid";
  return "open";
}

export default function VendorInvoicesPage() {
  const { wallet } = useEmbeddedWallet();
  const { selectedWorkspaceId, workspaces } = useWorkspace();
  const service = useMemo(() => (wallet ? createApSubledgerService(wallet) : null), [wallet]);
  const [rows, setRows] = useState<VendorInvoiceRecord[]>([]);
  const [buyerLedgers, setBuyerLedgers] = useState<BuyerLedgerRecord[]>([]);
  const [allVendors, setAllVendors] = useState<VendorRecord[]>([]);
  const [ledgerPubkey, setLedgerPubkey] = useState("");
  const [vendorPubkey, setVendorPubkey] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [amount, setAmount] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [documentHash, setDocumentHash] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>("all");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const activeWorkspaceId = selectedWorkspaceId ?? workspaces[0]?.id ?? null;

  // Filter vendors by selected ledger
  const vendorsForLedger = useMemo(() => {
    if (!ledgerPubkey) return [];
    return allVendors.filter((v) => v.ledger === ledgerPubkey);
  }, [allVendors, ledgerPubkey]);

  const vendorByPubkey = useMemo(
    () => new Map(allVendors.map((vendor) => [vendor.pubkey, vendor])),
    [allVendors],
  );

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return rows.filter((invoice) => {
      const vendor = vendorByPubkey.get(invoice.vendor);
      const matchesSearch =
        !normalizedSearch ||
        [
          invoice.invoiceNo,
          invoice.description,
          invoice.documentHash,
          invoice.pubkey,
          vendor?.vendorCode,
          vendor?.vendorName,
        ].some((value) => value?.toLowerCase().includes(normalizedSearch));
      const matchesVendor = !vendorFilter || invoice.vendor === vendorFilter;
      const matchesStatus = statusFilter === "all" || getInvoiceStatus(invoice) === statusFilter;
      return matchesSearch && matchesVendor && matchesStatus;
    });
  }, [rows, searchQuery, statusFilter, vendorByPubkey, vendorFilter]);

  useEffect(() => {
    setBuyerLedgers([]);
    setLedgerPubkey("");
    setVendorPubkey("");

    if (!service || !activeWorkspaceId) {
      setRows([]);
      setAllVendors([]);
      return;
    }

    let cancelled = false;
    void Promise.all([
      service.listBuyerLedgers(activeWorkspaceId),
      controlPlaneService.listBuyerLedgerLinks(activeWorkspaceId),
      controlPlaneService.listLedgerLinks(activeWorkspaceId),
    ])
      .then(([ledgers, links, workspaceLedgerLinks]) => {
        if (cancelled) return;
        const scopedLedgers = filterBuyerLedgersByWorkspaceLinks(ledgers, links, workspaceLedgerLinks);
        setBuyerLedgers(scopedLedgers);
        setLedgerPubkey(scopedLedgers[0]?.pubkey ?? "");
      })
      .catch((error) => {
        if (!cancelled) setMessage(String(error));
      });

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, service]);

  useEffect(() => {
    setRows([]);
    setAllVendors([]);
    setVendorPubkey("");
    setVendorFilter("");

    if (!service || !ledgerPubkey) return;

    let cancelled = false;
    void Promise.all([
      service.listVendorInvoices({ workspaceId: activeWorkspaceId, ledgerPubkey }),
      service.listVendors({ workspaceId: activeWorkspaceId, ledgerPubkey }),
    ])
      .then(([invoices, vendors]) => {
        if (cancelled) return;
        setRows(invoices);
        setAllVendors(vendors);
      })
      .catch((error) => {
        if (!cancelled) setMessage(String(error));
      });

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, ledgerPubkey, service]);

  async function handleReceive() {
    if (!service) return;
    setBusy(true);
    setMessage(null);
    try {
      const pubkey = await service.receiveVendorInvoice({
        workspaceId: activeWorkspaceId,
        ledgerPubkey,
        vendorPubkey,
        invoiceNo,
        amountMinor: parseAmountToMinor(amount),
        invoiceDateUnix: toUnix(invoiceDate),
        dueDateUnix: toUnix(dueDate),
        currency,
        description,
        documentHash,
      });
      setMessage(`Received vendor invoice ${pubkey}`);
      setInvoiceNo("");
      setAmount("");
      setInvoiceDate("");
      setDueDate("");
      setCurrency("USD");
      setDescription("");
      setDocumentHash("");
      setRows(await service.listVendorInvoices({ workspaceId: activeWorkspaceId, ledgerPubkey }));
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setMessage(text);
      if (text.toLowerCase().includes("duplicate invoice number")) {
        window.alert(text);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Vendor Invoices" subtitle="Record supplier invoices into the buyer AP subledger." />
      {message ? <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">{message}</p> : null}
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-900">Receive Vendor Invoice</h2>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <Select
            label="Buyer Ledger"
            value={ledgerPubkey}
            onChange={(event) => {
              setLedgerPubkey(event.target.value);
              setVendorPubkey(""); // Clear vendor when ledger changes
            }}
            disabled={buyerLedgers.length === 0}
            options={[
              { value: "", label: "Select a buyer ledger..." },
              ...buyerLedgers.map((ledger) => ({
                value: ledger.pubkey,
                label: `${ledger.ledgerCode} (${ledger.pubkey.slice(0, 8)}...)`,
              })),
            ]}
          />
          <Select
            label="Vendor"
            value={vendorPubkey}
            onChange={(event) => setVendorPubkey(event.target.value)}
            disabled={vendorsForLedger.length === 0}
            options={[
              { value: "", label: "Select a vendor..." },
              ...vendorsForLedger.map((vendor) => ({
                value: vendor.pubkey,
                label: `${vendor.vendorCode} (${vendor.pubkey.slice(0, 8)}...)`,
              })),
            ]}
          />
          <Input label="Invoice No" value={invoiceNo} onChange={(event) => setInvoiceNo(event.target.value)} />
          <Input label="Amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
          <Input label="Invoice Date" type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
          <Input label="Due Date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          <Input label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value)} />
          <Input label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
          <Input label="Document Hash" value={documentHash} onChange={(event) => setDocumentHash(event.target.value)} />
        </div>
        <div className="mt-3"><Button disabled={!wallet || busy || !ledgerPubkey || !vendorPubkey} onClick={handleReceive}>Receive Invoice</Button></div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-900">Received Vendor Invoices</h2>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <Input
            label="Search invoices"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Invoice, vendor, hash, or PDA"
          />
          <Select
            label="Vendor filter"
            value={vendorFilter}
            onChange={(event) => setVendorFilter(event.target.value)}
            options={[
              { value: "", label: "All vendors" },
              ...vendorsForLedger.map((vendor) => ({
                value: vendor.pubkey,
                label: `${vendor.vendorCode} - ${vendor.vendorName}`,
              })),
            ]}
          />
          <Select
            label="Status filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as InvoiceStatusFilter)}
            options={[
              { value: "all", label: "All statuses" },
              { value: "open", label: "Open" },
              { value: "partially_paid", label: "Partially paid" },
              { value: "paid", label: "Paid" },
            ]}
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Showing {filteredRows.length} of {rows.length} invoices for the selected Buyer Ledger.
        </p>
        <div className="mt-2 space-y-2">
          {filteredRows.map((row) => {
            const vendor = vendorByPubkey.get(row.vendor);
            return (
            <div key={row.pubkey} className="rounded-md border border-slate-200 px-3 py-2 text-[11px] text-slate-600">
              <Link href={`/app/anchor-buyer/vendor-invoices/${row.pubkey}`} className="font-semibold text-slate-900 underline decoration-slate-300">{row.invoiceNo}</Link>
              <p>{vendor ? `${vendor.vendorCode} - ${vendor.vendorName}` : row.vendor}</p>
              <p className="font-mono">{row.pubkey}</p>
              <p>
                Original {formatLamportsAmount(row.originalAmount, row.currency || "USD")} | Open{" "}
                {formatLamportsAmount(row.openAmount, row.currency || "USD")} | Paid{" "}
                {formatLamportsAmount(row.paidAmount, row.currency || "USD")}
              </p>
              <p>Status {getInvoiceStatus(row).replace("_", " ")}</p>
            </div>
            );
          })}
          {filteredRows.length === 0 ? <p className="text-[11px] text-slate-500">No matching vendor invoices.</p> : null}
        </div>
      </section>
    </div>
  );
}
