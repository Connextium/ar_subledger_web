"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import GlSetupComponent from "@/components/accounting/gl-setup";
import JournalEntriesComponent from "@/components/accounting/journal-entries";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageTitle } from "@/components/ui/page-title";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import type { BuyerLedgerRecord } from "@/lib/types/domain";
import { createApSubledgerService } from "@/lib/api-client/v1/buyer";
import { AlertCircle } from "lucide-react";

export default function BuyerLedgerAccountingPage() {
  const params = useParams();
  const ledgerPubkey = params?.pubkey as string;
  const { wallet } = useEmbeddedWallet();
  const service = useMemo(() => (wallet ? createApSubledgerService(wallet) : null), [wallet]);

  const [ledger, setLedger] = useState<BuyerLedgerRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLedger = useCallback(async () => {
    if (!ledgerPubkey) {
      setError("Buyer ledger not found");
      setLoading(false);
      return;
    }

    if (!service) {
      setLedger(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const row = await service.getBuyerLedger(ledgerPubkey);
      if (!row) {
        throw new Error("Buyer ledger not found");
      }
      setLedger(row);
    } catch (err) {
      setLedger(null);
      setError(err instanceof Error ? err.message : "Failed to load buyer ledger");
    } finally {
      setLoading(false);
    }
  }, [ledgerPubkey, service]);

  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading...</div>;
  }

  if (error || !ledger) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error || "Buyer ledger not found"}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <PageTitle title="Base GL - Accounting Management" />
        <p className="mt-1 text-gray-600">Base GL ( COA ) / Buyer Ledger: {ledger.ledgerCode}</p>
        <p className="mt-1 font-mono text-xs text-gray-500">{ledger.accountingLedger}</p>
      </div>

      <div className="rounded-lg border-2 border-blue-100 bg-blue-50 p-6">
        <GlSetupComponent
          ledgerKey={ledger.accountingLedger}
          generalLedgerId={`buyer:${ledger.pubkey}`}
          defaultInitializationType="ap"
        />
      </div>

      <div>
        <JournalEntriesComponent ledgerKey={ledger.accountingLedger} generalLedgerId={`buyer:${ledger.pubkey}`} />
      </div>
    </div>
  );
}
