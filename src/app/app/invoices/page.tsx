"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/records/data-table";
import { SearchBar } from "@/components/records/search-bar";
import { PageTitle } from "@/components/ui/page-title";
import { StatusBadge } from "@/components/ui/status-badge";
import { useArSubledger } from "@/hooks/use-ar-subledger";
import { INVOICE_STATUS_LABEL, type CustomerRecord, type InvoiceRecord } from "@/lib/types/domain";
import { formatLamportsAmount, formatUnixDate } from "@/lib/utils/format";

export default function InvoicesPage() {
  const service = useArSubledger();
  const searchParams = useSearchParams();
  const ledgerParam = searchParams.get("ledger");
  const customerParam = searchParams.get("customer");
  const statusParam = searchParams.get("status");

  const [rows, setRows] = useState<InvoiceRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(statusParam ?? "all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!service) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [nextInvoices, nextCustomers] = await Promise.all([
          service.listInvoices(ledgerParam ?? undefined),
          service.listCustomers(ledgerParam ?? undefined),
        ]);
        setRows(nextInvoices);
        setCustomers(nextCustomers);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [customerParam, ledgerParam, service]);

  useEffect(() => {
    setStatusFilter(statusParam ?? "all");
  }, [statusParam]);

  const customerById = useMemo(() => {
    return new Map(customers.map((row) => [row.pubkey, row]));
  }, [customers]);

  const rowsByCustomer = useMemo(() => {
    if (!customerParam) return rows;
    const matched = rows.filter((row) => row.customer === customerParam);
    // Customer query may contain workspace-customer id instead of on-chain customer pubkey.
    // Fall back to unfiltered rows so invoice list is still visible.
    return matched.length > 0 ? matched : rows;
  }, [customerParam, rows]);

  const filtered = rowsByCustomer.filter((row) => {
    const q = search.trim().toLowerCase();
    const customer = customerById.get(row.customer);
    const matchSearch =
      q.length === 0 ||
      row.invoiceNo.toLowerCase().includes(q) ||
      row.pubkey.toLowerCase().includes(q) ||
      (customer?.customerCode.toLowerCase().includes(q) ?? false) ||
      (customer?.customerName.toLowerCase().includes(q) ?? false);
    const matchStatus = statusFilter === "all" || String(row.status) === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <PageTitle
        title="Invoices"
        subtitle="Search and filter invoices with direct navigation to customers and settlement records."
        actions={
          <Link href="/app/workflow#issue-invoice" className="text-[11px] underline decoration-slate-300">
            Issue invoice
          </Link>
        }
      />

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <SearchBar
          label="Search invoices"
          value={search}
          onChange={setSearch}
          placeholder="Invoice no, customer, account..."
        />
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
          <span>Status</span>
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All</option>
            {Object.entries(INVOICE_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p className="ml-auto text-[11px] text-slate-500">{loading ? "Loading..." : `${filtered.length} row(s)`}</p>
      </div>

      <DataTable
        title="Invoice Accounts"
        rows={filtered}
        emptyLabel="No invoices found."
        columns={[
          {
            key: "invoiceNo",
            label: "Invoice No",
            render: (row) => (
              <Link href={`/app/invoices/${row.pubkey}`} className="font-semibold underline decoration-slate-300">
                {row.invoiceNo}
              </Link>
            ),
          },
          {
            key: "customer",
            label: "Customer",
            render: (row) => {
              const customer = customerById.get(row.customer);
              if (!customer) return row.customer;
              return (
                <Link href={`/app/customers/${customer.pubkey}`} className="underline decoration-slate-300">
                  {customer.customerCode}
                </Link>
              );
            },
          },
          {
            key: "status",
            label: "Status",
            render: (row) => <StatusBadge label={INVOICE_STATUS_LABEL[row.status] ?? `#${row.status}`} />,
          },
          {
            key: "dueDate",
            label: "Due Date",
            render: (row) => formatUnixDate(row.dueDate),
          },
          {
            key: "open",
            label: "Open Amount",
            render: (row) => formatLamportsAmount(row.openAmount, row.currency || "USD"),
          },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                <Link href={`/app/settlements?invoice=${row.pubkey}`} className="underline decoration-slate-300">
                  Settlements
                </Link>
                <Link href="/app/workflow#record-receipt" className="underline decoration-slate-300">
                  Record
                </Link>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
