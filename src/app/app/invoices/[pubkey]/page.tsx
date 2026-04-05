"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { DataTable } from "@/components/records/data-table";
import { PageTitle } from "@/components/ui/page-title";
import { StatusBadge } from "@/components/ui/status-badge";
import { useArSubledger } from "@/hooks/use-ar-subledger";
import {
  INVOICE_STATUS_LABEL,
  type CreditNoteRecord,
  type CustomerRecord,
  type InvoiceRecord,
  type ReceiptRecord,
  type WriteOffRecord,
} from "@/lib/types/domain";
import { formatLamportsAmount, formatUnixDate } from "@/lib/utils/format";

export default function InvoiceDetailPage() {
  const params = useParams<{ pubkey: string }>();
  const service = useArSubledger();
  const invoicePubkey = String(params.pubkey ?? "");

  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [credits, setCredits] = useState<CreditNoteRecord[]>([]);
  const [writeoffs, setWriteoffs] = useState<WriteOffRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!service || !invoicePubkey) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const invoiceRow = await service.getInvoice(invoicePubkey);
        setInvoice(invoiceRow);
        if (!invoiceRow) return;

        const [customerRow, receiptRows, creditRows, writeoffRows] = await Promise.all([
          service.getCustomer(invoiceRow.customer),
          service.listReceipts(invoicePubkey),
          service.listCreditNotes(invoicePubkey),
          service.listWriteOffs(invoicePubkey),
        ]);

        setCustomer(customerRow);
        setReceipts(receiptRows);
        setCredits(creditRows);
        setWriteoffs(writeoffRows);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [invoicePubkey, service]);

  if (loading) {
    return <p className="text-[11px] text-slate-500">Loading invoice...</p>;
  }

  if (!invoice) {
    return <p className="text-[11px] text-rose-600">Invoice account not found.</p>;
  }

  return (
    <div className="space-y-3">
      <PageTitle
        title={`Invoice ${invoice.invoiceNo}`}
        subtitle="Invoice lifecycle details with settlement drill-down."
        actions={
          <div className="flex gap-2 text-[11px]">
            {customer ? (
              <Link href="/app/customers" className="underline decoration-slate-300">
                Customer
              </Link>
            ) : null}
            <Link href="/app/workflow#record-receipt" className="underline decoration-slate-300">
              Receipt
            </Link>
            <Link href="/app/workflow#issue-credit-note" className="underline decoration-slate-300">
              Credit
            </Link>
            <Link href="/app/workflow#write-off-invoice" className="underline decoration-slate-300">
              Write-off
            </Link>
            <Link href="/app/workflow#close-invoice" className="underline decoration-slate-300">
              Close
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Status" value={<StatusBadge label={INVOICE_STATUS_LABEL[invoice.status] ?? "Unknown"} />} />
        <Stat label="Original" value={formatLamportsAmount(invoice.originalAmount, invoice.currency || "USD")} />
        <Stat label="Open" value={formatLamportsAmount(invoice.openAmount, invoice.currency || "USD")} />
        <Stat label="Paid" value={formatLamportsAmount(invoice.paidAmount, invoice.currency || "USD")} />
        <Stat label="Credited" value={formatLamportsAmount(invoice.creditedAmount, invoice.currency || "USD")} />
        <Stat
          label="Written Off"
          value={formatLamportsAmount(invoice.writtenOffAmount, invoice.currency || "USD")}
        />
      </div>

      <DataTable
        title="Receipts"
        rows={receipts}
        emptyLabel="No receipt records."
        columns={[
          { key: "no", label: "Receipt No", render: (row) => row.receiptNo },
          { key: "seq", label: "Seq", render: (row) => String(row.receiptSeq) },
          { key: "date", label: "Date", render: (row) => formatUnixDate(row.receiptDate) },
          { key: "amount", label: "Amount", render: (row) => formatLamportsAmount(row.amount) },
          { key: "ref", label: "Reference", render: (row) => row.paymentReference || "-" },
        ]}
      />

      <DataTable
        title="Credit Notes"
        rows={credits}
        emptyLabel="No credit note records."
        columns={[
          { key: "no", label: "Credit No", render: (row) => row.creditNo },
          { key: "seq", label: "Seq", render: (row) => String(row.creditSeq) },
          { key: "date", label: "Date", render: (row) => formatUnixDate(row.creditDate) },
          { key: "amount", label: "Amount", render: (row) => formatLamportsAmount(row.amount) },
          { key: "reason", label: "Reason", render: (row) => row.reason || "-" },
        ]}
      />

      <DataTable
        title="Write-offs"
        rows={writeoffs}
        emptyLabel="No write-off records."
        columns={[
          { key: "date", label: "Date", render: (row) => formatUnixDate(row.writeoffDate) },
          { key: "amount", label: "Amount", render: (row) => formatLamportsAmount(row.amount) },
          { key: "reason", label: "Reason", render: (row) => row.reason || "-" },
        ]}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 text-xs font-semibold text-slate-900">{value}</p>
    </div>
  );
}
