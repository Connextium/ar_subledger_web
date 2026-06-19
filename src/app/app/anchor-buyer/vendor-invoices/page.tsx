"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageTitle } from "@/components/ui/page-title";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import type { BuyerLedgerRecord, VendorRecord, VendorInvoiceRecord } from "@/lib/types/domain";
import { createApSubledgerService } from "@/services/ap-subledger-service";

function toUnix(date: string) {
  return Math.floor(new Date(date).getTime() / 1000);
}

export default function VendorInvoicesPage() {
  const { wallet } = useEmbeddedWallet();
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
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Filter vendors by selected ledger
  const vendorsForLedger = useMemo(() => {
    if (!ledgerPubkey) return [];
    return allVendors.filter((v) => v.ledger === ledgerPubkey);
  }, [allVendors, ledgerPubkey]);

  useEffect(() => {
    if (!service) {
      setRows([]);
      setBuyerLedgers([]);
      setAllVendors([]);
      return;
    }
    Promise.all([
      service.listVendorInvoices().then(setRows),
      service.listBuyerLedgers().then((ledgers) => {
        setBuyerLedgers(ledgers);
        // Auto-select the first ledger
        if (ledgers.length > 0 && !ledgerPubkey) {
          setLedgerPubkey(ledgers[0].pubkey);
        }
      }),
      service.listVendors().then(setAllVendors),
    ]).catch((error) => setMessage(String(error)));
  }, [service, ledgerPubkey]);

  async function handleReceive() {
    if (!service) return;
    setBusy(true);
    setMessage(null);
    try {
      const pubkey = await service.receiveVendorInvoice({
        ledgerPubkey,
        vendorPubkey,
        invoiceNo,
        amountMinor: Number(amount),
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
      setRows(await service.listVendorInvoices());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
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
          <Input label="Amount Minor" value={amount} onChange={(event) => setAmount(event.target.value)} />
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
        <div className="mt-2 space-y-2">
          {rows.map((row) => (
            <div key={row.pubkey} className="rounded-md border border-slate-200 px-3 py-2 text-[11px] text-slate-600">
              <Link href={`/app/anchor-buyer/vendor-invoices/${row.pubkey}`} className="font-semibold text-slate-900 underline decoration-slate-300">{row.invoiceNo}</Link>
              <p className="font-mono">{row.pubkey}</p>
              <p>Original {row.originalAmount} | Open {row.openAmount} | Paid {row.paidAmount}</p>
            </div>
          ))}
          {rows.length === 0 ? <p className="text-[11px] text-slate-500">No vendor invoices loaded.</p> : null}
        </div>
      </section>
    </div>
  );
}
