"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageTitle } from "@/components/ui/page-title";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import { useWorkspace } from "@/context/workspace-context";
import type { SettlementDocumentRecord, SettlementRouteRecord } from "@/lib/types/domain";
import { formatLamportsAmount, parseAmountToMinor } from "@/lib/utils/format";
import { controlPlaneService } from "@/lib/api-client/v1/platform";
import { createSettlementFacilitatorService } from "@/lib/api-client/v1/facilitator";

export default function SettlementDocumentsPage() {
  const { wallet } = useEmbeddedWallet();
  const { selectedWorkspaceId, workspaces } = useWorkspace();
  const service = useMemo(() => (wallet ? createSettlementFacilitatorService(wallet) : null), [wallet]);
  const [routes, setRoutes] = useState<SettlementRouteRecord[]>([]);
  const [rows, setRows] = useState<SettlementDocumentRecord[]>([]);
  const [routePubkey, setRoutePubkey] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [documentHash, setDocumentHash] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [originalAmount, setOriginalAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const activeWorkspaceId = selectedWorkspaceId ?? workspaces[0]?.id ?? null;

  async function refresh() {
    if (!service || !wallet || !activeWorkspaceId) {
      setRoutes([]);
      setRows([]);
      setRoutePubkey("");
      return;
    }
    const [nextRoutes, nextRows, workspaceRouteLinks] = await Promise.all([
      service.listRoutes(),
      service.listDocuments(),
      controlPlaneService.listWorkspaceSettlementRoutes(activeWorkspaceId),
    ]);
    const workspaceRoutePdas = new Set(
      workspaceRouteLinks.filter((route) => route.status === "active").map((route) => route.routePda),
    );
    const scopedRoutes = nextRoutes.filter(
      (route) => workspaceRoutePdas.has(route.pubkey) && route.facilitator === wallet.publicKey.toBase58(),
    );
    setRoutes(scopedRoutes);
    setRows(nextRows.filter((document) => workspaceRoutePdas.has(document.route)));
    setRoutePubkey((current) =>
      scopedRoutes.some((route) => route.pubkey === current) ? current : scopedRoutes[0]?.pubkey ?? "",
    );
  }

  useEffect(() => {
    refresh().catch((error) => setMessage(String(error)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId, service, wallet]);

  async function handleRegister() {
    if (!service) return;
    setBusy(true);
    setMessage(null);
    try {
      const selectedRoute = routes.find((route) => route.pubkey === routePubkey);
      if (!selectedRoute || selectedRoute.facilitator !== wallet?.publicKey.toBase58()) {
        throw new Error("Select a route owned by the current facilitator in this workspace.");
      }
      const pubkey = await service.registerDocument({
        routePubkey,
        invoiceNo,
        documentHash,
        currency,
        originalAmount: parseAmountToMinor(originalAmount),
      });
      setMessage(`Registered document ${pubkey}`);
      setInvoiceNo("");
      setDocumentHash("");
      setOriginalAmount("");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Settlement Documents" subtitle="Invoice documents coordinated by the facilitator." />
      {message ? <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">{message}</p> : null}
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-900">Register Document</h2>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <Select
            label="Route"
            value={routePubkey}
            onChange={(event) => setRoutePubkey(event.target.value)}
            options={[
              { value: "", label: "Select a route..." },
              ...routes.map((route) => ({ value: route.pubkey, label: route.routeCode })),
            ]}
          />
          <Input label="Invoice No" value={invoiceNo} onChange={(event) => setInvoiceNo(event.target.value)} />
          <Input label="Document Hash" value={documentHash} onChange={(event) => setDocumentHash(event.target.value)} />
          <Input label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value)} />
          <Input label="Original Amount" value={originalAmount} onChange={(event) => setOriginalAmount(event.target.value)} />
        </div>
        <div className="mt-3">
          <Button disabled={!wallet || busy || !routePubkey || !invoiceNo || !documentHash || !originalAmount} onClick={handleRegister}>
            Register Document
          </Button>
        </div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-900">Documents</h2>
        <div className="mt-2 space-y-2">
          {rows.map((row) => (
            <Link
              key={row.pubkey}
              href={`/app/facilitator/settlements/documents/${row.pubkey}`}
              className="block rounded-md border border-slate-200 px-3 py-2 text-[11px] text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            >
              <p className="font-semibold text-slate-900">{row.invoiceNo}</p>
              <p className="font-mono">{row.pubkey}</p>
              <p>
                Original {formatLamportsAmount(row.originalAmount, row.currency || "USD")} | Open{" "}
                {formatLamportsAmount(row.openAmount, row.currency || "USD")} | Settled{" "}
                {formatLamportsAmount(row.settledAmount, row.currency || "USD")}
              </p>
            </Link>
          ))}
          {rows.length === 0 ? <p className="text-[11px] text-slate-500">No settlement documents loaded.</p> : null}
        </div>
      </section>
    </div>
  );
}
