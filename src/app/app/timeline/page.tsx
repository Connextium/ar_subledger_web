"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/records/data-table";
import { SearchBar } from "@/components/records/search-bar";
import { PageTitle } from "@/components/ui/page-title";
import { useArSubledger } from "@/hooks/use-ar-subledger";
import type { ActivityItem } from "@/lib/types/domain";
import { formatLamportsAmount, formatUnixDate } from "@/lib/utils/format";

export default function TimelinePage() {
  const service = useArSubledger();
  const [rows, setRows] = useState<ActivityItem[]>([]);
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
        setRows(await service.listActivity());
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [service]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.type.toLowerCase().includes(q) ||
        row.details.toLowerCase().includes(q) ||
        (row.documentNo?.toLowerCase().includes(q) ?? false) ||
        (row.invoice?.toLowerCase().includes(q) ?? false) ||
        (row.customer?.toLowerCase().includes(q) ?? false),
    );
  }, [rows, search]);

  const tableRows = filtered.map((row) => ({ ...row, pubkey: row.id }));

  return (
    <div>
      <PageTitle
        title="Activity Timeline"
        subtitle="Aggregated event-style stream from invoice and settlement account changes."
      />

      <div className="mb-3 flex items-end justify-between gap-3">
        <SearchBar
          label="Search timeline"
          value={search}
          onChange={setSearch}
          placeholder="Type, detail, invoice, customer..."
        />
        <p className="text-[11px] text-slate-500">{loading ? "Loading..." : `${filtered.length} row(s)`}</p>
      </div>

      <DataTable
        title="Activity"
        rows={tableRows}
        emptyLabel="No activity found."
        columns={[
          {
            key: "type",
            label: "Type",
            render: (row) => (
              <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]">
                {row.type.replaceAll("_", " ")}
              </span>
            ),
          },
          {
            key: "doc",
            label: "Document",
            render: (row) => row.documentNo ?? "-",
          },
          {
            key: "invoice",
            label: "Invoice",
            render: (row) =>
              row.invoice ? (
                <Link href={`/app/invoices/${row.invoice}`} className="underline decoration-slate-300">
                  {row.invoice.slice(0, 12)}...
                </Link>
              ) : (
                "-"
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
            render: (row) => (row.amount ? formatLamportsAmount(row.amount) : "-"),
          },
          {
            key: "details",
            label: "Details",
            render: (row) => row.details,
          },
        ]}
      />
    </div>
  );
}
