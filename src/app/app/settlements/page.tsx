"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/records/data-table";
import { SearchBar } from "@/components/records/search-bar";
import { PageTitle } from "@/components/ui/page-title";
import { useArSubledger } from "@/hooks/use-ar-subledger";
import type { CreditNoteRecord, ReceiptRecord, WriteOffRecord } from "@/lib/types/domain";
import { formatLamportsAmount, formatUnixDate } from "@/lib/utils/format";

type SettlementRow = {
  pubkey: string;
  kind: "receipt" | "credit" | "writeoff";
  documentNo: string;
  invoice: string;
  amount: number;
  occurredAt: number;
  note: string;
};

export default function SettlementsPage() {
  const service = useArSubledger();
  const searchParams = useSearchParams();
  const invoiceParam = searchParams.get("invoice");

  const [rows, setRows] = useState<SettlementRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!service) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [receipts, credits, writeoffs] = await Promise.all([
          service.listReceipts(invoiceParam ?? undefined),
          service.listCreditNotes(invoiceParam ?? undefined),
          service.listWriteOffs(invoiceParam ?? undefined),
        ]);

        const flattened: SettlementRow[] = [
          ...mapReceipts(receipts),
          ...mapCredits(credits),
          ...mapWriteoffs(writeoffs),
        ].sort((a, b) => b.occurredAt - a.occurredAt);

        setRows(flattened);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [invoiceParam, service]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.documentNo.toLowerCase().includes(q) ||
        row.invoice.toLowerCase().includes(q) ||
        row.kind.toLowerCase().includes(q),
    );
  }, [rows, search]);

  return (
    <div>
      <PageTitle
        title="Settlements"
        subtitle="Receipts, credit notes, and write-offs with links back to parent invoices."
        actions={
          <div className="flex gap-2 text-[11px]">
            <Link href="/app/workflow#record-receipt" className="underline decoration-slate-300">
              Record receipt
            </Link>
            <Link href="/app/workflow#issue-credit-note" className="underline decoration-slate-300">
              Issue credit
            </Link>
            <Link href="/app/workflow#write-off-invoice" className="underline decoration-slate-300">
              Write off
            </Link>
          </div>
        }
      />

      <div className="mb-3 flex items-end justify-between gap-3">
        <SearchBar
          label="Search settlements"
          value={search}
          onChange={setSearch}
          placeholder="Document no, invoice, type..."
        />
        <p className="text-[11px] text-slate-500">{loading ? "Loading..." : `${filtered.length} row(s)`}</p>
      </div>

      <DataTable
        title="Settlement Records"
        rows={filtered}
        emptyLabel="No settlement records found."
        columns={[
          {
            key: "kind",
            label: "Type",
            render: (row) => (
              <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]">
                {row.kind}
              </span>
            ),
          },
          {
            key: "doc",
            label: "Document No",
            render: (row) => row.documentNo,
          },
          {
            key: "invoice",
            label: "Invoice",
            render: (row) => (
              <Link href={`/app/invoices/${row.invoice}`} className="underline decoration-slate-300">
                {row.invoice.slice(0, 12)}...
              </Link>
            ),
          },
          {
            key: "date",
            label: "Date",
            render: (row) => formatUnixDate(row.occurredAt),
          },
          {
            key: "amount",
            label: "Amount",
            render: (row) => formatLamportsAmount(row.amount),
          },
          {
            key: "note",
            label: "Note",
            render: (row) => row.note,
          },
        ]}
      />
    </div>
  );
}

function mapReceipts(rows: ReceiptRecord[]): SettlementRow[] {
  return rows.map((row) => ({
    pubkey: row.pubkey,
    kind: "receipt",
    documentNo: row.receiptNo,
    invoice: row.invoice,
    amount: row.amount,
    occurredAt: row.receiptDate,
    note: row.paymentReference,
  }));
}

function mapCredits(rows: CreditNoteRecord[]): SettlementRow[] {
  return rows.map((row) => ({
    pubkey: row.pubkey,
    kind: "credit",
    documentNo: row.creditNo,
    invoice: row.invoice,
    amount: row.amount,
    occurredAt: row.creditDate,
    note: row.reason,
  }));
}

function mapWriteoffs(rows: WriteOffRecord[]): SettlementRow[] {
  return rows.map((row) => ({
    pubkey: row.pubkey,
    kind: "writeoff",
    documentNo: "WRITE-OFF",
    invoice: row.invoice,
    amount: row.amount,
    occurredAt: row.writeoffDate,
    note: row.reason,
  }));
}
