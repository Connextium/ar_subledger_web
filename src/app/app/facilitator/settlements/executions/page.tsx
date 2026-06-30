"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PublicKey } from "@/lib/api-client/v1/public-key";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageTitle } from "@/components/ui/page-title";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import { useWorkspace } from "@/context/workspace-context";
import type { SettlementDocumentRecord, SettlementExecutionRecord, SettlementRouteRecord } from "@/lib/types/domain";
import { formatLamportsAmount, parseAmountToMinor } from "@/lib/utils/format";
import { accountingEngineService, type PostingDelegateStatus } from "@/lib/api-client/v1/accounting";
import { controlPlaneService } from "@/lib/api-client/v1/platform";
import { createSettlementFacilitatorService } from "@/lib/api-client/v1/facilitator";

export default function SettlementExecutionsPage() {
  const { wallet } = useEmbeddedWallet();
  const { selectedWorkspaceId, workspaces } = useWorkspace();
  const service = useMemo(() => (wallet ? createSettlementFacilitatorService(wallet) : null), [wallet]);
  const [routes, setRoutes] = useState<SettlementRouteRecord[]>([]);
  const [documents, setDocuments] = useState<SettlementDocumentRecord[]>([]);
  const [rows, setRows] = useState<SettlementExecutionRecord[]>([]);
  const [routePubkey, setRoutePubkey] = useState("");
  const [documentPubkey, setDocumentPubkey] = useState("");
  const [settlementSeq, setSettlementSeq] = useState("1");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [delegateStatus, setDelegateStatus] = useState<{
    buyer: PostingDelegateStatus | null;
    supplier: PostingDelegateStatus | null;
  }>({ buyer: null, supplier: null });
  const activeWorkspaceId = selectedWorkspaceId ?? workspaces[0]?.id ?? null;

  const documentsForRoute = useMemo(
    () => documents.filter((document) => (routePubkey ? document.route === routePubkey : true)),
    [documents, routePubkey],
  );
  const selectedRoute = useMemo(
    () => routes.find((route) => route.pubkey === routePubkey) ?? null,
    [routePubkey, routes],
  );
  const hasDelegateApprovals = Boolean(delegateStatus.buyer?.active && delegateStatus.supplier?.active);

  async function refresh() {
    if (!service || !wallet || !activeWorkspaceId) {
      setRoutes([]);
      setDocuments([]);
      setRows([]);
      return;
    }
    const [nextRoutes, nextDocuments, nextRows, workspaceRouteLinks] = await Promise.all([
      service.listRoutes(),
      service.listDocuments(),
      service.listExecutions(),
      controlPlaneService.listWorkspaceSettlementRoutes(activeWorkspaceId),
    ]);
    const activeRoutePdas = new Set(
      workspaceRouteLinks.filter((link) => link.status === "active").map((link) => link.routePda),
    );
    const scopedRoutes = nextRoutes.filter(
      (route) => activeRoutePdas.has(route.pubkey) && route.facilitator === wallet.publicKey.toBase58(),
    );
    const workspaceRoutePdas = new Set(scopedRoutes.map((route) => route.pubkey));
    const scopedDocuments = nextDocuments.filter((document) => workspaceRoutePdas.has(document.route));
    const scopedExecutions = nextRows.filter((execution) => workspaceRoutePdas.has(execution.route));
    setRoutes(scopedRoutes);
    setDocuments(scopedDocuments);
    setRows(scopedExecutions);
    setRoutePubkey((current) =>
      scopedRoutes.some((route) => route.pubkey === current) ? current : scopedRoutes[0]?.pubkey ?? "",
    );
  }

  useEffect(() => {
    refresh().catch((error) => setMessage(String(error)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId, service, wallet]);

  useEffect(() => {
    if (selectedRoute) setSettlementSeq(String(selectedRoute.nextSettlementSeq));
    if (documentsForRoute.length > 0 && !documentsForRoute.some((document) => document.pubkey === documentPubkey)) {
      setDocumentPubkey(documentsForRoute[0].pubkey);
    }
  }, [documentPubkey, documentsForRoute, selectedRoute]);

  useEffect(() => {
    if (!selectedRoute) {
      setDelegateStatus({ buyer: null, supplier: null });
      return;
    }

    void (async () => {
      try {
        const facilitator = new PublicKey(selectedRoute.facilitator);
        const [buyer, supplier] = await Promise.all([
          accountingEngineService.getPostingDelegateStatus(
            new PublicKey(selectedRoute.buyerAccountingLedger),
            facilitator,
          ),
          accountingEngineService.getPostingDelegateStatus(
            new PublicKey(selectedRoute.supplierAccountingLedger),
            facilitator,
          ),
        ]);
        setDelegateStatus({ buyer, supplier });
      } catch (error) {
        setDelegateStatus({ buyer: null, supplier: null });
        setMessage(error instanceof Error ? error.message : String(error));
      }
    })();
  }, [selectedRoute]);

  async function handleExecute() {
    if (!service) return;
    setBusy(true);
    setMessage(null);
    try {
      const pubkey = await service.executeSettlement({
        routePubkey,
        documentPubkey,
        settlementSeq: Number(settlementSeq),
        amountMinor: parseAmountToMinor(amount),
        memo,
      });
      setMessage(`Executed settlement ${pubkey}`);
      setAmount("");
      setMemo("");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Settlement Executions" subtitle="Posted settlement entries across buyer and supplier ledgers." />
      {message ? <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">{message}</p> : null}
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-900">Execute Settlement</h2>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <Select
            label="Route"
            value={routePubkey}
            onChange={(event) => {
              setRoutePubkey(event.target.value);
              setDocumentPubkey("");
            }}
            options={[
              { value: "", label: "Select a route..." },
              ...routes.map((route) => ({ value: route.pubkey, label: route.routeCode })),
            ]}
          />
          <Select
            label="Document"
            value={documentPubkey}
            onChange={(event) => setDocumentPubkey(event.target.value)}
            options={[
              { value: "", label: "Select a document..." },
              ...documentsForRoute.map((document) => ({ value: document.pubkey, label: document.invoiceNo })),
            ]}
          />
          <Input label="Settlement Seq" value={settlementSeq} onChange={(event) => setSettlementSeq(event.target.value)} />
          <Input label="Amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
          <Input label="Memo" value={memo} onChange={(event) => setMemo(event.target.value)} />
        </div>
        <div className="mt-3">
          <Button disabled={!wallet || busy || !routePubkey || !documentPubkey || !amount || !hasDelegateApprovals} onClick={handleExecute}>
            Execute Settlement
          </Button>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-slate-900">Buyer Approval</p>
              <StatusBadge label={delegateStatus.buyer?.active ? "active" : "not active"} />
            </div>
            <p className="mt-1 font-mono">{delegateStatus.buyer?.postingDelegatePubkey ?? "-"}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-slate-900">Supplier Approval</p>
              <StatusBadge label={delegateStatus.supplier?.active ? "active" : "not active"} />
            </div>
            <p className="mt-1 font-mono">{delegateStatus.supplier?.postingDelegatePubkey ?? "-"}</p>
          </div>
        </div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-900">Executions</h2>
        <div className="mt-2 space-y-2">
          {rows.map((row) => (
            <div key={row.pubkey} className="rounded-md border border-slate-200 px-3 py-2 text-[11px] text-slate-600">
              <Link
                href={`/app/facilitator/settlements/executions/${row.pubkey}`}
                className="font-semibold text-slate-900 underline decoration-slate-300"
              >
                Settlement #{row.settlementSeq}
              </Link>
              <p className="font-mono">{row.pubkey}</p>
              <p>
                Amount {formatLamportsAmount(row.amount, documents.find((document) => document.pubkey === row.document)?.currency || "USD")} | Buyer JE {row.buyerJournalEntryId} | Supplier JE {row.supplierJournalEntryId}
              </p>
            </div>
          ))}
          {rows.length === 0 ? <p className="text-[11px] text-slate-500">No settlement executions loaded.</p> : null}
        </div>
      </section>
    </div>
  );
}
