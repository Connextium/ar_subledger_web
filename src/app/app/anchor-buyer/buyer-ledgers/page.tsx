"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import { useWorkspace } from "@/context/workspace-context";
import type { BuyerLedgerRecord } from "@/lib/types/domain";
import { accountingEngineService, type AccountingLedger } from "@/lib/api-client/v1/accounting";
import { createApSubledgerService } from "@/lib/api-client/v1/buyer";
import { filterBuyerLedgersByWorkspaceLinks } from "@/lib/api-client/v1/buyer-ledger-workspace";
import { controlPlaneService } from "@/lib/api-client/v1/platform";

export default function BuyerLedgersPage() {
  const { wallet } = useEmbeddedWallet();
  const { selectedWorkspaceId, workspaces } = useWorkspace();
  const service = useMemo(() => (wallet ? createApSubledgerService(wallet) : null), [wallet]);
  const [rows, setRows] = useState<BuyerLedgerRecord[]>([]);
  const [accountingLedgers, setAccountingLedgers] = useState<AccountingLedger[]>([]);
  const [ledgerCode, setLedgerCode] = useState("");
  const [accountingLedgerPubkey, setAccountingLedgerPubkey] = useState("");
  const [apControlAccountCode, setApControlAccountCode] = useState("2100");
  const [purchaseAccountCode, setPurchaseAccountCode] = useState("5000");
  const [cashAccountCode, setCashAccountCode] = useState("1000");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const activeWorkspaceId = selectedWorkspaceId ?? workspaces[0]?.id ?? null;

  useEffect(() => {
    setRows([]);

    if (!service || !activeWorkspaceId) {
      return;
    }

    let cancelled = false;
    void Promise.all([
      service.listBuyerLedgers(activeWorkspaceId),
      controlPlaneService.listBuyerLedgerLinks(activeWorkspaceId),
      controlPlaneService.listLedgerLinks(activeWorkspaceId),
    ])
      .then(([ledgers, links, workspaceLedgerLinks]) => {
        if (!cancelled) {
          setRows(filterBuyerLedgersByWorkspaceLinks(ledgers, links, workspaceLedgerLinks));
        }
      })
      .catch((error) => {
        if (!cancelled) setMessage(String(error));
      });

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, service]);

  useEffect(() => {
    if (!wallet) {
      setAccountingLedgers([]);
      setAccountingLedgerPubkey("");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        if (!activeWorkspaceId) {
          setAccountingLedgers([]);
          setAccountingLedgerPubkey("");
          return;
        }

        const ledgers = await accountingEngineService.listLedgersByAuthority({
          workspaceId: activeWorkspaceId,
          authority: wallet.publicKey,
        });
        if (cancelled) return;

        setAccountingLedgers(ledgers);
        setAccountingLedgerPubkey((current) => current || ledgers[0]?.pubkey || "");
      } catch (error) {
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : String(error));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, wallet]);

  async function handleCreate() {
    if (!service || !wallet) return;
    setBusy(true);
    setMessage(null);
    try {
      if (!activeWorkspaceId) {
        throw new Error("Select a workspace before creating a Buyer Ledger.");
      }
      const pubkey = await service.initializeBuyerLedger({
        workspaceId: activeWorkspaceId,
        ledgerCode,
        accountingLedgerPubkey,
        apControlAccountCode: Number(apControlAccountCode),
        purchaseAccountCode: Number(purchaseAccountCode),
        cashAccountCode: Number(cashAccountCode),
      });
      await controlPlaneService.upsertBuyerLedgerLink({
        workspaceId: activeWorkspaceId,
        ledgerPda: pubkey,
        ledgerCode,
        authorityPubkey: wallet.publicKey,
        accountingLedgerKey: accountingLedgerPubkey,
      });
      setMessage(`Created buyer ledger ${pubkey}`);
      const createdLedger = await service.getBuyerLedger(pubkey);
      if (createdLedger) {
        setRows((current) => [...current.filter((row) => row.pubkey !== pubkey), createdLedger]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Buyer Ledgers" subtitle="Configure AP subledgers for Anchor buyer workflows." />
      {message ? <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">{message}</p> : null}
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-900">Create Buyer AP Ledger</h2>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <Input
            label="Ledger Code"
            value={ledgerCode}
            onChange={(event) => setLedgerCode(event.target.value.toUpperCase())}
            placeholder="AP-NA-2026"
          />
          <p className="-mt-1 text-[10px] text-slate-500 md:col-span-2">
            Use the format <span className="font-mono">AP-{`{REGION}`}-{`{YYYY}`}</span>, for example{' '}
            <span className="font-mono">AP-NA-2026</span>.
          </p>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
            <span>Base GL Ledger</span>
            <select
              className="rounded-md border border-slate-300 bg-white px-2 py-2 text-xs text-slate-800"
              value={accountingLedgerPubkey}
              onChange={(event) => setAccountingLedgerPubkey(event.target.value)}
            >
              <option value="">Select accounting ledger</option>
              {accountingLedgers.map((ledger) => {
                const pubkey = ledger.pubkey || "";
                const code = ledger.account?.ledgerCode || ledger.ledgerCode || "(no code)";
                return (
                  <option key={pubkey} value={pubkey}>
                    {code} ({pubkey})
                  </option>
                );
              })}
            </select>
          </label>
          <Input label="AP Control Code" value={apControlAccountCode} onChange={(event) => setApControlAccountCode(event.target.value)} />
          <Input label="Purchase Account Code" value={purchaseAccountCode} onChange={(event) => setPurchaseAccountCode(event.target.value)} />
          <Input label="Cash Account Code" value={cashAccountCode} onChange={(event) => setCashAccountCode(event.target.value)} />
        </div>
        <div className="mt-3">
          <Button disabled={!wallet || busy} onClick={handleCreate}>Create Buyer Ledger</Button>
        </div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-900">Buyer Ledger Inventory</h2>
        <div className="mt-2 space-y-2">
          {rows.map((row) => (
            <div key={row.pubkey} className="rounded-md border border-slate-200 px-3 py-2 text-[11px] text-slate-600">
              <p className="font-semibold text-slate-900">{row.ledgerCode}</p>
              <p className="font-mono">{row.pubkey}</p>
              <p>AP {row.apControlAccountCode} | Purchase {row.purchaseAccountCode} | Cash {row.cashAccountCode}</p>
            </div>
          ))}
          {rows.length === 0 ? <p className="text-[11px] text-slate-500">No buyer ledgers loaded.</p> : null}
        </div>
      </section>
    </div>
  );
}
