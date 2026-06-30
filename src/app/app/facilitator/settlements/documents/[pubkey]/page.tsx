"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PublicKey } from "@/lib/api-client/v1/public-key";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/page-title";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import { useWorkspace } from "@/context/workspace-context";
import { compareSettlementInvoice, type SettlementInvoiceMatch } from "@/lib/settlement/invoice-match";
import { deriveInvoicePda, deriveVendorInvoicePda } from "@/lib/api-client/v1/pdas";
import type {
  InvoiceRecord,
  SettlementDocumentRecord,
  SettlementRouteRecord,
  VendorInvoiceRecord,
} from "@/lib/types/domain";
import { formatLamportsAmount } from "@/lib/utils/format";
import { createApSubledgerService } from "@/lib/api-client/v1/buyer";
import { createArSubledgerService } from "@/lib/api-client/v1/supplier";
import { controlPlaneService } from "@/lib/api-client/v1/platform";
import { createSettlementFacilitatorService } from "@/lib/api-client/v1/facilitator";

const DOCUMENT_STATUS: Record<number, string> = {
  1: "Open",
  2: "Partially settled",
  3: "Settled",
  4: "Cancelled",
};

type InvoicePanelProps = {
  title: string;
  invoice: VendorInvoiceRecord | InvoiceRecord | null;
  match: SettlementInvoiceMatch;
};

function MatchResult({ label, matched }: { label: string; matched: boolean }) {
  return (
    <li className={matched ? "text-emerald-700" : "text-rose-700"}>
      {label}: {matched ? "Matched" : "Mismatch"}
    </li>
  );
}

function InvoicePanel({ title, invoice, match }: InvoicePanelProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold text-slate-900">{title}</h2>
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
            match.overall ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {match.overall ? "Matched" : "Mismatch"}
        </span>
      </div>

      {invoice ? (
        <div className="mt-3 space-y-1 text-[11px] text-slate-600">
          <p>Invoice PDA: <span className="break-all font-mono">{invoice.pubkey}</span></p>
          <p>Ledger PDA: <span className="break-all font-mono">{invoice.ledger}</span></p>
          <p>Invoice number: {invoice.invoiceNo}</p>
          <p>Original: {formatLamportsAmount(invoice.originalAmount, invoice.currency || "USD")}</p>
          <p>Open: {formatLamportsAmount(invoice.openAmount, invoice.currency || "USD")}</p>
          <p>Currency: {invoice.currency}</p>
          <p>Status: {invoice.status}</p>
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-rose-700">Invoice not found.</p>
      )}

      <ul className="mt-3 grid gap-1 text-[10px] sm:grid-cols-2">
        <MatchResult label="Expected PDA" matched={match.fields.pda} />
        <MatchResult label="Route ledger" matched={match.fields.ledger} />
        <MatchResult label="Invoice number" matched={match.fields.invoiceNo} />
        <MatchResult label="Original amount" matched={match.fields.originalAmount} />
        <MatchResult label="Currency" matched={match.fields.currency} />
      </ul>
    </section>
  );
}

export default function SettlementDocumentDetailPage() {
  const params = useParams<{ pubkey: string }>();
  const { wallet } = useEmbeddedWallet();
  const { selectedWorkspaceId, workspaces } = useWorkspace();
  const service = useMemo(() => (wallet ? createSettlementFacilitatorService(wallet) : null), [wallet]);
  const apService = useMemo(() => (wallet ? createApSubledgerService(wallet) : null), [wallet]);
  const arService = useMemo(() => (wallet ? createArSubledgerService(wallet) : null), [wallet]);
  const activeWorkspaceId = selectedWorkspaceId ?? workspaces[0]?.id ?? null;

  const [document, setDocument] = useState<SettlementDocumentRecord | null>(null);
  const [route, setRoute] = useState<SettlementRouteRecord | null>(null);
  const [buyerInvoice, setBuyerInvoice] = useState<VendorInvoiceRecord | null>(null);
  const [supplierInvoice, setSupplierInvoice] = useState<InvoiceRecord | null>(null);
  const [buyerMatch, setBuyerMatch] = useState<SettlementInvoiceMatch | null>(null);
  const [supplierMatch, setSupplierMatch] = useState<SettlementInvoiceMatch | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!service || !apService || !arService || !wallet || !activeWorkspaceId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        setMessage(null);
        setDocument(null);
        setRoute(null);

        const [nextDocument, workspaceRouteLinks] = await Promise.all([
          service.getDocument(params.pubkey),
          controlPlaneService.listWorkspaceSettlementRoutes(activeWorkspaceId),
        ]);
        if (!nextDocument) {
          throw new Error("Settlement document was not found.");
        }

        const hasWorkspaceRoute = workspaceRouteLinks.some(
          (link) => link.status === "active" && link.routePda === nextDocument.route,
        );
        if (!hasWorkspaceRoute) {
          throw new Error("Settlement document is not available in the current workspace.");
        }

        const nextRoute = await service.getRoute(nextDocument.route);
        if (!nextRoute || nextRoute.facilitator !== wallet.publicKey.toBase58()) {
          throw new Error("Settlement document is not owned by the connected facilitator.");
        }

        const [buyerInvoicePda] = deriveVendorInvoicePda(new PublicKey(nextRoute.buyerApLedger), nextDocument.invoiceNo);
        const [supplierInvoicePda] = deriveInvoicePda(new PublicKey(nextRoute.supplierArLedger), nextDocument.invoiceNo);
        const [nextBuyerInvoice, nextSupplierInvoice] = await Promise.all([
          apService.getVendorInvoice(buyerInvoicePda.toBase58()),
          arService.getInvoice(supplierInvoicePda.toBase58()),
        ]);
        if (cancelled) return;

        const expectedBuyer = {
          pubkey: buyerInvoicePda.toBase58(),
          ledger: nextRoute.buyerApLedger,
          invoiceNo: nextDocument.invoiceNo,
          originalAmount: nextDocument.originalAmount,
          currency: nextDocument.currency,
        };
        const expectedSupplier = {
          pubkey: supplierInvoicePda.toBase58(),
          ledger: nextRoute.supplierArLedger,
          invoiceNo: nextDocument.invoiceNo,
          originalAmount: nextDocument.originalAmount,
          currency: nextDocument.currency,
        };

        setDocument(nextDocument);
        setRoute(nextRoute);
        setBuyerInvoice(nextBuyerInvoice);
        setSupplierInvoice(nextSupplierInvoice);
        setBuyerMatch(compareSettlementInvoice(nextBuyerInvoice, expectedBuyer));
        setSupplierMatch(compareSettlementInvoice(nextSupplierInvoice, expectedSupplier));
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : String(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, apService, arService, params.pubkey, refreshKey, service, wallet]);

  const canCancelDocument = Boolean(
    document &&
      document.status === 1 &&
      document.settledAmount === 0 &&
      document.openAmount === document.originalAmount,
  );

  async function handleCancelDocument() {
    if (!service || !document || !route || !canCancelDocument) return;
    if (!window.confirm("Mark this settlement document invalid and cancel it permanently?")) return;

    setCancelBusy(true);
    setCancelMessage(null);
    try {
      await service.cancelDocument({
        routePubkey: route.pubkey,
        documentPubkey: document.pubkey,
      });
      setCancelMessage(`Cancelled settlement document ${document.pubkey}`);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setCancelMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setCancelBusy(false);
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-sm text-slate-500">Loading settlement document...</div>;
  }

  return (
    <div className="space-y-4">
      <PageTitle
        title={document?.invoiceNo ?? "Settlement Document"}
        subtitle={params.pubkey}
        actions={
          <Link href="/app/facilitator/settlements/documents" className="text-[11px] underline decoration-slate-300">
            Back to documents
          </Link>
        }
      />

      {message ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{message}</p> : null}
      {cancelMessage ? <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">{cancelMessage}</p> : null}

      {document && route && buyerMatch && supplierMatch ? (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="text-xs font-semibold text-slate-900">Settlement Document</h2>
            <div className="mt-3 grid gap-2 text-[11px] text-slate-600 md:grid-cols-2">
              <p>Document PDA: <span className="break-all font-mono">{document.pubkey}</span></p>
              <p>Route: {route.routeCode}</p>
              <p>Route PDA: <span className="break-all font-mono">{document.route}</span></p>
              <p>Invoice number: {document.invoiceNo}</p>
              <p>Document hash: <span className="break-all font-mono">{document.documentHash}</span></p>
              <p>Currency: {document.currency}</p>
              <p>Original: {formatLamportsAmount(document.originalAmount, document.currency || "USD")}</p>
              <p>Open: {formatLamportsAmount(document.openAmount, document.currency || "USD")}</p>
              <p>Settled: {formatLamportsAmount(document.settledAmount, document.currency || "USD")}</p>
              <p>Status: {DOCUMENT_STATUS[document.status] ?? `Unknown (${document.status})`}</p>
            </div>
            {canCancelDocument ? (
              <div className="mt-4 border-t border-slate-200 pt-3">
                <Button disabled={cancelBusy} onClick={handleCancelDocument}>
                  {cancelBusy ? "Cancelling..." : "Mark Invalid / Cancel Document"}
                </Button>
              </div>
            ) : null}
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <InvoicePanel title="Buyer AP Invoice" invoice={buyerInvoice} match={buyerMatch} />
            <InvoicePanel title="Supplier AR Invoice" invoice={supplierInvoice} match={supplierMatch} />
          </div>
        </>
      ) : null}
    </div>
  );
}
