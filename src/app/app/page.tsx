"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "@/components/ui/page-title";
import { Panel } from "@/components/ui/panel";
import { useArSubledger } from "@/hooks/use-ar-subledger";
import { useWorkspace } from "@/context/workspace-context";
import { INVOICE_STATUS_LABEL } from "@/lib/types/domain";
import { formatLamportsAmount } from "@/lib/utils/format";

type DashboardSummary = {
  ledgers: number;
  customers: number;
  invoices: number;
  openAmountMinor: number;
};

export default function DashboardPage() {
  const service = useArSubledger();
  const { selectedWorkspaceId, ledgerLinks, role } = useWorkspace();
  const [summary, setSummary] = useState<DashboardSummary>({
    ledgers: 0,
    customers: 0,
    invoices: 0,
    openAmountMinor: 0,
  });
  const [statusCounts, setStatusCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const workspaceLedgerSet = useMemo(() => {
    return new Set(ledgerLinks.map((row) => row.ledgerPda));
  }, [ledgerLinks]);

  useEffect(() => {
    const run = async () => {
      if (!service) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [allLedgers, allCustomers, allInvoices] = await Promise.all([
          service.listLedgers(),
          service.listCustomers(),
          service.listInvoices(),
        ]);

        const ledgers =
          workspaceLedgerSet.size > 0
            ? allLedgers.filter((ledger) => workspaceLedgerSet.has(ledger.pubkey))
            : allLedgers;
        const ledgerKeySet = new Set(ledgers.map((ledger) => ledger.pubkey));

        const customers =
          workspaceLedgerSet.size > 0
            ? allCustomers.filter((customer) => ledgerKeySet.has(customer.ledger))
            : allCustomers;

        const invoices =
          workspaceLedgerSet.size > 0
            ? allInvoices.filter((invoice) => ledgerKeySet.has(invoice.ledger))
            : allInvoices;

        const counts = invoices.reduce<Record<number, number>>((acc, invoice) => {
          acc[invoice.status] = (acc[invoice.status] ?? 0) + 1;
          return acc;
        }, {});

        setStatusCounts(counts);
        setSummary({
          ledgers: ledgers.length,
          customers: customers.length,
          invoices: invoices.length,
          openAmountMinor: invoices.reduce((acc, invoice) => acc + invoice.openAmount, 0),
        });
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [service, workspaceLedgerSet]);

  return (
    <div>
      <PageTitle
        title="Workspace Dashboard"
        subtitle={`Role: ${role}. ${selectedWorkspaceId ? `Workspace selected` : `Create/select a workspace from top bar`}`}
      />

      {error ? (
        <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ledgers" value={loading ? "..." : String(summary.ledgers)} />
        <StatCard label="Customers" value={loading ? "..." : String(summary.customers)} />
        <StatCard label="Invoices" value={loading ? "..." : String(summary.invoices)} />
        <StatCard
          label="Open AR"
          value={loading ? "..." : formatLamportsAmount(summary.openAmountMinor, "USD")}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Panel
          title="Workflow"
          subtitle="Execute on-chain AR lifecycle actions with validation and role checks."
        >
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <QuickLink href="/app/workflow#initialize-ledger" label="Initialize ledger" />
            <QuickLink href="/app/workflow#create-customer" label="Create customer" />
            <QuickLink href="/app/workflow#issue-invoice" label="Issue invoice" />
            <QuickLink href="/app/workflow#record-receipt" label="Record receipt" />
            <QuickLink href="/app/workflow#issue-credit-note" label="Issue credit note" />
            <QuickLink href="/app/workflow#write-off-invoice" label="Write off invoice" />
            <QuickLink href="/app/workflow#close-invoice" label="Close invoice" />
          </div>
        </Panel>

        <Panel title="Status Quick Links" subtitle="Jump to invoices by lifecycle status.">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {Object.entries(INVOICE_STATUS_LABEL).map(([status, label]) => (
              <Link
                key={status}
                href={`/app/invoices?status=${status}`}
                className="rounded border border-slate-200 px-2 py-1.5 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <span className="font-semibold">{label}</span>
                <span className="ml-1 text-slate-500">({statusCounts[Number(status)] ?? 0})</span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded border border-slate-200 px-2 py-1.5 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
    >
      {label}
    </Link>
  );
}
