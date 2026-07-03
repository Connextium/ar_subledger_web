"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function VendorInvoiceDetailPage() {
  const params = useParams<{ pubkey: string }>();
  const { wallet } = useEmbeddedWallet();
  const { selectedWorkspaceId, workspaces } = useWorkspace();
  const service = useMemo(() => (wallet ? createApSubledgerService(wallet) : null), [wallet]);
  const [invoice, setInvoice] = useState<VendorInvoiceRecord | null>(null);
  const [buyerLedger, setBuyerLedger] = useState<BuyerLedgerRecord | null>(null);
  const [vendor, setVendor] = useState<VendorRecord | null>(null);
  const [payments, setPayments] = useState<VendorPaymentRecord[]>([]);
  const [paymentSeq, setPaymentSeq] = useState("1");
  const [paymentNo, setPaymentNo] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const activeWorkspaceId = selectedWorkspaceId ?? workspaces[0]?.id ?? null;

  const loadDetail = useCallback(async () => {
    if (!service || !activeWorkspaceId) {
      setInvoice(null);
      setBuyerLedger(null);
      setVendor(null);
      setPayments([]);
      return;
    }

    const [nextInvoice, buyerLedgers, buyerLedgerLinks, workspaceLedgerLinks] = await Promise.all([
      service.getVendorInvoice(activeWorkspaceId, params.pubkey),
      service.listBuyerLedgers(activeWorkspaceId),
      controlPlaneService.listBuyerLedgerLinks(activeWorkspaceId),
      controlPlaneService.listLedgerLinks(activeWorkspaceId),
    ]);
    const scopedLedgers = filterBuyerLedgersByWorkspaceLinks(
      buyerLedgers,
      buyerLedgerLinks,
      workspaceLedgerLinks,
    );
    const isWorkspaceInvoice =
      nextInvoice && scopedLedgers.some((ledger) => ledger.pubkey === nextInvoice.ledger);

    if (!nextInvoice || !isWorkspaceInvoice) {
      setInvoice(null);
      setBuyerLedger(null);
      setVendor(null);
      setPayments([]);
      if (nextInvoice) setMessage("Invoice is not available in the current workspace.");
      return;
    }

    const [paymentRows, vendors] = await Promise.all([
      service.listVendorPayments(activeWorkspaceId, params.pubkey),
      service.listVendors({ workspaceId: activeWorkspaceId, ledgerPubkey: nextInvoice.ledger }),
    ]);
    setInvoice(nextInvoice);
    setPayments(paymentRows);
    setBuyerLedger(scopedLedgers.find((ledger) => ledger.pubkey === nextInvoice.ledger) ?? null);
    setVendor(vendors.find((row) => row.pubkey === nextInvoice.vendor) ?? null);
    setPaymentSeq(String(nextInvoice.paymentSeq + 1));
    setAmount(nextInvoice.openAmount > 0 ? (nextInvoice.openAmount / 100).toFixed(2) : "");
  }, [activeWorkspaceId, params.pubkey, service]);

  useEffect(() => {
    void loadDetail().catch((error) => setMessage(error instanceof Error ? error.message : String(error)));
  }, [loadDetail]);

  async function handlePay() {
    if (!service || !invoice) return;
    setBusy(true);
    setMessage(null);
    try {
      const pubkey = await service.payVendorInvoice({
        workspaceId: activeWorkspaceId,
        ledgerPubkey: invoice.ledger,
        vendorPubkey: invoice.vendor,
        invoicePubkey: invoice.pubkey,
        paymentSeq: Number(paymentSeq),
        paymentNo,
        amountMinor: parseAmountToMinor(amount),
        paymentDateUnix: toUnix(paymentDate),
        paymentReference,
      });
      setMessage(`Posted vendor payment ${pubkey}`);
      setPaymentNo("");
      setPaymentDate("");
      setPaymentReference("");
      await loadDetail();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle
        title="Vendor Invoice"
        subtitle={params.pubkey}
        actions={
          <Link href="/app/anchor-buyer/vendor-invoices" className="text-[11px] underline decoration-slate-300">
            Back to invoices
          </Link>
        }
      />
      {message ? <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">{message}</p> : null}
      {invoice ? (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-3 text-[11px] text-slate-600 shadow-sm">
            <p className="font-semibold text-slate-900">{invoice.invoiceNo}</p>
            <p className="mt-2">
              Invoice PDA <span className="break-all font-mono text-[10px] text-slate-700">{invoice.pubkey}</span>
            </p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Buyer</p>
                <p className="mt-1 font-semibold text-slate-900">{buyerLedger?.ledgerCode ?? "Unknown buyer ledger"}</p>
                <p className="mt-1 font-mono text-[10px] text-slate-600">{invoice.ledger}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Vendor</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {vendor ? `${vendor.vendorCode} - ${vendor.vendorName}` : "Unknown vendor"}
                </p>
                <p className="mt-1 font-mono text-[10px] text-slate-600">{invoice.vendor}</p>
              </div>
            </div>
            <p>
              Original {formatLamportsAmount(invoice.originalAmount, invoice.currency || "USD")} | Open{" "}
              {formatLamportsAmount(invoice.openAmount, invoice.currency || "USD")} | Paid{" "}
              {formatLamportsAmount(invoice.paidAmount, invoice.currency || "USD")}
            </p>
            <p>Currency {invoice.currency} | Due {new Date(invoice.dueDate * 1000).toLocaleDateString()}</p>
            <p>Journal entry {invoice.journalEntryId}</p>
          </section>
          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="text-xs font-semibold text-slate-900">Make Payment</h2>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <Input label="Payment Seq" value={paymentSeq} onChange={(event) => setPaymentSeq(event.target.value)} />
              <Input label="Payment No" value={paymentNo} onChange={(event) => setPaymentNo(event.target.value)} />
              <Input label="Amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
              <Input label="Payment Date" type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
              <Input label="Payment Reference" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              This invoice has open amount {formatLamportsAmount(invoice.openAmount, invoice.currency || "USD")} and next payment sequence {invoice.paymentSeq + 1}.
            </p>
            <div className="mt-3">
              <Button
                disabled={!wallet || busy || invoice.openAmount <= 0 || !paymentNo || !amount || !paymentDate}
                onClick={handlePay}
              >
                Post Payment
              </Button>
            </div>
          </section>
          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="text-xs font-semibold text-slate-900">Payments</h2>
            <div className="mt-2 space-y-2">
              {payments.map((payment) => (
                <div key={payment.pubkey} className="rounded-md border border-slate-200 px-3 py-2 text-[11px] text-slate-600">
                  <p className="font-semibold text-slate-900">{payment.paymentNo}</p>
                  <p className="font-mono">{payment.pubkey}</p>
                  <p>Amount {formatLamportsAmount(payment.amount, invoice.currency || "USD")} | Journal entry {payment.journalEntryId}</p>
                </div>
              ))}
              {payments.length === 0 ? <p className="text-[11px] text-slate-500">No payments posted for this invoice.</p> : null}
            </div>
          </section>
        </>
      ) : (
        <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500">
          Vendor invoice detail is unavailable until a wallet is selected and the invoice is loaded.
        </p>
      )}
    </div>
  );
}
