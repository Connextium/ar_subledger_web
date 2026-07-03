"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import GlSetupComponent from "@/components/accounting/gl-setup";
import JournalEntriesComponent from "@/components/accounting/journal-entries";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageTitle } from "@/components/ui/page-title";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import { useArSubledger } from "@/hooks/use-ar-subledger";
import { BuyerLedgerRecord, LedgerRecord } from "@/lib/types/domain";
import { AccountingLedger, accountingEngineService } from "@/lib/api-client/v1/accounting";
import { createApSubledgerService } from "@/lib/api-client/v1/buyer";

export default function BaseGlAccountingManagePage() {
  const params = useParams();
  const glPubkey = params?.glPubkey as string;
  const { wallet } = useEmbeddedWallet();
  const arSubledgerService = useArSubledger();
  const apSubledgerService = useMemo(() => (wallet ? createApSubledgerService(wallet) : null), [wallet]);

  const [baseGl, setBaseGl] = useState<AccountingLedger | null>(null);
  const [linkedSupplierLedgers, setLinkedSupplierLedgers] = useState<LedgerRecord[]>([]);
  const [linkedBuyerLedgers, setLinkedBuyerLedgers] = useState<BuyerLedgerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!glPubkey) {
      setError("Base GL not found");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const [ledger, supplierLedgers, buyerLedgers] = (await Promise.all([
        accountingEngineService.getLedger(glPubkey),
        arSubledgerService ? arSubledgerService.listLedgers() : Promise.resolve([]),
        apSubledgerService ? apSubledgerService.listBuyerLedgers() : Promise.resolve([]),
      ])) as [AccountingLedger | null, LedgerRecord[], BuyerLedgerRecord[]];

      if (!ledger) {
        throw new Error("Base GL not found");
      }

      setBaseGl(ledger);
      setLinkedSupplierLedgers(supplierLedgers.filter((row) => row.accountingLedger === glPubkey));
      setLinkedBuyerLedgers(buyerLedgers.filter((row) => row.accountingLedger === glPubkey));
    } catch (err) {
      setBaseGl(null);
      setLinkedSupplierLedgers([]);
      setLinkedBuyerLedgers([]);
      setError(err instanceof Error ? err.message : "Failed to load Base GL");
    } finally {
      setLoading(false);
    }
  }, [apSubledgerService, arSubledgerService, glPubkey]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const allowedInitializationTypes = useMemo<Array<"ar" | "ap">>(() => {
    const types: Array<"ar" | "ap"> = [];
    if (linkedSupplierLedgers.length > 0) types.push("ar");
    if (linkedBuyerLedgers.length > 0) types.push("ap");
    return types;
  }, [linkedBuyerLedgers.length, linkedSupplierLedgers.length]);

  const defaultInitializationType: "ar" | "ap" =
    linkedBuyerLedgers.length > 0 && linkedSupplierLedgers.length === 0 ? "ap" : "ar";

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading...</div>;
  }

  if (error || !baseGl) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error || "Base GL not found"}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <PageTitle title="Base GL - Accounting Management" />
        <p className="mt-1 text-gray-600">Base GL ( COA ): {baseGl.account?.ledgerCode ?? baseGl.ledgerCode ?? "-"}</p>
        <p className="mt-1 font-mono text-xs text-gray-500">{glPubkey}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Linked Supplier Ledgers</h3>
          <p className="mt-2 text-2xl font-bold text-slate-900">{linkedSupplierLedgers.length}</p>
        </section>
        <section className="rounded-lg border bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Linked Buyer Ledgers</h3>
          <p className="mt-2 text-2xl font-bold text-slate-900">{linkedBuyerLedgers.length}</p>
        </section>
      </div>

      {allowedInitializationTypes.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Link at least one Supplier AR or Buyer AP ledger to this Base GL before initializing GL accounts.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-lg border-2 border-blue-100 bg-blue-50 p-6">
        <GlSetupComponent
          ledgerKey={glPubkey}
          generalLedgerId={`base-gl:${glPubkey}`}
          defaultInitializationType={defaultInitializationType}
          allowedInitializationTypes={allowedInitializationTypes}
        />
      </div>

      <div>
        <JournalEntriesComponent ledgerKey={glPubkey} generalLedgerId={`base-gl:${glPubkey}`} />
      </div>
    </div>
  );
}
