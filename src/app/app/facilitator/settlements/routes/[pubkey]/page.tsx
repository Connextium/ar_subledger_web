"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { PageTitle } from "@/components/ui/page-title";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import type { BuyerLedgerRecord, LedgerRecord, SettlementRouteRecord } from "@/lib/types/domain";
import { accountingEngineService, type AccountingLedger } from "@/services/accounting-engine-service";
import { createApSubledgerService } from "@/services/ap-subledger-service";
import { createArSubledgerService } from "@/services/ar-subledger-service";
import { createSettlementFacilitatorService } from "@/services/settlement-facilitator-service";

function LedgerIdentity({ label, code, pubkey }: { label: string; code?: string | null; pubkey: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-[11px] text-slate-600">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{code || "Ledger code unavailable"}</p>
      <p className="mt-1 break-all font-mono text-[10px]">{pubkey}</p>
    </div>
  );
}
export default function SettlementRouteDetailPage() {
  const params = useParams<{ pubkey: string }>();
  const { wallet } = useEmbeddedWallet();
  const service = useMemo(() => (wallet ? createSettlementFacilitatorService(wallet) : null), [wallet]);
  const apService = useMemo(() => (wallet ? createApSubledgerService(wallet) : null), [wallet]);
  const arService = useMemo(() => (wallet ? createArSubledgerService(wallet) : null), [wallet]);

  const [route, setRoute] = useState<SettlementRouteRecord | null>(null);
  const [buyerApLedger, setBuyerApLedger] = useState<BuyerLedgerRecord | null>(null);
  const [supplierArLedger, setSupplierArLedger] = useState<LedgerRecord | null>(null);
  const [buyerBaseGl, setBuyerBaseGl] = useState<AccountingLedger | null>(null);
  const [supplierBaseGl, setSupplierBaseGl] = useState<AccountingLedger | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!service || !apService || !arService) {
      setRoute(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        setMessage(null);
        const nextRoute = await service.getRoute(params.pubkey);
        if (!nextRoute) {
          if (!cancelled) setRoute(null);
          return;
        }

        const [nextBuyerAp, nextSupplierAr, nextBuyerGl, nextSupplierGl] = await Promise.all([
          apService.getBuyerLedger(nextRoute.buyerApLedger),
          arService.getLedger(nextRoute.supplierArLedger),
          accountingEngineService.getLedger(new PublicKey(nextRoute.buyerAccountingLedger)),
          accountingEngineService.getLedger(new PublicKey(nextRoute.supplierAccountingLedger)),
        ]);

        if (cancelled) return;
        setRoute(nextRoute);
        setBuyerApLedger(nextBuyerAp);
        setSupplierArLedger(nextSupplierAr);
        setBuyerBaseGl(nextBuyerGl);
        setSupplierBaseGl(nextSupplierGl);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : String(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apService, arService, params.pubkey, service]);

  if (loading) {
    return <div className="py-12 text-center text-sm text-slate-500">Loading settlement route...</div>;
  }

  return (
    <div className="space-y-4">
      <PageTitle
        title={route?.routeCode ?? "Settlement Route"}
        subtitle={params.pubkey}
        actions={
          <Link href="/app/facilitator/settlements/routes" className="text-[11px] underline decoration-slate-300">
            Back to routes
          </Link>
        }
      />

      {message ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{message}</p> : null}

      {route ? (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="text-xs font-semibold text-slate-900">Route Details</h2>
            <div className="mt-2 grid gap-2 text-[11px] text-slate-600 md:grid-cols-2">
              <p>Route PDA: <span className="break-all font-mono">{route.pubkey}</span></p>
              <p>Facilitator: <span className="break-all font-mono">{route.facilitator}</span></p>
              <p>Status: {route.active ? "Active" : "Inactive"}</p>
              <p>Documents: {route.documentCount}</p>
              <p>Next settlement sequence: {route.nextSettlementSeq}</p>
              <p>Buyer authority: <span className="break-all font-mono">{route.buyerAuthority}</span></p>
              <p>Supplier authority: <span className="break-all font-mono">{route.supplierAuthority}</span></p>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="text-xs font-semibold text-slate-900">Ledger Identities</h2>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <LedgerIdentity label="Buyer AP Ledger" code={buyerApLedger?.ledgerCode} pubkey={route.buyerApLedger} />
              <LedgerIdentity label="Supplier AR Ledger" code={supplierArLedger?.ledgerCode} pubkey={route.supplierArLedger} />
              <LedgerIdentity
                label="Buyer Base GL"
                code={buyerBaseGl?.account.ledgerCode}
                pubkey={route.buyerAccountingLedger}
              />
              <LedgerIdentity
                label="Supplier Base GL"
                code={supplierBaseGl?.account.ledgerCode}
                pubkey={route.supplierAccountingLedger}
              />
            </div>
          </section>
        </>
      ) : (
        <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500">
          Settlement route was not found or is incompatible with the current program layout.
        </p>
      )}
    </div>
  );
}
