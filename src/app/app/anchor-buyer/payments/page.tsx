"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageTitle } from "@/components/ui/page-title";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import { useWorkspace } from "@/context/workspace-context";
import type { BuyerLedgerRecord, VendorInvoiceRecord, VendorPaymentRecord, VendorRecord } from "@/lib/types/domain";
import { formatLamportsAmount, parseAmountToMinor } from "@/lib/utils/format";
import { createApSubledgerService } from "@/lib/api-client/v1/buyer";
import { filterBuyerLedgersByWorkspaceLinks } from "@/lib/api-client/v1/buyer-ledger-workspace";
import { controlPlaneService } from "@/lib/api-client/v1/platform";

function toUnix(date: string) {
  return Math.floor(new Date(date).getTime() / 1000);
}

export default function PaymentsPage() {
  const { wallet } = useEmbeddedWallet();
  const { selectedWorkspaceId, workspaces } = useWorkspace();
  const service = useMemo(() => (wallet ? createApSubledgerService(wallet) : null), [wallet]);
  const [rows, setRows] = useState<VendorPaymentRecord[]>([]);
  const [buyerLedgers, setBuyerLedgers] = useState<BuyerLedgerRecord[]>([]);
  const [allVendors, setAllVendors] = useState<VendorRecord[]>([]);
  const [ledgerInvoices, setLedgerInvoices] = useState<VendorInvoiceRecord[]>([]);
  const [ledgerPubkey, setLedgerPubkey] = useState("");
  const [vendorPubkey, setVendorPubkey] = useState("");
  const [invoicePubkey, setInvoicePubkey] = useState("");
  const [paymentSeq, setPaymentSeq] = useState("1");
  const [paymentNo, setPaymentNo] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const activeWorkspaceId = selectedWorkspaceId ?? workspaces[0]?.id ?? null;

  const vendorsForLedger = useMemo(() => {
    if (!ledgerPubkey) return [];
    return allVendors.filter((vendor) => vendor.ledger === ledgerPubkey);
  }, [allVendors, ledgerPubkey]);

  const invoicesForSelection = useMemo(() => {
    if (!ledgerPubkey || !vendorPubkey) return [];
    return ledgerInvoices.filter(
      (invoice) =>
        invoice.ledger === ledgerPubkey &&
        invoice.vendor === vendorPubkey &&
        invoice.openAmount > 0,
    );
  }, [ledgerInvoices, ledgerPubkey, vendorPubkey]);

  const selectedInvoice = useMemo(
    () => invoicesForSelection.find((invoice) => invoice.pubkey === invoicePubkey) ?? null,
    [invoicePubkey, invoicesForSelection],
  );

  useEffect(() => {
    setBuyerLedgers([]);
    setLedgerPubkey("");
    setVendorPubkey("");
    setInvoicePubkey("");

    if (!service || !activeWorkspaceId) {
      setRows([]);
      setAllVendors([]);
      setLedgerInvoices([]);
      return;
    }

    let cancelled = false;
    void Promise.all([
      service.listVendorPayments(),
      service.listBuyerLedgers(),
      service.listVendors(),
      controlPlaneService.listBuyerLedgerLinks(activeWorkspaceId),
      controlPlaneService.listLedgerLinks(activeWorkspaceId),
    ])
      .then(([payments, ledgers, vendors, links, workspaceLedgerLinks]) => {
        if (cancelled) return;
        const scopedLedgers = filterBuyerLedgersByWorkspaceLinks(ledgers, links, workspaceLedgerLinks);
        setRows(payments);
        setAllVendors(vendors);
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
    if (!service || !ledgerPubkey) {
      setLedgerInvoices([]);
      return;
    }
    void service.listVendorInvoices(ledgerPubkey).then(setLedgerInvoices).catch((error) => setMessage(String(error)));
  }, [ledgerPubkey, service]);

  useEffect(() => {
    setVendorPubkey("");
    setInvoicePubkey("");
  }, [ledgerPubkey]);

  useEffect(() => {
    setInvoicePubkey("");
  }, [vendorPubkey]);

  useEffect(() => {
    if (!selectedInvoice) {
      setPaymentSeq("1");
      return;
    }
    setPaymentSeq(String(selectedInvoice.paymentSeq + 1));
    if (!amount) {
      setAmount((selectedInvoice.openAmount / 100).toFixed(2));
    }
  }, [selectedInvoice, amount]);

  async function handlePay() {
    if (!service) return;
    setBusy(true);
    setMessage(null);
    try {
      const pubkey = await service.payVendorInvoice({
        ledgerPubkey,
        vendorPubkey,
        invoicePubkey,
        paymentSeq: Number(paymentSeq),
        paymentNo,
        amountMinor: parseAmountToMinor(amount),
        paymentDateUnix: toUnix(paymentDate),
        paymentReference,
      });
      setMessage(`Posted vendor payment ${pubkey}`);
      setInvoicePubkey("");
      setRows(await service.listVendorPayments());
      setLedgerInvoices(await service.listVendorInvoices(ledgerPubkey));
      setPaymentNo("");
      setAmount("");
      setPaymentDate("");
      setPaymentReference("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Vendor Payments" subtitle="Post payments against open supplier invoices." />
      {message ? <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">{message}</p> : null}
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-900">Pay Vendor Invoice</h2>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <Select
            label="Buyer Ledger"
            value={ledgerPubkey}
            onChange={(event) => setLedgerPubkey(event.target.value)}
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
            disabled={!ledgerPubkey || vendorsForLedger.length === 0}
            options={[
              { value: "", label: "Select a vendor..." },
              ...vendorsForLedger.map((vendor) => ({
                value: vendor.pubkey,
                label: `${vendor.vendorCode} (${vendor.pubkey.slice(0, 8)}...)`,
              })),
            ]}
          />
          <Select
            label="Invoice"
            value={invoicePubkey}
            onChange={(event) => setInvoicePubkey(event.target.value)}
            disabled={!vendorPubkey || invoicesForSelection.length === 0}
            options={[
              { value: "", label: "Select an open invoice..." },
              ...invoicesForSelection.map((invoice) => ({
                value: invoice.pubkey,
                label: `${invoice.invoiceNo} | Open ${formatLamportsAmount(invoice.openAmount, invoice.currency || "USD")} | ${invoice.pubkey.slice(0, 8)}...`,
              })),
            ]}
          />
          <Input label="Payment Seq" value={paymentSeq} onChange={(event) => setPaymentSeq(event.target.value)} />
          <Input label="Payment No" value={paymentNo} onChange={(event) => setPaymentNo(event.target.value)} />
          <Input label="Amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
          <Input label="Payment Date" type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
          <Input label="Payment Reference" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} />
        </div>
        {selectedInvoice ? (
          <p className="mt-2 text-[11px] text-slate-500">
            Selected invoice {selectedInvoice.invoiceNo} has open amount {formatLamportsAmount(selectedInvoice.openAmount, selectedInvoice.currency || "USD")} and next payment sequence {selectedInvoice.paymentSeq + 1}.
          </p>
        ) : null}
        <div className="mt-3"><Button disabled={!wallet || busy || !ledgerPubkey || !vendorPubkey || !invoicePubkey} onClick={handlePay}>Post Payment</Button></div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-900">Posted Payments</h2>
        <div className="mt-2 space-y-2">
          {rows.map((row) => (
            <div key={row.pubkey} className="rounded-md border border-slate-200 px-3 py-2 text-[11px] text-slate-600">
              <p className="font-semibold text-slate-900">{row.paymentNo}</p>
              <p className="font-mono">{row.pubkey}</p>
              <p>Amount {formatLamportsAmount(row.amount)} | Journal entry {row.journalEntryId}</p>
            </div>
          ))}
          {rows.length === 0 ? <p className="text-[11px] text-slate-500">No vendor payments loaded.</p> : null}
        </div>
      </section>
    </div>
  );
}
