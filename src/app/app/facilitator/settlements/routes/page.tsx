"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import { useWorkspace } from "@/context/workspace-context";
import { deriveSettlementRoutePda } from "@/lib/solana/pdas";
import type { SettlementRouteRecord } from "@/lib/types/domain";
import { controlPlaneService } from "@/services/control-plane-service";
import { createSettlementFacilitatorService } from "@/services/settlement-facilitator-service";

export default function SettlementRoutesPage() {
  const { wallet } = useEmbeddedWallet();
  const { selectedWorkspaceId, workspaces } = useWorkspace();
  const service = useMemo(() => (wallet ? createSettlementFacilitatorService(wallet) : null), [wallet]);
  const [rows, setRows] = useState<SettlementRouteRecord[]>([]);
  const [routeCode, setRouteCode] = useState("");
  const [buyerApLedger, setBuyerApLedger] = useState("");
  const [supplierArLedger, setSupplierArLedger] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const activeWorkspaceId = selectedWorkspaceId ?? workspaces[0]?.id ?? null;

  async function refresh() {
    if (!service || !wallet || !activeWorkspaceId) {
      setRows([]);
      return;
    }
    const [nextRoutes, workspaceRouteLinks] = await Promise.all([
      service.listRoutes(),
      controlPlaneService.listWorkspaceSettlementRoutes(activeWorkspaceId),
    ]);
    const workspaceRoutePdas = new Set(
      workspaceRouteLinks.filter((route) => route.status === "active").map((route) => route.routePda),
    );
    setRows(
      nextRoutes.filter(
        (route) => workspaceRoutePdas.has(route.pubkey) && route.facilitator === wallet.publicKey.toBase58(),
      ),
    );
  }

  useEffect(() => {
    refresh().catch((error) => setMessage(String(error)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId, service, wallet]);

  async function handleCreate() {
    if (!service || !wallet) return;
    setBusy(true);
    setMessage(null);
    try {
      if (!activeWorkspaceId) {
        throw new Error("Select a workspace before creating a settlement route.");
      }
      const [derivedRoute] = deriveSettlementRoutePda(wallet.publicKey, routeCode);
      let createdRoute = await service.getRoute(derivedRoute.toBase58());
      const recoveredExistingRoute = Boolean(createdRoute);

      if (createdRoute) {
        if (
          createdRoute.buyerApLedger !== buyerApLedger ||
          createdRoute.supplierArLedger !== supplierArLedger
        ) {
          throw new Error("An existing route with this code uses different Buyer or Supplier ledgers.");
        }
      } else {
        const pubkey = await service.initializeRoute({
          routeCode,
          buyerApLedgerPubkey: buyerApLedger,
          supplierArLedgerPubkey: supplierArLedger,
        });
        createdRoute = await service.getRoute(pubkey);
      }

      if (!createdRoute) {
        throw new Error("Created route could not be loaded for workspace linking.");
      }
      const pubkey = createdRoute.pubkey;
      await controlPlaneService.upsertWorkspaceSettlementRoute({
        workspaceId: activeWorkspaceId,
        routePda: pubkey,
        routeCode: createdRoute.routeCode,
        facilitatorPubkey: createdRoute.facilitator,
        buyerAccountingLedger: createdRoute.buyerAccountingLedger,
        supplierAccountingLedger: createdRoute.supplierAccountingLedger,
      });
      setRows((current) => [
        ...current.filter((route) => route.pubkey !== createdRoute.pubkey),
        createdRoute,
      ]);
      setMessage(`${recoveredExistingRoute ? "Linked existing" : "Created"} route ${pubkey}`);
      setRouteCode("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Settlement Routes" subtitle="Buyer and supplier ledger mappings for facilitator settlement." />
      {message ? <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">{message}</p> : null}
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-900">Create Route</h2>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <Input label="Route Code" value={routeCode} onChange={(event) => setRouteCode(event.target.value)} />
          <Input label="Buyer AP Ledger" value={buyerApLedger} onChange={(event) => setBuyerApLedger(event.target.value)} />
          <Input label="Supplier AR Ledger" value={supplierArLedger} onChange={(event) => setSupplierArLedger(event.target.value)} />
        </div>
        <div className="mt-3">
          <Button disabled={!wallet || busy || !routeCode || !buyerApLedger || !supplierArLedger} onClick={handleCreate}>
            Create Route
          </Button>
        </div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-900">Routes</h2>
        <div className="mt-2 space-y-2">
          {rows.map((row) => (
            <Link
              key={row.pubkey}
              href={`/app/facilitator/settlements/routes/${row.pubkey}`}
              className="block rounded-md border border-slate-200 px-3 py-2 text-[11px] text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            >
              <p className="font-semibold text-slate-900">{row.routeCode}</p>
              <p className="font-mono">{row.pubkey}</p>
              <p>Buyer AP {row.buyerApLedger}</p>
              <p>Supplier AR {row.supplierArLedger}</p>
              <p>Buyer GL {row.buyerAccountingLedger}</p>
              <p>Supplier GL {row.supplierAccountingLedger}</p>
            </Link>
          ))}
          {rows.length === 0 ? <p className="text-[11px] text-slate-500">No settlement routes loaded.</p> : null}
        </div>
      </section>
    </div>
  );
}
