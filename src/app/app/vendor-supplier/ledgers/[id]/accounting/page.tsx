"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/context/workspace-context";
import GlSetupComponent from "@/components/accounting/gl-setup";
import JournalEntriesComponent from "@/components/accounting/journal-entries";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export default function LedgerAccountingPage() {
  const params = useParams();
  const ledgerId = params?.id as string;
  const { selectedWorkspaceId } = useWorkspace();

  const [ledger, setLedger] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLedger = useCallback(async () => {
    if (!ledgerId || !selectedWorkspaceId) {
      setError("Workspace or ledger not found");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("ledgers")
        .select("*")
        .eq("id", ledgerId)
        .eq("workspace_id", selectedWorkspaceId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      setLedger(data);
    } catch (err) {
      console.error("Error loading ledger:", err);
      setError(err instanceof Error ? err.message : "Failed to load ledger");
    } finally {
      setLoading(false);
    }
  }, [ledgerId, selectedWorkspaceId]);

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
        <AlertDescription>
          {error || "Ledger not found"}
          <div className="mt-2 text-xs text-gray-500">
            <div>Debug info:</div>
            <div>ledgerId: {ledgerId}</div>
            <div>selectedWorkspaceId: {selectedWorkspaceId}</div>
            <div>ledger: <pre>{JSON.stringify(ledger, null, 2)}</pre></div>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  const ledgerKey = ledger.onchain_ledger_key;

  if (!ledgerKey) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Ledger does not have an on-chain key
          <div className="mt-2 text-xs text-gray-500">
            <div>Debug info:</div>
            <div>ledgerId: {ledgerId}</div>
            <div>selectedWorkspaceId: {selectedWorkspaceId}</div>
            <div>ledger: <pre>{JSON.stringify(ledger, null, 2)}</pre></div>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Base GL - Accounting Management</h2>
        <p className="mt-1 text-gray-600">Base GL ( COA ) / Ledger: {ledger.code}</p>
      </div>

      {/* GL Account Setup */}
      <div className="rounded-lg border-2 border-blue-100 bg-blue-50 p-6">
        <GlSetupComponent ledgerKey={ledgerKey} generalLedgerId={ledgerId} />
      </div>

      {/* Journal Entries */}
      <div>
        <JournalEntriesComponent ledgerKey={ledgerKey} generalLedgerId={ledgerId} />
      </div>
    </div>
  );
}
