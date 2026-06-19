"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageTitle } from "@/components/ui/page-title";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import type { BuyerLedgerRecord, VendorRecord } from "@/lib/types/domain";
import { createApSubledgerService } from "@/services/ap-subledger-service";

export default function VendorsPage() {
  const { wallet } = useEmbeddedWallet();
  const service = useMemo(() => (wallet ? createApSubledgerService(wallet) : null), [wallet]);
  const [rows, setRows] = useState<VendorRecord[]>([]);
  const [buyerLedgers, setBuyerLedgers] = useState<BuyerLedgerRecord[]>([]);
  const [ledgerPubkey, setLedgerPubkey] = useState("");
  const [vendorCode, setVendorCode] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!service) {
      setRows([]);
      setBuyerLedgers([]);
      return;
    }
    Promise.all([
      service.listVendors().then(setRows),
      service.listBuyerLedgers().then((ledgers) => {
        setBuyerLedgers(ledgers);
        // Auto-select the first ledger
        if (ledgers.length > 0 && !ledgerPubkey) {
          setLedgerPubkey(ledgers[0].pubkey);
        }
      }),
    ]).catch((error) => setMessage(String(error)));
  }, [service, ledgerPubkey]);

  async function handleCreate() {
    if (!service) return;
    setBusy(true);
    setMessage(null);
    try {
      const pubkey = await service.createVendor({ ledgerPubkey, vendorCode, vendorName });
      setMessage(`Created vendor ${pubkey}`);
      setVendorCode("");
      setVendorName("");
      setRows(await service.listVendors());
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
        <div className="mt-2 space-y-2">
          {rows.map((row) => (
            <div key={row.pubkey} className="rounded-md border border-slate-200 px-3 py-2 text-[11px] text-slate-600">
              <p className="font-semibold text-slate-900">{row.vendorCode} | {row.vendorName}</p>
              <p className="font-mono">{row.pubkey}</p>
              <p>Open payable {row.totalOpenPayable} | Paid {row.totalPaid}</p>
            </div>
          ))}
          {rows.length === 0 ? <p className="text-[11px] text-slate-500">No vendors loaded.</p> : null}
        </div>
      </section>
    </div>
  );
}
