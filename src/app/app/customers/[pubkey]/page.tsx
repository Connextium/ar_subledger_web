"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageTitle } from "@/components/ui/page-title";

export default function LegacyCustomerDetailPage() {
  const params = useParams<{ pubkey: string }>();
  const pubkey = String(params.pubkey ?? "");

  return (
    <div className="space-y-3">
      <PageTitle
        title="Legacy Customer Route"
        subtitle="The customer detail page by on-chain pubkey is deprecated in the new customer master model."
      />

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900">
        <p>
          Route <strong>/app/customers/[pubkey]</strong> is kept only for backward compatibility.
        </p>
        <p className="mt-1">Requested on-chain customer pubkey: {pubkey || "(empty)"}</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3 text-[12px] text-slate-700">
        <p className="font-semibold">Use the new flow:</p>
        <ul className="mt-2 list-disc pl-5">
          <li>
            Open <Link href="/app/customers" className="underline decoration-slate-300">Customer Master</Link> to select/edit customers and linked ledgers.
          </li>
          <li>
            Open <Link href="/app/workflow" className="underline decoration-slate-300">Workflow</Link> to execute invoice and settlement actions with context.
          </li>
        </ul>
      </div>
    </div>
  );
}
