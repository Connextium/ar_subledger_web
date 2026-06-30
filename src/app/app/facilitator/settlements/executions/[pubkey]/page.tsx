"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PublicKey } from "@/lib/api-client/v1/public-key";
import { PageTitle } from "@/components/ui/page-title";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import { useWorkspace } from "@/context/workspace-context";
import type {
  SettlementDocumentRecord,
  SettlementExecutionRecord,
  SettlementRouteRecord,
} from "@/lib/types/domain";
import { formatLamportsAmount } from "@/lib/utils/format";
import { accountingEngineService, type JournalEntry } from "@/lib/api-client/v1/accounting";
import { controlPlaneService } from "@/lib/api-client/v1/platform";
import { createSettlementFacilitatorService } from "@/lib/api-client/v1/facilitator";

const DOCUMENT_STATUS: Record<number, string> = {
  1: "Open",
  2: "Partially settled",
  3: "Settled",
  4: "Cancelled",
};

function formatTimestamp(seconds: number | bigint): string {
  return new Date(Number(seconds) * 1000).toLocaleString();
}

function JournalPanel({
  title,
  journal,
  expectedPda,
  currency,
}: {
  title: string;
  journal: JournalEntry | null;
  expectedPda: string;
  currency: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <h2 className="text-xs font-semibold text-slate-900">{title}</h2>
      {journal ? (
        <div className="mt-3 space-y-1 text-[11px] text-slate-600">
          <p>Journal PDA: <span className="break-all font-mono">{journal.publicKey.toBase58()}</span></p>
          <p>Entry ID: {journal.account.entryId.toString()}</p>
          <p>Ledger PDA: <span className="break-all font-mono">{journal.account.ledger.toBase58()}</span></p>
          <p>External reference: {journal.account.externalRef}</p>
          <p>Memo: {journal.account.memo || "-"}</p>
          <p>Total debit: {formatLamportsAmount(Number(journal.account.totalDebit), currency)}</p>
          <p>Total credit: {formatLamportsAmount(Number(journal.account.totalCredit), currency)}</p>
          <p>Line count: {journal.account.lineCount}</p>
          <p>Posted: {formatTimestamp(journal.account.postedAt)}</p>
        </div>
      ) : (
        <div className="mt-3 text-[11px] text-rose-700">
          <p>Journal entry not found.</p>
          <p className="break-all font-mono">{expectedPda}</p>
        </div>
      )}
    </section>
  );
}

export default function SettlementExecutionDetailPage() {
  const params = useParams<{ pubkey: string }>();
  const { wallet } = useEmbeddedWallet();
  const { selectedWorkspaceId, workspaces } = useWorkspace();
  const service = useMemo(() => (wallet ? createSettlementFacilitatorService(wallet) : null), [wallet]);
  const activeWorkspaceId = selectedWorkspaceId ?? workspaces[0]?.id ?? null;

  const [execution, setExecution] = useState<SettlementExecutionRecord | null>(null);
  const [route, setRoute] = useState<SettlementRouteRecord | null>(null);
  const [document, setDocument] = useState<SettlementDocumentRecord | null>(null);
  const [buyerJournal, setBuyerJournal] = useState<JournalEntry | null>(null);
  const [supplierJournal, setSupplierJournal] = useState<JournalEntry | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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
        const [nextExecution, workspaceRouteLinks] = await Promise.all([
          service.getExecution(params.pubkey),
          controlPlaneService.listWorkspaceSettlementRoutes(activeWorkspaceId),
        ]);
        if (!nextExecution) throw new Error("Settlement execution was not found.");

        const hasWorkspaceRoute = workspaceRouteLinks.some(
          (link) => link.status === "active" && link.routePda === nextExecution.route,
        );
        if (!hasWorkspaceRoute) {
          throw new Error("Settlement execution is not available in the current workspace.");
        }

        const nextRoute = await service.getRoute(nextExecution.route);
        if (!nextRoute || nextRoute.facilitator !== wallet.publicKey.toBase58()) {
          throw new Error("Settlement execution is not owned by the connected facilitator.");
        }

        const [nextDocument, nextBuyerJournal, nextSupplierJournal] = await Promise.all([
          service.getDocument(nextExecution.document),
          accountingEngineService.getJournalEntry(
            new PublicKey(nextRoute.buyerAccountingLedger),
            BigInt(nextExecution.buyerJournalEntryId),
          ),
          accountingEngineService.getJournalEntry(
            new PublicKey(nextRoute.supplierAccountingLedger),
            BigInt(nextExecution.supplierJournalEntryId),
          ),
        ]);
        if (cancelled) return;

        setExecution(nextExecution);
        setRoute(nextRoute);
        setDocument(nextDocument);
        setBuyerJournal(nextBuyerJournal);
        setSupplierJournal(nextSupplierJournal);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : String(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, params.pubkey, service, wallet]);

  if (loading) {
    return <div className="py-12 text-center text-sm text-slate-500">Loading settlement execution...</div>;
  }

  const currency = document?.currency || "USD";

  return (
    <div className="space-y-4">
      <PageTitle
        title={execution ? `Settlement #${execution.settlementSeq}` : "Settlement Details"}
        subtitle={params.pubkey}
        actions={
          <Link href="/app/facilitator/settlements/executions" className="text-[11px] underline decoration-slate-300">
            Back to settlements
          </Link>
        }
      />

      {message ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{message}</p> : null}

      {execution && route ? (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="text-xs font-semibold text-slate-900">Settlement Execution</h2>
            <div className="mt-3 grid gap-2 text-[11px] text-slate-600 md:grid-cols-2">
              <p>Execution PDA: <span className="break-all font-mono">{execution.pubkey}</span></p>
              <p>Sequence: {execution.settlementSeq}</p>
              <p>Amount: {formatLamportsAmount(execution.amount, currency)}</p>
              <p>Executed: {formatTimestamp(execution.executedAt)}</p>
              <p className="md:col-span-2">Memo: {execution.memo || "-"}</p>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="text-xs font-semibold text-slate-900">Linked Route</h2>
            <div className="mt-3 grid gap-2 text-[11px] text-slate-600 md:grid-cols-2">
              <p>Route code: {route.routeCode}</p>
              <p>Status: {route.active ? "Active" : "Inactive"}</p>
              <p>Route PDA: <span className="break-all font-mono">{route.pubkey}</span></p>
              <p>Buyer AP: <span className="break-all font-mono">{route.buyerApLedger}</span></p>
              <p>Supplier AR: <span className="break-all font-mono">{route.supplierArLedger}</span></p>
              <p>Buyer GL: <span className="break-all font-mono">{route.buyerAccountingLedger}</span></p>
              <p>Supplier GL: <span className="break-all font-mono">{route.supplierAccountingLedger}</span></p>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="text-xs font-semibold text-slate-900">Settlement Document</h2>
            {document ? (
              <div className="mt-3 grid gap-2 text-[11px] text-slate-600 md:grid-cols-2">
                <p>Document PDA: <span className="break-all font-mono">{document.pubkey}</span></p>
                <p>Invoice number: {document.invoiceNo}</p>
                <p>Document hash: <span className="break-all font-mono">{document.documentHash}</span></p>
                <p>Currency: {document.currency}</p>
                <p>Original: {formatLamportsAmount(document.originalAmount, currency)}</p>
                <p>Open: {formatLamportsAmount(document.openAmount, currency)}</p>
                <p>Settled: {formatLamportsAmount(document.settledAmount, currency)}</p>
                <p>Status: {DOCUMENT_STATUS[document.status] ?? `Unknown (${document.status})`}</p>
              </div>
            ) : (
              <p className="mt-3 text-[11px] text-rose-700">Linked settlement document was not found.</p>
            )}
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <JournalPanel
              title="Buyer Journal Entry"
              journal={buyerJournal}
              expectedPda={execution.buyerJournalEntry}
              currency={currency}
            />
            <JournalPanel
              title="Supplier Journal Entry"
              journal={supplierJournal}
              expectedPda={execution.supplierJournalEntry}
              currency={currency}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
