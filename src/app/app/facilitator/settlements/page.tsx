"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "@/components/ui/page-title";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import { createSettlementFacilitatorService } from "@/services/settlement-facilitator-service";

export default function FacilitatorSettlementsPage() {
  const { wallet } = useEmbeddedWallet();
  const service = useMemo(() => (wallet ? createSettlementFacilitatorService(wallet) : null), [wallet]);
  const [counts, setCounts] = useState({ routes: 0, documents: 0, executions: 0 });

  useEffect(() => {
    if (!service) {
      return;
    }

    Promise.all([service.listRoutes(), service.listDocuments(), service.listExecutions()])
      .then(([routes, documents, executions]) => {
        setCounts({ routes: routes.length, documents: documents.length, executions: executions.length });
      })
      .catch(() => setCounts({ routes: 0, documents: 0, executions: 0 }));
  }, [service]);

  return (
    <div className="space-y-4">
      <PageTitle title="Facilitated Settlements" subtitle="Coordinate buyer and supplier invoice settlement." />
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { label: "Routes", value: counts.routes, href: "/app/facilitator/settlements/routes" },
          { label: "Documents", value: counts.documents, href: "/app/facilitator/settlements/documents" },
          { label: "Executions", value: counts.executions, href: "/app/facilitator/settlements/executions" },
        ].map((item) => (
          <Link key={item.label} href={item.href} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
