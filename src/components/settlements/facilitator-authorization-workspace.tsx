"use client";

import { useEffect, useMemo, useState } from "react";
import { PublicKey } from "@/lib/api-client/v1/public-key";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import { useWorkspace } from "@/context/workspace-context";
import { useRoleGate } from "@/hooks/use-role-gate";
import type { BuyerLedgerRecord, LedgerRecord } from "@/lib/types/domain";
import { createApSubledgerService } from "@/lib/api-client/v1/buyer";
import { filterBuyerLedgersByWorkspaceLinks } from "@/lib/api-client/v1/buyer-ledger-workspace";
import { accountingEngineService, type PostingDelegateStatus } from "@/lib/api-client/v1/accounting";
import { createArSubledgerService } from "@/lib/api-client/v1/supplier";
import { controlPlaneService } from "@/lib/api-client/v1/platform";

type LedgerSide = "buyer" | "supplier";

type DelegableLedger = {
  pubkey: string;
  ledgerCode: string;
  accountingLedger: string;
  authority: string;
};

function mapBuyerLedger(row: BuyerLedgerRecord): DelegableLedger {
  return {
    pubkey: row.pubkey,
    ledgerCode: row.ledgerCode,
    accountingLedger: row.accountingLedger,
    authority: row.authority,
  };
}

function mapSupplierLedger(row: LedgerRecord): DelegableLedger {
  return {
    pubkey: row.pubkey,
    ledgerCode: row.ledgerCode,
    accountingLedger: row.accountingLedger,
    authority: row.authority,
  };
}

function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function parsePublicKey(value: string): PublicKey | null {
  try {
    return value.trim() ? new PublicKey(value.trim()) : null;
  } catch {
    return null;
  }
}

export function FacilitatorAuthorizationWorkspace({ side }: { side: LedgerSide }) {
  const { wallet } = useEmbeddedWallet();
  const { selectedWorkspaceId, workspaces } = useWorkspace();
  const { canWriteTransactions } = useRoleGate();
  const apService = useMemo(() => (wallet ? createApSubledgerService(wallet) : null), [wallet]);
  const arService = useMemo(() => (wallet ? createArSubledgerService(wallet) : null), [wallet]);

  const [ledgers, setLedgers] = useState<DelegableLedger[]>([]);
  const [ledgerPubkey, setLedgerPubkey] = useState("");
  const [facilitatorPubkey, setFacilitatorPubkey] = useState("");
  const [status, setStatus] = useState<PostingDelegateStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const activeWorkspaceId = selectedWorkspaceId ?? workspaces[0]?.id ?? null;

  const selectedLedger = useMemo(
    () => ledgers.find((ledger) => ledger.pubkey === ledgerPubkey) ?? null,
    [ledgerPubkey, ledgers],
  );
  const facilitatorKey = useMemo(() => parsePublicKey(facilitatorPubkey), [facilitatorPubkey]);
  const currentSigner = wallet?.publicKey.toBase58() ?? "";
  const hasAuthority = Boolean(selectedLedger && currentSigner && selectedLedger.authority === currentSigner);
  const title = side === "buyer" ? "Buyer Facilitator Authorization" : "Supplier Facilitator Authorization";
  const subtitle =
    side === "buyer"
      ? "Grant settlement posting access for Buyer AP accounting ledgers."
      : "Grant settlement posting access for Supplier AR accounting ledgers.";

  async function refreshLedgers() {
    if (!wallet || !activeWorkspaceId) {
      setLedgers([]);
      setLedgerPubkey("");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let nextLedgers: DelegableLedger[];
      if (side === "buyer") {
        const [buyerLedgers, links] = await Promise.all([
          apService?.listBuyerLedgers() ?? Promise.resolve([]),
          controlPlaneService.listBuyerLedgerLinks(activeWorkspaceId),
        ]);
        nextLedgers = filterBuyerLedgersByWorkspaceLinks(buyerLedgers, links).map(mapBuyerLedger);
      } else {
        const [supplierLedgers, links] = await Promise.all([
          arService?.listLedgers() ?? Promise.resolve([]),
          controlPlaneService.listLedgerLinks(activeWorkspaceId),
        ]);
        const supplierLedgerPdas = new Set(
          links.filter((link) => link.status === "active").map((link) => link.ledgerPda),
        );
        nextLedgers = supplierLedgers.filter((ledger) => supplierLedgerPdas.has(ledger.pubkey)).map(mapSupplierLedger);
      }
      setLedgers(nextLedgers);
      setLedgerPubkey((current) =>
        nextLedgers.some((ledger) => ledger.pubkey === current) ? current : nextLedgers[0]?.pubkey ?? "",
      );
    } catch (error) {
      setMessage(toMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function refreshStatus() {
    if (!selectedLedger || !facilitatorKey) {
      setStatus(null);
      return;
    }

    try {
      const nextStatus = await accountingEngineService.getPostingDelegateStatus(
        new PublicKey(selectedLedger.accountingLedger),
        facilitatorKey,
      );
      setStatus(nextStatus);
    } catch (error) {
      setStatus(null);
      setMessage(toMessage(error));
    }
  }

  async function handleAuthorize() {
    if (!wallet || !selectedLedger || !facilitatorKey) return;
    setBusy(true);
    setMessage(null);
    try {
      const signature = await accountingEngineService.authorizePostingDelegate(
        new PublicKey(selectedLedger.accountingLedger),
        facilitatorKey,
        wallet,
      );
      setMessage(`Authorized delegate ${signature}`);
      await refreshStatus();
    } catch (error) {
      setMessage(toMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    if (!wallet || !selectedLedger || !facilitatorKey) return;
    setBusy(true);
    setMessage(null);
    try {
      const signature = await accountingEngineService.revokePostingDelegate(
        new PublicKey(selectedLedger.accountingLedger),
        facilitatorKey,
        wallet,
      );
      setMessage(`Revoked delegate ${signature}`);
      await refreshStatus();
    } catch (error) {
      setMessage(toMessage(error));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refreshLedgers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId, side, wallet]);

  useEffect(() => {
    void refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLedger?.accountingLedger, facilitatorPubkey]);

  return (
    <div className="space-y-4">
      <PageTitle title={title} subtitle={subtitle} />
      {message ? <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">{message}</p> : null}
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xs font-semibold text-slate-900">Delegate Access</h2>
          <StatusBadge label={status?.active ? "active" : "not active"} />
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <Select
            label={side === "buyer" ? "Buyer AP Ledger" : "Supplier AR Ledger"}
            value={ledgerPubkey}
            onChange={(event) => setLedgerPubkey(event.target.value)}
            options={[
              { value: "", label: loading ? "Loading ledgers..." : "Select a ledger..." },
              ...ledgers.map((ledger) => ({ value: ledger.pubkey, label: ledger.ledgerCode })),
            ]}
          />
          <Input
            label="Facilitator Wallet"
            value={facilitatorPubkey}
            onChange={(event) => setFacilitatorPubkey(event.target.value)}
          />
        </div>
        <div className="mt-3 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600 md:grid-cols-2">
          <p>Accounting ledger: <span className="font-mono">{selectedLedger?.accountingLedger ?? "-"}</span></p>
          <p>Posting delegate: <span className="font-mono">{status?.postingDelegatePubkey ?? "-"}</span></p>
          <p>Ledger authority: <span className="font-mono">{selectedLedger?.authority ?? "-"}</span></p>
          <p>Current signer: <span className="font-mono">{currentSigner || "-"}</span></p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            disabled={!canWriteTransactions || !wallet || !selectedLedger || !facilitatorKey || !hasAuthority || busy}
            onClick={handleAuthorize}
          >
            Authorize
          </Button>
          <Button
            variant="secondary"
            disabled={!canWriteTransactions || !wallet || !selectedLedger || !facilitatorKey || !hasAuthority || busy || !status?.active}
            onClick={handleRevoke}
          >
            Revoke
          </Button>
          <Button variant="ghost" disabled={!selectedLedger || !facilitatorKey || busy} onClick={refreshStatus}>
            Refresh
          </Button>
        </div>
        {!hasAuthority && selectedLedger ? (
          <p className="mt-2 text-[11px] text-amber-700">Selected ledger requires its authority wallet.</p>
        ) : null}
      </section>
    </div>
  );
}
