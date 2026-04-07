"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/records/data-table";
import { SearchBar } from "@/components/records/search-bar";
import { useWorkingContext } from "@/context/working-context";
import { PageTitle } from "@/components/ui/page-title";
import { useArSubledger } from "@/hooks/use-ar-subledger";
import type { CreditNoteRecord, InvoiceRecord, ReceiptRecord, WriteOffRecord } from "@/lib/types/domain";
import { formatLamportsAmount, formatUnixDate } from "@/lib/utils/format";
import { controlPlaneService } from "@/services/control-plane-service";

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
  const { workspaceId, ledgerPda: contextLedgerPda, customerId: contextCustomerId } = useWorkingContext();

  const invoiceParam = searchParams.get("invoice");
  const ledgerParam = searchParams.get("ledger");
  const customerParam = searchParams.get("customer");

  const activeLedgerPda = ledgerParam ?? contextLedgerPda;
  const selectedCustomerScope = customerParam ?? contextCustomerId;

  const [rows, setRows] = useState<SettlementRow[]>([]);
  const [scopedCustomerPubkeys, setScopedCustomerPubkeys] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [scopeLoading, setScopeLoading] = useState(false);

  useEffect(() => {
    const resolveScope = async () => {
      if (!selectedCustomerScope) {
        setScopedCustomerPubkeys([]);
        setScopeLoading(false);
        return;
      }

      if (!workspaceId) {
        setScopedCustomerPubkeys([selectedCustomerScope]);
        setScopeLoading(false);
        return;
      }

      setScopeLoading(true);
      try {
        const links = await controlPlaneService.listWorkspaceCustomerLedgerLinks({
          workspaceId,
          workspaceCustomerId: selectedCustomerScope,
        });

        const scopedLinks = links.filter(
          (row) => row.status === "active" && (!activeLedgerPda || row.ledgerPda === activeLedgerPda),
        );

        const resolved = Array.from(
          new Set([selectedCustomerScope, ...scopedLinks.map((row) => row.onchainCustomerPubkey)]),
        );

        setScopedCustomerPubkeys(resolved);
      } finally {
        setScopeLoading(false);
      }
    };

    void resolveScope();
  }, [activeLedgerPda, selectedCustomerScope, workspaceId]);

  useEffect(() => {
    const run = async () => {
      if (!service) {
        setLoading(false);
        return;
      }

      if (!selectedCustomerScope) {
        setRows([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const scopedCustomerSet = new Set(
          scopedCustomerPubkeys.length > 0 ? scopedCustomerPubkeys : [selectedCustomerScope],
        );

        const [invoices, receipts, credits, writeoffs] = await Promise.all([
          service.listInvoices(activeLedgerPda ?? undefined),
          service.listReceipts(invoiceParam ?? undefined),
          service.listCreditNotes(invoiceParam ?? undefined),
          service.listWriteOffs(invoiceParam ?? undefined),
        ]);

        const scopedInvoiceSet = new Set(
          invoices
            .filter((invoice: InvoiceRecord) => scopedCustomerSet.has(invoice.customer))
            .map((invoice: InvoiceRecord) => invoice.pubkey),
        );

        const flattened: SettlementRow[] = [
          ...mapReceipts(receipts),
          ...mapCredits(credits),
          ...mapWriteoffs(writeoffs),
        ]
          .filter((row) => scopedInvoiceSet.has(row.invoice))
          .sort((a, b) => b.occurredAt - a.occurredAt);

        setRows(flattened);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [activeLedgerPda, invoiceParam, scopedCustomerPubkeys, selectedCustomerScope, service]);

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
        subtitle="Showing settlement records for the selected customer in current context."
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
        <p className="text-[11px] text-slate-500">
          {loading || scopeLoading ? "Loading..." : `${filtered.length} row(s)`}
        </p>
      </div>

      <DataTable
        title="Settlement Records"
        rows={filtered}
        emptyLabel={
          selectedCustomerScope
            ? "No settlement records found for selected customer."
            : "Select a customer to view settlements."
        }
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
