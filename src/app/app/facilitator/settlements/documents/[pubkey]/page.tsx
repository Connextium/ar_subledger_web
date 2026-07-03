"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/page-title";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import { useWorkspace } from "@/context/workspace-context";
import { compareSettlementInvoice, type SettlementInvoiceMatch } from "@/lib/settlement/invoice-match";
import type {
  InvoiceRecord,
  SettlementDocumentRecord,
  SettlementRouteRecord,
  VendorInvoiceRecord,
} from "@/lib/types/domain";
import { formatLamportsAmount } from "@/lib/utils/format";
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
  const activeWorkspaceId = selectedWorkspaceId ?? workspaces[0]?.id ?? null;

  const [document, setDocument] = useState<SettlementDocumentRecord | null>(null);
  const [route, setRoute] = useState<SettlementRouteRecord | null>(null);
  const [buyerInvoice, setBuyerInvoice] = useState<VendorInvoiceRecord | null>(null);
  const [supplierInvoice, setSupplierInvoice] = useState<InvoiceRecord | null>(null);
  const [supplierInvoices, setSupplierInvoices] = useState<InvoiceRecord[]>([]);
  const [buyerMatch, setBuyerMatch] = useState<SettlementInvoiceMatch | null>(null);
  const [supplierMatch, setSupplierMatch] = useState<SettlementInvoiceMatch | null>(null);
  const [matchDebug, setMatchDebug] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!service || !wallet || !activeWorkspaceId) {
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
        setSupplierInvoices([]);
        setMatchDebug(null);

        const [matchedBundle, workspaceRouteLinks] = await Promise.all([
          service.getDocumentMatch(activeWorkspaceId, params.pubkey),
          controlPlaneService.listWorkspaceSettlementRoutes(activeWorkspaceId),
        ]);
        const nextDocument = matchedBundle.document as SettlementDocumentRecord | null;
        if (!nextDocument) {
          throw new Error("Settlement document was not found.");
        }

        const hasWorkspaceRoute = workspaceRouteLinks.some(
          (link) => link.status === "active" && link.routePda === nextDocument.route,
        );
        if (!hasWorkspaceRoute) {
          throw new Error("Settlement document is not available in the current workspace.");
        }

        const nextRoute = (matchedBundle.route ??
          (await service.getRoute(activeWorkspaceId, nextDocument.route))) as SettlementRouteRecord | null;
        if (!nextRoute || nextRoute.facilitator !== wallet.publicKey) {
          throw new Error("Settlement document is not owned by the connected facilitator.");
        }

        const nextBuyerInvoice = (matchedBundle.buyerInvoice as VendorInvoiceRecord | null) ?? null;
        const nextSupplierInvoice = (matchedBundle.supplierInvoice as InvoiceRecord | null) ?? null;
        const nextSupplierInvoices = Array.isArray((matchedBundle as { supplierInvoices?: unknown }).supplierInvoices)
          ? ((matchedBundle as { supplierInvoices: InvoiceRecord[] }).supplierInvoices ?? [])
          : [];
        if (cancelled) return;

        const expectedBuyer = {
          pubkey: "",
          ledger: nextRoute.buyerApLedger,
          invoiceNo: nextDocument.invoiceNo,
          originalAmount: nextDocument.originalAmount,
          currency: nextDocument.currency,
        };
        const expectedSupplier = {
          pubkey: "",
          ledger: nextRoute.supplierArLedger,
          invoiceNo: nextDocument.invoiceNo,
          originalAmount: nextDocument.originalAmount,
          currency: nextDocument.currency,
        };

        setDocument(nextDocument);
        setRoute(nextRoute);
        setBuyerInvoice(nextBuyerInvoice);
        setSupplierInvoice(nextSupplierInvoice);
        setSupplierInvoices(nextSupplierInvoices);
        setMatchDebug((matchedBundle as { debug?: unknown }).debug ?? null);
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
  }, [activeWorkspaceId, params.pubkey, refreshKey, service, wallet]);

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

            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700">
              <p>
                Buyer AP Invoice PDA: {" "}
                <span className="break-all font-mono">
                  {buyerInvoice?.pubkey ?? "Not matched"}
                </span>
              </p>
              <p className="mt-1">
                Supplier AR Invoice PDA: {" "}
                <span className="break-all font-mono">
                  {supplierInvoice?.pubkey ?? "Not matched"}
                </span>
              </p>
            </div>

            <div className="mt-3 rounded-md border border-slate-200 bg-white p-2 text-[11px] text-slate-700">
              <p className="font-semibold text-slate-900">
                Supplier AR invoices with same invoice number (non-cancelled): {supplierInvoices.length}
              </p>
              {supplierInvoices.length > 0 ? (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[680px] border-collapse text-left text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="px-2 py-1 font-medium">Invoice PDA</th>
                        <th className="px-2 py-1 font-medium">Ledger PDA</th>
                        <th className="px-2 py-1 font-medium">Invoice #</th>
                        <th className="px-2 py-1 font-medium">Status</th>
                        <th className="px-2 py-1 font-medium">Original</th>
                        <th className="px-2 py-1 font-medium">Open</th>
                        <th className="px-2 py-1 font-medium">Currency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierInvoices.map((invoice) => (
                        <tr key={invoice.pubkey} className="border-b border-slate-100 align-top">
                          <td className="px-2 py-1 font-mono text-[9px] break-all">{invoice.pubkey}</td>
                          <td className="px-2 py-1 font-mono text-[9px] break-all">{invoice.ledger}</td>
                          <td className="px-2 py-1">{invoice.invoiceNo}</td>
                          <td className="px-2 py-1">{invoice.status}</td>
                          <td className="px-2 py-1">{formatLamportsAmount(invoice.originalAmount, invoice.currency || "USD")}</td>
                          <td className="px-2 py-1">{formatLamportsAmount(invoice.openAmount, invoice.currency || "USD")}</td>
                          <td className="px-2 py-1">{invoice.currency}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-2 text-[10px] text-slate-500">No eligible supplier AR invoice with the same invoice number.</p>
              )}
            </div>

            {canCancelDocument ? (
              <div className="mt-4 border-t border-slate-200 pt-3">
                <Button disabled={cancelBusy} onClick={handleCancelDocument}>
                  {cancelBusy ? "Cancelling..." : "Mark Invalid / Cancel Document"}
                </Button>
              </div>
            ) : null}

            {matchDebug ? (
              <details className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-slate-700">
                <summary className="cursor-pointer font-semibold text-amber-800">
                  Match Debug (facilitator troubleshooting)
                </summary>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2 text-[10px] leading-4 text-slate-700">
                  {JSON.stringify(matchDebug, null, 2)}
                </pre>
              </details>
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
