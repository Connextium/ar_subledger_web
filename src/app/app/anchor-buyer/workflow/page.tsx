"use client";

import Link from "next/link";
import { PageTitle } from "@/components/ui/page-title";

export default function AnchorBuyerWorkflowPage() {
  return (
    <div className="space-y-4">
      <PageTitle title="Buyer Workflow" subtitle="Run the Anchor buyer AP lifecycle from ledger setup through payment." />
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-900">AP Workflow</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <Link href="/app/anchor-buyer/buyer-ledgers" className="rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Create Buyer Ledger</Link>
          <Link href="/app/anchor-buyer/vendors" className="rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Create Vendor</Link>
          <Link href="/app/anchor-buyer/vendor-invoices" className="rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Receive Vendor Invoice</Link>
          <Link href="/app/anchor-buyer/payments" className="rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Post Vendor Payment</Link>
        </div>
      </section>
    </div>
  );
}
