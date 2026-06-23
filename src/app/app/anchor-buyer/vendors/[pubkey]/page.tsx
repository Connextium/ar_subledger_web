"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageTitle } from "@/components/ui/page-title";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import { useWorkspace } from "@/context/workspace-context";
import type {
  BuyerLedgerRecord,
  VendorRecord,
  WorkspaceVendor,
  WorkspaceVendorLedgerLink,
  WorkspaceVendorStatus,
} from "@/lib/types/domain";
import { createApSubledgerService } from "@/services/ap-subledger-service";
import { controlPlaneService } from "@/services/control-plane-service";

export default function VendorDetailPage() {
  const params = useParams();
  const vendorPubkey = params?.pubkey as string;
  const { wallet } = useEmbeddedWallet();
  const { selectedWorkspaceId, workspaces } = useWorkspace();
  const service = useMemo(() => (wallet ? createApSubledgerService(wallet) : null), [wallet]);

  const [vendor, setVendor] = useState<VendorRecord | null>(null);
  const [buyerLedger, setBuyerLedger] = useState<BuyerLedgerRecord | null>(null);
  const [workspaceVendor, setWorkspaceVendor] = useState<WorkspaceVendor | null>(null);
  const [vendorLink, setVendorLink] = useState<WorkspaceVendorLedgerLink | null>(null);
  const [vendorRef, setVendorRef] = useState("");
  const [legalName, setLegalName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [status, setStatus] = useState<WorkspaceVendorStatus>("active");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const activeWorkspaceId = selectedWorkspaceId ?? workspaces[0]?.id ?? null;

  const loadData = useCallback(async () => {
    if (!service || !vendorPubkey) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      const [vendors, buyerLedgers] = await Promise.all([
        service.listVendors(),
        service.listBuyerLedgers(),
      ]);
      const nextVendor = vendors.find((row) => row.pubkey === vendorPubkey) ?? null;
      setVendor(nextVendor);
      setBuyerLedger(buyerLedgers.find((row) => row.pubkey === nextVendor?.ledger) ?? null);

      if (!activeWorkspaceId || !nextVendor) {
        setWorkspaceVendor(null);
        setVendorLink(null);
        return;
      }

      const [workspaceVendors, vendorLinks] = await Promise.all([
        controlPlaneService.listWorkspaceVendors(activeWorkspaceId),
        controlPlaneService.listWorkspaceVendorLedgerLinks({
          workspaceId: activeWorkspaceId,
          ledgerPda: nextVendor.ledger,
        }),
      ]);
      const nextLink = vendorLinks.find((link) => link.onchainVendorPubkey === nextVendor.pubkey) ?? null;
      const nextWorkspaceVendor =
        workspaceVendors.find((row) => row.id === nextLink?.workspaceVendorId) ?? null;

      setVendorLink(nextLink);
      setWorkspaceVendor(nextWorkspaceVendor);
      setVendorRef(nextWorkspaceVendor?.vendorRef ?? nextVendor.vendorCode);
      setLegalName(nextWorkspaceVendor?.legalName ?? nextVendor.vendorName);
      setTaxId(nextWorkspaceVendor?.taxId ?? "");
      setStatus(nextWorkspaceVendor?.status ?? "active");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, service, vendorPubkey]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleSave() {
    if (!activeWorkspaceId || !vendor) return;
    setBusy(true);
    setMessage(null);
    try {
      const nextWorkspaceVendor = workspaceVendor
        ? await controlPlaneService.updateWorkspaceVendor({
            workspaceId: activeWorkspaceId,
            vendorId: workspaceVendor.id,
            vendorRef,
            legalName,
            taxId: taxId || null,
            status,
          })
        : await controlPlaneService.createWorkspaceVendor({
            workspaceId: activeWorkspaceId,
            vendorRef,
            legalName,
            taxId: taxId || null,
          });

      if (!vendorLink) {
        await controlPlaneService.upsertWorkspaceVendorLedgerLink({
          workspaceId: activeWorkspaceId,
          workspaceVendorId: nextWorkspaceVendor.id,
          ledgerPda: vendor.ledger,
          onchainVendorPubkey: vendor.pubkey,
          vendorCode: vendor.vendorCode,
        });
      }

      setWorkspaceVendor(nextWorkspaceVendor);
      setMessage("Vendor metadata updated. On-chain vendor is immutable and was not changed.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-sm text-slate-500">Loading vendor...</div>;
  }

  if (!vendor) {
    return (
      <div className="space-y-3">
        <PageTitle title="Vendor Detail" />
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          Vendor not found.
        </p>
        <Link href="/app/anchor-buyer/vendors" className="text-xs font-medium text-blue-600 hover:text-blue-700">
          Back to Vendors
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Vendor Detail" subtitle="Update off-chain workspace metadata for an immutable on-chain vendor." />
      <Link href="/app/anchor-buyer/vendors" className="text-xs font-medium text-blue-600 hover:text-blue-700">
        Back to Vendors
      </Link>

      {message ? <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">{message}</p> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-900">On-chain Vendor</h2>
        <p className="mt-1 text-[11px] text-slate-500">On-chain vendor is immutable. Edit workspace metadata below.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div className="rounded-md border border-slate-200 px-3 py-2 text-[11px] text-slate-600">
            <p className="font-semibold text-slate-900">Buyer Ledger</p>
            <p>{buyerLedger?.ledgerCode ?? "Unknown Buyer Ledger"}</p>
            <p className="font-mono">{vendor.ledger}</p>
          </div>
          <div className="rounded-md border border-slate-200 px-3 py-2 text-[11px] text-slate-600">
            <p className="font-semibold text-slate-900">{vendor.vendorCode} | {vendor.vendorName}</p>
            <p className="font-mono">{vendor.pubkey}</p>
            <p>Status {vendor.status} | Open payable {vendor.totalOpenPayable}</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-900">Workspace Vendor Metadata</h2>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <Input label="Vendor Ref" value={vendorRef} onChange={(event) => setVendorRef(event.target.value.toUpperCase())} />
          <Input label="Vendor Legal Name" value={legalName} onChange={(event) => setLegalName(event.target.value)} />
          <Input label="Tax ID" value={taxId} onChange={(event) => setTaxId(event.target.value)} />
          <Select
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value as WorkspaceVendorStatus)}
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "archived", label: "Archived" },
            ]}
          />
        </div>
        <div className="mt-3">
          <Button disabled={!activeWorkspaceId || busy || !vendorRef || !legalName} onClick={handleSave}>
            {busy ? "Saving..." : "Save Vendor Metadata"}
          </Button>
        </div>
      </section>
    </div>
  );
}
