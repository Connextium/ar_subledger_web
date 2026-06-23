"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageTitle } from "@/components/ui/page-title";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import { useWorkspace } from "@/context/workspace-context";
import type { BuyerLedgerRecord, VendorRecord } from "@/lib/types/domain";
import { createApSubledgerService } from "@/services/ap-subledger-service";
import { filterBuyerLedgersByWorkspaceLinks } from "@/services/buyer-ledger-workspace";
import { controlPlaneService } from "@/services/control-plane-service";

export default function VendorsPage() {
  const { wallet } = useEmbeddedWallet();
  const { selectedWorkspaceId, workspaces } = useWorkspace();
  const service = useMemo(() => (wallet ? createApSubledgerService(wallet) : null), [wallet]);
  const [rows, setRows] = useState<VendorRecord[]>([]);
  const [buyerLedgers, setBuyerLedgers] = useState<BuyerLedgerRecord[]>([]);
  const [ledgerPubkey, setLedgerPubkey] = useState("");
  const [vendorCode, setVendorCode] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const activeWorkspaceId = selectedWorkspaceId ?? workspaces[0]?.id ?? null;

  useEffect(() => {
    setRows([]);
    setBuyerLedgers([]);
    setLedgerPubkey("");

    if (!service || !activeWorkspaceId) {
      return;
    }

    let cancelled = false;
    void Promise.all([
      service.listBuyerLedgers(),
      controlPlaneService.listBuyerLedgerLinks(activeWorkspaceId),
      controlPlaneService.listLedgerLinks(activeWorkspaceId),
    ])
      .then(([ledgers, links, workspaceLedgerLinks]) => {
        if (cancelled) return;
        const scopedLedgers = filterBuyerLedgersByWorkspaceLinks(ledgers, links, workspaceLedgerLinks);
        setBuyerLedgers(scopedLedgers);
        setLedgerPubkey(scopedLedgers[0]?.pubkey ?? "");
      })
      .catch((error) => {
        if (!cancelled) setMessage(String(error));
      });

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, service]);

  useEffect(() => {
    if (!service || !ledgerPubkey) {
      setRows([]);
      return;
    }

    let cancelled = false;
    void service
      .listVendors(ledgerPubkey)
      .then((vendors) => {
        if (!cancelled) setRows(vendors);
      })
      .catch((error) => {
        if (!cancelled) setMessage(String(error));
      });

    return () => {
      cancelled = true;
    };
  }, [service, ledgerPubkey]);

  async function handleCreate() {
    if (!service) return;
    setBusy(true);
    setMessage(null);
    try {
      if (!activeWorkspaceId) {
        throw new Error("Select a workspace before creating vendor metadata.");
      }
      const pubkey = await service.createVendor({ ledgerPubkey, vendorCode, vendorName });
      const workspaceVendor = await controlPlaneService.createWorkspaceVendor({
        workspaceId: activeWorkspaceId,
        vendorRef: vendorCode,
        legalName: vendorName,
        taxId: null,
      });
      await controlPlaneService.upsertWorkspaceVendorLedgerLink({
        workspaceId: activeWorkspaceId,
        workspaceVendorId: workspaceVendor.id,
        ledgerPda: ledgerPubkey,
        onchainVendorPubkey: pubkey,
        vendorCode,
      });
      setMessage(`Created vendor ${pubkey}`);
      setVendorCode("");
      setVendorName("");
      setRows(await service.listVendors(ledgerPubkey));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Vendors" subtitle="Maintain supplier master records for buyer AP ledgers." />
      {message ? <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">{message}</p> : null}
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-900">Create Vendor</h2>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <Select
            label="Buyer Ledger"
            value={ledgerPubkey}
            onChange={(event) => setLedgerPubkey(event.target.value)}
            disabled={buyerLedgers.length === 0}
            options={[
              { value: "", label: "Select a buyer ledger..." },
              ...buyerLedgers.map((ledger) => ({
                value: ledger.pubkey,
                label: `${ledger.ledgerCode} (${ledger.pubkey.slice(0, 8)}...)`,
              })),
            ]}
          />
          <Input label="Vendor Code" value={vendorCode} onChange={(event) => setVendorCode(event.target.value)} />
          <Input label="Vendor Name" value={vendorName} onChange={(event) => setVendorName(event.target.value)} />
        </div>
        <div className="mt-3"><Button disabled={!wallet || busy || !ledgerPubkey} onClick={handleCreate}>Create Vendor</Button></div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-900">Vendor Inventory</h2>
        <p className="mt-1 text-[11px] text-slate-500">
          Showing vendors for the selected Buyer Ledger only.
        </p>
        <div className="mt-2 space-y-2">
          {rows.map((row) => (
            <Link
              key={row.pubkey}
              href={`/app/anchor-buyer/vendors/${row.pubkey}`}
              className="block rounded-md border border-slate-200 px-3 py-2 text-[11px] text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            >
              <p className="font-semibold text-slate-900">{row.vendorCode} | {row.vendorName}</p>
              <p className="font-mono">{row.pubkey}</p>
              <p>Open payable {row.totalOpenPayable} | Paid {row.totalPaid}</p>
            </Link>
          ))}
          {rows.length === 0 ? <p className="text-[11px] text-slate-500">No vendors loaded.</p> : null}
        </div>
      </section>
    </div>
  );
}
