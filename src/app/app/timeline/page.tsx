"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/records/data-table";
import { SearchBar } from "@/components/records/search-bar";
import { useWorkingContext } from "@/context/working-context";
import { PageTitle } from "@/components/ui/page-title";
import { useArSubledger } from "@/hooks/use-ar-subledger";
import type { ActivityItem, InvoiceRecord } from "@/lib/types/domain";
import { formatLamportsAmount, formatUnixDate } from "@/lib/utils/format";
import { controlPlaneService } from "@/services/control-plane-service";

export default function TimelinePage() {
  const service = useArSubledger();
  const searchParams = useSearchParams();
  const { workspaceId, ledgerPda: contextLedgerPda, customerId: contextCustomerId } = useWorkingContext();

  const ledgerParam = searchParams.get("ledger");
  const customerParam = searchParams.get("customer");

  const activeLedgerPda = ledgerParam ?? contextLedgerPda;
  const selectedCustomerScope = customerParam ?? contextCustomerId;

  const [rows, setRows] = useState<ActivityItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
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
        setInvoices([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [activityRows, invoiceRows] = await Promise.all([
          service.listActivity(),
          service.listInvoices(activeLedgerPda ?? undefined),
        ]);

        setRows(activityRows);
        setInvoices(invoiceRows);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [activeLedgerPda, selectedCustomerScope, service]);

  const rowsByCustomer = useMemo(() => {
    if (!selectedCustomerScope) return [];

    const scopedCustomerSet = new Set(
      scopedCustomerPubkeys.length > 0 ? scopedCustomerPubkeys : [selectedCustomerScope],
    );

    const invoiceByPubkey = new Map(invoices.map((row) => [row.pubkey, row]));

    return rows.filter((row) => {
      const invoice = row.invoice ? invoiceByPubkey.get(row.invoice) : null;

      if (activeLedgerPda && row.invoice && !invoice) return false;
      if (activeLedgerPda && invoice && invoice.ledger !== activeLedgerPda) return false;

      if (row.customer && scopedCustomerSet.has(row.customer)) return true;
      if (invoice && scopedCustomerSet.has(invoice.customer)) return true;
      return false;
    });
  }, [activeLedgerPda, invoices, rows, scopedCustomerPubkeys, selectedCustomerScope]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rowsByCustomer;
    return rowsByCustomer.filter(
      (row) =>
        row.type.toLowerCase().includes(q) ||
        row.details.toLowerCase().includes(q) ||
        (row.documentNo?.toLowerCase().includes(q) ?? false) ||
        (row.invoice?.toLowerCase().includes(q) ?? false) ||
        (row.customer?.toLowerCase().includes(q) ?? false),
    );
  }, [rowsByCustomer, search]);

  const tableRows = filtered.map((row) => ({ ...row, pubkey: row.id }));

  return (
    <div>
      <PageTitle
        title="Activity Timeline"
        subtitle="Showing timeline events for the selected customer in current context."
      />

      <div className="mb-3 flex items-end justify-between gap-3">
        <SearchBar
          label="Search timeline"
          value={search}
          onChange={setSearch}
          placeholder="Type, detail, invoice, customer..."
        />
        <p className="text-[11px] text-slate-500">
          {loading || scopeLoading ? "Loading..." : `${filtered.length} row(s)`}
        </p>
      </div>

      <DataTable
        title="Activity"
        rows={tableRows}
        emptyLabel={selectedCustomerScope ? "No activity found for selected customer." : "Select a customer to view activity."}
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
