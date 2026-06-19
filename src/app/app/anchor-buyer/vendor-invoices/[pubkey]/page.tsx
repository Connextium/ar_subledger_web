"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PageTitle } from "@/components/ui/page-title";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import type { VendorInvoiceRecord } from "@/lib/types/domain";
import { createApSubledgerService } from "@/services/ap-subledger-service";

export default function VendorInvoiceDetailPage() {
  const params = useParams<{ pubkey: string }>();
  const { wallet } = useEmbeddedWallet();
  const service = useMemo(() => (wallet ? createApSubledgerService(wallet) : null), [wallet]);
  const [invoice, setInvoice] = useState<VendorInvoiceRecord | null>(null);

  useEffect(() => {
    if (!service) return;
    void service
      .listVendorInvoices()
      .then((rows) => setInvoice(rows.find((row) => row.pubkey === params.pubkey) ?? null));
  }, [params.pubkey, service]);

  return (
    <div className="space-y-4">
      <PageTitle title="Vendor Invoice" subtitle={params.pubkey} />
      {invoice ? (
        <section className="rounded-lg border border-slate-200 bg-white p-3 text-[11px] text-slate-600 shadow-sm">
          <p className="font-semibold text-slate-900">{invoice.invoiceNo}</p>
          <p>Original {invoice.originalAmount} | Open {invoice.openAmount} | Paid {invoice.paidAmount}</p>
          <p>Journal entry {invoice.journalEntryId}</p>
        </section>
      ) : (
        <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500">
          Vendor invoice detail is unavailable until a wallet is selected and the invoice is loaded.
        </p>
      )}
    </div>
  );
}
